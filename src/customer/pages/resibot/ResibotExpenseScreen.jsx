import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { resibotService, RESIBOT_EXPENSE_CATEGORIES } from "../../services/resibotService";
import {
  RB, ResibotHeader, Spinner, Card, Field, TextInput, Select, PrimaryButton, EmptyState, fmtDate,
} from "./resibotUi";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({ category: "", amount: "", spentOn: today(), note: "" });

const ResibotExpenseScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(empty());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [s, list] = await Promise.all([
      resibotService.getExpenseSummary(),
      resibotService.listExpenses(new Date().getMonth() + 1, new Date().getFullYear()),
    ]);
    setSummary(s?.success ? s.data : null);
    setExpenses(list?.success && Array.isArray(list.data) ? list.data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.category || form.amount === "") return;
    setSaving(true);
    await resibotService.addExpense({
      category: form.category, amount: Number(form.amount),
      spentOn: form.spentOn || today(), note: form.note || null, source: "Manual",
    });
    setForm(empty()); setShowForm(false); setSaving(false);
    await load();
  };

  const remove = async (id) => { if (!window.confirm("Delete this expense?")) return; await resibotService.deleteExpense(id); await load(); };

  if (loading) return <Spinner />;

  const delta = Number(summary?.monthOnMonthDelta || 0);
  const top = summary?.topCategories || [];
  const maxTop = top.reduce((m, t) => Math.max(m, Number(t.amount || 0)), 0) || 1;

  return (
    <div className="rb-page">
      <ResibotHeader
        title="Expense Snapshot" subtitle="Lightweight monthly spend tracker"
        onBack={() => navigate("/customer/app/resibot")}
        right={<button type="button" onClick={() => setShowForm((s) => !s)} style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: RB.brand, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><FaPlus size={14} /></button>}
      />

      {/* Summary */}
      <Card style={{ marginBottom: 14, display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{money(summary?.currentMonthTotal)}</div>
          <div style={{ fontSize: 12, color: RB.muted }}>This month</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: delta > 0 ? "#DC2626" : "#16A34A", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {delta > 0 ? <FaArrowUp size={11} /> : <FaArrowDown size={11} />} {money(Math.abs(delta))}
          </div>
          <div style={{ fontSize: 11.5, color: RB.muted }}>vs last month {money(summary?.lastMonthTotal)}</div>
        </div>
      </Card>

      {/* Top categories */}
      {top.length > 0 && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Top categories</div>
          <div style={{ display: "grid", gap: 9 }}>
            {top.map((t) => (
              <div key={t.category}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span>{t.category}</span><span style={{ fontWeight: 700 }}>{money(t.amount)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: RB.border }}>
                  <div style={{ height: "100%", borderRadius: 999, background: RB.brand, width: `${(Number(t.amount) / maxTop) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              <option value="">Select category</option>
              {RESIBOT_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amount (₹)"><TextInput type="number" value={form.amount} onChange={set("amount")} /></Field>
            <Field label="Date"><TextInput type="date" value={form.spentOn} onChange={set("spentOn")} /></Field>
          </div>
          <Field label="Note (optional)"><TextInput value={form.note} onChange={set("note")} placeholder="What was it for?" /></Field>
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Add expense"}</PrimaryButton>
        </Card>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>This month's entries</h3>
      {expenses.length === 0 ? (
        <EmptyState>No expenses logged this month. Tap + to add one.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {expenses.map((e) => (
            <Card key={e.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{e.category}</div>
                <div style={{ fontSize: 12, color: RB.muted }}>{fmtDate(e.spentOn)}{e.note ? ` · ${e.note}` : ""}</div>
              </div>
              <strong style={{ fontSize: 14.5 }}>{money(e.amount)}</strong>
              <button type="button" onClick={() => remove(e.id)} aria-label="Delete"
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #DC2626", background: "transparent", color: "#DC2626", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <FaTrash size={11} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResibotExpenseScreen;
