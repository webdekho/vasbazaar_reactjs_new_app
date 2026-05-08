import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCommentDots, FaCheckCircle } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { triggerNativeSms } from "../../services/reminderScheduler";

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${Math.round(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const ReminderQueueScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [sentIds, setSentIds] = useState(() => new Set());
  const [editing, setEditing] = useState({}); // { [customerId]: messageDraft }

  const load = async () => {
    setLoading(true);
    const res = await outstandingService.listDueReminders();
    setLoading(false);
    if (!res?.success) {
      setError(res?.message || "Failed to load reminders");
      return;
    }
    setItems(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const messageFor = (item) =>
    editing[item.customerId] != null ? editing[item.customerId] : item.message || "";

  const sendOne = async (item) => {
    const message = messageFor(item);
    triggerNativeSms(item.customerMobile, message);
    try {
      await outstandingService.logReminderTriggered(item.customerId, {
        message,
        channel: "SMS",
        status: "TRIGGERED",
      });
    } catch {}
    setSentIds((prev) => {
      const next = new Set(prev);
      next.add(item.customerId);
      return next;
    });
  };

  const sendAll = async () => {
    for (const item of items) {
      if (sentIds.has(item.customerId)) continue;
      await sendOne(item);
      await new Promise((r) => setTimeout(r, 800));
    }
  };

  const pending = items.filter((i) => !sentIds.has(i.customerId));

  return (
    <div className="cm-page ol-page ol-reminder-queue">
      <header className="ol-ledger-header">
        <button className="ol-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-title">
          <h2>Send reminders</h2>
        </div>
      </header>

      {loading ? (
        <div className="ol-sms-list" style={{ margin: "16px 14px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="ol-sms-card" style={{ opacity: 0.5 }}>
              <div className="ol-sms-card-info">
                <div style={{ width: "60%", height: 16, background: "var(--ol-line)", borderRadius: 8, marginBottom: 8 }} />
                <div style={{ width: "40%", height: 12, background: "var(--ol-line)", borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="ol-error" style={{ margin: 16 }}>{error}</div>
      ) : items.length === 0 ? (
        <div className="ol-empty-state">
          <FaCheckCircle size={36} className="ol-empty-icon" />
          <p>No reminders due right now.</p>
        </div>
      ) : (
        <>
          <div className="ol-reminder-hint">
            {pending.length} of {items.length} pending. Tap "Send" to open your phone's SMS app
            with the message pre-filled. SMS charges apply.
          </div>

          {pending.length > 1 && (
            <div style={{ padding: "0 16px 12px" }}>
              <button className="ol-submit" onClick={sendAll}>
                Send all ({pending.length})
              </button>
            </div>
          )}

          <ul className="ol-reminder-list">
            {items.map((item) => {
              const sent = sentIds.has(item.customerId);
              return (
                <li key={item.customerId} className={`ol-reminder-card ${sent ? "is-sent" : ""}`}>
                  <div className="ol-reminder-card-head">
                    <div>
                      <strong className="ol-reminder-name">{item.customerName}</strong>
                      <div className="ol-reminder-mobile">+91 {item.customerMobile}</div>
                    </div>
                    <div className="ol-reminder-balance">
                      <div className="ol-reminder-amount">{formatINR(item.balance)}</div>
                      <small>outstanding</small>
                    </div>
                  </div>

                  <textarea
                    className="ol-reminder-textarea"
                    rows={3}
                    value={messageFor(item)}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [item.customerId]: e.target.value }))
                    }
                    disabled={sent}
                  />

                  <div className="ol-reminder-action">
                    {sent ? (
                      <span className="ol-reminder-sent">
                        <FaCheckCircle /> Triggered
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sendOne(item)}
                        className="ol-submit ol-reminder-send-btn"
                      >
                        <FaCommentDots /> Send SMS
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default ReminderQueueScreen;
