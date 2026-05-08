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

  // Category hierarchy browsing
  const [itemCategories, setItemCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      marketplaceService.getStore(storeId),
      marketplaceService.getStoreItems(storeId),
      marketplaceService.getStoreItemCategories(storeId).catch(() => ({ success: false, data: [] })),
    ])
      .then(([sRes, iRes, cRes]) => {
        if (sRes.success && sRes.data) setStore(sRes.data);
        else setError(sRes.message || "Store not found");
        if (iRes.success) setItems(Array.isArray(iRes.data) ? iRes.data : []);
        if (cRes.success) setItemCategories(Array.isArray(cRes.data) ? cRes.data : []);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  // Load subcategories when a category is selected
  useEffect(() => {
    if (!selectedCategoryId) { setSubcategories([]); setSelectedSubcategoryId(null); return; }
    marketplaceService.getItemCategorySubcategories(selectedCategoryId)
      .then((res) => {
        if (res.success) setSubcategories(Array.isArray(res.data) ? res.data : []);
        else setSubcategories([]);
      })
      .catch(() => setSubcategories([]));
  }, [selectedCategoryId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredItems = useMemo(() => {
    let result = items;
    // Filter by selected category
    if (selectedCategoryId) {
      result = result.filter((i) => i.storeItemCategoryId?.id === selectedCategoryId);
    }
    // Filter by selected subcategory
    if (selectedSubcategoryId) {
      result = result.filter((i) => i.storeItemSubcategoryId?.id === selectedSubcategoryId);
    }
    // Filter by search text
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((i) => (i.name || "").toLowerCase().includes(q));
    }
    return result;
  }, [items, debouncedSearch, selectedCategoryId, selectedSubcategoryId]);

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

      {/* Category filter chips */}
      {itemCategories.length > 0 && (
        <div style={{ padding: "8px 14px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            <button
              type="button"
              onClick={() => { setSelectedCategoryId(null); setSelectedSubcategoryId(null); }}
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${!selectedCategoryId ? "transparent" : "var(--cm-line)"}`,
                background: !selectedCategoryId ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
                color: !selectedCategoryId ? "#fff" : "var(--cm-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              All
            </button>
            {itemCategories.map((cat) => {
              const isActive = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setSelectedCategoryId(isActive ? null : cat.id); setSelectedSubcategoryId(null); }}
                  style={{
                    flexShrink: 0,
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: `1px solid ${isActive ? "transparent" : "var(--cm-line)"}`,
                    background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
                    color: isActive ? "#fff" : "var(--cm-muted)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {cat.iconUrl && <img src={cat.iconUrl} alt="" style={{ width: 14, height: 14, borderRadius: 3 }} />}
                  {cat.name}
                </button>
              );
            })}
          </div>
          {/* Subcategory chips */}
          {selectedCategoryId && subcategories.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              <button
                type="button"
                onClick={() => setSelectedSubcategoryId(null)}
                style={{
                  flexShrink: 0,
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: `1px solid ${!selectedSubcategoryId ? "transparent" : "var(--cm-line)"}`,
                  background: !selectedSubcategoryId ? "rgba(20,184,166,0.15)" : "var(--cm-card)",
                  color: !selectedSubcategoryId ? "#14b8a6" : "var(--cm-muted)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                All
              </button>
              {subcategories.map((sub) => {
                const isActive = selectedSubcategoryId === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubcategoryId(isActive ? null : sub.id)}
                    style={{
                      flexShrink: 0,
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: `1px solid ${isActive ? "transparent" : "var(--cm-line)"}`,
                      background: isActive ? "rgba(20,184,166,0.15)" : "var(--cm-card)",
                      color: isActive ? "#14b8a6" : "var(--cm-muted)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
