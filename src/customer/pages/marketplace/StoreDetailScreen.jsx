import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaStore, FaClock, FaRupeeSign, FaPlus, FaMinus, FaShareAlt, FaStar } from "react-icons/fa";
import { FiSearch, FiGrid, FiList } from "react-icons/fi";
import { marketplaceService } from "../../services/marketplaceService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { shareStore } from "./shareStore";
import { parseVariants, variantDimensions, dimensionValues, findVariantByOptions, minVariantPrice } from "./variantUtils";
import "./marketplace.css";

const StoreDetailScreen = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { addItem, decrementItem, getItemQty, getItemTotalQty, totals, cart } = useMarketplaceCart();

  // Item whose variant picker sheet is open (null = closed).
  const [variantItem, setVariantItem] = useState(null);

  // Per-item chosen variant label (for items that define variants).

  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Category hierarchy browsing
  const [itemCategories, setItemCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);

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

  const handleAdd = useCallback((item, variant) => {
    if (!store) return;
    addItem(store, item, variant ? { variant } : undefined);
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

  // View toggle (grid / list) — rendered inline with the category chips.
  const viewToggle = filteredItems.length > 0 ? (
    <div className="mkt-view-toggle">
      <button
        type="button"
        className={`mkt-view-btn${viewMode === "grid" ? " active" : ""}`}
        onClick={() => setViewMode("grid")}
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <FiGrid size={16} />
      </button>
      <button
        type="button"
        className={`mkt-view-btn${viewMode === "list" ? " active" : ""}`}
        onClick={() => setViewMode("list")}
        aria-label="List view"
        aria-pressed={viewMode === "list"}
      >
        <FiList size={16} />
      </button>
    </div>
  ) : null;

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

      {/* ===== Hero: banner with overlapping store-identity card ===== */}
      <div className="mkt-hero">
        <div className="mkt-detail-banner">
          {store.bannerUrl ? <img src={store.bannerUrl} alt="" /> : null}
          <div className="mkt-hero-scrim" />
        </div>

        <div className="mkt-hero-card">
          <div className="mkt-hero-avatar">
            {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <FaStore size={26} />}
            <span className={`mkt-hero-dot ${closed ? "is-closed" : "is-open"}`} />
          </div>

          <div className="mkt-hero-body">
            <div className="mkt-hero-title-row">
              <h2 className="mkt-detail-title" style={{ margin: 0 }}>{store.businessName}</h2>
              {Number(store.reviewCount) > 0 ? (
                <span className="mkt-hero-rating">
                  <FaStar size={11} />
                  {Number(store.avgRating || 0).toFixed(1)}
                  <span className="mkt-hero-rating-count">
                    ({Number(store.reviewCount)})
                  </span>
                </span>
              ) : (
                <span className="mkt-hero-newbadge">New</span>
              )}
            </div>

            <div className="mkt-detail-meta">
              {store.deliveryTimeMinutes && (
                <span className="mkt-meta-pill"><FaClock />{store.deliveryTimeMinutes} min</span>
              )}
              {Number(store.deliveryCharges) > 0
                ? <span className="mkt-meta-pill"><FaRupeeSign />{Number(store.deliveryCharges).toFixed(0)} delivery</span>
                : <span className="mkt-meta-pill mkt-meta-pill--free">Free delivery</span>}
              {Number(store.minOrderValue) > 0 && (
                <span className="mkt-meta-pill">Min ₹{Number(store.minOrderValue).toFixed(0)}</span>
              )}
              {closed && <span className="mkt-store-badge--closed">Closed</span>}
            </div>

            {store.addressLine1 && (
              <div className="mkt-hero-address">
                {store.addressLine1}{store.city ? `, ${store.city}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coupons moved to the cart/payment page (Apply coupon section). */}

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

      {/* Category filter chips (with inline grid/list toggle on the right) */}
      {itemCategories.length > 0 && (
        <div style={{ padding: "8px 14px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
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
          {viewToggle}
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

      {/* When there are no category chips, still show the toggle on its own row. */}
      {itemCategories.length === 0 && viewToggle}

      {filteredItems.length === 0 ? (
        <div className="mkt-empty">No items available</div>
      ) : (
        <div className={`mkt-item-grid${viewMode === "list" ? " mkt-item-grid--list" : ""}`}>
          {filteredItems.map((item) => {
            const variants = parseVariants(item);
            const hasVariants = variants.length > 0;
            const unavailable = item.isAvailable === false || closed;
            // Variant items show a "From ₹X" price and open a grouped picker sheet;
            // plain items keep the inline ADD / stepper.
            const effPrice = hasVariants
              ? minVariantPrice(variants)
              : Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : item.sellingPrice);
            const strikePrice = hasVariants
              ? null
              : (item.offerPrice && Number(item.offerPrice) > 0 && Number(item.sellingPrice) > Number(item.offerPrice)
                  ? Number(item.sellingPrice)
                  : (item.mrp && Number(item.mrp) > Number(item.sellingPrice) ? Number(item.mrp) : null));
            const qty = hasVariants ? getItemTotalQty(item.id) : getItemQty(item.id);
            const extraCount =
              ((() => { try { return JSON.parse(item.offers || "[]").length; } catch { return 0; } })()) +
              ((() => { try { return JSON.parse(item.services || "[]").length; } catch { return 0; } })());
            const groupCount = (() => { try { return JSON.parse(item.groupedItemIds || "[]").length; } catch { return 0; } })();
            return (
              <div key={item.id} className={`mkt-item-card${viewMode === "list" ? " mkt-item-card--list" : ""}`}>
                <div className="mkt-item-image">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <FaStore size={32} />}
                </div>
                <div className="mkt-item-body">
                  <p className="mkt-item-name">{item.name}</p>
                  <div className="mkt-item-row">
                    <div>
                      <div className="mkt-item-price">{hasVariants ? "From " : ""}₹{Number(effPrice || 0).toFixed(0)}</div>
                      {strikePrice && (
                        <div className="mkt-item-mrp">₹{strikePrice.toFixed(0)}</div>
                      )}
                    </div>
                    {unavailable ? (
                      <span style={{ fontSize: 11, color: "#f87171" }}>N/A</span>
                    ) : hasVariants ? (
                      <button className="mkt-add-btn" onClick={() => setVariantItem(item)}>
                        {qty > 0 ? `${qty} · OPTIONS` : "OPTIONS"}
                      </button>
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
                  {hasVariants && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>
                      {variants.length} option{variants.length > 1 ? "s" : ""}
                    </div>
                  )}
                  {!hasVariants && (extraCount > 0 || groupCount > 0) && (
                    <button
                      type="button"
                      onClick={() => setVariantItem(item)}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 2, fontSize: 11, color: "var(--cm-accent, #007BFF)", fontWeight: 600, cursor: "pointer" }}
                    >
                      {groupCount > 0 ? `View options (${groupCount + 1}) ›` : "Offers & services ›"}
                    </button>
                  )}
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
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--cm-ink)" }}>
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
                  <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: "var(--cm-ink)" }}>
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
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-ink)" }}>
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
                  color: "var(--cm-ink)",
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

      {variantItem && (
        <VariantPickerSheet
          store={store}
          item={variantItem}
          allItems={items}
          onOpenItem={setVariantItem}
          closed={closed}
          onClose={() => setVariantItem(null)}
          getItemQty={getItemQty}
          addItem={addItem}
          decrementItem={decrementItem}
        />
      )}
    </div>
  );
};

/**
 * Amazon-style grouped variant picker. Renders one chip group per option
 * dimension (Size / Colour …); legacy flat variants fall back to a single
 * group of labels. The resolved variant drives price, MRP, stock and add/qty.
 */
const VariantPickerSheet = ({ store, item, allItems = [], onOpenItem, closed, onClose, getItemQty, addItem, decrementItem }) => {
  const variants = useMemo(() => parseVariants(item), [item]);
  const dims = useMemo(() => variantDimensions(variants), [variants]);

  // Products grouped with this one (Amazon-style "other options"). Tapping a
  // grouped product swaps the sheet to show that product instead.
  const groupedProducts = useMemo(() => {
    let ids = [];
    try { const a = JSON.parse(item.groupedItemIds || "[]"); if (Array.isArray(a)) ids = a.map(Number); } catch { /* ignore */ }
    if (!ids.length) return [];
    const byId = new Map((allItems || []).map((it) => [it.id, it]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [item, allItems]);

  const [selection, setSelection] = useState(() =>
    dims.length ? { ...(variants[0]?.options || {}) } : {}
  );
  const [flatLabel, setFlatLabel] = useState(() => (dims.length ? null : variants[0]?.label || null));

  const hasVar = variants.length > 0;
  const selected = !hasVar
    ? null
    : dims.length
      ? findVariantByOptions(variants, dims, selection)
      : variants.find((v) => v.label === flatLabel) || null;

  // A value is selectable if a variant exists for it given the other chosen dims.
  const valueEnabled = (dim, val) =>
    variants.some((v) =>
      String(v.options?.[dim] ?? "") === String(val) &&
      dims.filter((d) => d !== dim).every((d) => !selection[d] || String(v.options?.[d] ?? "") === String(selection[d]))
    );

  // Effective price/MRP: variant when present, else the item's own price.
  const basePrice = Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : item.sellingPrice);
  const baseMrp = item.mrp && Number(item.mrp) > basePrice ? Number(item.mrp) : null;
  const dispPrice = hasVar ? (selected ? Number(selected.price) : null) : basePrice;
  const dispMrp = hasVar
    ? (selected?.mrp && Number(selected.mrp) > Number(selected.price) ? Number(selected.mrp) : null)
    : baseMrp;

  const qty = hasVar ? (selected ? getItemQty(item.id, selected.label) : 0) : getItemQty(item.id);
  const stock = hasVar && selected && selected.stock != null ? Number(selected.stock) : null;
  const soldOut = stock != null && stock <= 0;
  const canAdd = (hasVar ? !!selected : true) && !closed && item.isAvailable !== false && !soldOut;

  const variant = hasVar && selected ? { label: selected.label, price: Number(selected.price), image: selected.image } : null;
  const lineKey = hasVar && selected ? `${item.id}::${selected.label}` : `${item.id}`;

  const parseArr = (raw) => { try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
  const offers = parseArr(item.offers);
  const services = parseArr(item.services);

  return (
    <div className="mkt-vsheet-overlay" onClick={onClose}>
      <div className="mkt-vsheet" onClick={(e) => e.stopPropagation()}>
        <div className="mkt-vsheet-head">
          <div className="mkt-vsheet-img">
            {(selected?.image || item.imageUrl)
              ? <img src={selected?.image || item.imageUrl} alt="" />
              : <FaStore size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <div className="mkt-vsheet-title">{item.name}</div>
            {selected && <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{selected.label}</div>}
          </div>
          <button className="mkt-header-back" onClick={onClose} aria-label="Close">×</button>
        </div>

        {hasVar && (dims.length > 0 ? (
          dims.map((dim) => (
            <div key={dim} className="mkt-vsheet-dim">
              <div className="mkt-vsheet-dim-label">{dim}</div>
              <div className="mkt-vopt-row">
                {dimensionValues(variants, dim).map((val) => {
                  const enabled = valueEnabled(dim, val);
                  const active = String(selection[dim] ?? "") === String(val);
                  return (
                    <button
                      key={val}
                      className={`mkt-vopt${active ? " mkt-vopt--active" : ""}${enabled ? "" : " mkt-vopt--disabled"}`}
                      disabled={!enabled}
                      onClick={() => setSelection((p) => ({ ...p, [dim]: val }))}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="mkt-vsheet-dim">
            <div className="mkt-vsheet-dim-label">Options</div>
            <div className="mkt-vopt-row">
              {variants.map((v) => (
                <button
                  key={v.label}
                  className={`mkt-vopt${flatLabel === v.label ? " mkt-vopt--active" : ""}`}
                  onClick={() => setFlatLabel(v.label)}
                >
                  {v.label} · ₹{Number(v.price).toFixed(0)}
                </button>
              ))}
            </div>
          </div>
        ))}

        {groupedProducts.length > 0 && (
          <div className="mkt-vsheet-dim">
            <div className="mkt-vsheet-dim-label">Other options</div>
            <div className="mkt-group-row">
              {groupedProducts.map((g) => {
                const gPrice = Number(g.offerPrice && Number(g.offerPrice) > 0 ? g.offerPrice : g.sellingPrice) || 0;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="mkt-group-chip"
                    onClick={() => onOpenItem && onOpenItem(g)}
                  >
                    <span className="mkt-group-chip-img">
                      {g.imageUrl ? <img src={g.imageUrl} alt="" /> : <FaStore size={16} />}
                    </span>
                    <span className="mkt-group-chip-name">{g.name}</span>
                    <span className="mkt-group-chip-price">₹{gPrice.toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mkt-vsheet-pricerow">
          {dispPrice != null ? (
            <>
              <span className="mkt-vsheet-price">₹{Number(dispPrice).toFixed(0)}</span>
              {dispMrp && (
                <span className="mkt-vsheet-mrp">₹{Number(dispMrp).toFixed(0)}</span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 13, color: "var(--cm-muted)" }}>This combination isn't available</span>
          )}
        </div>
        {stock != null && stock > 0 && stock <= 5 && (
          <div className="mkt-vsheet-stock">Only {stock} left</div>
        )}
        {soldOut && <div className="mkt-vsheet-stock" style={{ color: "#f87171" }}>Out of stock</div>}

        {qty === 0 ? (
          <button
            className="mkt-btn mkt-btn--primary"
            disabled={!canAdd}
            style={{ opacity: canAdd ? 1 : 0.5 }}
            onClick={() => { addItem(store, item, { variant }); }}
          >
            {closed ? "Store closed" : "Add to cart"}
          </button>
        ) : (
          <div className="mkt-stepper" style={{ alignSelf: "flex-start", width: "fit-content" }}>
            <button className="mkt-stepper-btn" onClick={() => decrementItem(lineKey)} aria-label="Decrease"><FaMinus size={10} /></button>
            <span className="mkt-stepper-qty">{qty}</span>
            <button className="mkt-stepper-btn" disabled={!canAdd} onClick={() => addItem(store, item, { variant })} aria-label="Increase"><FaPlus size={10} /></button>
          </div>
        )}

        {offers.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Offers</div>
            <div className="mkt-offer-row">
              {offers.map((o, i) => (
                <div key={i} className="mkt-offer-card">
                  <div className="mkt-offer-title">{o.title}</div>
                  {Number(o.discountValue) > 0 && (
                    <div className="mkt-offer-rule">
                      {o.discountType === "percent" ? `${Number(o.discountValue)}% off` : `₹${Number(o.discountValue)} off`}
                      {Number(o.minPurchase) > 0 ? ` on orders above ₹${Number(o.minPurchase)}` : ""}
                    </div>
                  )}
                  {o.description && <div className="mkt-offer-desc">{o.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {services.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Services</div>
            <div className="mkt-service-row">
              {services.map((s, i) => (
                <div key={i} className="mkt-service-item">
                  <div className="mkt-service-label">{s.label}</div>
                  {s.detail && <div className="mkt-service-detail">{s.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDetailScreen;
