import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft, FaPlus, FaShareAlt, FaTrashAlt, FaUserPlus, FaTimes,
  FaReceipt, FaHandshake, FaCheckCircle,
} from "react-icons/fa";
import { useToast } from "../../context/ToastContext";
import {
  RB, formatMoney, getGroup, memberMap, newId,
  simplifySettlements, upsertGroup, deleteGroup, computeBalances,
} from "./utils";

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

  useEffect(() => {
    const g = getGroup(id);
    if (!g) {
      toast?.showToast?.("Group not found.", "error");
      navigate("/customer/app/rebuddy", { replace: true });
      return;
    }
    setGroup(g);
  }, [id, navigate, toast]);

  const persist = (next) => {
    const saved = upsertGroup(next);
    setGroup(saved);
  };

  const settle = useMemo(() => (group ? simplifySettlements(group) : []), [group]);
  const balances = useMemo(() => (group ? computeBalances(group) : {}), [group]);
  const total = useMemo(
    () => (group?.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0),
    [group]
  );
  const mMap = useMemo(() => memberMap(group), [group]);

  const closeExpenseModal = () => { setExpenseModal(false); setEditingExpense(null); };

  const handleSaveExpense = (exp) => {
    if (editingExpense) {
      persist({
        ...group,
        expenses: (group.expenses || []).map((e) =>
          e.id === editingExpense.id ? { ...e, ...exp, updatedAt: Date.now() } : e
        ),
      });
      toast?.showToast?.("Expense updated.", "success");
    } else {
      persist({ ...group, expenses: [{ id: newId("e"), createdAt: Date.now(), ...exp }, ...(group.expenses || [])] });
      toast?.showToast?.("Expense added.", "success");
    }
    closeExpenseModal();
  };

  const handleDeleteExpense = (eid) => {
    persist({ ...group, expenses: (group.expenses || []).filter((e) => e.id !== eid) });
    toast?.showToast?.("Expense removed.", "info");
  };

  const handleAddMember = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (group.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      toast?.showToast?.("Already in the group.", "error");
      return;
    }
    persist({ ...group, members: [...group.members, { id: newId("m"), name: trimmed }] });
    setMemberModal(false);
    toast?.showToast?.("Member added.", "success");
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

  const handleDeleteGroup = () => {
    if (!window.confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    deleteGroup(group.id);
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
                padding: "6px 12px", borderRadius: 999,
                background: RB.coralSoft, color: RB.coralDark,
                fontSize: 12.5, fontWeight: 600,
              }}
            >
              {m.name}
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
          group={group} mMap={mMap}
          onAdd={() => { setEditingExpense(null); setExpenseModal(true); }}
          onEdit={(e) => { setEditingExpense(e); setExpenseModal(true); }}
          onDelete={handleDeleteExpense}
        />
      ) : (
        <SettlePanel settle={settle} balances={balances} group={group} mMap={mMap} />
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
        />
      )}
    </div>
  );
};

const ExpensesPanel = ({ group, mMap, onAdd, onEdit, onDelete }) => {
  const expenses = group.expenses || [];
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
            return (
              <div
                key={e.id}
                role="button" tabIndex={0}
                onClick={() => onEdit(e)}
                onKeyDown={(ev) => { if (ev.key === "Enter") onEdit(e); }}
                style={{
                  display: "flex", gap: 12, alignItems: "center",
                  padding: "12px 14px", borderRadius: 12,
                  background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
                  cursor: "pointer",
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
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {formatMoney(e.amount, group.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
                    aria-label="Delete expense"
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      color: "var(--cm-muted, #A0A0A0)", cursor: "pointer", marginTop: 4,
                    }}
                  >
                    <FaTrashAlt size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

const SettlePanel = ({ settle, balances, group, mMap }) => {
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
          const color = isPos ? "#22C55E" : isNeg ? RB.coral : "var(--cm-muted, #A0A0A0)";
          const label = isPos ? "gets back" : isNeg ? "owes" : "settled";
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
                {isPos || isNeg ? formatMoney(Math.abs(m.balance), group.currency) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (settle.length === 0) {
    return (
      <>
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
      </>
    );
  }
  return (
    <>
      {Summary}
      <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--cm-muted, #A0A0A0)", marginBottom: -2 }}>
        Simplified into {settle.length} payment{settle.length > 1 ? "s" : ""}.
      </div>
      {settle.map((s, idx) => (
        <div
          key={idx}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 14px", borderRadius: 12,
            background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
          }}
        >
          <Avatar name={mMap[s.from]?.name} />
          <div style={{ flex: 1, fontSize: 13 }}>
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
        </div>
      ))}
      </div>
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

const MemberModal = ({ onClose, onSubmit }) => {
  const [name, setName] = useState("");
  return (
    <Modal title="Add a member" onClose={onClose}>
      <label style={lbl}>Name</label>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Member name" autoFocus
        style={{
          width: "100%", padding: "11px 14px", borderRadius: 10,
          border: `1px solid ${RB.borderDark}`, background: RB.surface,
          color: "inherit", fontSize: 14, outline: "none", marginBottom: 14,
        }}
      />
      <button type="button" onClick={() => onSubmit(name)} style={primaryBtn}>Add member</button>
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
