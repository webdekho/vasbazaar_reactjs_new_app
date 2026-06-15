import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaStore, FaClock, FaRupeeSign, FaPlus, FaMinus, FaShareAlt, FaStar } from "react-icons/fa";
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

  // Offers strip
  const [offers, setOffers] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  // Ratings & reviews
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewTotalPages, setReviewTotalPages] = useState(0);
  const [reviewTotalRecords, setReviewTotalRecords] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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

  // Fetch offers on mount
  useEffect(() => {
    marketplaceService.getStoreOffers(storeId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setOffers(res.data);
        else setOffers([]);
      })
      .catch(() => setOffers([]));
  }, [storeId]);

  // Fetch first page of reviews on mount
  useEffect(() => {
    setReviewsLoading(true);
    marketplaceService.getStoreReviews(storeId, { pageNumber: 0, pageSize: 10 })
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          setReviewSummary(d.summary || null);
          setReviews(Array.isArray(d.records) ? d.records : []);
          setReviewPage(typeof d.currentPage === "number" ? d.currentPage : 0);
          setReviewTotalPages(typeof d.totalPages === "number" ? d.totalPages : 0);
          setReviewTotalRecords(typeof d.totalRecords === "number" ? d.totalRecords : 0);
        }
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [storeId]);

  const handleCopyCode = useCallback((code) => {
    if (!code) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
      }
    } catch (_e) { /* ignore */ }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
  }, []);

  const loadMoreReviews = useCallback(() => {
    const next = reviewPage + 1;
    setReviewsLoading(true);
    marketplaceService.getStoreReviews(storeId, { pageNumber: next, pageSize: 10 })
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          setReviews((prev) => [...prev, ...(Array.isArray(d.records) ? d.records : [])]);
          setReviewPage(typeof d.currentPage === "number" ? d.currentPage : next);
          if (typeof d.totalPages === "number") setReviewTotalPages(d.totalPages);
        }
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [storeId, reviewPage]);

  const offerTitle = useCallback((o) => {
    if (o.title) return o.title;
    if (o.type === "PERCENT") return `${Number(o.value)}% OFF`;
    if (o.type === "FLAT") return `₹${Number(o.value)} OFF`;
    if (o.type === "BOGO") return "Buy 1 Get 1";
    return "Offer";
  }, []);

  const renderStars = useCallback((rating, size = 12) => {
    const r = Math.round(Number(rating) || 0);
    return (
      <span style={{ display: "inline-flex", gap: 1, lineHeight: 1 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <FaStar key={n} size={size} color={n <= r ? "#fbbf24" : "var(--cm-line)"} />
        ))}
      </span>
    );
  }, []);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 className="mkt-detail-title" style={{ margin: 0 }}>{store.businessName}</h2>
          {Number(store.reviewCount) > 0 ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(251,191,36,0.15)",
                color: "#fbbf24",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <FaStar size={11} />
              {Number(store.avgRating || 0).toFixed(1)}
              <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>
                ({Number(store.reviewCount)} review{Number(store.reviewCount) > 1 ? "s" : ""})
              </span>
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(20,184,166,0.15)",
                color: "#14b8a6",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              New
            </span>
          )}
        </div>
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

      {/* Offers strip */}
      {offers.length > 0 && (
        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            {offers.map((o) => {
              const flash = !!o.isFlash;
              return (
                <div
                  key={o.id}
                  style={{
                    flexShrink: 0,
                    width: 180,
                    padding: "12px 12px 10px",
                    borderRadius: 14,
                    border: `1px solid ${flash ? "rgba(245,158,11,0.6)" : "var(--cm-line)"}`,
                    background: flash ? "rgba(245,158,11,0.12)" : "var(--cm-card)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: flash ? "#f59e0b" : "var(--cm-text, #fff)", display: "flex", alignItems: "center", gap: 4 }}>
                    {flash && <span aria-hidden>⚡</span>}
                    {offerTitle(o)}
                  </div>
                  {o.description && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", lineHeight: 1.3 }}>{o.description}</div>
                  )}
                  {o.code && (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(o.code)}
                      style={{
                        alignSelf: "flex-start",
                        padding: "4px 10px",
                        borderRadius: 8,
                        border: `1px dashed ${flash ? "#f59e0b" : "var(--cm-line)"}`,
                        background: "transparent",
                        color: flash ? "#f59e0b" : "var(--cm-text, #fff)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        cursor: "pointer",
                      }}
                    >
                      {copiedCode === o.code ? "Copied!" : `${o.code} · Tap to copy`}
                    </button>
                  )}
                  {Number(o.minOrderValue) > 0 && (
                    <div style={{ fontSize: 10, color: "var(--cm-muted)" }}>Min ₹{Number(o.minOrderValue).toFixed(0)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Ratings & Reviews */}
      <div style={{ padding: "20px 14px 8px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--cm-text, #fff)" }}>
          Ratings &amp; Reviews
        </h3>

        {(!reviewSummary || (reviewSummary.total || 0) === 0) && reviews.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              borderRadius: 14,
              border: "1px solid var(--cm-line)",
              background: "var(--cm-card)",
              textAlign: "center",
              color: "var(--cm-muted)",
              fontSize: 13,
            }}
          >
            {reviewsLoading ? "Loading reviews…" : "No reviews yet — be the first!"}
          </div>
        ) : (
          <>
            {reviewSummary && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid var(--cm-line)",
                  background: "var(--cm-card)",
                  marginBottom: 14,
                  alignItems: "center",
                }}
              >
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: "var(--cm-text, #fff)" }}>
                    {Number(reviewSummary.average || 0).toFixed(1)}
                  </div>
                  <div style={{ marginTop: 6 }}>{renderStars(reviewSummary.average, 13)}</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--cm-muted)" }}>
                    {Number(reviewSummary.total || 0)} rating{Number(reviewSummary.total || 0) !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = Number((reviewSummary.histogram || {})[String(star)] || 0);
                    const total = Number(reviewSummary.total || 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--cm-muted)", width: 26, display: "inline-flex", alignItems: "center", gap: 2 }}>
                          {star}<FaStar size={9} color="#fbbf24" />
                        </span>
                        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--cm-line)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#fbbf24", borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 10, color: "var(--cm-muted)", width: 24, textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviews.map((rv) => (
                <div
                  key={rv.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid var(--cm-line)",
                    background: "var(--cm-card)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {renderStars(rv.rating, 11)}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-text, #fff)" }}>
                        {rv.userId?.name || "Customer"}
                      </span>
                    </div>
                    {rv.createdAt && (
                      <span style={{ fontSize: 10, color: "var(--cm-muted)" }}>
                        {new Date(rv.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {rv.comment && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--cm-text, #e5e7eb)", lineHeight: 1.4 }}>
                      {rv.comment}
                    </div>
                  )}
                  {Array.isArray(rv.photos) && rv.photos.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                      {rv.photos.map((p, idx) => (
                        <img key={idx} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ))}
                    </div>
                  )}
                  {rv.merchantReply && (
                    <div
                      style={{
                        marginTop: 10,
                        marginLeft: 12,
                        padding: "8px 10px",
                        borderLeft: "2px solid #14b8a6",
                        borderRadius: 6,
                        background: "rgba(20,184,166,0.08)",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6" }}>Store replied</div>
                      <div style={{ marginTop: 3, fontSize: 12, color: "var(--cm-text, #e5e7eb)", lineHeight: 1.4 }}>
                        {rv.merchantReply}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {reviewPage < reviewTotalPages - 1 && (
              <button
                type="button"
                onClick={loadMoreReviews}
                disabled={reviewsLoading}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--cm-line)",
                  background: "var(--cm-card)",
                  color: "var(--cm-text, #fff)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: reviewsLoading ? "default" : "pointer",
                  opacity: reviewsLoading ? 0.6 : 1,
                }}
              >
                {reviewsLoading ? "Loading…" : `Load more (${reviewTotalRecords - reviews.length} more)`}
              </button>
            )}
          </>
        )}
      </div>

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
