import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaMotorcycle, FaCheckCircle, FaTimesCircle, FaStopwatch, FaBolt, FaChartLine } from "react-icons/fa";
import { marketplaceLogisticsAiService } from "../../services/marketplaceLogisticsAiService";
import "./marketplace.css";

/**
 * Seller Rider Performance (Logistics v2 / Wave 5) — read-only per-rider
 * analytics from GET /store/my/riders/performance: deliveries, failed attempts,
 * average delivery minutes, on-time % (deliveredAt <= promisedBy) and current
 * open load. Optional date range windows by delivered_at. Money-neutral.
 *
 * Route: /customer/app/marketplace/my-store/rider-performance
 */
const pct = (v) => (v == null ? "—" : `${Math.round(Number(v) * (Number(v) <= 1 ? 100 : 1))}%`);
const mins = (v) => (v == null ? "—" : `${Math.round(Number(v))} min`);

const StoreRiderPerformanceScreen = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await marketplaceLogisticsAiService.getRiderPerformance({ from, to });
    setLoading(false);
    if (res.success) setRows(Array.isArray(res.data) ? res.data : []);
    else setError(res.message || "Could not load rider performance");
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Rider Performance</h1>
      </div>

      <div style={{ padding: "0 14px 24px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", margin: "4px 0 12px" }}>
          Delivery stats per active rider. On-time compares actual delivery against the promised time.
        </div>

        {/* Date range (optional) */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "var(--cm-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            From
            <input type="date" className="mkt-input" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: "7px 10px" }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--cm-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            To
            <input type="date" className="mkt-input" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "7px 10px" }} />
          </label>
          {(from || to) && (
            <button
              type="button"
              onClick={() => { setFrom(""); setTo(""); }}
              className="mkt-btn mkt-btn--secondary"
              style={{ width: "auto", padding: "8px 14px", fontSize: 12 }}
            >
              Clear
            </button>
          )}
        </div>

        {error && <div style={{ marginBottom: 10, fontSize: 12, color: "#ef4444" }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="mkt-empty">
            <div className="mkt-empty-icon"><FaChartLine /></div>
            No rider activity in this range yet.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.riderId}
              style={{ background: "var(--cm-card)", borderRadius: 14, padding: 14, border: "1px solid var(--cm-line)", marginBottom: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                  <FaMotorcycle size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cm-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{r.mobile}</div>
                </div>
                {Number(r.openLoad) > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#8b5cf6", background: "rgba(139,92,246,0.12)", padding: "3px 9px", borderRadius: 8 }}>
                    <FaBolt size={10} /> {r.openLoad} open
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <Stat icon={<FaCheckCircle size={12} color="#10b981" />} label="Delivered" value={r.totalDelivered ?? 0} />
                <Stat icon={<FaTimesCircle size={12} color="#ef4444" />} label="Failed attempts" value={r.totalFailedAttempts ?? 0} />
                <Stat icon={<FaStopwatch size={12} color="#0ea5e9" />} label="Avg delivery" value={mins(r.avgDeliveryMinutes)} />
                <Stat icon={<FaChartLine size={12} color="#f59e0b" />} label="On-time" value={pct(r.onTimeRate)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--cm-bg)", borderRadius: 10, padding: "8px 10px", border: "1px solid var(--cm-line)" }}>
    <div style={{ flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--cm-ink)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{label}</div>
    </div>
  </div>
);

export default StoreRiderPerformanceScreen;
