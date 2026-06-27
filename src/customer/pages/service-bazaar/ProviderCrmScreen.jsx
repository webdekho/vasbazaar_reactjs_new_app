import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaRupeeSign, FaUsers, FaRedo, FaCommentDots } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { serviceChatService } from "../../services/serviceChatService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Provider CRM + revenue dashboard (PRD: Provider CRM). Revenue funnel + a customer
 * book derived live from bookings, with a one-tap follow-up message (re-engagement).
 */
export default function ProviderCrmScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tab, setTab] = useState("revenue");
  const [rev, setRev] = useState(null);
  const [cust, setCust] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followUp, setFollowUp] = useState(null); // customer row being messaged
  const [fuText, setFuText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, c] = await Promise.all([
      serviceBazaarService.getProviderRevenue(),
      serviceBazaarService.getProviderCustomers(),
    ]);
    if (r.success) setRev(r.data);
    else showToast(r.message || "Become a provider first", "error");
    if (c.success) setCust(c.data);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const sendFollowUp = async () => {
    const t = fuText.trim();
    if (!t) { showToast("Type a message", "error"); return; }
    setBusy(true);
    const res = await serviceChatService.providerMessageCustomer(followUp.customerUserId, { messageText: t });
    setBusy(false);
    if (res.success) {
      showToast("Follow-up sent", "success");
      setFollowUp(null); setFuText("");
    } else showToast(res.message || "Could not send", "error");
  };

  if (loading) return <div className="sb-page"><div className="sb-empty">Loading…</div></div>;

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate("/customer/app/service-bazaar/provider")} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">My Business</h1>
      </div>

      <div className="sb-tabs">
        <button className={`sb-tab ${tab === "revenue" ? "active" : ""}`} onClick={() => setTab("revenue")}>Revenue</button>
        <button className={`sb-tab ${tab === "customers" ? "active" : ""}`} onClick={() => setTab("customers")}>Customers</button>
      </div>

      {tab === "revenue" && rev && (
        <>
          <div className="sb-crm-hero">
            <p className="sb-crm-hero-label"><FaRupeeSign style={{ marginRight: 4 }} />Net earnings (lifetime)</p>
            <p className="sb-crm-hero-value">{money(rev.netEarnings)}</p>
            <p className="sb-crm-hero-sub">Gross {money(rev.grossLifetime)} • Platform fee {money(rev.platformCommission)}</p>
          </div>

          <div className="sb-crm-grid">
            <div className="sb-crm-card"><p className="sb-crm-card-v">{money(rev.grossToday)}</p><p className="sb-crm-card-l">Today</p></div>
            <div className="sb-crm-card"><p className="sb-crm-card-v">{money(rev.grossThisWeek)}</p><p className="sb-crm-card-l">This week</p></div>
            <div className="sb-crm-card"><p className="sb-crm-card-v">{money(rev.grossThisMonth)}</p><p className="sb-crm-card-l">This month</p></div>
          </div>

          <div className="sb-section">
            <h3>Job funnel</h3>
            <div className="sb-crm-stats">
              <div className="sb-crm-stat"><span>{rev.totalBookings}</span>Total</div>
              <div className="sb-crm-stat"><span>{rev.completed}</span>Completed</div>
              <div className="sb-crm-stat"><span>{rev.confirmed + rev.inProgress}</span>Active</div>
              <div className="sb-crm-stat"><span>{rev.pending}</span>Pending</div>
              <div className="sb-crm-stat"><span>{rev.cancelled}</span>Cancelled</div>
            </div>
            {Number(rev.reviewCount) > 0 && (
              <p className="sb-card-meta" style={{ marginTop: 10 }}>
                ⭐ {Number(rev.ratingAvg).toFixed(1)} average from {rev.reviewCount} review{rev.reviewCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </>
      )}

      {tab === "customers" && cust && (
        <>
          <div className="sb-crm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-crm-card"><p className="sb-crm-card-v"><FaUsers style={{ marginRight: 5, fontSize: 14 }} />{cust.totalCustomers}</p><p className="sb-crm-card-l">Customers</p></div>
            <div className="sb-crm-card"><p className="sb-crm-card-v"><FaRedo style={{ marginRight: 5, fontSize: 13 }} />{cust.repeatCustomers}</p><p className="sb-crm-card-l">Repeat</p></div>
          </div>

          <div className="sb-results">
            {(cust.records || []).length === 0 ? (
              <div className="sb-empty">No customers yet. Your booking customers will appear here.</div>
            ) : cust.records.map((r) => (
              <div className="sb-booking" key={r.customerUserId}>
                <div className="sb-booking-head">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="sb-offering-title">
                      {r.name || "Customer"}
                      {r.isRepeat && <span className="sb-pill-repeat">Repeat</span>}
                    </p>
                    <p className="sb-offering-desc">
                      {r.bookingCount} booking{r.bookingCount === 1 ? "" : "s"} • {r.completedCount} done • spent {money(r.totalSpent)}
                    </p>
                    {r.lastServiceTitle && <p className="sb-offering-desc">Last: {r.lastServiceTitle}</p>}
                  </div>
                </div>
                <div className="sb-row-actions">
                  <button className="sb-btn sm ghost" onClick={() => { setFollowUp(r); setFuText(""); }}>
                    <FaCommentDots style={{ marginRight: 5 }} /> Follow up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {followUp && (
        <div className="sb-modal-backdrop" onClick={() => setFollowUp(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Message {followUp.name || "customer"}</h3>
            <p className="sb-card-meta" style={{ marginBottom: 10 }}>Send a re-engagement message. It opens a chat they can reply to.</p>
            <div className="sb-field">
              <textarea rows={3} value={fuText} onChange={(e) => setFuText(e.target.value)} placeholder="e.g. Time for your monthly service? Book now for 10% off." />
            </div>
            <button className="sb-btn block" disabled={busy} onClick={sendFollowUp}>{busy ? "Sending…" : "Send follow-up"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setFollowUp(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
