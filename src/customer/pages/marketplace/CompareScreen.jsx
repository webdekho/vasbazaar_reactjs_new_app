import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore, FaTimes, FaBalanceScale } from "react-icons/fa";
import { useMarketplaceCompare } from "../../context/MarketplaceCompareContext";
import "./marketplace.css";

// Best available price for a product row (offer wins, else selling).
const effPrice = (it) =>
  Number(it.offerPrice && Number(it.offerPrice) > 0 ? it.offerPrice : it.sellingPrice) || 0;

const ratingOf = (it) => {
  const r = Number(it.avgRating ?? it.rating ?? 0);
  return r > 0 ? r.toFixed(1) : "—";
};

const money = (v) => {
  const n = Number(v);
  return n > 0 ? `₹${n.toFixed(0)}` : "—";
};

const text = (v) => (v != null && String(v).trim() !== "" ? String(v) : "—");

/**
 * Side-by-side comparison of up to 3 products the shopper picked from a store's
 * grid. Pure client-side view over the compare context — no fetches, no cart
 * writes here (each column links back to its store to add).
 */
const CompareScreen = () => {
  const navigate = useNavigate();
  const { items, remove, clear } = useMarketplaceCompare();

  const rows = [
    { label: "Brand", render: (it) => text(it.brand) },
    { label: "Pack size", render: (it) => text(it.packSize) },
    { label: "Unit", render: (it) => text(it.unit) },
    { label: "Price", render: (it) => <strong style={{ color: "var(--cm-ink)" }}>{money(effPrice(it))}</strong> },
    { label: "MRP", render: (it) => money(it.mrp) },
    { label: "Selling price", render: (it) => money(it.sellingPrice) },
    { label: "Offer price", render: (it) => money(it.offerPrice) },
    { label: "Rating", render: (it) => ratingOf(it) },
  ];

  if (!items || items.length === 0) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Compare</h1>
        </div>
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaBalanceScale /></div>
          <div>No products to compare</div>
          <button
            className="mkt-btn mkt-btn--primary"
            onClick={() => navigate("/customer/app/marketplace")}
            style={{ width: "auto", padding: "10px 24px", marginTop: 12 }}
          >
            Browse products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Compare ({items.length})</h1>
        <button
          type="button"
          className="mkt-store-share-btn"
          onClick={clear}
          aria-label="Clear comparison"
          title="Clear all"
        >
          <FaTimes size={14} />
        </button>
      </div>

      <div style={{ overflowX: "auto", padding: "12px 14px 24px", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: items.length > 2 ? 460 : 340 }}>
          <thead>
            <tr>
              <th style={{ width: 92, textAlign: "left", verticalAlign: "bottom", padding: "0 8px 10px 0" }} />
              {items.map((it) => (
                <th key={it.id} style={{ padding: "0 6px 10px", verticalAlign: "bottom", minWidth: 120 }}>
                  <div style={{ position: "relative", border: "1px solid var(--cm-line)", borderRadius: 14, padding: 10, background: "var(--cm-card)" }}>
                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      aria-label={`Remove ${it.name}`}
                      style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(248,113,113,0.15)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    >
                      <FaTimes size={10} />
                    </button>
                    <div style={{ width: "100%", height: 78, borderRadius: 10, overflow: "hidden", background: "var(--cm-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {it.imageUrl ? <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaStore size={22} color="var(--cm-muted)" />}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "var(--cm-ink)", lineHeight: 1.3, minHeight: 32, overflow: "hidden" }}>
                      {it.name}
                    </div>
                    {it.storeId != null && (
                      <button
                        type="button"
                        onClick={() => navigate(`/customer/app/marketplace/store/${it.storeId}?item=${it.id}`)}
                        style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 700, color: "var(--cm-accent, #007BFF)", cursor: "pointer" }}
                      >
                        View / Add ›
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.label} style={{ background: ri % 2 ? "var(--cm-card)" : "transparent" }}>
                <td style={{ fontSize: 11.5, fontWeight: 600, color: "var(--cm-muted)", padding: "10px 8px 10px 0", whiteSpace: "nowrap" }}>
                  {row.label}
                </td>
                {items.map((it) => (
                  <td key={it.id} style={{ fontSize: 12.5, color: "var(--cm-ink)", textAlign: "center", padding: "10px 6px", borderTop: "1px solid var(--cm-line)" }}>
                    {row.render(it)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CompareScreen;
