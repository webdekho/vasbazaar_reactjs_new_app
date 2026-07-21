import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaGift, FaCoins, FaCrown, FaCheckCircle, FaWallet, FaBell, FaCalendarCheck } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import { formatDisplayDate } from "../../../utils/dateFormat";
import "./marketplace.css";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CB_TONE = {
  CREDITED: { bg: "rgba(16, 185, 129, 0.12)", color: "#059669" },
  PENDING: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  SKIPPED: { bg: "rgba(148, 163, 184, 0.18)", color: "#64748b" },
};

const MarketplaceRewardsScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loyalty, setLoyalty] = useState({ points: 0, valueInRupees: 0 });
  const [cashback, setCashback] = useState([]);
  const [plans, setPlans] = useState([]);
  const [membership, setMembership] = useState(null);

  const [redeemPts, setRedeemPts] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [buyingId, setBuyingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [balRes, cbRes, planRes, memRes] = await Promise.all([
      marketplaceService.getLoyaltyBalance(),
      marketplaceService.getMyCashback(),
      marketplaceService.getMembershipPlans(),
      marketplaceService.getMyMembership(),
    ]);
    if (balRes.success && balRes.data) {
      setLoyalty({
        points: Number(balRes.data.points || 0),
        valueInRupees: Number(balRes.data.valueInRupees || 0),
      });
    }
    if (cbRes.success) setCashback(Array.isArray(cbRes.data) ? cbRes.data : []);
    if (planRes.success) setPlans(Array.isArray(planRes.data) ? planRes.data : []);
    if (memRes.success) setMembership(memRes.data || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRedeem = async () => {
    const pts = Math.floor(Number(redeemPts));
    if (!pts || pts <= 0) { showToast("Enter points to redeem", "error"); return; }
    if (pts > loyalty.points) { showToast("Not enough points", "error"); return; }
    setRedeeming(true);
    const res = await marketplaceService.redeemLoyalty(pts);
    setRedeeming(false);
    if (res.success) {
      const credited = Number(res.data?.creditedRupees ?? res.data?.rupees ?? res.data?.amount ?? 0);
      showToast(credited > 0 ? `${rupee(credited)} added to wallet` : "Points redeemed", "success");
      setRedeemPts("");
      load();
    } else {
      showToast(res.message || "Redeem failed", "error");
    }
  };

  const handleBuy = async (plan) => {
    setBuyingId(plan.id);
    const res = await marketplaceService.purchaseMembership(plan.id);
    setBuyingId(null);
    if (res.success) {
      showToast("Membership activated", "success");
      load();
    } else {
      showToast(res.message || "Purchase failed", "error");
    }
  };

  const activeMembership = membership && String(membership.status || "").toUpperCase() === "ACTIVE" ? membership : null;

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Rewards</h1>
      </div>

      <div style={{ padding: "12px 14px 32px" }}>
        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : (
          <>
            {/* Wave 4 quick links: reminders & appointments */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => navigate("/customer/app/marketplace/reminders")}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(99,102,241,0.14)", color: "#6366f1", flexShrink: 0 }}><FaBell size={16} /></span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--cm-ink)" }}>Reminders</span>
              </button>
              <button
                onClick={() => navigate("/customer/app/marketplace/appointments")}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(16,185,129,0.14)", color: "#10b981", flexShrink: 0 }}><FaCalendarCheck size={16} /></span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--cm-ink)" }}>Appointments</span>
              </button>
            </div>

            {/* Loyalty balance card */}
            <div style={{ borderRadius: 16, padding: 16, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                <FaCoins size={14} /> Loyalty points
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6, lineHeight: 1 }}>{loyalty.points.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: 13, marginTop: 6, opacity: 0.95 }}>
                Worth {rupee(loyalty.valueInRupees)} in wallet
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Points"
                  value={redeemPts}
                  onChange={(e) => setRedeemPts(e.target.value)}
                  style={{ flex: 1, minWidth: 0, borderRadius: 10, border: "none", padding: "10px 12px", fontSize: 14, fontWeight: 600, color: "#111", outline: "none" }}
                />
                <button
                  type="button"
                  onClick={handleRedeem}
                  disabled={redeeming || loyalty.points <= 0}
                  style={{ borderRadius: 10, border: "none", padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", background: "#fff", color: "#4f46e5", opacity: (redeeming || loyalty.points <= 0) ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                >
                  <FaWallet size={12} /> {redeeming ? "…" : "Redeem"}
                </button>
              </div>
              <div style={{ fontSize: 11, marginTop: 8, opacity: 0.85 }}>
                Redeemed points are credited to your VasBazaar wallet.
              </div>
            </div>

            {/* Current membership */}
            {activeMembership && (
              <div style={{ borderRadius: 14, padding: 14, border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FaCrown size={16} color="#f59e0b" />
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-ink)" }}>
                    {activeMembership.planName || activeMembership.plan?.name || "Active membership"}
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#059669", background: "rgba(16,185,129,0.12)", borderRadius: 999, padding: "3px 10px" }}>ACTIVE</span>
                </div>
                {activeMembership.expiryAt && (
                  <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 6 }}>
                    Valid till {formatDisplayDate(activeMembership.expiryAt, "")}
                  </div>
                )}
              </div>
            )}

            {/* Membership plans */}
            <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>
              {activeMembership ? "Upgrade / renew" : "Membership plans"}
            </div>
            {plans.length === 0 ? (
              <div className="mkt-empty" style={{ marginBottom: 18 }}>No plans available right now.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {plans.map((p) => (
                  <div key={p.id} style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff", flexShrink: 0 }}>
                        <FaCrown size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--cm-ink)" }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: 12.5, color: "var(--cm-muted)", marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--cm-ink)" }}>{rupee(p.price)}</div>
                        {Number(p.validityDays) > 0 && (
                          <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{p.validityDays} days</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {Number(p.cashbackBoostPercent) > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#059669", background: "rgba(16,185,129,0.12)", borderRadius: 999, padding: "3px 10px" }}>
                          <FaGift size={10} /> +{Number(p.cashbackBoostPercent)}% cashback
                        </span>
                      )}
                      {Number(p.freeDeliveryMinOrder) > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#007BFF", background: "rgba(0,123,255,0.12)", borderRadius: 999, padding: "3px 10px" }}>
                          <FaCheckCircle size={10} /> Free delivery over {rupee(p.freeDeliveryMinOrder)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="mkt-btn mkt-btn--primary"
                      onClick={() => handleBuy(p)}
                      disabled={buyingId === p.id}
                      style={{ width: "100%", marginTop: 12 }}
                    >
                      {buyingId === p.id ? "Processing…" : `Buy with wallet · ${rupee(p.price)}`}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Cashback history */}
            <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>Cashback history</div>
            {cashback.length === 0 ? (
              <div className="mkt-empty">No cashback earned yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cashback.map((c) => {
                  const tone = CB_TONE[String(c.status || "").toUpperCase()] || CB_TONE.PENDING;
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(16,185,129,0.12)", color: "#059669", flexShrink: 0 }}>
                        <FaGift size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--cm-ink)" }}>Order #{c.orderId}</div>
                        <div style={{ fontSize: 11.5, color: "var(--cm-muted)" }}>
                          {formatDisplayDate(c.creditedAt || c.createdAt, "")}
                          {Number(c.percentApplied) > 0 ? ` · ${Number(c.percentApplied)}%` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-ink)" }}>{rupee(c.amount)}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.color }}>
                          {String(c.status || "").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MarketplaceRewardsScreen;
