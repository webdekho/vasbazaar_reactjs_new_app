import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore, FaTrash, FaHeart, FaPlus } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useToast } from "../../context/ToastContext";
import "./marketplace.css";

// Best available price for a saved product's embedded item.
const effPrice = (it) =>
  Number(it.offerPrice && Number(it.offerPrice) > 0 ? it.offerPrice : it.sellingPrice) || 0;

/**
 * "Saved Products" — the NEW saved-product wishlist (distinct from the
 * 'request-an-item' MyWishlistScreen). Lists products the shopper hearted from
 * the store grid / product sheet, keyed by item id. Supports remove and
 * add-to-cart (the store's real delivery meta is fetched before adding so the
 * cart totals stay correct; the server re-computes money on checkout anyway).
 */
const MySavedItemsScreen = () => {
  const navigate = useNavigate();
  const { addItem } = useMarketplaceCart();
  const { showToast } = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingId, setAddingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    marketplaceService.getSavedItems()
      .then((res) => {
        if (res.success) setRows(Array.isArray(res.data) ? res.data : []);
        else setError(res.message || "Could not load saved products");
      })
      .catch(() => setError("Could not load saved products"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (itemId) => {
    // Optimistic — the endpoint is idempotent so a stale row is harmless.
    setRows((prev) => prev.filter((r) => String(r.itemId) !== String(itemId)));
    const res = await marketplaceService.removeSavedItem(itemId);
    if (!res.success) { showToast(res.message || "Could not remove", "error"); load(); }
  };

  const handleAddToCart = async (row) => {
    const item = row.item || {};
    if (item.isAvailable === false) { showToast("This item is currently unavailable", "error"); return; }
    setAddingId(row.itemId);
    // Pull the store so delivery charges / min-order carry into the cart bucket.
    const sRes = await marketplaceService.getStore(row.storeId);
    setAddingId(null);
    if (!sRes.success || !sRes.data) { showToast("Could not open the store for this item", "error"); return; }
    const ok = addItem(sRes.data, {
      id: row.itemId,
      name: item.name,
      sellingPrice: item.sellingPrice,
      offerPrice: item.offerPrice,
      imageUrl: item.imageUrl,
    });
    if (ok) showToast(`${item.name || "Item"} added to cart`, "success");
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Saved Products</h1>
      </div>

      {loading ? (
        <div className="mkt-empty">Loading saved products…</div>
      ) : error ? (
        <div className="mkt-empty mkt-empty-v2">
          <div className="mkt-empty-icon-v2">!</div>
          <div className="mkt-empty-title">Couldn't load</div>
          <div className="mkt-empty-sub">{error}</div>
          <button className="mkt-btn mkt-btn--secondary" onClick={load} style={{ width: "auto", marginTop: 14, padding: "10px 22px" }}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaHeart /></div>
          <div>No saved products yet</div>
          <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
            Tap the heart on any product to save it here.
          </div>
          <button
            className="mkt-btn mkt-btn--primary"
            onClick={() => navigate("/customer/app/marketplace")}
            style={{ width: "auto", padding: "10px 24px", marginTop: 12 }}
          >
            Browse products
          </button>
        </div>
      ) : (
        <div style={{ padding: "8px 0 24px" }}>
          {rows.map((row) => {
            const item = row.item || {};
            const price = effPrice(item);
            const mrp = item.mrp && Number(item.mrp) > price ? Number(item.mrp) : null;
            const unavailable = item.isAvailable === false;
            return (
              <div key={row.id ?? row.itemId} className="mkt-cart-line">
                <div
                  className="mkt-cart-line-img"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/customer/app/marketplace/store/${row.storeId}?item=${row.itemId}`)}
                >
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <FaStore size={20} />}
                </div>
                <div className="mkt-cart-line-info">
                  <p className="mkt-cart-line-name">{item.name || `Item #${row.itemId}`}</p>
                  {(item.brand || item.packSize) && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 1 }}>
                      {[item.brand, item.packSize].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <div className="mkt-cart-line-price">
                    ₹{price.toFixed(0)}
                    {mrp && <span style={{ textDecoration: "line-through", color: "var(--cm-muted)", marginLeft: 6 }}>₹{mrp.toFixed(0)}</span>}
                  </div>
                  <button
                    type="button"
                    className="mkt-btn mkt-btn--secondary"
                    onClick={() => handleAddToCart(row)}
                    disabled={unavailable || addingId === row.itemId}
                    style={{ width: "auto", padding: "6px 12px", fontSize: 12, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, opacity: unavailable ? 0.5 : 1 }}
                  >
                    <FaPlus size={10} />
                    {addingId === row.itemId ? "Adding…" : unavailable ? "Unavailable" : "Add to cart"}
                  </button>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => handleRemove(row.itemId)}
                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                    aria-label="Remove from saved"
                    title="Remove"
                  >
                    <FaTrash size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MySavedItemsScreen;
