import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUserCircle } from "react-icons/fa";
import { marketplaceWave6Service } from "../../services/marketplaceWave6Service";
import "./marketplace.css";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const CHURN_TONE = {
  HIGH: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", label: "High risk" },
  MEDIUM: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", label: "At risk" },
  LOW: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", label: "Active" },
  NEW: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", label: "New" },
};

const SEGMENT_TONE = {
  Champion: "#10b981",
  Loyal: "#14b8a6",
  "At-Risk": "#f59e0b",
  Lost: "#ef4444",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "HIGH", label: "High risk" },
  { key: "MEDIUM", label: "At risk" },
];

const StoreCustomerInsightsScreen = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await marketplaceWave6Service.getMyCustomerInsights();
    setLoading(false);
    if (res.success) setRows(Array.isArray(res.data) ? res.data : []);
    else setError(res.message || "Failed to load customer insights");
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => String(r.churnRisk || "").toUpperCase() === filter);
  }, [rows, filter]);

  const totalClv = useMemo(() => rows.reduce((s, r) => s + Number(r.totalSpend || 0), 0), [rows]);
  const atRisk = useMemo(() => rows.filter((r) => ["HIGH", "MEDIUM"].includes(String(r.churnRisk || "").toUpperCase())).length, [rows]);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Customer Insights</h1>
      </div>

      <div style={{ padding: "12px 14px 24px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
          Lifetime value and churn risk per customer, from their order recency and frequency.
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Customers", value: rows.length },
              { label: "Total CLV", value: rupee(totalClv) },
              { label: "At risk", value: atRisk },
            ].map((k) => (
              <div key={k.label} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                <div style={{ fontSize: 10, color: "var(--cm-muted)", fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cm-ink)", marginTop: 4 }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "8px 14px", borderRadius: 999, border: "1px solid var(--cm-line)", cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
                  color: isActive ? "#fff" : "var(--cm-muted)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="mkt-empty">No customers in this view yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((c) => {
              const tone = CHURN_TONE[String(c.churnRisk || "").toUpperCase()] || CHURN_TONE.LOW;
              const segColor = SEGMENT_TONE[c.segment] || "var(--cm-muted)";
              return (
                <div key={c.userId} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <FaUserCircle size={34} color="var(--cm-muted)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name || c.mobile || `Customer #${c.userId}`}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                        {c.mobile ? `${c.mobile} · ` : ""}{c.orderCount ?? 0} order{Number(c.orderCount) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: tone.bg, color: tone.color, flexShrink: 0 }}>{tone.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--cm-ink)" }}>
                      {rupee(c.totalSpend)} <span style={{ fontSize: 10, fontWeight: 600, color: "var(--cm-muted)" }}>CLV</span>
                    </div>
                    {c.segment && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: segColor }}>{c.segment}</span>
                    )}
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>
                      {c.recencyDays != null ? `Last order ${c.recencyDays}d ago` : ""}
                      {c.medianGapDays != null ? ` · buys every ~${c.medianGapDays}d` : ""}
                    </div>
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

export default StoreCustomerInsightsScreen;
