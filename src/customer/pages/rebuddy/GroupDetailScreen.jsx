import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft, FaPlus, FaShareAlt, FaTrashAlt, FaUserPlus, FaTimes,
  FaReceipt, FaHandshake, FaCheckCircle, FaAddressBook, FaHourglassHalf, FaCheck, FaPen, FaSyncAlt, FaArchive, FaSignOutAlt,
} from "react-icons/fa";
import { useToast } from "../../context/ToastContext";
import {
  RB, formatMoney, memberMap, newId,
  simplifySettlements, computeBalances,
  selfMember, settlementInitialStatus, pendingForViewer,
} from "./utils";
import { pickContacts, normalizeMobile, isValidMobile, isUserCancelledError } from "./contacts";
import { rebuddyService } from "../../services/rebuddyService";
import { server_api } from "../../../utils/constants";

const TABS = [
  { key: "expenses", label: "Expenses", icon: FaReceipt },
  { key: "settle", label: "Settle up", icon: FaHandshake },
];

// Compact date+time for expense / settlement entries, e.g. "10 Jun 2026, 7:26 PM".
const fmtWhen = (ms) => {
  if (!ms) return "";
  try {
    return new Date(Number(ms)).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return "";
  }
};

const isPendingExpense = (expense) => expense?.status === "pending";
const isApprovedExpense = (expense) => !isPendingExpense(expense);
const memberRequiresExpenseApproval = (member, isOwner = false) =>
  !isOwner && member?.expenseApprovalRequired !== false;

