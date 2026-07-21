import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBell, FaPlus, FaTrash, FaPills, FaSyringe, FaTools, FaRegBell } from "react-icons/fa";
import { marketplaceWave4Service } from "../../services/marketplaceWave4Service";
import { useToast } from "../../context/ToastContext";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const TYPES = [
  { key: "MEDICINE", label: "Medicine", icon: FaPills, color: "#ef4444" },
  { key: "REFILL", label: "Refill", icon: FaRegBell, color: "#6366f1" },
  { key: "VACCINATION", label: "Vaccination", icon: FaSyringe, color: "#0ea5e9" },
  { key: "AMC", label: "AMC / Service", icon: FaTools, color: "#f59e0b" },
  { key: "CUSTOM", label: "Custom", icon: FaBell, color: "#10b981" },
];
const FREQS = [
  { key: "ONCE", label: "One time" },
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "INTERVAL", label: "Every N days" },
];

const typeMeta = (t) => TYPES.find((x) => x.key === t) || TYPES[4];
const freqLabel = (f, n) => {
  if (f === "INTERVAL") return `Every ${n || "—"} days`;
  return (FREQS.find((x) => x.key === f) || {}).label || f;
};
const pad2 = (n) => String(n).padStart(2, "0");
const defaultNextAt = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T09:00`;
};

const MarketplaceRemindersScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [open, setOpen] = useState(false);

  // form state
  const [type, setType] = useState("MEDICINE");
  const [title, setTitle] = useState("");
  const [nextAt, setNextAt] = useState(defaultNextAt());
  const [frequency, setFrequency] = useState("DAILY");
  const [intervalDays, setIntervalDays] = useState(30);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceWave4Service.getReminders();
    setLoading(false);
    if (res.success) setReminders(Array.isArray(res.data) ? res.data : (res.data?.records || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setType("MEDICINE"); setTitle(""); setNextAt(defaultNextAt());
    setFrequency("DAILY"); setIntervalDays(30);
  };

  const submit = async () => {
    if (!title.trim()) { showToast("Add a reminder title", "error"); return; }
    if (!nextAt) { showToast("Pick a date & time", "error"); return; }
    setSaving(true);
    const payload = {
      type,
      title: title.trim(),
      nextAt,
      frequency,
      ...(frequency === "INTERVAL" ? { intervalDays: Number(intervalDays) || 1 } : {}),
    };
    const res = await marketplaceWave4Service.createReminder(payload);
    setSaving(false);
    if (res.success) {
      showToast("Reminder set", "success");
      setOpen(false);
      resetForm();
      load();
    } else {
      showToast(res.message || "Could not create reminder", "error");
    }
  };

  const remove = async (r) => {
    if (!window.confirm("Delete this reminder?")) return;
    setBusyId(r.id);
    const res = await marketplaceWave4Service.deleteReminder(r.id);
    setBusyId(null);
    if (res.success) {
      showToast("Reminder deleted", "info");
      setReminders((p) => p.filter((x) => x.id !== r.id));
    } else {
      showToast(res.message || "Could not delete", "error");
    }
  };

  const active = useMemo(() => reminders.filter((r) => r.active !== false), [reminders]);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Reminders</h1>
        <button className="mkt-header-back" onClick={() => setOpen(true)} aria-label="Add reminder"><FaPlus /></button>
      </div>

      <div style={{ padding: "12px 14px 32px" }}>
        <div style={{ fontSize: 12.5, color: "var(--cm-muted)", marginBottom: 12, lineHeight: 1.5 }}>
          Never miss a medicine dose, a monthly refill, a vaccination or an appliance service.
          We'll send you a notification when each reminder is due.
        </div>

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : active.length === 0 ? (
          <div className="mkt-empty" style={{ display: "grid", placeItems: "center", gap: 8, padding: "32px 12px" }}>
            <FaBell size={30} style={{ opacity: 0.4 }} />
            <div>No reminders yet.</div>
            <button className="mkt-btn mkt-btn--primary" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
              <FaPlus size={11} /> Add reminder
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {active.map((r) => {
              const meta = typeMeta(r.type);
              const Icon = meta.icon;
              return (
                <div key={r.id} style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", background: `${meta.color}1f`, color: meta.color, flexShrink: 0 }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--cm-ink)" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 3 }}>
                      {meta.label} · {freqLabel(r.frequency, r.intervalDays)}
                    </div>
                    <div style={{ fontSize: 12, color: meta.color, fontWeight: 700, marginTop: 4 }}>
                      Next: {formatDisplayDateTime(r.nextAt, "—")}
                    </div>
                  </div>
                  <button
                    className="mkt-store-share-btn"
                    disabled={busyId === r.id}
                    onClick={() => remove(r)}
                    aria-label="Delete reminder"
                    style={{ color: "#f87171" }}
                  >
                    <FaTrash size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div className="mkt-vsheet-overlay" onClick={() => setOpen(false)}>
          <div className="mkt-vsheet" onClick={(e) => e.stopPropagation()}>
            <div className="mkt-vsheet-head">
              <div style={{ flex: 1 }}>
                <div className="mkt-vsheet-title">New reminder</div>
              </div>
              <button className="mkt-header-back" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="mkt-isheet-sec">
              <div className="mkt-isheet-sec-title">Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const on = type === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      className={`mkt-vopt${on ? " mkt-vopt--active" : ""}`}
                      onClick={() => setType(t.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Icon size={11} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mkt-isheet-sec">
              <div className="mkt-isheet-sec-title">Title</div>
              <input
                className="mkt-input"
                placeholder="e.g. BP tablet — 1 after breakfast"
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="mkt-isheet-sec">
              <div className="mkt-isheet-sec-title">First / next reminder</div>
              <input
                className="mkt-input"
                type="datetime-local"
                value={nextAt}
                onChange={(e) => setNextAt(e.target.value)}
              />
            </div>

            <div className="mkt-isheet-sec">
              <div className="mkt-isheet-sec-title">Repeat</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FREQS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`mkt-vopt${frequency === f.key ? " mkt-vopt--active" : ""}`}
                    onClick={() => setFrequency(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {frequency === "INTERVAL" && (
                <input
                  className="mkt-input"
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  placeholder="Interval in days"
                  style={{ marginTop: 8 }}
                />
              )}
            </div>

            <button
              className="mkt-btn mkt-btn--primary"
              disabled={saving}
              style={{ width: "100%", marginTop: 8 }}
              onClick={submit}
            >
              {saving ? "Saving…" : "Set reminder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceRemindersScreen;
