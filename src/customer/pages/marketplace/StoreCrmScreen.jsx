import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUsers, FaSortAmountDown, FaClipboardCheck, FaChevronRight } from "react-icons/fa";
import { marketplaceVendorService } from "../../services/marketplaceVendorService";
import "./marketplace.css";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return d;
  }
};

const SORTS = [
  { key: "totalSpend", label: "Top spenders" },
  { key: "orderCount", label: "Most orders" },
  { key: "lastOrderDate", label: "Recent" },
];

/**
 * Seller CRM-lite: my store's customer roster derived from orders (read-only).
 * Mobile numbers arrive masked from the backend; full numbers stay on the
 * individual order screens only.
 */
const StoreCrmScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("totalSpend");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await marketplaceVendorService.getMyCrm();
      setLoading(false);
      if (res.success) setData(res.data || null);
    })();
  }, []);

  const summary = data?.summary || {};
  const customers = useMemo(() => {
    const list = Array.isArray(data?.customers) ? [...data.customers] : [];
    list.sort((a, b) => {
      if (sortKey === "lastOrderDate") return String(b.lastOrderDate || "").localeCompare(String(a.lastOrderDate || ""));
      return Number(b[sortKey] || 0) - Number(a[sortKey] || 0);
    });
    return list;
  }, [data, sortKey]);

  const Tile = ({ label, value, sub }) => (
    <div style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--cm-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Customers</h1>
      </div>

      <div style={{ padding: "8px 14px 90px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--cm-muted)", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {/* Summary tiles */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Tile label="Customers" value={summary.totalCustomers ?? 0} />
              <Tile label="Repeat" value={summary.repeatCustomers ?? 0} sub={`${summary.repeatRatePct ?? 0}% repeat rate`} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Tile label="Lifetime revenue" value={inr(summary.totalRevenue)} />
              <Tile label="Avg per customer" value={inr(summary.avgSpendPerCustomer)} />
            </div>

            {/* Scorecard shortcut */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate("/customer/app/marketplace/my-store/scorecard")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/customer/app/marketplace/my-store/scorecard"); } }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: 12, marginBottom: 16,
                borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)", cursor: "pointer",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", flexShrink: 0 }}>
                <FaClipboardCheck size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Seller scorecard</div>
                <div style={{ fontSize: 11.5, color: "var(--cm-muted)" }}>Cancellations, rejections & accept time</div>
              </div>
              <FaChevronRight size={12} color="var(--cm-muted)" />
            </div>

            {/* Sort control */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <FaSortAmountDown size={12} color="var(--cm-muted)" />
              {SORTS.map((s) => (
                <button key={s.key} type="button" onClick={() => setSortKey(s.key)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: sortKey === s.key ? "1px solid transparent" : "1px solid var(--cm-line)",
                    background: sortKey === s.key ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
                    color: sortKey === s.key ? "#fff" : "var(--cm-ink)",
                  }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Customer list */}
            {customers.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--cm-muted)", fontSize: 13 }}>
                <FaUsers size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>No customers yet — they appear here after their first paid order</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customers.map((c) => (
                  <div key={c.userId} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name || "Customer"}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--cm-muted)" }}>{c.mobileMasked}</div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                        background: c.customerType === "REPEAT" ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.18)",
                        color: c.customerType === "REPEAT" ? "#10b981" : "var(--cm-muted)",
                      }}>
                        {c.customerType === "REPEAT" ? "REPEAT" : "ONE-TIME"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, color: "var(--cm-muted)", flexWrap: "wrap" }}>
                      <span><b style={{ color: "var(--cm-ink)" }}>{c.orderCount}</b> orders</span>
                      <span><b style={{ color: "var(--cm-ink)" }}>{inr(c.totalSpend)}</b> spent</span>
                      <span><b style={{ color: "var(--cm-ink)" }}>{inr(c.avgBasket)}</b> avg basket</span>
                      <span>last: <b style={{ color: "var(--cm-ink)" }}>{fmtDate(c.lastOrderDate)}</b></span>
                    </div>
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

export default StoreCrmScreen;