// `publicView` renders the read-only shared-link version: served by a public
// route (no login), fetched from the public masked endpoint, with every
// mutation control and cross-page navigation hidden so the recipient can only
// view this one group and nothing else in the app.
const GroupDetailScreen = ({ publicView = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [group, setGroup] = useState(null);
  const [tab, setTab] = useState("expenses");
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [memberModal, setMemberModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null); // { from, to, amount }
  const [settleSuccess, setSettleSuccess] = useState(null); // { from, to, amount, settled }
  const [gatewaySettled, setGatewaySettled] = useState(null); // { amount, payeeName } — confetti popup
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [revealedMobile, setRevealedMobile] = useState({}); // member id → show number

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await (publicView ? rebuddyService.getPublicGroup(id) : rebuddyService.getGroup(id));
      if (!alive) return;
      if (!res.success || !res.data) {
        toast?.showToast?.(res.message || "Group not found.", "error");
        // In public/shared mode don't bounce to the groups list (the recipient
        // isn't allowed there) — just surface the error on this page.
        if (!publicView) navigate("/customer/app/rebuddy", { replace: true });
        return;
      }
      setGroup(res.data);
    })();
    return () => { alive = false; };
  }, [id, navigate, toast, publicView]);

  // Optimistically render the new state, then persist server-side. On failure
  // roll back to the last known-good group and surface the error.
  const persist = async (next) => {
    const prev = group;
    setGroup(next);
    const res = await rebuddyService.saveGroup(next);
    if (!res.success) {
      setGroup(prev);
      toast?.showToast?.(res.message || "Could not save changes. Please try again.", "error");
      return false;
    }
    if (res.data) setGroup(res.data);
    return true;
  };

  // Pull the latest group document from the server so entries added by other
  // members (on their own devices) show up here.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const res = await (publicView ? rebuddyService.getPublicGroup(id) : rebuddyService.getGroup(id));
    setRefreshing(false);
    if (!res.success || !res.data) {
      toast?.showToast?.(res.message || "Could not refresh. Please try again.", "error");
      return;
    }
    setGroup(res.data);
    toast?.showToast?.("Up to date.", "success");
  };

  // Start an online "Pay & Settle": the backend creates a HDFC SmartGateway
  // order and returns a payment link. We redirect the payer there; on return
  // (`?settle=1`) the effect below reconciles and the payee's wallet is credited
  // — no manual confirmation from the receiver.
  const handlePayAndSettle = async ({ from, to, amount, note }) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast?.showToast?.("Enter a valid amount.", "error"); return; }
    setSettleTarget(null);
    toast?.showToast?.("Starting secure payment…", "info");
    // The gateway POSTs the return URL after payment, so it MUST hit the backend
    // (a static SPA host answers that POST with HTTP 405 and the payment is lost).
    // The backend callback reconciles + credits the wallet, then 302-redirects
    // back to this group screen with `?settle=1`. Mirrors the RYBBO flow.
    const apiBase = (server_api() || "").replace(/\/$/, "");
    const appOrigin = encodeURIComponent(window.location.origin);
    const returnUrl = `${apiBase}/RebuddySettlementCallback?app=${appOrigin}`;
    const res = await rebuddyService.initiateSettlement({
      groupId: group.id, fromId: from, toId: to, amount: amt, note: (note || "").trim(), returnUrl,
    });
    if (!res.success || !res.data?.paymentUrl) {
      toast?.showToast?.(res.message || "Could not start the payment.", "error");
      return;
    }
    try { localStorage.setItem("vb_rebuddy_settle_order", res.data.orderId); } catch {}
    window.location.href = res.data.paymentUrl;
  };

  // After returning from the gateway (`?settle=1`, with the gateway appending
  // `order_id`), verify the payment server-side and refresh the group.
  useEffect(() => {
    if (publicView || searchParams.get("settle") !== "1") return;
    const orderId = searchParams.get("order_id") || (() => {
      try { return localStorage.getItem("vb_rebuddy_settle_order"); } catch { return null; }
    })();
    if (!orderId) { navigate(`/customer/app/rebuddy/group/${id}`, { replace: true }); return; }
    let alive = true;
    (async () => {
      setVerifyingPayment(true);
      const res = await rebuddyService.confirmSettlement(orderId);
      if (!alive) return;
      setVerifyingPayment(false);
      try { localStorage.removeItem("vb_rebuddy_settle_order"); } catch {}
      const st = res?.data?.status;
      if (res.success && st === "SETTLED") {
        // Celebrate with the confetti popup instead of a plain toast.
        setGatewaySettled({
          amount: res.data?.amount ?? 0,
          payeeName: res.data?.payeeName || "their",
        });
      } else if (st === "PENDING") {
        toast?.showToast?.("Payment is being verified. Try Refresh in a moment.", "info");
      } else {
        toast?.showToast?.(res.message || "Payment was not completed.", "error");
      }
      navigate(`/customer/app/rebuddy/group/${id}`, { replace: true });
      await handleRefresh();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, publicView]);

  const settle = useMemo(() => (group ? simplifySettlements(group) : []), [group]);
  const balances = useMemo(() => (group ? computeBalances(group) : {}), [group]);
  const total = useMemo(
    () => (group?.expenses || []).filter(isApprovedExpense).reduce((s, e) => s + Number(e.amount || 0), 0),
    [group]
  );
  const mMap = useMemo(() => memberMap(group), [group]);
  const self = useMemo(() => selfMember(group), [group]);
  const pendingToConfirm = useMemo(
    () => (group && self ? pendingForViewer(group, self.id) : []),
    [group, self]
  );

  const closeExpenseModal = () => { setExpenseModal(false); setEditingExpense(null); };

  const handleSaveExpense = async (exp) => {
    const editing = !!editingExpense;
    const needsApproval = !!self && memberRequiresExpenseApproval(mMap[self.id], viewerIsCreator);
    const approvalPatch = needsApproval
      ? { status: "pending", approvedBy: null, approvedAt: null }
      : { status: "approved", approvedBy: editingExpense?.approvedBy || self?.id || null, approvedAt: editingExpense?.approvedAt || Date.now() };
    const next = editing
      ? {
          ...group,
          expenses: (group.expenses || []).map((e) =>
            e.id === editingExpense.id ? { ...e, ...exp, ...approvalPatch, updatedAt: Date.now() } : e
          ),
        }
      : { ...group, expenses: [{ id: newId("e"), createdAt: Date.now(), createdBy: self?.id, ...approvalPatch, ...exp }, ...(group.expenses || [])] };
    closeExpenseModal();
    if (await persist(next)) {
      toast?.showToast?.(
        needsApproval ? "Expense sent for admin approval." : (editing ? "Expense updated." : "Expense added."),
        "success"
      );
    }
  };

  const handleApproveExpense = async (exp) => {
    const next = {
      ...group,
      expenses: (group.expenses || []).map((e) =>
        e.id === exp.id ? { ...e, status: "approved", approvedBy: self?.id || null, approvedAt: Date.now(), updatedAt: Date.now() } : e
      ),
    };
    if (await persist(next)) toast?.showToast?.("Expense approved and added to split.", "success");
  };

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Delete "${exp.description || "this expense"}" (${formatMoney(exp.amount, group.currency)})? This cannot be undone.`)) return;
    if (await persist({ ...group, expenses: (group.expenses || []).filter((e) => e.id !== exp.id) })) {
      toast?.showToast?.("Expense removed.", "info");
    }
  };

  // Record a payment between two members. If the viewer IS the creditor (`to`,
  // the receiver), it auto-confirms and settles immediately; otherwise it's
  // logged as pending until the creditor confirms they received the money.
  const handleRecordSettlement = async ({ from, to, amount, note }) => {
    const amt = parseFloat(amount);
    if (!from || !to || from === to) { toast?.showToast?.("Pick who paid whom.", "error"); return; }
    if (!amt || amt <= 0) { toast?.showToast?.("Enter a valid amount.", "error"); return; }
    const createdBy = self?.id || from;
    const status = settlementInitialStatus(createdBy, to);
    const now = Date.now();
    const settlement = {
      id: newId("s"),
      from, to, amount: amt,
      note: (note || "").trim(),
      mode: "manual",
      createdBy, status,
      createdAt: now,
      confirmedAt: status === "confirmed" ? now : null,
    };
    setSettleTarget(null);
    const next = { ...group, settlements: [settlement, ...(group.settlements || [])] };
    if (await persist(next)) {
      // Confirm the entry with an explicit success popup. Dismissing it pulls
      // the latest group from the server so the outstanding balance is fresh.
      setSettleSuccess({ from, to, amount: amt, settled: status === "confirmed" });
    }
  };

  // Close the post-settlement success popup and refresh the outstanding amount
  // from the server so this screen reflects the just-recorded payment.
  const handleSettleSuccessDone = async () => {
    setSettleSuccess(null);
    await handleRefresh();
  };

  const handleConfirmSettlement = async (sid) => {
    const next = {
      ...group,
      settlements: (group.settlements || []).map((s) =>
        s.id === sid ? { ...s, status: "confirmed", confirmedAt: Date.now() } : s
      ),
    };
    if (await persist(next)) toast?.showToast?.("Payment confirmed — settled.", "success");
  };

  const handleDeleteSettlement = async (sid) => {
    if (!window.confirm("Remove this payment record?")) return;
    const next = {
      ...group,
      settlements: (group.settlements || []).filter((s) => s.id !== sid),
    };
    if (await persist(next)) toast?.showToast?.("Payment record removed.", "info");
  };

  const handleAddMember = async ({ name, mobile, expenseApprovalRequired = true }) => {
    const trimmed = (name || "").trim();
    const num = normalizeMobile(mobile);
    if (!trimmed) { toast?.showToast?.("Enter the member's name.", "error"); return; }
    if (!isValidMobile(num)) { toast?.showToast?.("Enter a valid 10-digit mobile number.", "error"); return; }
    if (group.members.some((m) => m.mobile === num)) {
      toast?.showToast?.("That mobile number is already in the group.", "error");
      return;
    }
    setMemberModal(false);
    if (await persist({ ...group, members: [...group.members, { id: newId("m"), name: trimmed, mobile: num, expenseApprovalRequired }] })) {
      toast?.showToast?.("Member added.", "success");
    }
  };

  const handleAddContacts = async (picked) => {
    const have = new Set(group.members.map((m) => m.mobile));
    const fresh = picked
      .filter((c) => !have.has(c.mobile))
      .map((c) => ({ id: newId("m"), name: c.name, mobile: c.mobile, expenseApprovalRequired: true }));
    if (!fresh.length) { toast?.showToast?.("No new contacts to add.", "info"); return; }
    setMemberModal(false);
    if (await persist({ ...group, members: [...group.members, ...fresh] })) {
      toast?.showToast?.(`${fresh.length} member${fresh.length > 1 ? "s" : ""} added.`, "success");
    }
  };

  const handleRemoveMember = async (member) => {
    if (member.isSelf) { toast?.showToast?.("You can't remove yourself.", "error"); return; }
    const inExpense = (group.expenses || []).some(
      (e) => e.paidBy === member.id || (e.splitAmong || []).includes(member.id)
    );
    if (inExpense) {
      toast?.showToast?.("This member is part of an expense. Remove those expenses first.", "error");
      return;
    }
    if (!window.confirm(`Remove ${member.name} from the group?`)) return;
    if (await persist({ ...group, members: group.members.filter((m) => m.id !== member.id) })) {
      toast?.showToast?.("Member removed.", "info");
    }
  };

  const handleShare = async () => {
    // Always share the public production link (not localhost / the current
    // origin). The group page is public (login-free, view-only for outsiders),
    // so the message carries exactly ONE link — the group URL. A separate
    // register link confused recipients: share targets append `url` after
    // `text`, so two URLs ran together in the message body.
    const base = "https://web.vasbazaar.com";
    const groupUrl = `${base}/customer/rebuddy/group/${group.id}`;
    // Full message (used for clipboard).
    const fullText =
      `Hey!\n\n` +
      `View our "${group.name}" group to split and track trip expenses easily:\n` +
      `${groupUrl}`;
    // Share-sheet text: keep the link out of the body and pass it as the
    // canonical `url` so the OS preview card points at the group page.
    const shareText =
      `Hey!\n\n` +
      `View our "${group.name}" group to split and track trip expenses easily:`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `ReBuddy · ${group.name}`, text: shareText, url: groupUrl });
      } else {
        await navigator.clipboard.writeText(fullText);
        toast?.showToast?.("Invite copied to clipboard.", "success");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(fullText);
        toast?.showToast?.("Invite copied.", "success");
      } catch {
        toast?.showToast?.("Could not share link.", "error");
      }
    }
  };

  const handleLeaveGroup = async () => {
    // A member may leave only once their own balance is settled.
    if (self && Math.abs(balances[self.id] || 0) >= 1) {
      toast?.showToast?.("Settle your balance before leaving the group.", "error");
      return;
    }
    if (!window.confirm(`Leave "${group.name}"? You'll exit the group — everyone else keeps it with all entries intact.`)) return;
    const res = await rebuddyService.leaveGroup(group.id);
    if (!res.success) {
      toast?.showToast?.(res.message || "Could not leave the group.", "error");
      return;
    }
    toast?.showToast?.("You left the group.", "success");
    navigate("/customer/app/rebuddy", { replace: true });
  };

  const handleArchiveGroup = async () => {
    const archiving = !group.archived;
    const res = await rebuddyService.archiveGroup(group.id, archiving);
    if (!res.success) {
      toast?.showToast?.(res.message || "Could not update archive status.", "error");
      return;
    }
    setGroup(res.data || { ...group, archived: archiving });
    if (res.success) {
      toast?.showToast?.(archiving ? "Group archived." : "Group unarchived.", "success");
      if (archiving) navigate("/customer/app/rebuddy", { replace: true });
    }
  };

  // From the public shared page: stash a return path to the authed group, then
  // send the visitor to login. After they sign in they land back on the group
  // (full view) where they can use "Pay & Settle" (UPI).
  const handlePublicLoginToPay = () => {
    try { sessionStorage.setItem("vb_post_login_redirect", `/customer/app/rebuddy/group/${id}`); } catch {}
    navigate("/customer/login");
  };

  const handleDeleteGroup = async () => {
    // Block deletion while anyone still owes / is owed (≥ ₹1).
    const hasOutstanding = (group.members || []).some((m) => Math.abs(balances[m.id] || 0) >= 1);
    if (hasOutstanding) {
      toast?.showToast?.("Settle all balances before deleting this group.", "error");
      return;
    }
    if (!window.confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    const res = await rebuddyService.deleteGroup(group.id);
    if (!res.success) {
      toast?.showToast?.(res.message || "Could not delete the group.", "error");
      return;
    }
    navigate("/customer/app/rebuddy", { replace: true });
  };

  if (!group) return null;

  // Members display: keep the group creator ("Admin") and the viewer ("You")
  // pinned at the top; everyone else collapses behind a "view all members"
  // link. Only the creator may remove members.
  const ownerMob = group.ownerMobile ? normalizeMobile(group.ownerMobile) : null;
  const viewerIsCreator = !!self && !!ownerMob && normalizeMobile(self.mobile) === ownerMob;
  const isOwnerMember = (m) => !!ownerMob && normalizeMobile(m.mobile) === ownerMob;
  const allMembers = group.members || [];
  const creatorMember = allMembers.find(isOwnerMember);
  const selfChip = allMembers.find((m) => m.isSelf);
  const topMembers = [];
  if (creatorMember) topMembers.push(creatorMember);
  if (selfChip && selfChip !== creatorMember) topMembers.push(selfChip);
  // The public/shared view has no "self" or owner context (mobiles are masked),
  // so just show everyone there; the collapse only applies to the in-app view.
  const collapseMembers = !publicView && topMembers.length > 0;
  const restMembers = collapseMembers ? allMembers.filter((m) => !topMembers.includes(m)) : [];
  const shownMembers = collapseMembers
    ? (showAllMembers ? [...topMembers, ...restMembers] : topMembers)
    : allMembers;

  // The group can only be deleted once everyone is settled (no balance ≥ ₹1).
  const groupHasOutstanding = allMembers.some((m) => Math.abs(balances[m.id] || 0) >= 1);
  // A member can leave only once their OWN balance is settled.
  const viewerSettled = !self || Math.abs(balances[self.id] || 0) < 1;

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      <style>{"@keyframes rb-spin{to{transform:rotate(360deg)}}"}</style>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        {publicView ? (
          <span />
        ) : (
          <button
            type="button" onClick={() => navigate("/customer/app/rebuddy")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none", color: "inherit",
              fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0,
            }}
          >
            <FaArrowLeft size={11} /> All groups
          </button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button" onClick={handleRefresh} disabled={refreshing}
            aria-label="Refresh"
            title="Fetch latest entries"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999, border: `1px solid ${RB.coral}`,
              background: "transparent", color: RB.coral, fontSize: 12, fontWeight: 700,
              cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.6 : 1,
            }}
          >
            <FaSyncAlt size={11} style={refreshing ? { animation: "rb-spin 0.8s linear infinite" } : undefined} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button
            type="button" onClick={handleShare}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999, border: `1px solid ${RB.coral}`,
              background: "transparent", color: RB.coral, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <FaShareAlt size={11} /> Share
          </button>
          {/* Archive is per-member; delete remains creator-only. */}
          {!publicView && (
            <button
              type="button" onClick={handleArchiveGroup}
              aria-label={group.archived ? "Unarchive group" : "Archive group"}
              title={group.archived ? "Unarchive group" : "Archive group"}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "6px 10px", borderRadius: 999, border: `1px solid ${RB.borderDark}`,
                background: group.archived ? RB.coralSoft : "transparent",
                color: group.archived ? RB.coralDark : "var(--cm-muted, #A0A0A0)", cursor: "pointer",
              }}
            >
              <FaArchive size={11} />
            </button>
          )}
          {/* Non-creators can only leave the group (active once they're settled). */}
          {!publicView && !viewerIsCreator && (
            <button
              type="button" onClick={handleLeaveGroup}
              disabled={!viewerSettled}
              aria-label="Leave group"
              title={viewerSettled ? "Leave group" : "Settle your balance before leaving"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999, border: `1px solid ${RB.borderDark}`,
                background: "transparent", color: "var(--cm-muted, #A0A0A0)",
                fontSize: 12, fontWeight: 700,
                cursor: viewerSettled ? "pointer" : "not-allowed",
                opacity: viewerSettled ? 1 : 0.4,
              }}
            >
              <FaSignOutAlt size={11} /> Leave
            </button>
          )}
          {!publicView && viewerIsCreator && (
            <button
              type="button" onClick={handleDeleteGroup}
              disabled={groupHasOutstanding}
              aria-label="Delete group"
              title={groupHasOutstanding ? "Settle all balances before deleting" : "Delete group"}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "6px 10px", borderRadius: 999, border: `1px solid ${RB.borderDark}`,
                background: "transparent", color: "var(--cm-muted, #A0A0A0)",
                cursor: groupHasOutstanding ? "not-allowed" : "pointer",
                opacity: groupHasOutstanding ? 0.4 : 1,
              }}
            >
              <FaTrashAlt size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Shared-link viewers: nudge to log in, and offer to pay via UPI. */}
      {publicView && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
          padding: "10px 14px", borderRadius: 12, marginBottom: 14,
          background: RB.coralSoft, border: `1px solid ${RB.coral}`,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: RB.coralDark, flex: 1, minWidth: 160 }}>
            You're viewing a shared group. Login to pay your share or edit.
          </span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              type="button" onClick={handlePublicLoginToPay}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 999, border: "none",
                background: RB.coral, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              <FaHandshake size={11} /> Pay via UPI
            </button>
            <button
              type="button" onClick={handlePublicLoginToPay}
              style={{
                padding: "7px 14px", borderRadius: 999,
                border: `1px solid ${RB.coral}`, background: "transparent",
                color: RB.coralDark, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Login
            </button>
          </div>
        </div>
      )}

      {/* Header card */}
      <section
        style={{
          background: RB.gradient,
          borderRadius: 18, padding: "18px 18px 16px", color: "#111", marginBottom: 14,
          boxShadow: "0 18px 38px -22px rgba(64, 224, 208, 0.35)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#111", opacity: 0.85 }}>REBUDDY GROUP</div>
        <h1 style={{ margin: "4px 0 8px", fontSize: 22, fontWeight: 800, color: "#111" }}>{group.name}</h1>
        {group.category ? (
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "3px 10px", borderRadius: 999, marginBottom: 8,
            background: "rgba(0,0,0,0.12)", color: "#111",
            fontSize: 11.5, fontWeight: 700,
          }}>
            {group.category}
          </span>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "#111" }}>
          <span style={{ fontSize: 12.5 }}>{group.members.length} members</span>
          <span style={{ fontWeight: 800, fontSize: 29, color: "#000", lineHeight: 1.1, textAlign: "right" }}>
            Total : {formatMoney(Math.round(total), group.currency)}
          </span>
        </div>
      </section>

      {/* Members chips */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700 }}>Members</h3>
          {!publicView && (
            <button
              type="button" onClick={() => setMemberModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none", color: RB.coral,
                fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0,
              }}
            >
              <FaUserPlus size={11} /> Add
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {shownMembers.map((m) => {
            const showMobile = !!revealedMobile[m.id];
            return (
              <span
                key={m.id}
                onClick={() => setRevealedMobile((p) => ({ ...p, [m.id]: !p[m.id] }))}
                title={showMobile ? "Tap to hide number" : "Tap to show number"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999,
                  background: RB.coralSoft, color: "var(--cm-ink, #fff)",
                  fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}
              >
                {m.name}{m.isSelf ? " (You)" : isOwnerMember(m) ? " (Admin)" : ""}
                {memberRequiresExpenseApproval(m, isOwnerMember(m)) ? (
                  <span style={{ opacity: 0.7, fontWeight: 500 }}>· approval</span>
                ) : null}
                {/* Number is hidden by default — revealed on tap. */}
                {showMobile && m.mobile ? <span style={{ opacity: 0.7, fontWeight: 500 }}>· {m.mobile}</span> : null}
                {/* Only the group creator can remove a member (never themselves). */}
                {!publicView && viewerIsCreator && !m.isSelf && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveMember(m); }}
                    aria-label={`Remove ${m.name}`}
                    style={{
                      background: "transparent", border: "none", color: RB.coralDark,
                      cursor: "pointer", padding: 0, display: "grid", placeItems: "center",
                    }}
                  >
                    <FaTimes size={10} />
                  </button>
                )}
              </span>
            );
          })}
          {restMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllMembers((v) => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                marginTop: 2, padding: "9px 12px", borderRadius: 999,
                border: `1px solid ${RB.coral}`, background: "transparent",
                color: RB.coral, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              {showAllMembers ? "Show Less" : `View All (${restMembers.length} more)`}
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div
        style={{
          display: "flex", gap: 6, padding: 4, borderRadius: 12,
          background: RB.surface, border: `1px solid ${RB.borderDark}`, marginBottom: 14,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 12px", borderRadius: 9, border: "none",
                background: active ? RB.coral : "transparent",
                color: active ? "#fff" : "var(--cm-muted, #A0A0A0)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              <t.icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "expenses" ? (
        <ExpensesPanel
          group={group} mMap={mMap} self={self} readOnly={publicView}
          canManageAllExpenses={viewerIsCreator}
          onAdd={() => { setEditingExpense(null); setExpenseModal(true); }}
          onEdit={(e) => { setEditingExpense(e); setExpenseModal(true); }}
          onDelete={handleDeleteExpense}
          onApprove={handleApproveExpense}
        />
      ) : (
        <SettlePanel
          settle={settle} balances={balances} group={group} mMap={mMap}
          self={self}
          pendingToConfirm={pendingToConfirm}
          onSettleClick={(row) => setSettleTarget(row)}
          onConfirm={handleConfirmSettlement}
          onDeleteSettlement={handleDeleteSettlement}
        />
      )}

      {expenseModal && (
        <ExpenseModal
          group={group}
          existing={editingExpense}
          onClose={closeExpenseModal}
          onSubmit={handleSaveExpense}
        />
      )}
      {memberModal && (
        <MemberModal
          onClose={() => setMemberModal(false)}
          onSubmit={handleAddMember}
          onPickContacts={handleAddContacts}
          toast={toast}
        />
      )}
      {settleTarget && (
        <SettleModal
          group={group} mMap={mMap} self={self} target={settleTarget}
          onClose={() => setSettleTarget(null)}
          onSubmit={handleRecordSettlement}
          onPayAndSettle={handlePayAndSettle}
        />
      )}
      {settleSuccess && (
        <SettleSuccessModal
          group={group} mMap={mMap} data={settleSuccess}
          onDone={handleSettleSuccessDone}
        />
      )}

      {verifyingPayment && (
        <div
          role="dialog" aria-modal="true"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14, zIndex: 1200, color: "#fff",
          }}
        >
          <div className="md-spinner" />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Verifying your payment…</div>
        </div>
      )}

      {gatewaySettled && (
        <ConfettiSuccessModal
          data={gatewaySettled}
          currency={group?.currency}
          onDone={() => setGatewaySettled(null)}
        />
      )}
    </div>
  );
};

const ExpensesPanel = ({
  group, mMap, self, onAdd, onEdit, onDelete, onApprove,
  readOnly = false, canManageAllExpenses = false,
}) => {
  const expenses = group.expenses || [];
  const isOwnEntry = (e) => !!self && (e.createdBy ? e.createdBy === self.id : e.paidBy === self.id);
  // Group admins manage every expense. Regular members can only change their
  // own entries. Older entries without creator tracking fall back to paidBy.
  const canModify = (e) => !readOnly && !!self && (canManageAllExpenses || isOwnEntry(e));
  return (
    <>
      {!readOnly && (
        <button
          type="button" onClick={onAdd}
          style={{
            width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
            background: RB.coral, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginBottom: 14, boxShadow: "0 12px 24px -16px rgba(0,123,255,0.45)",
          }}
        >
          <FaPlus size={11} /> Add an expense
        </button>
      )}

      {expenses.length === 0 ? (
        <div
          style={{
            padding: "20px 16px", borderRadius: 14,
            border: `1px dashed ${RB.borderDark}`, background: RB.cardBg,
            textAlign: "center", color: "var(--cm-muted, #A0A0A0)", fontSize: 13,
          }}
        >
          No expenses yet. Add the first one!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {expenses.map((e) => {
            const splitNames = (e.splitAmong && e.splitAmong.length ? e.splitAmong : group.members.map((m) => m.id))
              .map((mid) => mMap[mid]?.name).filter(Boolean);
            const mine = canModify(e);
            const ownEntry = isOwnEntry(e);
            const pending = isPendingExpense(e);
            return (
              <div
                key={e.id}
                role={mine ? "button" : undefined} tabIndex={mine ? 0 : undefined}
                onClick={mine ? () => onEdit(e) : undefined}
                onKeyDown={mine ? (ev) => { if (ev.key === "Enter") onEdit(e); } : undefined}
                style={{
                  display: "flex", gap: 12, alignItems: "center",
                  padding: "12px 14px", borderRadius: 12,
                  background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
                  cursor: mine ? "pointer" : "default",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: RB.coralSoft, color: RB.coralDark,
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <FaReceipt size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>
                    {e.description || "Expense"}
                    {pending && (
                      <span style={{
                        marginLeft: 8, padding: "2px 7px", borderRadius: 999,
                        background: "rgba(245,158,11,0.14)", color: "#F59E0B",
                        fontSize: 10.5, fontWeight: 800, verticalAlign: "middle",
                      }}>
                        Pending approval
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--cm-muted, #A0A0A0)" }}>
                    {mMap[e.paidBy]?.name || "Someone"} paid · split among {splitNames.length} ({splitNames.slice(0, 3).join(", ")}{splitNames.length > 3 ? "…" : ""})
                    {!ownEntry && e.createdBy ? ` · added by ${mMap[e.createdBy]?.name || "another member"}` : ""}
                    {pending ? " · not included in balances yet" : ""}
                  </div>
                  {e.createdAt ? (
                    <div style={{ fontSize: 11, color: "var(--cm-muted, #A0A0A0)", marginTop: 2 }}>
                      {fmtWhen(e.createdAt)}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {formatMoney(e.amount, group.currency)}
                  </div>
                  {mine && (
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                      {pending && canManageAllExpenses && (
                        <button
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); onApprove(e); }}
                          aria-label="Approve expense"
                          style={{
                            display: "grid", placeItems: "center",
                            width: 26, height: 26, borderRadius: 7,
                            background: "rgba(34,197,94,0.14)", border: "none",
                            color: "#22C55E", cursor: "pointer",
                          }}
                        >
                          <FaCheck size={10} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
                        aria-label="Edit expense"
                        style={{
                          display: "grid", placeItems: "center",
                          width: 26, height: 26, borderRadius: 7,
                          background: RB.coralSoft, border: "none",
                          color: RB.coralDark, cursor: "pointer",
                        }}
                      >
                        <FaPen size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); onDelete(e); }}
                        aria-label="Delete expense"
                        style={{
                          display: "grid", placeItems: "center",
                          width: 26, height: 26, borderRadius: 7,
                          background: "rgba(239,68,68,0.12)", border: "none",
                          color: "#EF4444", cursor: "pointer",
                        }}
                      >
                        <FaTrashAlt size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

const SettlePanel = ({
  settle, balances, group, mMap, self,
  pendingToConfirm, onSettleClick, onConfirm, onDeleteSettlement,
}) => {
  // Hook must run before any early return to keep hook order stable.
  const [sortBy, setSortBy] = useState("amount");

  if (!(group.expenses || []).some(isApprovedExpense)) {
    return (
      <div
        style={{
          padding: "20px 16px", borderRadius: 14,
          border: `1px dashed ${RB.borderDark}`, background: RB.cardBg,
          textAlign: "center", color: "var(--cm-muted, #A0A0A0)", fontSize: 13,
        }}
      >
        Add some expenses to see who owes whom.
      </div>
    );
  }

  // Only show members with a real outstanding balance — anyone settled or under
  // ₹1 is hidden. Default sort: largest amount (either direction) first.
  const memberBalances = group.members
    .map((m) => ({ ...m, balance: balances[m.id] || 0 }))
    .filter((m) => Math.abs(m.balance) >= 1)
    .sort((a, b) => {
      switch (sortBy) {
        case "gets": return b.balance - a.balance;
        case "owes": return a.balance - b.balance;
        case "name": return (a.name || "").localeCompare(b.name || "");
        case "amount":
        default: return Math.abs(b.balance) - Math.abs(a.balance);
      }
    });

  // For the viewer, map each counterparty member → the simplified payment, so a
  // "Settle up" action can sit right next to that member's balance.
  const settleForMember = {};
  if (self) {
    settle.forEach((s) => {
      if (s.from === self.id) settleForMember[s.to] = s;
      else if (s.to === self.id) settleForMember[s.from] = s;
    });
  }

  const Summary = memberBalances.length === 0 ? null : (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--cm-muted, #A0A0A0)" }}>
          Balances
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort balances"
          style={{
            fontSize: 11.5, fontWeight: 600, color: RB.coralDark,
            background: RB.surface, border: `1px solid ${RB.borderDark}`,
            borderRadius: 8, padding: "4px 8px", cursor: "pointer", outline: "none",
          }}
        >
          <option value="amount">Highest amount</option>
          <option value="gets">Gets back first</option>
          <option value="owes">Owes first</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {memberBalances.map((m) => {
          const isPos = m.balance > 0.009;
          const isNeg = m.balance < -0.009;
          const color = isPos ? "#22C55E" : isNeg ? "#EF4444" : "var(--cm-muted, #A0A0A0)";
          const label = isPos ? "gets back" : isNeg ? "owes" : "settled";
          const sign = isPos ? "+" : isNeg ? "−" : "";
          return (
            <div
              key={m.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
              }}
            >
              <Avatar name={m.name} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted, #A0A0A0)" }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color, minWidth: 64, textAlign: "right" }}>
                {isPos || isNeg ? `${sign}${formatMoney(Math.abs(m.balance), group.currency)}` : "—"}
              </div>
              {settleForMember[m.id] && (
                <button
                  type="button"
                  onClick={() => onSettleClick({
                    from: settleForMember[m.id].from,
                    to: settleForMember[m.id].to,
                    amount: settleForMember[m.id].amount,
                  })}
                  style={{
                    flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: "none",
                    background: RB.coral, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Settle up
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Payments someone recorded that THIS viewer (the owing party) must confirm.
  const PendingBanner = pendingToConfirm.length > 0 && (
    <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: RB.coralDark }}>
        Confirm payments
      </div>
      {pendingToConfirm.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "12px 14px", borderRadius: 12,
            background: RB.coralSoft, border: `1px solid ${RB.coral}`,
          }}
        >
          <FaHourglassHalf size={13} color={RB.coralDark} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 140, fontSize: 12.5 }}>
            <strong>{mMap[s.from]?.name || "?"}</strong> recorded paying you{" "}
            <strong>{formatMoney(s.amount, group.currency)}</strong>. Confirm you received it to settle.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button" onClick={() => onConfirm(s.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 12px", borderRadius: 999, border: "none",
                background: RB.coral, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              <FaCheck size={10} /> Confirm
            </button>
            <button
              type="button" onClick={() => onDeleteSettlement(s.id)}
              style={{
                padding: "7px 12px", borderRadius: 999,
                border: `1px solid ${RB.borderDark}`, background: "transparent",
                color: "var(--cm-muted, #A0A0A0)", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // A log of every recorded payment (confirmed + still-pending), newest first.
  const recorded = group.settlements || [];
  const History = recorded.length > 0 && (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: "var(--cm-muted, #A0A0A0)" }}>
        Payment history
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {recorded.map((s) => {
          const confirmed = s.status === "confirmed";
          // Payment-history entries are not deletable — gateway payments moved
          // real money, and manual records stay as an audit trail.
          return (
            <div
              key={s.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
              }}
            >
              <Avatar name={mMap[s.from]?.name} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                <div>
                  <strong>{mMap[s.from]?.name || "?"}</strong>
                  <span style={{ color: "var(--cm-muted, #A0A0A0)" }}> paid </span>
                  <strong>{mMap[s.to]?.name || "?"}</strong>
                  {" "}
                  <strong>{formatMoney(s.amount, group.currency)}</strong>
                </div>
                {(() => {
                  // Gateway payments are tagged mode="vasbazaar" (older ones carry
                  // it in the note); everything else is a manual record.
                  const isVasbazaar = s.mode === "vasbazaar" || (s.note || "").toLowerCase().includes("vasbazaar");
                  const modeLabel = isVasbazaar ? "VasBazaar" : "Manual";
                  const when = fmtWhen(s.confirmedAt || s.createdAt);
                  return (
                    <div style={{ fontSize: 11, color: "var(--cm-muted, #A0A0A0)", marginTop: 2 }}>
                      {modeLabel}
                      {!isVasbazaar && s.note ? ` · ${s.note}` : ""}
                      {when ? ` · ${when}` : ""}
                    </div>
                  );
                })()}
              </div>
              <span
                style={{
                  padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: confirmed ? "rgba(34,197,94,0.14)" : RB.coralSoft,
                  color: confirmed ? "#22C55E" : RB.coralDark,
                  whiteSpace: "nowrap",
                }}
              >
                {confirmed ? "Settled" : "Pending"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (settle.length === 0) {
    return (
      <>
        {PendingBanner}
        {Summary}
        <div
          style={{
            padding: "22px 16px", borderRadius: 14,
            background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
            textAlign: "center",
          }}
        >
          <FaCheckCircle size={26} color={RB.coral} />
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>All settled up</div>
          <div style={{ fontSize: 12.5, color: "var(--cm-muted, #A0A0A0)", marginTop: 4 }}>
            Everyone’s balance is zero. Nice work.
          </div>
        </div>
        {History}
      </>
    );
  }
  return (
    <>
      {PendingBanner}
      {Summary}
      {History}
    </>
  );
};

const Avatar = ({ name }) => (
  <div style={{
    width: 30, height: 30, borderRadius: "50%",
    background: RB.coralSoft, color: RB.coralDark,
    display: "grid", placeItems: "center",
    fontSize: 11, fontWeight: 800, flexShrink: 0,
  }}>
    {(name || "?").slice(0, 2).toUpperCase()}
  </div>
);

const ExpenseModal = ({ group, existing, onClose, onSubmit }) => {
  const [paidBy, setPaidBy] = useState(existing?.paidBy || group.members[0]?.id || "");
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : "");
  const [description, setDescription] = useState(existing?.description || "");
  const [splitAmong, setSplitAmong] = useState(
    existing?.splitAmong?.length ? existing.splitAmong : group.members.map((m) => m.id)
  );
  const [error, setError] = useState("");

  const toggleSplit = (mid) => {
    setSplitAmong((prev) => prev.includes(mid) ? prev.filter((x) => x !== mid) : [...prev, mid]);
  };

  const submit = () => {
    const amt = parseFloat(amount);
    if (!paidBy) { setError("Pick who paid."); return; }
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    if (!splitAmong.length) { setError("Pick at least one person to split with."); return; }
    onSubmit({ paidBy, amount: amt, description: description.trim() || "Expense", splitAmong });
  };

  const inputBase = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1px solid ${RB.borderDark}`, background: RB.surface,
    color: "inherit", fontSize: 14, outline: "none",
  };

  return (
    <Modal title={existing ? "Edit expense" : "Add an expense"} onClose={onClose}>
      <label style={lbl}>Description</label>
      <input
        type="text" value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Dinner, taxi, hotel…" style={{ ...inputBase, marginBottom: 14 }}
      />

      <label style={lbl}>Amount ({group.currency})</label>
      <input
        type="number" inputMode="decimal" min="0" step="0.01"
        value={amount} onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00" style={{ ...inputBase, marginBottom: 14 }}
      />

      <label style={lbl}>Paid by</label>
      <select
        value={paidBy} onChange={(e) => setPaidBy(e.target.value)}
        style={{ ...inputBase, marginBottom: 14, appearance: "none" }}
      >
        {group.members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <label style={lbl}>Split among</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {group.members.map((m) => {
          const active = splitAmong.includes(m.id);
          return (
            <button
              key={m.id} type="button" onClick={() => toggleSplit(m.id)}
              style={{
                padding: "6px 12px", borderRadius: 999, border: "none",
                background: active ? RB.coral : "transparent",
                color: active ? "#fff" : "var(--cm-muted, #A0A0A0)",
                outline: active ? "none" : `1px solid ${RB.borderDark}`,
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginBottom: 12,
          background: "rgba(255,60,60,0.12)", color: "#ff6b6b", fontSize: 12, fontWeight: 600,
        }}>{error}</div>
      )}

      <button
        type="button" onClick={submit}
        style={primaryBtn}
      >
        {existing ? "Update expense" : "Save expense"}
      </button>
    </Modal>
  );
};

const MemberModal = ({ onClose, onSubmit, onPickContacts, toast }) => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [expenseApprovalRequired, setExpenseApprovalRequired] = useState(true);

  const fieldStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1px solid ${RB.borderDark}`, background: RB.surface,
    color: "inherit", fontSize: 14, outline: "none", marginBottom: 14,
  };

  const fromContacts = async () => {
    try {
      const picked = await pickContacts();
      if (!picked.length) return;
      onPickContacts(picked);
    } catch (err) {
      if (isUserCancelledError(err)) return;
      if (err?.code === "permission_denied") toast?.showToast?.("Contacts permission is required.", "error");
      else if (err?.code === "unsupported") toast?.showToast?.("Contact picker is available in the VasBazaar app or supported browsers.", "error");
      else toast?.showToast?.("Could not open contacts. Please try again.", "error");
    }
  };

  return (
    <Modal title="Add a member" onClose={onClose}>
      <button
        type="button" onClick={fromContacts}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: 10, marginBottom: 14,
          border: `1px solid ${RB.coral}`, background: "transparent", color: RB.coral,
          fontWeight: 700, fontSize: 13.5, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <FaAddressBook size={13} /> Add from contacts
      </button>

      <label style={lbl}>Name</label>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Member name" autoFocus style={fieldStyle}
      />

      <label style={lbl}>Mobile number</label>
      <input
        type="tel" inputMode="numeric" value={mobile} maxLength={10}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="10-digit mobile" style={fieldStyle}
      />

      <label style={lbl}>Expense updates</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { value: false, label: "Flexible Addition" },
          { value: true, label: "Admin Approval Addition" },
        ].map((opt) => {
          const active = expenseApprovalRequired === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => setExpenseApprovalRequired(opt.value)}
              style={{
                padding: "7px 12px", borderRadius: 999,
                border: `1px solid ${active ? RB.coral : RB.borderDark}`,
                background: active ? RB.coralSoft : "transparent",
                color: active ? RB.coralDark : "var(--cm-muted, #A0A0A0)",
                fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ name, mobile, expenseApprovalRequired })}
        disabled={!name.trim() || !isValidMobile(normalizeMobile(mobile))}
        style={{
          ...primaryBtn,
          opacity: (!name.trim() || !isValidMobile(normalizeMobile(mobile))) ? 0.5 : 1,
          cursor: (!name.trim() || !isValidMobile(normalizeMobile(mobile))) ? "not-allowed" : "pointer",
        }}
      >
        Add member
      </button>
    </Modal>
  );
};

const SettleModal = ({ group, mMap, self, target, onClose, onSubmit, onPayAndSettle }) => {
  const [amount, setAmount] = useState(target.amount != null ? String(target.amount) : "");
  const [note, setNote] = useState("");

  const fromName = mMap[target.from]?.name || "?";
  const toName = mMap[target.to]?.name || "?";
  // The creditor (`to`, the receiver) is the confirmation authority. If the
  // viewer is the receiver, recording settles immediately. Otherwise the
  // receiver must confirm they got the money before it settles.
  const viewerIsReceiver = self && self.id === target.to;
  // Only the debtor can pay online — the money leaves their own UPI. They get a
  // "Pay & Settle" option that credits the payee's wallet directly.
  const viewerIsPayer = self && self.id === target.from;

  const inputBase = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1px solid ${RB.borderDark}`, background: RB.surface,
    color: "inherit", fontSize: 14, outline: "none",
  };

  return (
    <Modal title="Record a payment" onClose={onClose}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
          padding: "12px 14px", borderRadius: 12,
          background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
        }}
      >
        <Avatar name={fromName} />
        <div style={{ flex: 1, fontSize: 13 }}>
          <strong>{fromName}</strong>
          <span style={{ color: "var(--cm-muted, #A0A0A0)" }}> pays </span>
          <strong>{toName}</strong>
        </div>
        <Avatar name={toName} />
      </div>

      <label style={lbl}>Amount ({group.currency})</label>
      <input
        type="number" inputMode="decimal" min="0" step="0.01"
        value={amount} onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00" style={{ ...inputBase, marginBottom: 14 }}
      />

      <label style={lbl}>Note (optional)</label>
      <input
        type="text" value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="UPI, cash, bank transfer…" style={{ ...inputBase, marginBottom: 14 }}
      />

      <div
        style={{
          padding: "9px 12px", borderRadius: 9, marginBottom: 14,
          background: RB.coralSoft, color: RB.coralDark, fontSize: 12, fontWeight: 600,
        }}
      >
        {viewerIsPayer
          ? `Pay online and ${toName} gets it in their VasBazaar wallet instantly — no confirmation needed.`
          : viewerIsReceiver
          ? "You're receiving this payment — it settles immediately."
          : `${toName} will be asked to confirm receipt before this settles.`}
      </div>

      {viewerIsPayer && onPayAndSettle && (
        <button
          type="button"
          onClick={() => onPayAndSettle({ from: target.from, to: target.to, amount, note })}
          style={{ ...primaryBtn, marginBottom: 10 }}
        >
          Pay {formatMoney(parseFloat(amount) || target.amount || 0, group.currency)} &amp; settle
        </button>
      )}

      <button
        type="button"
        onClick={() => onSubmit({ from: target.from, to: target.to, amount, note })}
        style={viewerIsPayer
          ? { ...primaryBtn, background: "transparent", color: RB.coralDark, border: `1px solid ${RB.borderDark}` }
          : primaryBtn}
      >
        {viewerIsPayer
          ? "Record manually instead"
          : viewerIsReceiver ? "Record & settle" : "Record payment"}
      </button>
    </Modal>
  );
};

// Post-settlement confirmation. Centered (not the bottom sheet the input modals
// use) so it reads as a result, not another form. Dismiss refreshes balances.
const SettleSuccessModal = ({ group, mMap, data, onDone }) => {
  const fromName = mMap[data.from]?.name || "?";
  const toName = mMap[data.to]?.name || "?";
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onDone}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360,
          background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
          borderRadius: 18, padding: "26px 22px 22px", textAlign: "center",
          boxShadow: "0 24px 48px -24px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: "50%", margin: "0 auto 14px",
          background: "rgba(34,197,94,0.14)", display: "grid", placeItems: "center",
        }}>
          <FaCheckCircle size={30} color="#22C55E" />
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800 }}>
          {data.settled ? "Payment settled" : "Payment recorded"}
        </h3>
        <div style={{ fontSize: 13, color: "var(--cm-muted, #A0A0A0)", marginBottom: 4 }}>
          <strong>{fromName}</strong> paid <strong>{toName}</strong>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: RB.coralDark, marginBottom: 8 }}>
          {formatMoney(data.amount, group.currency)}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--cm-muted, #A0A0A0)", marginBottom: 18 }}>
          {data.settled
            ? "The entry has been recorded and the balance is updated."
            : `Waiting for ${toName} to confirm receipt before it settles.`}
        </div>
        <button type="button" onClick={onDone} style={primaryBtn}>
          Done
        </button>
      </div>
    </div>
  );
};

// Celebratory popup shown to the payer after an online "Pay & Settle" succeeds.
// Self-contained CSS confetti — no extra dependency.
const CONFETTI_COLORS = ["#40E0D0", "#007BFF", "#FF6B6B", "#FFD93D", "#22C55E", "#A855F7"];
const ConfettiSuccessModal = ({ data, currency, onDone }) => {
  const pieces = Array.from({ length: 70 });
  return (
    <div
      role="dialog" aria-modal="true" onClick={onDone}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1300, padding: 24, overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes rb-confetti-fall {
          0% { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0.85; }
        }
        @keyframes rb-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.04); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {pieces.map((_, i) => {
          const left = Math.random() * 100;
          const delay = Math.random() * 0.6;
          const dur = 2.2 + Math.random() * 1.8;
          const w = 6 + Math.random() * 8;
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          return (
            <span key={i} style={{
              position: "absolute", top: "-12vh", left: `${left}%`,
              width: w, height: w * 0.42, background: color, borderRadius: 2,
              animation: `rb-confetti-fall ${dur}s linear ${delay}s forwards`,
            }} />
          );
        })}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 360,
          background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
          borderRadius: 18, padding: "28px 22px 22px", textAlign: "center",
          boxShadow: "0 24px 48px -24px rgba(0,0,0,0.5)", animation: "rb-pop 0.4s ease-out",
        }}
      >
        <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 10 }}>🎉</div>
        <h3 style={{ margin: "0 0 12px", fontSize: 21, fontWeight: 800 }}>Boom — settled!</h3>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          {formatMoney(data.amount, currency)} → {data.payeeName}&rsquo;s wallet, instantly.
        </div>
        <div style={{ fontSize: 13.5, color: "var(--cm-muted, #A0A0A0)", marginBottom: 20 }}>
          You&rsquo;re all clear! ✅
        </div>
        <button type="button" onClick={onDone} style={primaryBtn}>Done</button>
      </div>
    </div>
  );
};

const Modal = ({ title, children, onClose }) => (
  <div
    role="dialog" aria-modal="true"
    onClick={onClose}
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 1000, padding: "0",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%", maxWidth: 560,
        background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
        borderRadius: "18px 18px 0 0", padding: "18px 18px 24px",
        maxHeight: "90vh", overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <button
          type="button" onClick={onClose} aria-label="Close"
          style={{
            background: "transparent", border: "none", color: "var(--cm-muted, #A0A0A0)",
            cursor: "pointer", padding: 0,
          }}
        >
          <FaTimes size={14} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const lbl = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 };
const primaryBtn = {
  width: "100%", padding: "12px 16px", borderRadius: 12, border: "none",
  background: RB.coral, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
};

export default GroupDetailScreen;
