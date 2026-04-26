import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaStore, FaClock, FaRupeeSign, FaPlus, FaMinus, FaShareAlt } from "react-icons/fa";
import { FiSearch } from "react-icons/fi";
import { marketplaceService } from "../../services/marketplaceService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { shareStore } from "./shareStore";
import "./marketplace.css";

const StoreDetailScreen = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { addItem, decrementItem, getItemQty, totals, cart } = useMarketplaceCart();

  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      marketplaceService.getStore(storeId),
      marketplaceService.getStoreItems(storeId),
    ])
      .then(([sRes, iRes]) => {
        if (sRes.success && sRes.data) setStore(sRes.data);
        else setError(sRes.message || "Store not found");
        if (iRes.success) setItems(Array.isArray(iRes.data) ? iRes.data : []);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((i) => (i.name || "").toLowerCase().includes(q));
  }, [items, debouncedSearch]);

  const handleAdd = useCallback((item) => {
    if (!store) return;
    addItem(store, item);
  }, [addItem, store]);

  if (loading) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Loading…</h1>
        </div>
        <div className="mkt-empty">Loading store…</div>
      </div>
    );
  }
  if (error || !store) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Marketplace</h1>
        </div>
        <div className="mkt-empty">{error || "Store not found"}</div>
      </div>
    );
  }

  const closed = store.isOpen === false;

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">{store.businessName}</h1>
        <button
          type="button"
          aria-label="Share store"
          title="Share store"
          className="mkt-store-share-btn"
          onClick={() => shareStore(store)}
        >
          <FaShareAlt size={14} />
        </button>
      </div>

      <div className="mkt-detail-banner">
        {store.bannerUrl ? <img src={store.bannerUrl} alt="" /> : null}
      </div>

      <div className="mkt-detail-info">
        <h2 className="mkt-detail-title">{store.businessName}</h2>
        <div className="mkt-detail-meta">
          {store.deliveryTimeMinutes && <span><FaClock />{store.deliveryTimeMinutes} min delivery</span>}
          {Number(store.deliveryCharges) > 0
            ? <span><FaRupeeSign />{Number(store.deliveryCharges).toFixed(0)} delivery</span>
            : <span style={{ color: "#34d399" }}>Free delivery</span>}
          {Number(store.minOrderValue) > 0 && <span>Min order ₹{Number(store.minOrderValue).toFixed(0)}</span>}
          {closed && <span className="mkt-store-badge--closed">Closed</span>}
        </div>
        {store.addressLine1 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--cm-muted)" }}>
            {store.addressLine1}{store.city ? `, ${store.city}` : ""}
          </div>
        )}
      </div>

      <div className="mkt-search-bar" style={{ position: "static", paddingTop: 12 }}>
        <div className="mkt-search-input-wrap">
          <FiSearch size={18} />
          <input
            className="mkt-search-input"
            placeholder="Search items"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="mkt-empty">No items available</div>
      ) : (
        <div className="mkt-item-grid">
          {filteredItems.map((item) => {
            const qty = getItemQty(item.id);
            const unavailable = item.isAvailable === false || closed;
            return (
              <div key={item.id} className="mkt-item-card">
                <div className="mkt-item-image">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <FaStore size={32} />}
                </div>
                <div className="mkt-item-body">
                  <p className="mkt-item-name">{item.name}</p>
                  <div className="mkt-item-row">
                    <div>
                      <div className="mkt-item-price">₹{Number(item.sellingPrice).toFixed(0)}</div>
                      {item.mrp && Number(item.mrp) > Number(item.sellingPrice) && (
                        <div className="mkt-item-mrp">₹{Number(item.mrp).toFixed(0)}</div>
                      )}
                    </div>
                    {unavailable ? (
                      <span style={{ fontSize: 11, color: "#f87171" }}>N/A</span>
                    ) : qty === 0 ? (
                      <button className="mkt-add-btn" onClick={() => handleAdd(item)}>ADD</button>
                    ) : (
                      <div className="mkt-stepper">
                        <button className="mkt-stepper-btn" onClick={() => decrementItem(item.id)} aria-label="Decrease"><FaMinus size={10} /></button>
                        <span className="mkt-stepper-qty">{qty}</span>
                        <button className="mkt-stepper-btn" onClick={() => handleAdd(item)} aria-label="Increase"><FaPlus size={10} /></button>
                      </div>
                    )}
                  </div>
                  {item.unit && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{item.unit}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totals.count > 0 && cart && cart.storeId === store.id && (
        <div className="mkt-cart-bar" onClick={() => navigate("/customer/app/marketplace/cart")}>
          <div className="mkt-cart-bar-info">
            {totals.count} item{totals.count > 1 ? "s" : ""} · ₹{totals.subtotal.toFixed(0)}
          </div>
          <div className="mkt-cart-bar-cta">View cart →</div>
        </div>
      )}
    </div>
  );
};

export default StoreDetailScreen;
