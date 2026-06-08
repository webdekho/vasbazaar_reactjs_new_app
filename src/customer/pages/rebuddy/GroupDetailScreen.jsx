import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaPlus, FaShareAlt, FaTrashAlt, FaUserPlus, FaTimes,
  FaReceipt, FaHandshake, FaCheckCircle, FaAddressBook, FaHourglassHalf, FaCheck, FaPen,
} from "react-icons/fa";
import { useToast } from "../../context/ToastContext";
import {
  RB, formatMoney, memberMap, newId,
  simplifySettlements, computeBalances,
  selfMember, settlementInitialStatus, pendingForViewer,
} from "./utils";
import { pickContacts, normalizeMobile, isValidMobile, isUserCancelledError } from "./contacts";
import { rebuddyService } from "../../services/rebuddyService";

const TABS = [
  { key: "expenses", label: "Expenses", icon: FaReceipt },
  { key: "settle", label: "Settle up", icon: FaHandshake },
];

const GroupDetailScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [group, setGroup] = useState(null);
  const [tab, setTab] = useState("expenses");
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [memberModal, setMemberModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null); // { from, to, amount }

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await rebuddyService.getGroup(id);
      if (!alive) return;
      if (!res.success || !res.data) {
        toast?.showToast?.(res.message || "Group not found.", "error");
        navigate("/customer/app/rebuddy", { replace: true });
        return;
      }
      setGroup(res.data);
    })();
    return () => { alive = false; };
  }, [id, navigate, toast]);

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

  const settle = useMemo(() => (group ? simplifySettlements(group) : []), [group]);
  const balances = useMemo(() => (group ? computeBalances(group) : {}), [group]);
  const total = useMemo(
    () => (group?.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0),
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
    const next = editing
      ? {
          ...group,
          expenses: (group.expenses || []).map((e) =>
            e.id === editingExpense.id ? { ...e, ...exp, updatedAt: Date.now() } : e
          ),
        }
      : { ...group, expenses: [{ id: newId("e"), createdAt: Date.now(), createdBy: self?.id, ...exp }, ...(group.expenses || [])] };
    closeExpenseModal();
    if (await persist(next)) {
      toast?.showToast?.(editing ? "Expense updated." : "Expense added.", "success");
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Delete "${exp.description || "this expense"}" (${formatMoney(exp.amount, group.currency)})? This cannot be undone.`)) return;
    if (await persist({ ...group, expenses: (group.expenses || []).filter((e) => e.id !== exp.id) })) {
      toast?.showToast?.("Expense removed.", "info");
    }
  };

  // Record a payment between two members. If the viewer IS the owing party
  // (from), it auto-confirms and settles immediately; otherwise it's logged as
  // pending until the owing party confirms.
  const handleRecordSettlement = async ({ from, to, amount, note }) => {
    const amt = parseFloat(amount);
    if (!from || !to || from === to) { toast?.showToast?.("Pick who paid whom.", "error"); return; }
    if (!amt || amt <= 0) { toast?.showToast?.("Enter a valid amount.", "error"); return; }
    const createdBy = self?.id || from;
    const status = settlementInitialStatus(createdBy, from);
    const now = Date.now();
    const settlement = {
      id: newId("s"),
      from, to, amount: amt,
      note: (note || "").trim(),
      createdBy, status,
      createdAt: now,
      confirmedAt: status === "confirmed" ? now : null,
    };
    setSettleTarget(null);
    const next = { ...group, settlements: [settlement, ...(group.settlements || [])] };
    if (await persist(next)) {
      toast?.showToast?.(
        status === "confirmed"
          ? "Payment recorded — settled."
          : "Payment recorded — waiting for confirmation.",
        "success"
      );
    }
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

  const handleAddMember = async ({ name, mobile }) => {
    const trimmed = (name || "").trim();
    const num = normalizeMobile(mobile);
    if (!trimmed) { toast?.showToast?.("Enter the member's name.", "error"); return; }
    if (!isValidMobile(num)) { toast?.showToast?.("Enter a valid 10-digit mobile number.", "error"); return; }
    if (group.members.some((m) => m.mobile === num)) {
      toast?.showToast?.("That mobile number is already in the group.", "error");
      return;
    }
    setMemberModal(false);
    if (await persist({ ...group, members: [...group.members, { id: newId("m"), name: trimmed, mobile: num }] })) {
      toast?.showToast?.("Member added.", "success");
    }
  };

  const handleAddContacts = async (picked) => {
    const have = new Set(group.members.map((m) => m.mobile));
    const fresh = picked
      .filter((c) => !have.has(c.mobile))
      .map((c) => ({ id: newId("m"), name: c.name, mobile: c.mobile }));
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
    const url = `${window.location.origin}/customer/app/rebuddy/group/${group.id}`;
    const text = `Join my ReBuddy group "${group.name}" to split expenses: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `ReBuddy · ${group.name}`, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast?.showToast?.("Link copied to clipboard.", "success");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast?.showToast?.("Link copied.", "success");
      } catch {
        toast?.showToast?.("Could not share link.", "error");
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    const res = await rebuddyService.deleteGroup(group.id);
    if (!res.success) {
      toast?.showToast?.(res.message || "Could not delete the group.", "error");
      return;
    }
    navigate("/customer/app/rebuddy", { replace: true });
  };

  if (!group) return null;

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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
        <div style={{ display: "flex", gap: 8 }}>
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
          <button
            type="button" onClick={handleDeleteGroup}
            aria-label="Delete group"
            style={{
              display: "inline-flex", alignItems: "center",
              padding: "6px 10px", borderRadius: 999, border: `1px solid ${RB.borderDark}`,
              background: "transparent", color: "var(--cm-muted, #A0A0A0)", cursor: "pointer",
            }}
          >
            <FaTrashAlt size={11} />
          </button>
        </div>
      </div>

      {/* Header card */}
      <section
        style={{
          background: RB.gradient,
          borderRadius: 18, padding: "18px 18px 16px", color: "#fff", marginBottom: 14,
          boxShadow: "0 18px 38px -22px rgba(64, 224, 208, 0.35)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, opacity: 0.9 }}>REBUDDY GROUP</div>
        <h1 style={{ margin: "4px 0 8px", fontSize: 22, fontWeight: 800 }}>{group.name}</h1>
        {group.category ? (
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "3px 10px", borderRadius: 999, marginBottom: 8,
            background: "rgba(255,255,255,0.22)", color: "#fff",
            fontSize: 11.5, fontWeight: 700,
          }}>
            {group.category}
          </span>
        ) : null}
        <div style={{ display: "flex", gap: 16, fontSize: 12.5, opacity: 0.95 }}>
          <span>{group.members.length} members</span>
          <span>•</span>
          <span>Total {formatMoney(total, group.currency)}</span>
        </div>
      </section>

      {/* Members chips */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700 }}>Members</h3>
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
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {group.members.map((m) => (
            <span
              key={m.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999,
                background: RB.coralSoft, color: RB.coralDark,
                fontSize: 12.5, fontWeight: 600,
              }}
            >
              {m.name}{m.isSelf ? " (You)" : ""}
              {m.mobile ? <span style={{ opacity: 0.7, fontWeight: 500 }}>· {m.mobile}</span> : null}
              {!m.isSelf && (
                <button
                  type="button" onClick={() => handleRemoveMember(m)}
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
          ))}
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
          group={group} mMap={mMap} self={self}
          onAdd={() => { setEditingExpense(null); setExpenseModal(true); }}
          onEdit={(e) => { setEditingExpense(e); setExpenseModal(true); }}
          onDelete={handleDeleteExpense}
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
        />
      )}
    </div>
  );
};

