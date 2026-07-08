import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaClipboardCheck, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { marketplaceVendorService } from "../../services/marketplaceVendorService";
import "./marketplace.css";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const fmtMinutes = (m) => {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

/**
 * Seller scorecard (read-only): total orders, seller-cancellation and reject
 * rates, and average accept time over a rolling window, benchmarked against
 * the 2.5% marketplace seller-cancel standard.
 */
const StoreScorecardScreen = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceVendorService.getMyScorecard(days);
    setLoading(false);
    if (res.success) setCard(res.data || null);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const warn = Boolean(card?.cancelRateHigh);

  const Metric = ({ label, value, sub, danger }) => (
    <div style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: danger ? "#e5484d" : "var(--cm-ink)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--cm-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Seller Scorecard</h1>
      </div>

      <div style={{ padding: "8px 14px 90px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
          How reliably you fulfil orders. Marketplaces flag sellers whose own cancellations cross{" "}
          <b>{card?.cancelRateBenchmarkPct ?? 2.5}%</b> of orders.
        </div>

        {/* Window picker */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {WINDOWS.map((w) => (
            <button key={w.days} type="button" onClick={() => setDays(w.days)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: days === w.days ? "1px solid transparent" : "1px solid var(--cm-line)",
                background: days === w.days ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
                color: days === w.days ? "#fff" : "var(--cm-ink)",
              }}>
              {w.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--cm-muted)", fontSize: 13 }}>Loading…</div>
        ) : !card ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--cm-muted)", fontSize: 13 }}>
            <FaClipboardCheck size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>Could not load your scorecard</div>
          </div>
        ) : (
          <>
            {/* SLA banner */}
            <div style={{
              display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, marginBottom: 14,
              border: `1px solid ${warn ? "rgba(229,72,77,0.4)" : "rgba(16,185,129,0.35)"}`,
              background: warn ? "rgba(229,72,77,0.08)" : "rgba(16,185,129,0.08)",
            }}>
              {warn
                ? <FaExclamationTriangle size={15} color="#e5484d" style={{ marginTop: 1, flexShrink: 0 }} />
                : <FaCheckCircle size={15} color="#10b981" style={{ marginTop: 1, flexShrink: 0 }} />}
              <div style={{ fontSize: 12.5, color: "var(--cm-ink)", lineHeight: 1.45 }}>{card.slaNote}</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Metric label="Total orders" value={card.totalOrders ?? 0} />
              <Metric label="Avg accept time" value={fmtMinutes(card.avgAcceptMinutes)} sub="placed → accepted" />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Metric
                label="Cancelled by you"
                value={`${card.sellerCancelRatePct ?? 0}%`}
                sub={`${card.sellerCancelledCount ?? 0} orders · benchmark < ${card.cancelRateBenchmarkPct ?? 2.5}%`}
                danger={warn}
              />
              <Metric
                label="Rejected"
                value={`${card.rejectRatePct ?? 0}%`}
                sub={`${card.rejectedCount ?? 0} orders`}
              />
            </div>

            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 10 }}>
              Period: {card.fromDate} → {card.toDate}. Seller cancellations are orders you cancelled after accepting;
              rejections are orders you declined. Both hurt customer trust and store ranking.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StoreScorecardScreen;
