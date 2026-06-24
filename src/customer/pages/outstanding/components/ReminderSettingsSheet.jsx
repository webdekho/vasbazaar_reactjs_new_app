import { useEffect, useState } from "react";
import { FaTimes, FaPaperPlane } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";
import { syncReminders } from "../../../services/reminderScheduler";
import { sendSms } from "../../../services/smsService";

const DEFAULT_TEMPLATE =
  "Namaste {name}, you have an outstanding balance of Rs.{balance} with {owner}. Please clear at your earliest convenience.";

const ReminderSettingsSheet = ({ customer, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("DAILY");
  const [time, setTime] = useState("10:00");
  const [minBalance, setMinBalance] = useState("1");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  // Build message from template
  const buildMessage = () => {
    return template
      .replace(/\{name\}/gi, customer.customerName || "Customer")
      .replace(/\{balance\}/gi, Math.abs(customer.balance || 0).toLocaleString("en-IN"))
      .replace(/\{owner\}/gi, ""); // Owner name would come from user profile
  };

  // Send SMS now - opens SMS composer
  const handleSendNow = async () => {
    if (!customer.customerMobile) {
      setSendResult({ success: false, error: "Customer mobile number not available" });
      return;
    }

    setSendingNow(true);
    setSendResult(null);
    setError("");

    try {
      const message = buildMessage();
      const result = await sendSms(customer.customerMobile, message);

      if (result.success) {
        setSendResult({ success: true, message: "SMS app opened. Please tap Send to send the message." });
      } else {
        setSendResult(result);
      }
    } catch (err) {
      setSendResult({ success: false, error: err?.message || "Failed to open SMS app" });
    }

    setSendingNow(false);
  };

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
    setSendResult(null);
    setSubmitting(true);

    // Save settings to backend
    const payload = {
      reminderEnabled: enabled,
      reminderFrequency: frequency,
      reminderTime: time,
      reminderMinBalance: Number(minBalance) || 0,
      reminderTemplate: template?.trim() || null,
    };
    const res = await outstandingService.updateReminderConfig(customer.id, payload);

    if (!res?.success) {
      setSubmitting(false);
      setError(res?.message || "Failed to save reminder settings");
      return;
    }

    // Sync local notifications (will remind user to send SMS)
    try {
      await syncReminders();
      if (enabled) {
        setSendResult({
          success: true,
          message: "Reminder saved! You'll get a notification to send SMS."
        });
      }
    } catch {}

    setSubmitting(false);
    onSaved?.(res.data);
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className="cm-sheet is-open ol-sheet">
        <div className="ol-sheet-head">
          <h3>Payment reminders for {customer.customerName}</h3>
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
              <span>Send payment reminders (auto in-app + SMS from my phone)</span>
            </label>

            <label className="ol-field">
              <span>Frequency</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly (Mondays)</option>
                <option value="NEVER">Never</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <label className="ol-field" style={{ flex: 1 }}>
                <span>Reminder time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>

              <label className="ol-field" style={{ flex: 1 }}>
                <span>Min balance ₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={minBalance}
                  onChange={(e) => setMinBalance(e.target.value)}
                />
              </label>
            </div>

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

            <div style={{ background: "#e3f2fd", padding: 12, borderRadius: 8, fontSize: 13, color: "#1565c0" }}>
              <strong>How it works:</strong> If your customer uses the VasBazaar app, they
              automatically get an in-app reminder every day at 12 PM (weekly customers once a week).
              For SMS: at the chosen time you'll get a notification — tap it to open the SMS app with a
              pre-filled message, then tap Send. SMS charges apply as per your operator.
            </div>

            {error && <div className="ol-error">{error}</div>}

            {sendResult && (
              <div
                className={sendResult.success ? "ol-success" : "ol-error"}
                style={sendResult.success ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#16a34a", padding: "10px 12px", borderRadius: 10, fontSize: 13 } : {}}
              >
                {sendResult.success
                  ? `✓ ${sendResult.message || "SMS app opened!"}`
                  : sendResult.error || "Failed to send SMS"}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="ol-submit"
                onClick={handleSendNow}
                disabled={sendingNow || !customer.customerMobile}
                style={{ flex: 1, background: "linear-gradient(135deg, #2196F3, #1976D2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <FaPaperPlane /> {sendingNow ? "Sending…" : "Send SMS Now"}
              </button>
              <button
                type="submit"
                className="ol-submit"
                disabled={submitting}
                style={{ flex: 1 }}
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
};

export default ReminderSettingsSheet;
