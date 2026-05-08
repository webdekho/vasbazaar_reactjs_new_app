import { useEffect, useState } from "react";
import { FaTimes, FaPaperPlane } from "react-icons/fa";
import { Capacitor } from "@capacitor/core";
import { outstandingService } from "../../../services/outstandingService";
import { syncReminders } from "../../../services/reminderScheduler";
import { sendSms, ensureSmsPermission, scheduleReminder, cancelReminder } from "../../../services/smsService";

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

  const isAndroid = Capacitor.getPlatform() === "android";

  // Build message from template
  const buildMessage = () => {
    return template
      .replace(/\{name\}/gi, customer.customerName || "Customer")
      .replace(/\{balance\}/gi, Math.abs(customer.balance || 0).toLocaleString("en-IN"))
      .replace(/\{owner\}/gi, ""); // Owner name would come from user profile
  };

  // Send SMS now for testing
  const handleSendNow = async () => {
    if (!customer.customerMobile) {
      setSendResult({ success: false, error: "Customer mobile number not available" });
      return;
    }

    setSendingNow(true);
    setSendResult(null);
    setError("");

    try {
      // First ensure permission on Android
      if (isAndroid) {
        const hasPermission = await ensureSmsPermission();
        if (!hasPermission) {
          setSendResult({ success: false, error: "SMS permission denied. Please allow SMS permission." });
          setSendingNow(false);
          return;
        }
      }

      const message = buildMessage();
      const result = await sendSms(customer.customerMobile, message);

      setSendResult(result);
    } catch (err) {
      setSendResult({ success: false, error: err?.message || "Failed to send SMS" });
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

    // Schedule or cancel native SMS reminder (Android)
    if (isAndroid && customer.customerMobile && frequency !== "NEVER") {
      try {
        if (enabled) {
          // Check if balance meets minimum threshold
          const balance = Math.abs(customer.balance || 0);
          if (balance >= (Number(minBalance) || 0)) {
            const message = buildMessage();
            const scheduleResult = await scheduleReminder({
              customerId: customer.id,
              customerName: customer.customerName,
              phoneNumber: customer.customerMobile,
              message: message,
              time: time,
              frequency: frequency
            });

            if (scheduleResult.success) {
              const hours = Math.floor((scheduleResult.scheduledIn || 0) / 3600000);
              const mins = Math.floor(((scheduleResult.scheduledIn || 0) % 3600000) / 60000);
              setSendResult({
                success: true,
                method: "scheduled",
                message: `SMS scheduled in ${hours}h ${mins}m`
              });
            } else {
              setError(scheduleResult.error || "Failed to schedule SMS");
            }
          }
        } else {
          // Cancel existing reminder
          await cancelReminder(customer.id);
        }
      } catch (err) {
        console.error("Schedule error:", err);
      }
    }

    // Sync notifications (for iOS and as backup)
    try {
      await syncReminders();
    } catch {}

    setSubmitting(false);
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

            <div style={{ background: "#fff8e1", padding: 12, borderRadius: 8, fontSize: 13, color: "#7a5b00" }}>
              {Capacitor.getPlatform() === "android" ? (
                <>
                  <strong>Auto SMS:</strong> At the chosen time, SMS will be sent automatically
                  from your phone. You'll get a notification confirming delivery.
                  SMS charges apply as per your operator.
                </>
              ) : (
                <>
                  At the chosen time you will get a notification. Tapping it opens a queue
                  where you can send each SMS through your phone's messaging app.
                  SMS charges apply as per your operator.
                </>
              )}
            </div>

            {error && <div className="ol-error">{error}</div>}

            {sendResult && (
              <div
                className={sendResult.success ? "ol-success" : "ol-error"}
                style={sendResult.success ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#16a34a", padding: "10px 12px", borderRadius: 10, fontSize: 13 } : {}}
              >
                {sendResult.success
                  ? sendResult.method === "scheduled"
                    ? `✓ ${sendResult.message}`
                    : `✓ SMS sent via ${sendResult.method === "background" ? "background" : "composer"}!`
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
