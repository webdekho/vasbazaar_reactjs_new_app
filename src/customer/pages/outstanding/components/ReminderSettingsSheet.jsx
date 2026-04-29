import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";
import { syncReminders } from "../../../services/reminderScheduler";

const DEFAULT_TEMPLATE =
  "Namaste {name}, you have an outstanding balance of Rs.{balance} with {owner}. Please clear at your earliest convenience.";

const ReminderSettingsSheet = ({ customer, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("DAILY");
  const [time, setTime] = useState("10:00");
  const [minBalance, setMinBalance] = useState("1");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await outstandingService.getReminderConfig(customer.id);
      if (!mounted) return;
      if (res?.success && res.data) {
        const d = res.data;
        setEnabled(!!d.reminderEnabled);
        setFrequency(d.reminderFrequency || "DAILY");
        setTime((d.reminderTime || "10:00").slice(0, 5));
        setMinBalance(String(d.reminderMinBalance ?? "1"));
        setTemplate(d.reminderTemplate || DEFAULT_TEMPLATE);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [customer.id]);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      reminderEnabled: enabled,
      reminderFrequency: frequency,
      reminderTime: time,
      reminderMinBalance: Number(minBalance) || 0,
      reminderTemplate: template?.trim() || null,
    };
    const res = await outstandingService.updateReminderConfig(customer.id, payload);
    setSubmitting(false);
    if (!res?.success) {
      setError(res?.message || "Failed to save reminder settings");
      return;
    }
    try {
      await syncReminders();
    } catch {}
    onSaved?.(res.data);
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className="cm-sheet is-open ol-sheet">
        <div className="ol-sheet-head">
          <h3>SMS reminder for {customer.customerName}</h3>
          <button type="button" className="ol-sheet-close" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : (
          <form onSubmit={submit} className="ol-form">
            <label className="ol-field" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Send daily SMS reminder from my phone</span>
            </label>

            <label className="ol-field">
              <span>Frequency</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly (Mondays)</option>
                <option value="NEVER">Never</option>
              </select>
            </label>

            <label className="ol-field">
              <span>Reminder time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>

            <label className="ol-field">
              <span>Only remind if balance ≥ ₹</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
              />
            </label>

            <label className="ol-field">
              <span>Message template</span>
              <textarea
                rows={4}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={DEFAULT_TEMPLATE}
              />
              <small style={{ color: "#888", marginTop: 4 }}>
                Use {"{name}"}, {"{balance}"}, {"{owner}"} as placeholders.
              </small>
            </label>

            <div style={{ background: "#fff8e1", padding: 12, borderRadius: 8, fontSize: 13, color: "#7a5b00" }}>
              At the chosen time you will get a notification. Tapping it opens a queue
              where you can send each SMS through your phone's messaging app. SMS
              charges apply as per your operator.
            </div>

            {error && <div className="ol-error">{error}</div>}

            <button
              type="submit"
              className="ol-submit"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save settings"}
            </button>
          </form>
        )}
      </div>
    </>
  );
};

export default ReminderSettingsSheet;
