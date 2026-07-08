import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBoxOpen } from "react-icons/fa";
import { marketplaceWave6Service } from "../../services/marketplaceWave6Service";
import "./marketplace.css";

const RANGES = [
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
];

const URGENCY_TONE = {
  HIGH: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", label: "Reorder now" },
  MED: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", label: "Reorder soon" },
  LOW: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", label: "Healthy" },
};

const fmtDays = (n) => (n == null || !isFinite(Number(n)) ? "—" : `${Number(n).toFixed(n < 10 ? 1 : 0)}d`);

const StoreRestockScreen = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    const res = await marketplaceWave6Service.getMyRestockSuggestions(d);
    setLoading(false);
    if (res.success) setRows(Array.isArray(res.data) ? res.data : []);
    else setError(res.message || "Failed to load restock suggestions");
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Restock Suggestions</h1>
      </div>

      <div style={{ padding: "12px 14px 24px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
          Items running low or selling fast, with a suggested reorder quantity based on recent sales velocity.
        </div>

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

        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="mkt-empty">Nothing needs restocking right now.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((it) => {
              const tone = URGENCY_TONE[it.urgency] || URGENCY_TONE.LOW;
              return (
                <div key={it.itemId} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--cm-line)", overflow: "hidden", flexShrink: 0 }}>
                      {it.imageUrl ? <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaBoxOpen size={16} color="var(--cm-muted)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                        In stock {it.currentStockQty ?? 0}{it.lowStockThreshold != null ? ` · low at ${it.lowStockThreshold}` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: tone.bg, color: tone.color, flexShrink: 0 }}>{tone.label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                    {[
                      { label: "Sold", value: `${it.unitsSold ?? 0} / ${it.days ?? days}d` },
                      { label: "Runs out in", value: fmtDays(it.daysToStockout) },
                      { label: "Reorder", value: `${it.suggestedReorderQty ?? 0}` },
                    ].map((m) => (
                      <div key={m.label} style={{ padding: "8px 10px", borderRadius: 10, background: "var(--cm-bg-secondary)" }}>
                        <div style={{ fontSize: 10, color: "var(--cm-muted)", fontWeight: 600 }}>{m.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-ink)", marginTop: 2 }}>{m.value}</div>
                      </div>
                    ))}
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

export default StoreRestockScreen;
