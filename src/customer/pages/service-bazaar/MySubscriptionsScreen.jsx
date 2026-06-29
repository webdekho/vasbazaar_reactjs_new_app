import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPause, FaPlay, FaForward, FaTimes } from "react-icons/fa";
import { subscriptionService } from "../../services/subscriptionService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

const FREQ_LABEL = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };

export default function MySubscriptionsScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await subscriptionService.getMine({ pageSize: 50 });
    if (res.success) setSubs(res.data?.records || []);
    else showToast(res.message || "Could not load subscriptions", "error");
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, fn, okMsg) => {
    setBusyId(id);
    const res = await fn(id);
    setBusyId(null);
    if (res.success) { showToast(okMsg, "success"); load(); }
    else showToast(res.message || "Action failed", "error");
  };

  return (
    <div className="sb-page">
      <div className="sb-topbar" style={{ marginBottom: 8 }}>
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">My Subscriptions</h1>
      </div>

      <div className="sb-results">
        {loading ? (
          <div className="sb-empty">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="sb-empty">No subscriptions yet. Subscribe to a service to get recurring deliveries.</div>
        ) : subs.map((s) => (
          <div className="sb-section" key={s.id} style={{ marginTop: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <p className="sb-card-name">{s.serviceOfferingId?.title || "Service"}</p>
                <p className="sb-card-meta">{s.providerProfileId?.businessName || s.providerProfileId?.providerName}</p>
                <p className="sb-card-meta">{FREQ_LABEL[s.frequency] || s.frequency} • Qty {s.quantity} • ₹{Number(s.unitPrice || 0).toFixed(0)}/delivery</p>
                <p className="sb-card-meta">{s.status === "ACTIVE" ? `Next: ${s.nextRunDate || "—"}` : s.status === "PAUSED" ? "Paused" : "Cancelled"} • {s.totalDeliveries || 0} delivered</p>
              </div>
              <span className={`sb-status ${s.status === "ACTIVE" ? "COMPLETED" : "PENDING"}`} style={{ fontSize: 10 }}>{s.status}</span>
            </div>
            {s.status !== "CANCELLED" && (
              <div className="sb-cta-row" style={{ marginTop: 10 }}>
                {s.status === "ACTIVE" ? (
                  <>
                    <button className="sb-btn ghost sm" disabled={busyId === s.id} onClick={() => act(s.id, subscriptionService.skipNext, "Next delivery skipped")}><FaForward style={{ marginRight: 4 }} /> Skip next</button>
                    <button className="sb-btn ghost sm" disabled={busyId === s.id} onClick={() => act(s.id, subscriptionService.pause, "Paused")}><FaPause style={{ marginRight: 4 }} /> Pause</button>
                  </>
                ) : (
                  <button className="sb-btn sm" disabled={busyId === s.id} onClick={() => act(s.id, subscriptionService.resume, "Resumed")}><FaPlay style={{ marginRight: 4 }} /> Resume</button>
                )}
                <button className="sb-btn danger sm" disabled={busyId === s.id} onClick={() => { if (window.confirm("Cancel this subscription?")) act(s.id, subscriptionService.cancel, "Cancelled"); }}><FaTimes style={{ marginRight: 4 }} /> Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
