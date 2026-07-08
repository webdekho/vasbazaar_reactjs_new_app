import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStar } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const STATUS_TONE = {
  PLACED: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  ACCEPTED: { bg: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" },
  PREPARING: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" },
  OUT_FOR_DELIVERY: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" },
  DELIVERED: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444" },
  CANCELLED: { bg: "rgba(148, 163, 184, 0.18)", color: "#64748b" },
};

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rupee0 = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const StoreAnalyticsScreen = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    const res = await marketplaceService.getMyStoreAnalytics(d);
    setLoading(false);
    if (res.success) setData(res.data || null);
    else setError(res.message || "Failed to load analytics");
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const kpis = data?.kpis || {};
  const dailySeries = Array.isArray(data?.dailySeries) ? data.dailySeries : [];
  const statusBreakdown = data?.statusBreakdown || {};
  const topItems = Array.isArray(data?.topItems) ? data.topItems : [];
  const maxRevenue = dailySeries.reduce((m, p) => Math.max(m, Number(p.revenue || 0)), 0);

  // Category split (Wave 3): [{ category, revenue, orders? }]. Tolerate a few
  // field-name shapes so the panel renders whatever the backend sends.
  const categorySplit = (Array.isArray(data?.categorySplit) ? data.categorySplit : [])
    .map((c) => ({
      category: c.category || c.name || c.categoryName || "Uncategorised",
      revenue: Number(c.revenue ?? c.amount ?? c.total ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxCatRevenue = categorySplit.reduce((m, c) => Math.max(m, c.revenue), 0);

  // Explicit cancellation headline (Wave 3): prefer the server field, else derive
  // it from the status breakdown (CANCELLED + REJECTED).
  const cancellationCount =
    data?.cancellationCount ??
    kpis?.cancellationCount ??
    (Number(statusBreakdown.CANCELLED || 0) + Number(statusBreakdown.REJECTED || 0));

  const kpiCards = [
    { label: "Today's revenue", value: rupee(kpis.todayRevenue) },
    { label: "Today's orders", value: kpis.todayOrders ?? 0 },
    { label: "GMV", value: rupee(kpis.gmv) },
    { label: "Orders", value: kpis.orderCount ?? 0 },
    { label: "AOV", value: rupee(kpis.aov) },
    { label: "Unique customers", value: kpis.uniqueCustomers ?? 0 },
    { label: "Repeat rate", value: `${Number(kpis.repeatRatePct || 0).toFixed(1)}%` },
    { label: "Cancellations", value: cancellationCount },
    { label: "Avg rating", value: `${Number(data?.avgRating || 0).toFixed(1)} (${data?.reviewCount ?? 0})` },
  ];

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Analytics</h1>
      </div>

      <div style={{ padding: "12px 14px 24px" }}>
        {/* Range selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: 4, borderRadius: 12, background: "var(--cm-bg-secondary)", border: "1px solid var(--cm-line)", marginBottom: 14 }}>
          {RANGES.map((r) => {
            const isActive = days === r.days;
            return (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                style={{
                  minWidth: 0, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 700,
                  background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "transparent",
                  color: isActive ? "#fff" : "var(--cm-muted)",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {data?.businessName && (
          <div style={{ fontSize: 13, color: "var(--cm-muted)", marginBottom: 12 }}>
            <strong style={{ color: "var(--cm-ink)" }}>{data.businessName}</strong>
            {data.from && data.to ? ` · ${data.from} → ${data.to}` : ""}
          </div>
        )}

        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : !data ? (
          <div className="mkt-empty">No analytics available yet.</div>
        ) : (
          <>
            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              {kpiCards.map((k) => (
                <div key={k.label} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", fontWeight: 600 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--cm-ink)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    {k.label === "Avg rating" && <FaStar size={13} color="#f59e0b" />}
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Daily revenue bar chart */}
            <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>Daily revenue</div>
            <div style={{ padding: 14, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", marginBottom: 18 }}>
              {dailySeries.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>No data in this range.</div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140, overflowX: "auto", paddingBottom: 4 }}>
                  {dailySeries.map((p) => {
                    const rev = Number(p.revenue || 0);
                    const pct = maxRevenue > 0 ? Math.max(2, Math.round((rev / maxRevenue) * 100)) : 2;
                    return (
                      <div key={p.date} title={`${p.date}: ${rupee(rev)} · ${p.orders || 0} orders`} style={{ flex: "1 0 8px", minWidth: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                        <div style={{ width: "100%", height: `${pct}%`, borderRadius: 4, background: "linear-gradient(180deg, #40E0D0, #007BFF)" }} />
                      </div>
                    );
                  })}
                </div>
              )}
              {dailySeries.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--cm-muted)" }}>
                  <span>{dailySeries[0]?.date}</span>
                  <span>Peak {rupee0(maxRevenue)}</span>
                  <span>{dailySeries[dailySeries.length - 1]?.date}</span>
                </div>
              )}
            </div>

            {/* Status breakdown */}
            <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>Order status</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {Object.keys(statusBreakdown).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>No orders yet.</div>
              ) : (
                Object.entries(statusBreakdown).map(([status, count]) => {
                  const tone = STATUS_TONE[status] || STATUS_TONE.ACCEPTED;
                  return (
                    <span key={status} style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: tone.bg, color: tone.color }}>
                      {String(status).replace(/_/g, " ")} <span style={{ opacity: 0.85 }}>({count})</span>
                    </span>
                  );
                })
              )}
            </div>

            {/* Category split (Wave 3) */}
            {categorySplit.length > 0 && (
              <>
                <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>Revenue by category</div>
                <div style={{ padding: 14, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {categorySplit.map((c, idx) => {
                    const pct = maxCatRevenue > 0 ? Math.max(3, Math.round((c.revenue / maxCatRevenue) * 100)) : 3;
                    return (
                      <div key={`${c.category}-${idx}`}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "var(--cm-ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{c.category}</span>
                          <span style={{ color: "var(--cm-muted)", fontWeight: 700 }}>{rupee(c.revenue)}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "var(--cm-bg-secondary)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #40E0D0, #007BFF)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Top items leaderboard */}
            <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>Top items</div>
            {topItems.length === 0 ? (
              <div className="mkt-empty">No sales yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topItems.map((it, idx) => (
                  <div key={`${it.name}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Qty {it.quantity ?? 0}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{rupee(it.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StoreAnalyticsScreen;
