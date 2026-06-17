import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaClock, FaPause, FaPlay, FaTrash, FaStore, FaSyncAlt } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import "./marketplace.css";

const PAY_LABEL = { WALLET: "Wallet", COD: "Cash on Delivery", AUTOPAY: "Autopay (HDFC)" };
const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const cadenceText = (s) => {
  if (s.frequency === "WEEKLY") {
    const days = String(s.daysOfWeek || "")
      .split(",")
      .filter(Boolean)
      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      .map((d) => d[0] + d.slice(1).toLowerCase())
      .join(", ");
    return `Weekly · ${days || "—"}`;
  }
  return "Every day";
};

const timeText = (t) => (t ? String(t).slice(0, 5) : "--:--");
const dateText = (d) => (d ? String(d).slice(0, 10) : null);

const MySubscriptionsScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMySubscriptions();
    setLoading(false);
    if (res.success) setSubs(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (sub) => {
    setBusyId(sub.id);
    const next = !sub.active;
    const res = await marketplaceService.toggleSubscription(sub.id, next);
    setBusyId(null);
    if (res.success) {
      showToast(next ? "Subscription resumed" : "Subscription paused", next ? "success" : "info");
      load();
    } else {
      showToast(res.message || "Could not update", "error");
    }
  };

  const cancel = async (sub) => {
    if (!window.confirm("Cancel this subscription? Future auto-orders will stop.")) return;
    setBusyId(sub.id);
    const res = await marketplaceService.cancelSubscription(sub.id);
    setBusyId(null);
    if (res.success) {
      showToast("Subscription cancelled", "info");
      setSubs((p) => p.filter((s) => s.id !== sub.id));
    } else {
      showToast(res.message || "Could not cancel", "error");
    }
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Subscriptions</h1>
      </div>

      <div style={{ padding: "8px 14px 90px" }}>
        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="mkt-empty-v2" style={{ marginTop: 12 }}>
            <div className="mkt-empty-icon-v2"><FaSyncAlt /></div>
            <div className="mkt-empty-title">No subscriptions yet</div>
            <div className="mkt-empty-sub">Add items to cart and choose “Subscribe” at checkout to set up recurring delivery.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {subs.map((s) => {
              const paused = !s.active;
              return (
                <div key={s.id} style={{
                  border: "1px solid var(--cm-line)", borderRadius: 16, padding: 14, background: "var(--cm-card)",
                  opacity: paused ? 0.7 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <FaStore size={13} color="var(--cm-muted)" />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: "var(--cm-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.storeId?.businessName || "Store"}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                      background: paused ? "rgba(245,158,11,0.16)" : "rgba(16,185,129,0.16)",
                      color: paused ? "#f59e0b" : "#10b981",
                    }}>
                      {paused ? "Paused" : "Active"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 4 }}>
                    <FaClock size={11} color="#007BFF" /> {cadenceText(s)} at {timeText(s.deliveryTime)}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--cm-muted)", marginBottom: 2 }}>
                    Pay via {PAY_LABEL[s.paymentMethod] || s.paymentMethod} · {s.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}
                  </div>
                  {s.nextRunAt && !paused && (
                    <div style={{ fontSize: 11.5, color: "var(--cm-muted)" }}>
                      Next order: {String(s.nextRunAt).replace("T", " ").slice(0, 16)}
                    </div>
                  )}
                  {dateText(s.endDate) && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>Ends {dateText(s.endDate)}</div>
                  )}
                  {s.lastError && (
                    <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Last run: {s.lastError}</div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => toggle(s)} disabled={busyId === s.id}
                      className="mkt-btn mkt-btn--secondary" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5 }}>
                      {paused ? <><FaPlay size={11} style={{ marginRight: 6 }} /> Resume</> : <><FaPause size={11} style={{ marginRight: 6 }} /> Pause</>}
                    </button>
                    <button type="button" onClick={() => cancel(s)} disabled={busyId === s.id}
                      className="mkt-btn mkt-btn--secondary" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5, color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }}>
                      <FaTrash size={11} style={{ marginRight: 6 }} /> Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySubscriptionsScreen;
