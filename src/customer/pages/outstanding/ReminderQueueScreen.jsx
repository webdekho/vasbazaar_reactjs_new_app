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
    <div className="cm-page ol-page">
      <header className="cm-app-header">
        <button className="cm-back" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <h2>Send reminders</h2>
      </header>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
      ) : error ? (
        <div className="ol-error" style={{ margin: 16 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
          <FaCheckCircle size={36} color="#2e7d32" />
          <p>No reminders due right now.</p>
        </div>
      ) : (
        <>
          <div style={{ padding: "12px 16px", color: "#555", fontSize: 14 }}>
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

          <ul className="ol-customer-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((item) => {
              const sent = sentIds.has(item.customerId);
              return (
                <li
                  key={item.customerId}
                  style={{
                    padding: 16,
                    borderBottom: "1px solid #eee",
                    background: sent ? "#f5fff5" : "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <strong>{item.customerName}</strong>
                      <div style={{ fontSize: 13, color: "#666" }}>+91 {item.customerMobile}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600, color: "#c62828" }}>{formatINR(item.balance)}</div>
                      <small style={{ color: "#888" }}>outstanding</small>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={messageFor(item)}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [item.customerId]: e.target.value }))
                    }
                    style={{ width: "100%", boxSizing: "border-box", padding: 8, fontSize: 13 }}
                    disabled={sent}
                  />

                  <div style={{ marginTop: 8 }}>
                    {sent ? (
                      <span style={{ color: "#2e7d32", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <FaCheckCircle /> Triggered
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sendOne(item)}
                        className="ol-submit"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "auto", padding: "8px 16px" }}
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