const ExpensesPanel = ({ group, mMap, self, onAdd, onEdit, onDelete }) => {
  const expenses = group.expenses || [];
  // Only the member who added an entry can edit or delete it. Legacy entries
  // saved before creator tracking (no createdBy) stay editable by anyone.
  const canModify = (e) => !e.createdBy || (self && e.createdBy === self.id);
  return (
    <>
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
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--cm-muted, #A0A0A0)" }}>
                    {mMap[e.paidBy]?.name || "Someone"} paid · split among {splitNames.length} ({splitNames.slice(0, 3).join(", ")}{splitNames.length > 3 ? "…" : ""})
                    {!mine && e.createdBy ? ` · added by ${mMap[e.createdBy]?.name || "another member"}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {formatMoney(e.amount, group.currency)}
                  </div>
                  {mine && (
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
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
  if (!group.expenses?.length) {
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

  const memberBalances = group.members.map((m) => ({
    ...m, balance: balances[m.id] || 0,
  })).sort((a, b) => b.balance - a.balance);

  const Summary = (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: "var(--cm-muted, #A0A0A0)" }}>
        Balances
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
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted, #A0A0A0)" }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color, minWidth: 70, textAlign: "right" }}>
                {isPos || isNeg ? `${sign}${formatMoney(Math.abs(m.balance), group.currency)}` : "—"}
              </div>
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
            <strong>{mMap[s.to]?.name || "?"}</strong> recorded that you paid{" "}
            <strong>{formatMoney(s.amount, group.currency)}</strong>. Confirm to settle.
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
          // Only the member who recorded the payment can remove it from history.
          const mine = self && (s.createdBy ? s.createdBy === self.id : s.from === self.id);
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
                {s.note ? (
                  <div style={{ fontSize: 11, color: "var(--cm-muted, #A0A0A0)", marginTop: 2 }}>{s.note}</div>
                ) : null}
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
              {mine ? (
                <button
                  type="button" onClick={() => onDeleteSettlement(s.id)}
                  aria-label="Remove payment"
                  style={{
                    background: "transparent", border: "none", padding: 0,
                    color: "var(--cm-muted, #A0A0A0)", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <FaTrashAlt size={11} />
                </button>
              ) : null}
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
      <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--cm-muted, #A0A0A0)", marginBottom: -2 }}>
        Simplified into {settle.length} payment{settle.length > 1 ? "s" : ""}.
      </div>
      {settle.map((s, idx) => {
        // Either party to the payment can record it from here.
        const canSettle = self && (s.from === self.id || s.to === self.id);
        return (
        <div
          key={idx}
          style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "14px 14px", borderRadius: 12,
            background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
          }}
        >
          <Avatar name={mMap[s.from]?.name} />
          <div style={{ flex: 1, minWidth: 120, fontSize: 13 }}>
            <strong>{mMap[s.from]?.name || "?"}</strong>
            <span style={{ color: "var(--cm-muted, #A0A0A0)" }}> pays </span>
            <strong>{mMap[s.to]?.name || "?"}</strong>
          </div>
          <Avatar name={mMap[s.to]?.name} />
          <div style={{
            padding: "6px 10px", borderRadius: 999,
            background: RB.coralSoft, color: RB.coralDark,
            fontSize: 12.5, fontWeight: 800,
          }}>
            {formatMoney(s.amount, group.currency)}
          </div>
          {canSettle && (
            <button
              type="button"
              onClick={() => onSettleClick({ from: s.from, to: s.to, amount: s.amount })}
              style={{
                padding: "7px 14px", borderRadius: 999, border: "none",
                background: RB.coral, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Settle up
            </button>
          )}
        </div>
        );
      })}
      </div>
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

      <button
        type="button"
        onClick={() => onSubmit({ name, mobile })}
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

const SettleModal = ({ group, mMap, self, target, onClose, onSubmit }) => {
  const [amount, setAmount] = useState(target.amount != null ? String(target.amount) : "");
  const [note, setNote] = useState("");

  const fromName = mMap[target.from]?.name || "?";
  const toName = mMap[target.to]?.name || "?";
  // If the viewer is the one who owes (the `from`), recording it settles right
  // away. If they're the receiver (or anyone else), the owing party must confirm.
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
          ? "You're the payer — this settles immediately."
          : `${fromName} will be asked to confirm before this settles.`}
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ from: target.from, to: target.to, amount, note })}
        style={primaryBtn}
      >
        {viewerIsPayer ? "Record & settle" : "Record payment"}
      </button>
    </Modal>
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
