import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaPlus, FaCheck, FaClock, FaEdit, FaTrash, FaBolt } from "react-icons/fa";
import { resibotService, getResibotModule } from "../../services/resibotService";
import { RB, ResibotHeader, Spinner, Card, EmptyState, StatusChip, fmtDate, dueLabel } from "./resibotUi";

const actionBtn = (color) => ({
  display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 9,
  border: `1px solid ${color}`, background: "transparent", color, fontSize: 12, fontWeight: 600, cursor: "pointer",
});

const ResibotReminderListScreen = () => {
  const navigate = useNavigate();
  const { module } = useParams();
  const meta = getResibotModule(module);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const res = await resibotService.listReminders(module);
    setItems(res?.success && Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, [module]);

  useEffect(() => { load(); }, [load]);

  const goPay = (r) => {
    const slug = r.redirectSlug || meta?.redirectSlug;
    if (!slug) return;
    navigate(`/customer/app/services/${slug}`, {
      state: { prefill: { accountIdentifier: r.accountIdentifier, amount: r.amount, providerName: r.providerName }, fromResibot: true },
    });
  };

  const doMarkPaid = async (id) => {
    setBusyId(id);
    await resibotService.markPaid(id);
    await load();
    setBusyId(null);
  };

  const doSnooze = async (id) => {
    setBusyId(id);
    const until = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await resibotService.snooze(id, until);
    await load();
    setBusyId(null);
  };

  const doDelete = async (id) => {
    if (!window.confirm("Delete this reminder?")) return;
    setBusyId(id);
    await resibotService.deleteReminder(id);
    await load();
    setBusyId(null);
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      <ResibotHeader
        title={meta?.label || "Reminders"}
        subtitle={`${items.length} reminder(s)`}
        onBack={() => navigate("/customer/app/resibot")}
        right={
          <button type="button" onClick={() => navigate(`/customer/app/resibot/reminder/new?module=${module}`)}
            style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: RB.brand, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <FaPlus size={14} />
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState>No {meta?.label || ""} reminders yet. Tap + to add one.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((r) => {
            const isBusy = busyId === r.id;
            const showPay = meta?.action && (r.status === "ACTIVE" || r.status === "OVERDUE" || r.status === "SNOOZED");
            return (
              <Card key={r.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}
                  onClick={() => navigate(`/customer/app/resibot/reminder/${r.id}`)}>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{r.title || r.category || meta?.label}</div>
                    <div style={{ fontSize: 12.5, color: RB.muted, marginTop: 2 }}>
                      {r.providerName ? `${r.providerName} · ` : ""}{r.accountIdentifier || ""}
                    </div>
                    <div style={{ fontSize: 12.5, color: RB.muted, marginTop: 3 }}>
                      {fmtDate(r.dueDate)} · {dueLabel(r.dueDate)}{r.amount ? ` · ₹${r.amount}` : ""}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {showPay && (
                    <button type="button" style={actionBtn(meta.highlightColor)} onClick={() => goPay(r)}>
                      <FaBolt size={11} /> {meta.action}
                    </button>
                  )}
                  <button type="button" style={actionBtn("#16A34A")} disabled={isBusy} onClick={() => doMarkPaid(r.id)}>
                    <FaCheck size={11} /> Mark paid
                  </button>
                  <button type="button" style={actionBtn("#B45309")} disabled={isBusy} onClick={() => doSnooze(r.id)}>
                    <FaClock size={11} /> Snooze
                  </button>
                  <button type="button" style={actionBtn("#2563EB")} onClick={() => navigate(`/customer/app/resibot/reminder/${r.id}/edit`)}>
                    <FaEdit size={11} /> Edit
                  </button>
                  <button type="button" style={actionBtn("#DC2626")} disabled={isBusy} onClick={() => doDelete(r.id)}>
                    <FaTrash size={11} /> Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResibotReminderListScreen;
