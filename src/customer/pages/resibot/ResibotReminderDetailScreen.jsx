import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaBolt, FaCheck, FaClock, FaEdit, FaTrash } from "react-icons/fa";
import { resibotService, getResibotModule } from "../../services/resibotService";
import { RB, ResibotHeader, Spinner, Card, StatusChip, dueLabel, EmptyState } from "./resibotUi";
import { formatDisplayDate } from "../../../utils/dateFormat";

const Row = ({ label, value }) => (
  value === null || value === undefined || value === "" ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${RB.border}` }}>
      <span style={{ fontSize: 13, color: RB.muted }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  )
);

const btn = (color, fill) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 12px", borderRadius: 10,
  border: `1px solid ${color}`, background: fill ? color : "transparent", color: fill ? "#fff" : color,
  fontSize: 13, fontWeight: 700, cursor: "pointer", flex: 1,
});

const ResibotReminderDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await resibotService.getReminder(id);
    setR(res?.success ? res.data : null);
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  if (loading) return <Spinner />;
  if (!r) return (
    <div className="rb-page">
      <ResibotHeader title="Reminder" onBack={() => navigate("/customer/app/resibot")} />
      <EmptyState>Reminder not found.</EmptyState>
    </div>
  );

  const meta = getResibotModule(r.module);

  const goPay = () => {
    const slug = r.redirectSlug || meta?.redirectSlug;
    if (!slug) return;
    navigate(`/customer/app/services/${slug}`, {
      state: { prefill: { accountIdentifier: r.accountIdentifier, amount: r.amount, providerName: r.providerName }, fromResibot: true },
    });
  };
  const markPaid = async () => { setBusy(true); await resibotService.markPaid(r.id); await load(); setBusy(false); };
  const snooze = async () => {
    setBusy(true);
    await resibotService.snooze(r.id, new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    await load(); setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm("Delete this reminder?")) return;
    setBusy(true);
    await resibotService.deleteReminder(r.id);
    navigate(`/customer/app/resibot/reminders/${r.module}`);
  };

  return (
    <div className="rb-page">
      <ResibotHeader title={r.title || r.category || meta?.label} subtitle={meta?.label} onBack={() => navigate(-1)}
        right={<StatusChip status={r.status} />} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: RB.muted, marginBottom: 8 }}>
          {formatDisplayDate(r.dueDate, "—")} · {dueLabel(r.dueDate)}
        </div>
        <Row label="Category" value={r.category} />
        <Row label="Provider" value={r.providerName} />
        <Row label="Account / Policy no." value={r.accountIdentifier} />
        <Row label="Amount" value={r.amount ? `₹${r.amount}` : null} />
        <Row label="Repeat" value={r.repeatFrequency && r.repeatFrequency !== "NONE" ? r.repeatFrequency.replace("_", " ") : null} />
        <Row label="Alerts (days before)" value={r.alertOffsetsDays} />
        <Row label="Last action date" value={r.lastActionDate ? formatDisplayDate(r.lastActionDate, "—") : null} />
        <Row label="Payment method" value={r.paymentMethod} />
        <Row label="For member" value={r.memberId?.name} />
        <Row label="Notes" value={r.notes} />
      </Card>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        {meta?.action && (
          <button type="button" style={btn(meta.highlightColor, true)} onClick={goPay}>
            <FaBolt size={12} /> {meta.action}
          </button>
        )}
        <button type="button" style={btn("#16A34A")} disabled={busy} onClick={markPaid}>
          <FaCheck size={12} /> Mark paid
        </button>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" style={btn("#B45309")} disabled={busy} onClick={snooze}>
          <FaClock size={12} /> Snooze
        </button>
        <button type="button" style={btn("#2563EB")} onClick={() => navigate(`/customer/app/resibot/reminder/${r.id}/edit`)}>
          <FaEdit size={12} /> Edit
        </button>
        <button type="button" style={btn("#DC2626")} disabled={busy} onClick={remove}>
          <FaTrash size={12} /> Delete
        </button>
      </div>
    </div>
  );
};

export default ResibotReminderDetailScreen;
