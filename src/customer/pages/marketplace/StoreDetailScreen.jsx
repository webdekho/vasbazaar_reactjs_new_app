import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaStore, FaClock, FaRupeeSign, FaPlus, FaMinus, FaShareAlt, FaStar, FaCamera, FaHeart, FaRegHeart, FaBalanceScale, FaBolt, FaSnowflake, FaUndoAlt, FaExchangeAlt, FaGift, FaCoins, FaCalendarCheck, FaCheck } from "react-icons/fa";
import { FiSearch, FiGrid, FiList } from "react-icons/fi";
import { marketplaceService } from "../../services/marketplaceService";
import { marketplaceDiscoveryService } from "../../services/marketplaceDiscoveryService";
import { marketplaceWave6Service } from "../../services/marketplaceWave6Service";
import { marketplaceItemExtrasService } from "../../services/marketplaceItemExtrasService";
import { marketplaceWave4Service } from "../../services/marketplaceWave4Service";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useMarketplaceCompare } from "../../context/MarketplaceCompareContext";
import { useToast } from "../../context/ToastContext";
import { shareStore } from "./shareStore";
import { shareProduct } from "../../utils/shareProduct";
import { parseVariants, variantDimensions, dimensionValues, findVariantByOptions, minVariantPrice } from "./variantUtils";
import "./marketplace.css";

// Client-side sort options for a store's item grid (applied to the already-
// loaded list only — the backend keeps its own default order).
const SORT_OPTIONS = [
  { id: "relevance", label: "Relevance" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "newest", label: "Newest" },
  { id: "rating", label: "Rating" },
];

// Effective (payable) price for an item, honouring variants and offer price.
const itemSortPrice = (item) => {
  const variants = parseVariants(item);
  if (variants.length > 0) return minVariantPrice(variants);
  return Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : item.sellingPrice) || 0;
};

const itemRating = (item) => Number(item.avgRating ?? item.rating ?? 0);

// ===== Wave 4 helpers =====
// A `services` node is a PRICED add-on iff it carries a numeric price AND a
// non-blank code; everything else is a legacy display-only assurance highlight.
const isAddOnNode = (s) =>
  s && s.code != null && String(s.code).trim() !== "" && s.price != null && Number.isFinite(Number(s.price));
const splitServices = (services) => {
  const addOns = [], assurances = [];
  (Array.isArray(services) ? services : []).forEach((s) => {
    if (isAddOnNode(s)) addOns.push({ code: String(s.code).trim(), label: s.label || s.code, price: Number(s.price), group: s.group || null });
    else assurances.push(s);
  });
  return { addOns, assurances };
};

// Parse an item's attributes_json (string or object) into a plain map.
const parseAttributes = (item) => {
  const raw = item?.attributesJson ?? item?.attributes;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { const o = JSON.parse(raw); return o && typeof o === "object" ? o : {}; } catch { return {}; }
};
const humanizeKey = (k) => String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const formatAttrValue = (val, def) => {
  if (val == null || val === "") return null;
  if (def?.dataType === "BOOL" || typeof val === "boolean") return (val === true || val === "true") ? "Yes" : "No";
  return def?.unit ? `${val} ${def.unit}` : String(val);
};

// Effective cashback % for an item: per-item override falls back to the store
// rate. Display-only — the server stays authoritative on the actual credit.
const effectiveCashbackPct = (item, store) => {
  const itemPct = Number(item?.cashbackPercent);
  if (Number.isFinite(itemPct) && itemPct > 0) return itemPct;
  const storePct = Number(store?.cashbackPercent);
  return Number.isFinite(storePct) && storePct > 0 ? storePct : 0;
};

// Small green pill: "Earn X% cashback" and/or "Y pt/₹" when the store offers it.
const CashbackHint = ({ item, store, style }) => {
  const pct = effectiveCashbackPct(item, store);
  const earnRate = Number(store?.loyaltyEarnRate);
  const hasLoyalty = Number.isFinite(earnRate) && earnRate > 0;
  if (pct <= 0 && !hasLoyalty) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, ...(style || {}) }}>
      {pct > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#059669", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 999, padding: "1px 7px" }}>
          <FaGift size={9} /> {pct % 1 === 0 ? pct : pct.toFixed(1)}% cashback
        </span>
      )}
      {hasLoyalty && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 999, padding: "1px 7px" }}>
          <FaCoins size={9} /> {earnRate % 1 === 0 ? earnRate : earnRate.toFixed(2)} pt/₹
        </span>
      )}
    </div>
  );
};

// Global fallback near-expiry threshold (days) — mirrors the backend constant.
const GLOBAL_NEAR_EXPIRY_DAYS = 30;

// Best-before / near-expiry helper. Mirrors the backend pricing rule so the
// displayed near-expiry price matches what the server actually charges. The
// backend stays server-authoritative — this is display only.
const nearExpiryInfo = (item, store) => {
  const out = { hasExpiry: false, expired: false, isNearExpiry: false, effectivePrice: null, discountedPrice: null, pct: 0, daysLeft: null, expiryDate: null };
  const raw = item?.expiryDate;
  if (!raw) return out;
  const exp = new Date(raw);
  if (Number.isNaN(exp.getTime())) return out;
  out.hasExpiry = true;
  out.expiryDate = exp;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const daysLeft = Math.round((expDay.getTime() - today.getTime()) / 86400000);
  out.daysLeft = daysLeft;
  if (daysLeft < 0) { out.expired = true; return out; }
  const pct = Number(item?.nearExpiryDiscountPercent) || 0;
  const threshold = Number(store?.nearExpiryDays) || GLOBAL_NEAR_EXPIRY_DAYS;
  if (pct >= 1 && pct <= 100 && daysLeft <= threshold) {
    out.isNearExpiry = true;
    out.pct = pct;
    const base = Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : item.sellingPrice) || 0;
    out.effectivePrice = Math.round(base * (100 - pct)) / 100;
    out.discountedPrice = out.effectivePrice;
  }
  return out;
};

const fmtExpiry = (d) => {
  try { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
};

const StoreDetailScreen = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem, decrementItem, getItemQty, getItemTotalQty, totals, cart } = useMarketplaceCart();
  const compare = useMarketplaceCompare();
  const { showToast } = useToast();

  // Client-side controls for the item grid (Retail Wave 1).
  const [sortBy, setSortBy] = useState("relevance");
  const [selectedBrand, setSelectedBrand] = useState(null);

  // Saved-product wishlist: set of item ids the user has hearted.
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [savingIds, setSavingIds] = useState(() => new Set());

  // Item whose variant picker sheet is open (null = closed).
  const [variantItem, setVariantItem] = useState(null);

  // Shared product links carry ?item={itemId} — open that product's sheet
  // once the items load (only on first load, so closing the sheet sticks).
  const deepLinkedItem = useRef(false);

  // "Recently viewed" tracking — fire-and-forget when a product detail sheet
  // opens, at most once per item per visit to this store screen.
  const trackedViews = useRef(new Set());
  useEffect(() => {
    const id = variantItem?.id;
    if (!id || trackedViews.current.has(id)) return;
    trackedViews.current.add(id);
    marketplaceDiscoveryService.trackView(id).catch(() => {});
  }, [variantItem]);

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

  // Wave 4: category attribute defs (labels/units/filter flags for dynamic specs).
  const [attrDefs, setAttrDefs] = useState([]);

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
        if (sRes.success && sRes.data) {
          setStore(sRes.data);
          // Best-effort: pull the global-category attribute defs so specs render
          // with proper labels/units and expose filterable chips. Non-fatal.
          const gcid = sRes.data.storeCategoryId || sRes.data.categoryId || sRes.data.storeCategory?.id;
          if (gcid) {
            marketplaceWave4Service.getAttributeDefs(gcid)
              .then((dRes) => { if (dRes.success) setAttrDefs(Array.isArray(dRes.data) ? dRes.data : (dRes.data?.records || [])); })
              .catch(() => {});
          }
        }
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

  // Deep link: /store/{storeId}?item={itemId} opens that product's sheet.
  useEffect(() => {
    if (deepLinkedItem.current || items.length === 0) return;
    const wanted = searchParams.get("item");
    if (!wanted) { deepLinkedItem.current = true; return; }
    const hit = items.find((i) => String(i.id) === String(wanted));
    if (hit) setVariantItem(hit);
    deepLinkedItem.current = true;
  }, [items, searchParams]);

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
    // Filter by selected brand (client-side, from the loaded items)
    if (selectedBrand) {
      result = result.filter((i) => (i.brand || "").trim() === selectedBrand);
    }
    // Filter by search text
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((i) => (i.name || "").toLowerCase().includes(q));
    }
    return result;
  }, [items, debouncedSearch, selectedCategoryId, selectedSubcategoryId, selectedBrand]);

  // Distinct brands across the loaded items — powers the brand filter chips.
  const brands = useMemo(() => {
    const set = new Set();
    items.forEach((i) => { const b = (i.brand || "").trim(); if (b) set.add(b); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Apply the client-side sort on top of the filtered list. "relevance" keeps
  // the backend order; the others sort a shallow copy.
  const sortedItems = useMemo(() => {
    if (sortBy === "relevance") return filteredItems;
    const arr = [...filteredItems];
    if (sortBy === "price_asc") arr.sort((a, b) => itemSortPrice(a) - itemSortPrice(b));
    else if (sortBy === "price_desc") arr.sort((a, b) => itemSortPrice(b) - itemSortPrice(a));
    else if (sortBy === "newest") arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    else if (sortBy === "rating") arr.sort((a, b) => itemRating(b) - itemRating(a));
    return arr;
  }, [filteredItems, sortBy]);

  // Load the user's saved products once, to light up the heart on saved items.
  useEffect(() => {
    marketplaceService.getSavedItems()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setSavedIds(new Set(res.data.map((r) => String(r.itemId))));
        }
      })
      .catch(() => {});
  }, []);

  const handleAdd = useCallback((item, variant) => {
    if (!store) return;
    addItem(store, item, variant ? { variant } : undefined);
  }, [addItem, store]);

  // Buy Now: add just this item (optionally a chosen variant) and jump straight
  // to the existing single-store checkout — no new payment path.
  const handleBuyNow = useCallback((item, variant, extras = {}) => {
    if (!store) return;
    addItem(store, item, { ...(variant ? { variant } : {}), ...extras });
    navigate(`/customer/app/marketplace/cart?store=${store.id}`);
  }, [addItem, store, navigate]);

  // Toggle the saved-product heart (optimistic; endpoints are idempotent).
  const toggleSave = useCallback(async (item) => {
    const id = String(item.id);
    if (savingIds.has(id)) return;
    const wasSaved = savedIds.has(id);
    setSavingIds((prev) => new Set(prev).add(id));
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });
    const res = wasSaved
      ? await marketplaceService.removeSavedItem(item.id)
      : await marketplaceService.saveItem(item.id);
    setSavingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    if (!res.success) {
      // Revert on failure.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(id); else next.delete(id);
        return next;
      });
      showToast(res.message || "Could not update saved products", "error");
    } else {
      showToast(wasSaved ? "Removed from saved" : "Saved to your products", "success");
    }
  }, [savedIds, savingIds, showToast]);

  // Toggle this item in the compare tray (max 3), with a friendly cap toast.
  const toggleCompare = useCallback((item) => {
    if (!compare.isSelected(item.id) && compare.atLimit) {
      showToast(`You can compare up to ${compare.limit} products`, "error");
      return;
    }
    compare.toggle(item, store?.id);
  }, [compare, showToast, store]);

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

      {/* Store-level cashback / loyalty offer banner (display-only). */}
      {(effectiveCashbackPct({}, store) > 0 || Number(store.loyaltyEarnRate) > 0) && (
        <div style={{ padding: "10px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.28)" }}>
            <FaGift size={16} color="#059669" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cm-ink)" }}>
              {effectiveCashbackPct({}, store) > 0 && (
                <>Earn {(() => { const p = effectiveCashbackPct({}, store); return p % 1 === 0 ? p : p.toFixed(1); })()}% cashback on this store</>
              )}
              {effectiveCashbackPct({}, store) > 0 && Number(store.loyaltyEarnRate) > 0 && " · "}
              {Number(store.loyaltyEarnRate) > 0 && (
                <>{(() => { const r = Number(store.loyaltyEarnRate); return r % 1 === 0 ? r : r.toFixed(2); })()} loyalty pt / ₹</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Store policies (return + cancellation) — display-only info panel. */}
      {(store.returnPolicyText || store.cancellationPolicyText) && (
        <div style={{ padding: "10px 14px 0" }}>
          <details className="mkt-store-policies">
            <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)", fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>
              <FaUndoAlt size={13} color="#007BFF" /> Store policies
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--cm-muted)", fontWeight: 500 }}>Tap to view</span>
            </summary>
            <div style={{ padding: "10px 12px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
              {store.returnPolicyText && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 3 }}>Return / Replacement</div>
                  <div style={{ fontSize: 12.5, color: "var(--cm-muted)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{store.returnPolicyText}</div>
                </div>
              )}
              {store.cancellationPolicyText && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 3 }}>Cancellation</div>
                  <div style={{ fontSize: 12.5, color: "var(--cm-muted)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{store.cancellationPolicyText}</div>
                </div>
              )}
            </div>
          </details>
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

      {/* When there are no category chips, still show the toggle on its own row (right-aligned). */}
      {itemCategories.length === 0 && viewToggle && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px 0" }}>
          {viewToggle}
        </div>
      )}

      {/* Sort control (client-side) */}
      {items.length > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, padding: "10px 14px 0" }}>
          <label htmlFor="mkt-store-sort" style={{ fontSize: 11, color: "var(--cm-muted)", fontWeight: 600 }}>Sort</label>
          <select
            id="mkt-store-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card)", color: "var(--cm-ink)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* Brand filter chips (client-side, from distinct brands in loaded items) */}
      {brands.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 14px 0", scrollbarWidth: "none" }}>
          <button
            type="button"
            onClick={() => setSelectedBrand(null)}
            style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 999,
              border: `1px solid ${!selectedBrand ? "transparent" : "var(--cm-line)"}`,
              background: !selectedBrand ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
              color: !selectedBrand ? "#fff" : "var(--cm-muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            All brands
          </button>
          {brands.map((b) => {
            const active = selectedBrand === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBrand(active ? null : b)}
                style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 999,
                  border: `1px solid ${active ? "transparent" : "var(--cm-line)"}`,
                  background: active ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
                  color: active ? "#fff" : "var(--cm-muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {b}
              </button>
            );
          })}
        </div>
      )}

      {sortedItems.length === 0 ? (
        <div className="mkt-empty">No items available</div>
      ) : (
        <div className={`mkt-item-grid${viewMode === "list" ? " mkt-item-grid--list" : ""}`}>
          {sortedItems.map((item) => {
            const variants = parseVariants(item);
            const hasVariants = variants.length > 0;
            const unavailable = item.isAvailable === false || closed;
            // Variant items show a "From ₹X" price and open a grouped picker sheet;
            // plain items keep the inline ADD / stepper.
            // Best-before / near-expiry: mirrors the backend discount so the
            // shown price equals the charged price (server stays authoritative).
            const nexp = hasVariants ? null : nearExpiryInfo(item, store);
            const baseEff = Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : item.sellingPrice);
            let effPrice = hasVariants ? minVariantPrice(variants) : baseEff;
            let strikePrice = hasVariants
              ? null
              : (item.offerPrice && Number(item.offerPrice) > 0 && Number(item.sellingPrice) > Number(item.offerPrice)
                  ? Number(item.sellingPrice)
                  : (item.mrp && Number(item.mrp) > Number(item.sellingPrice) ? Number(item.mrp) : null));
            if (nexp && nexp.isNearExpiry) {
              effPrice = nexp.effectivePrice;
              strikePrice = baseEff; // strike the pre-discount effective price
            }
            const qty = hasVariants ? getItemTotalQty(item.id) : getItemQty(item.id);
            const extraCount =
              ((() => { try { return JSON.parse(item.offers || "[]").length; } catch { return 0; } })()) +
              ((() => { try { return JSON.parse(item.services || "[]").length; } catch { return 0; } })());
            const groupCount = (() => { try { return JSON.parse(item.groupedItemIds || "[]").length; } catch { return 0; } })();
            // Per-item order-quantity limits (merchant-configured).
            const minQty = Math.max(1, Number(item.minOrderQty) || 1);
            const maxQty = Number(item.maxOrderQty) > 0 ? Number(item.maxOrderQty) : null;
            const atMax = !hasVariants && maxQty != null && qty >= maxQty;
            return (
              <div key={item.id} className={`mkt-item-card${viewMode === "list" ? " mkt-item-card--list" : ""}`}>
                <div
                  className="mkt-item-image"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer", position: "relative" }}
                  onClick={() => setVariantItem(item)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVariantItem(item); } }}
                  aria-label={`View ${item.name} details`}
                >
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <FaStore size={32} />}
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSave(item); }}
                      aria-label={savedIds.has(String(item.id)) ? "Remove from saved" : "Save product"}
                      title={savedIds.has(String(item.id)) ? "Saved" : "Save"}
                      style={{ width: 28, height: 28, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.45)", color: savedIds.has(String(item.id)) ? "#f87171" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                    >
                      {savedIds.has(String(item.id)) ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleCompare(item); }}
                      aria-label={compare.isSelected(item.id) ? "Remove from compare" : "Add to compare"}
                      title={compare.isSelected(item.id) ? "In compare" : "Compare"}
                      style={{ width: 28, height: 28, borderRadius: 999, border: "none", background: compare.isSelected(item.id) ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                    >
                      <FaBalanceScale size={12} />
                    </button>
                  </div>
                </div>
                <div className="mkt-item-body">
                  <p
                    className="mkt-item-name"
                    style={{ cursor: "pointer" }}
                    onClick={() => setVariantItem(item)}
                  >
                    {item.name}
                  </p>
                  {(item.brand || item.packSize) && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 2 }}>
                      {[item.brand, item.packSize].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {(item.coldChain || (nexp && (nexp.isNearExpiry || nexp.hasExpiry))) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
                      {item.coldChain && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.35)", borderRadius: 999, padding: "1px 7px" }}>
                          <FaSnowflake size={9} /> Cold chain
                        </span>
                      )}
                      {nexp && nexp.isNearExpiry && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 999, padding: "1px 7px" }}>
                          {nexp.pct}% off · near expiry
                        </span>
                      )}
                      {nexp && nexp.hasExpiry && !nexp.expired && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--cm-muted)", background: "var(--cm-card)", border: "1px solid var(--cm-line)", borderRadius: 999, padding: "1px 7px" }}>
                          Best before {fmtExpiry(nexp.expiryDate)}
                        </span>
                      )}
                    </div>
                  )}
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
                        <button
                          className="mkt-stepper-btn"
                          onClick={() => handleAdd(item)}
                          disabled={atMax}
                          style={atMax ? { opacity: 0.4, cursor: "default" } : undefined}
                          aria-label="Increase"
                        ><FaPlus size={10} /></button>
                      </div>
                    )}
                  </div>
                  {!hasVariants && (minQty > 1 || maxQty != null) && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>
                      {minQty > 1 ? `Min ${minQty}` : ""}
                      {minQty > 1 && maxQty != null ? " · " : ""}
                      {maxQty != null ? `Max ${maxQty}` : ""}
                      {atMax ? " (max reached)" : ""}
                    </div>
                  )}
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
                  <CashbackHint item={item} store={store} style={{ marginTop: 4 }} />
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

      {compare.count > 0 && (
        <div
          className="mkt-cart-bar"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #007BFF 100%)",
            boxShadow: "0 12px 32px rgba(99,102,241,0.35)",
            bottom: totals.count > 0 && cart && cart.storeId === store.id ? 80 : 16,
          }}
          onClick={() => navigate("/customer/app/marketplace/compare")}
        >
          <div className="mkt-cart-bar-info" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaBalanceScale size={13} /> {compare.count} to compare
          </div>
          <div className="mkt-cart-bar-cta">Compare →</div>
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
          onBuyNow={handleBuyNow}
          saved={savedIds.has(String(variantItem.id))}
          onToggleSave={() => toggleSave(variantItem)}
          attrDefs={attrDefs}
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
const VariantPickerSheet = ({ store, item, allItems = [], onOpenItem, closed, onClose, getItemQty, addItem, decrementItem, onBuyNow, saved, onToggleSave, attrDefs = [] }) => {
  const navigate = useNavigate();
  const variants = useMemo(() => parseVariants(item), [item]);
  const dims = useMemo(() => variantDimensions(variants), [variants]);
  const { updateLineExtras, storeList } = useMarketplaceCart();

  // ===== Per-line customization (bakery cake message / reference photo) =====
  const allowsCustomization = !!item.allowsCustomization;
  const [custNote, setCustNote] = useState("");
  const [custImage, setCustImage] = useState("");
  const [custUploading, setCustUploading] = useState(false);
  const [custError, setCustError] = useState(null);
  const custFileInput = useRef(null);

  // ===== Wave 4: add-on services (priced), chosen by CODE only =====
  const [addOnCodes, setAddOnCodes] = useState(() => new Set());

  // ===== Product reviews =====
  const [reviewData, setReviewData] = useState(null); // { summary, records, ... }
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [eligibleOrderId, setEligibleOrderId] = useState(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateStars, setRateStars] = useState(0);
  const [rateComment, setRateComment] = useState("");
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateMessage, setRateMessage] = useState(null); // { ok, text }

  const loadReviews = useCallback((itemId) => {
    marketplaceItemExtrasService.getItemReviews(itemId, { pageNumber: 0, pageSize: 10 })
      .then((res) => { if (res.success && res.data) setReviewData(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setReviewData(null);
    setReviewsOpen(false);
    setEligibleOrderId(null);
    setRateOpen(false);
    setRateStars(0);
    setRateComment("");
    setRateMessage(null);
    setCustError(null);
    if (!item?.id) return;
    loadReviews(item.id);
    marketplaceItemExtrasService.getMyEligibleOrder(item.id)
      .then((res) => {
        if (res.success && res.data && res.data.orderId != null) setEligibleOrderId(res.data.orderId);
      })
      .catch(() => {});
  }, [item?.id, loadReviews]);

  const handleCustImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setCustError("Image must be under 5 MB"); return; }
    setCustError(null);
    setCustUploading(true);
    const res = await marketplaceService.uploadImage(file, "item");
    setCustUploading(false);
    if (res.success && res.data?.url) setCustImage(res.data.url);
    else setCustError(res.message || "Upload failed");
  };

  const submitReview = async () => {
    if (rateSubmitting) return;
    if (!rateStars) { setRateMessage({ ok: false, text: "Pick a star rating first" }); return; }
    setRateSubmitting(true);
    setRateMessage(null);
    const res = await marketplaceItemExtrasService.createItemReview(item.id, {
      orderId: eligibleOrderId,
      rating: rateStars,
      comment: rateComment.trim() || undefined,
    });
    setRateSubmitting(false);
    if (res.success) {
      setRateMessage({ ok: true, text: "Thanks! Your review is live." });
      setRateOpen(false);
      setRateStars(0);
      setRateComment("");
      setEligibleOrderId(null);
      loadReviews(item.id);
    } else {
      // e.g. backend "not purchased" rejection — keep it friendly.
      setRateMessage({ ok: false, text: res.message || "You can rate products after they're delivered to you." });
    }
  };

  // Products grouped with this one (Amazon-style "other options"). Tapping a
  // grouped product swaps the sheet to show that product instead.
  const groupedProducts = useMemo(() => {
    let ids = [];
    try { const a = JSON.parse(item.groupedItemIds || "[]"); if (Array.isArray(a)) ids = a.map(Number); } catch { /* ignore */ }
    if (!ids.length) return [];
    const byId = new Map((allItems || []).map((it) => [it.id, it]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [item, allItems]);

  // Discovery strips — companions from past orders + similar catalog items.
  // Cards come back in the feed row shape; they're resolved against the
  // already-loaded store items so tapping swaps the sheet (like grouped items).
  const [fbtCards, setFbtCards] = useState([]);
  const [similarCards, setSimilarCards] = useState([]);
  // Cross-category "goes well with" companions (Wave 6) — may be from OTHER
  // stores, so these are shown as their own cards and tap through to that store.
  const [bundleCards, setBundleCards] = useState([]);
  useEffect(() => {
    let alive = true;
    setFbtCards([]);
    setSimilarCards([]);
    setBundleCards([]);
    if (!item?.id) return undefined;
    marketplaceDiscoveryService.getFrequentlyBoughtTogether(item.id)
      .then((res) => { if (alive && res.success) setFbtCards(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    marketplaceDiscoveryService.getSimilarProducts(item.id)
      .then((res) => { if (alive && res.success) setSimilarCards(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    marketplaceWave6Service.getItemBundle(item.id)
      .then((res) => { if (alive && res.success) setBundleCards(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [item?.id]);

  const bundleCompanions = useMemo(() => {
    const seen = new Set();
    return (bundleCards || [])
      .map((row) => ({ card: row.companion || row, category: row.companionCategory, score: row.score }))
      .filter((b) => b.card && b.card.id && b.card.id !== item.id)
      .filter((b) => (seen.has(`${b.card.storeId}-${b.card.id}`) ? false : seen.add(`${b.card.storeId}-${b.card.id}`)));
  }, [bundleCards, item]);

  const itemsById = useMemo(() => new Map((allItems || []).map((it) => [it.id, it])), [allItems]);
  const fbtItems = useMemo(
    () => fbtCards.map((c) => itemsById.get(c.id)).filter((g) => g && g.id !== item.id),
    [fbtCards, itemsById, item]
  );
  const similarItems = useMemo(() => {
    const fbtIds = new Set(fbtItems.map((g) => g.id));
    return similarCards
      .map((c) => itemsById.get(c.id))
      .filter((g) => g && g.id !== item.id && !fbtIds.has(g.id));
  }, [similarCards, itemsById, item, fbtItems]);

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
  // Best-before / near-expiry discount (non-variant items) — matches backend.
  const nexp = hasVar ? null : nearExpiryInfo(item, store);
  const nearExpiryActive = !!(nexp && nexp.isNearExpiry);
  const dispPrice = hasVar
    ? (selected ? Number(selected.price) : null)
    : (nearExpiryActive ? nexp.effectivePrice : basePrice);
  const dispMrp = hasVar
    ? (selected?.mrp && Number(selected.mrp) > Number(selected.price) ? Number(selected.mrp) : null)
    : (nearExpiryActive ? basePrice : baseMrp);

  const qty = hasVar ? (selected ? getItemQty(item.id, selected.label) : 0) : getItemQty(item.id);
  const stock = hasVar && selected && selected.stock != null ? Number(selected.stock) : null;
  const soldOut = stock != null && stock <= 0;
  // Per-item order-quantity limits (merchant-configured).
  const minQty = Math.max(1, Number(item.minOrderQty) || 1);
  const maxQty = Number(item.maxOrderQty) > 0 ? Number(item.maxOrderQty) : null;
  const atMax = maxQty != null && qty >= maxQty;
  const canAdd = (hasVar ? !!selected : true) && !closed && item.isAvailable !== false && !soldOut && !atMax;

  const variant = hasVar && selected ? { label: selected.label, price: Number(selected.price), image: selected.image } : null;
  const lineKey = hasVar && selected ? `${item.id}::${selected.label}` : `${item.id}`;

  // Prefill customization from the cart line (if this item+variant is already
  // in the cart) so re-opening the sheet shows the saved message/photo.
  useEffect(() => {
    if (!allowsCustomization) return;
    const bucket = (storeList || []).find((b) => String(b.storeId) === String(store?.id));
    const line = bucket?.items?.[lineKey];
    setCustNote(line?.note || "");
    setCustImage(line?.noteImageUrl || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey, store?.id, allowsCustomization]);

  // Customization travels with the cart line: passed on add, and synced live
  // when the line already exists.
  const custExtras = allowsCustomization
    ? { note: custNote.trim() || null, imageUrl: custImage || null }
    : {};
  const syncCustToLine = (note, imageUrl) => {
    if (!allowsCustomization || qty === 0) return;
    updateLineExtras(store.id, lineKey, { note: note.trim() || null, imageUrl: imageUrl || null });
  };

  const parseArr = (raw) => { try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
  const offers = parseArr(item.offers);
  const services = parseArr(item.services);
  // Split legacy assurance highlights from new priced add-on services.
  const { addOns: addOnServices, assurances } = splitServices(services);
  const chosenAddOns = addOnServices.filter((a) => addOnCodes.has(a.code));
  const addOnPerUnit = chosenAddOns.reduce((s, a) => s + a.price, 0);

  // Extras carried onto the cart line: cake note/photo + chosen add-ons.
  const addExtras = {
    ...custExtras,
    ...(addOnServices.length > 0 ? { addOns: chosenAddOns } : {}),
  };

  // Prefill chosen add-ons from the existing cart line so re-opening the sheet
  // shows the saved selection.
  useEffect(() => {
    const bucket = (storeList || []).find((b) => String(b.storeId) === String(store?.id));
    const line = bucket?.items?.[lineKey];
    const saved = Array.isArray(line?.addOns) ? line.addOns.map((a) => a.code) : [];
    setAddOnCodes(new Set(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey, store?.id]);

  const toggleAddOn = (code) => {
    setAddOnCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      // Live-sync to the cart line when this item is already in the cart.
      if (qty > 0) {
        const objs = addOnServices.filter((a) => next.has(a.code));
        updateLineExtras(store.id, lineKey, { addOns: objs });
      }
      return next;
    });
  };

  // Wave 4: dynamic attribute specs (from attributes_json + category defs).
  const attrValues = parseAttributes(item);
  const defByKey = {};
  (attrDefs || []).forEach((d) => { if (d?.attrKey) defByKey[d.attrKey] = d; });
  const specRows = (() => {
    const rows = [];
    const seen = new Set();
    // Defs first (ordered), then any extra keys present on the item.
    (attrDefs || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .forEach((d) => {
        if (d.active === false) return;
        const v = formatAttrValue(attrValues[d.attrKey], d);
        if (v == null) return;
        seen.add(d.attrKey);
        rows.push({ label: d.label || humanizeKey(d.attrKey), value: v });
      });
    Object.keys(attrValues).forEach((k) => {
      if (seen.has(k)) return;
      const v = formatAttrValue(attrValues[k], defByKey[k]);
      if (v == null) return;
      rows.push({ label: defByKey[k]?.label || humanizeKey(k), value: v });
    });
    return rows;
  })();

  // Gold/jewellery: indicative price = rate/g × net weight (display only).
  const metal = attrValues.metal || attrValues.Metal;
  const purity = attrValues.purity || attrValues.Purity || attrValues.hallmark;
  const netWeight = Number(attrValues.net_weight ?? attrValues.weight_gram ?? attrValues.weight);
  const [goldRate, setGoldRate] = useState(null);
  useEffect(() => {
    if (!metal) { setGoldRate(null); return; }
    let alive = true;
    marketplaceWave4Service.getCurrentGoldRate({ metal: String(metal).toUpperCase().includes("SILVER") ? "SILVER" : "GOLD", purity: purity ? String(purity) : "22K" })
      .then((r) => { if (alive && r.success && r.data) setGoldRate(r.data); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  const indicativeGold = goldRate && Number.isFinite(netWeight) && netWeight > 0
    ? Number(goldRate.ratePerGram) * netWeight
    : null;

  // Items eligible for an appointment (jewellery / installable / trial goods).
  const apptPurpose = metal ? "JEWELLERY_VISIT"
    : (attrValues.installation_required ? "INSTALLATION"
      : (item.allowsTrial ? "TRIAL" : null));

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
            {(item.brand || item.packSize) && (
              <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 1 }}>
                {[item.brand, item.packSize].filter(Boolean).join(" · ")}
              </div>
            )}
            {selected && <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{selected.label}</div>}
            {reviewData?.summary && Number(reviewData.summary.count) > 0 && (
              <button
                type="button"
                onClick={() => setReviewsOpen((v) => !v)}
                style={{ background: "none", border: "none", padding: 0, marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#fbbf24", cursor: "pointer" }}
                aria-label="View product reviews"
              >
                <FaStar size={11} />
                {Number(reviewData.summary.average || 0).toFixed(1)}
                <span style={{ color: "var(--cm-muted)", fontWeight: 600 }}>({Number(reviewData.summary.count)})</span>
              </button>
            )}
          </div>
          {onToggleSave && (
            <button
              type="button"
              className="mkt-store-share-btn"
              onClick={onToggleSave}
              aria-label={saved ? "Remove from saved" : "Save product"}
              title={saved ? "Saved" : "Save"}
              style={{ color: saved ? "#f87171" : undefined }}
            >
              {saved ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
            </button>
          )}
          <button
            type="button"
            className="mkt-store-share-btn"
            onClick={() => shareProduct(store, item)}
            aria-label="Share product"
            title="Share product"
          >
            <FaShareAlt size={13} />
          </button>
          <button className="mkt-header-back" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Category-flow badges */}
        {(item.requiresPrescription || item.ageGroup) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 4px" }}>
            {item.requiresPrescription && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 999, padding: "3px 10px" }}>
                ℞ Prescription required
              </span>
            )}
            {item.ageGroup && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6", background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.4)", borderRadius: 999, padding: "3px 10px" }}>
                Age {item.ageGroup}
              </span>
            )}
          </div>
        )}

        {/* Cold-chain / best-before / returnable badges (Retail Wave 2) */}
        {(item.coldChain || (nexp && nexp.hasExpiry) || item.isReturnable || item.replacementAllowed) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 4px" }}>
            {item.coldChain && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.4)", borderRadius: 999, padding: "3px 10px" }}>
                <FaSnowflake size={10} /> Cold chain — kept chilled
              </span>
            )}
            {nexp && nexp.isNearExpiry && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 999, padding: "3px 10px" }}>
                {nexp.pct}% off · near expiry
              </span>
            )}
            {nexp && nexp.hasExpiry && !nexp.expired && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cm-muted)", background: "var(--cm-card)", border: "1px solid var(--cm-line)", borderRadius: 999, padding: "3px 10px" }}>
                Best before {fmtExpiry(nexp.expiryDate)}
                {nexp.daysLeft != null ? ` · ${nexp.daysLeft}d left` : ""}
              </span>
            )}
            {item.isReturnable && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#14b8a6", background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.4)", borderRadius: 999, padding: "3px 10px" }}>
                <FaUndoAlt size={10} /> Returnable
                {Number(store?.returnWindowDays) > 0 ? ` in ${store.returnWindowDays}d` : ""}
              </span>
            )}
            {item.replacementAllowed && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#8b5cf6", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 999, padding: "3px 10px" }}>
                <FaExchangeAlt size={10} /> Replacement available
              </span>
            )}
            {item.batchNo && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cm-muted)", background: "var(--cm-card)", border: "1px solid var(--cm-line)", borderRadius: 999, padding: "3px 10px" }}>
                Batch {item.batchNo}
              </span>
            )}
          </div>
        )}

        {item.description && (
          <div className="mkt-vsheet-dim">
            <div className="mkt-vsheet-dim-label">Product description</div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--cm-text, #4b5563)", whiteSpace: "pre-line" }}>
              {item.description}
            </p>
            {item.unit && (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--cm-muted)" }}>Unit: {item.unit}</div>
            )}
          </div>
        )}

        {hasVar && (dims.length > 0 ? (
          dims.map((dim) => (
            <div key={dim} className="mkt-vsheet-dim">
              <div className="mkt-vsheet-dim-label">
                {item.isWeightBased && (dims.length === 1 || /weight|size|qty|quantity/i.test(dim)) ? "Select weight" : dim}
              </div>
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
            <div className="mkt-vsheet-dim-label">{item.isWeightBased ? "Select weight" : "Options"}</div>
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
        <CashbackHint item={item} store={store} style={{ margin: "6px 0 0" }} />

        {/* Wave 4: live gold/silver rate badge + indicative price (display only) */}
        {goldRate && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#b45309", background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <FaCoins size={11} /> {goldRate.metal || "GOLD"} {goldRate.purity || purity || ""} · ₹{Number(goldRate.ratePerGram).toFixed(0)}/g
            </span>
            {indicativeGold != null && (
              <span style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                Indicative: <strong style={{ color: "var(--cm-ink)" }}>₹{indicativeGold.toFixed(0)}</strong> ({netWeight}g)
              </span>
            )}
          </div>
        )}

        {stock != null && stock > 0 && stock <= 5 && (
          <div className="mkt-vsheet-stock">Only {stock} left</div>
        )}
        {soldOut && <div className="mkt-vsheet-stock" style={{ color: "#f87171" }}>Out of stock</div>}
        {(minQty > 1 || maxQty != null) && (
          <div className="mkt-vsheet-stock" style={{ color: atMax ? "#f87171" : "var(--cm-muted)" }}>
            {minQty > 1 ? `Min order ${minQty}` : ""}
            {minQty > 1 && maxQty != null ? " · " : ""}
            {maxQty != null ? `Max order ${maxQty}` : ""}
            {atMax ? " — limit reached" : ""}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {qty === 0 ? (
            <button
              className="mkt-btn mkt-btn--primary"
              disabled={!canAdd}
              style={{ opacity: canAdd ? 1 : 0.5, flex: 1 }}
              onClick={() => { addItem(store, item, { variant, ...addExtras }); }}
            >
              {closed ? "Store closed" : (minQty > 1 ? `Add ${minQty} to cart` : "Add to cart")}
            </button>
          ) : (
            <div className="mkt-stepper" style={{ width: "fit-content" }}>
              <button className="mkt-stepper-btn" onClick={() => decrementItem(lineKey)} aria-label="Decrease"><FaMinus size={10} /></button>
              <span className="mkt-stepper-qty">{qty}</span>
              <button className="mkt-stepper-btn" disabled={!canAdd} onClick={() => addItem(store, item, { variant, ...addExtras })} aria-label="Increase"><FaPlus size={10} /></button>
            </div>
          )}
          {onBuyNow && (
            <button
              type="button"
              className="mkt-btn mkt-btn--secondary"
              disabled={!canAdd}
              style={{ opacity: canAdd ? 1 : 0.5, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={() => onBuyNow(item, variant, addExtras)}
              title="Buy this item now"
            >
              <FaBolt size={12} /> Buy now
            </button>
          )}
        </div>

        {/* Wave 4: priced add-on services — pick by CODE, server re-computes price */}
        {addOnServices.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Add-on services</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {addOnServices.map((a) => {
                const on = addOnCodes.has(a.code);
                return (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => toggleAddOn(a.code)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
                      borderRadius: 12, padding: "10px 12px", background: "var(--cm-card)",
                      border: `1.5px solid ${on ? "var(--cm-accent, #6366f1)" : "var(--cm-line)"}`,
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center",
                      background: on ? "var(--cm-accent, #6366f1)" : "transparent",
                      border: `1.5px solid ${on ? "var(--cm-accent, #6366f1)" : "var(--cm-line)"}`,
                      color: "#fff",
                    }}>
                      {on && <FaCheck size={10} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--cm-ink)" }}>{a.label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--cm-ink)" }}>+₹{a.price.toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
            {addOnPerUnit > 0 && (
              <div style={{ fontSize: 12.5, color: "var(--cm-muted)", marginTop: 8, textAlign: "right" }}>
                Add-ons: <strong style={{ color: "var(--cm-ink)" }}>+₹{addOnPerUnit.toFixed(0)}</strong> / unit
              </div>
            )}
          </div>
        )}

        {/* Wave 4: book an appointment / trial for eligible items */}
        {apptPurpose && (
          <button
            type="button"
            className="mkt-btn mkt-btn--secondary"
            style={{ width: "100%", marginTop: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={() => navigate(`/customer/app/marketplace/appointments?storeId=${store.id}&itemId=${item.id}&purpose=${apptPurpose}&book=1`)}
          >
            <FaCalendarCheck size={12} /> {apptPurpose === "TRIAL" ? "Book a trial" : "Book appointment"}
          </button>
        )}

        {/* Wave 4: dynamic spec rows from category attributes */}
        {specRows.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Specifications</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {specRows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: i < specRows.length - 1 ? "1px solid var(--cm-line)" : "none" }}>
                  <span style={{ fontSize: 12.5, color: "var(--cm-muted)" }}>{r.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--cm-ink)", textAlign: "right" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customization (bakery cake message / photo) — stored on the cart line */}
        {allowsCustomization && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Add message / photo</div>
            {item.customizationHint && (
              <div style={{ fontSize: 11.5, color: "var(--cm-muted)", marginBottom: 6 }}>{item.customizationHint}</div>
            )}
            <textarea
              className="mkt-textarea"
              maxLength={200}
              placeholder="Your message (e.g. Happy Birthday Asha!)"
              value={custNote}
              onChange={(e) => { setCustNote(e.target.value); syncCustToLine(e.target.value, custImage); }}
              style={{ minHeight: 56 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="mkt-btn mkt-btn--secondary"
                onClick={() => custFileInput.current?.click()}
                disabled={custUploading}
                style={{ width: "auto", padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              >
                <FaCamera size={12} />
                {custUploading ? "Uploading…" : custImage ? "Change photo" : "Add photo (optional)"}
              </button>
              {custImage && (
                <>
                  <img src={custImage} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => { setCustImage(""); syncCustToLine(custNote, ""); }}
                    style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    Remove
                  </button>
                </>
              )}
              <input ref={custFileInput} type="file" accept="image/*" hidden onChange={handleCustImage} />
            </div>
            <div style={{ fontSize: 10.5, color: "var(--cm-muted)", marginTop: 6 }}>
              {custNote.length}/200 · {qty > 0 ? "Saved to your cart item." : "Added when you add this item to the cart."}
            </div>
            {custError && <div style={{ fontSize: 11.5, color: "#f87171", marginTop: 4 }}>{custError}</div>}
          </div>
        )}

        {/* Product reviews — summary always in the head; list + rate here */}
        <div className="mkt-isheet-sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="mkt-isheet-sec-title" style={{ margin: 0 }}>Product reviews</div>
            {reviewData?.summary && Number(reviewData.summary.count) > 0 && (
              <span style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                ★ {Number(reviewData.summary.average || 0).toFixed(1)} ({Number(reviewData.summary.count)})
              </span>
            )}
            {reviewData && Number(reviewData.summary?.count || 0) > 0 && (
              <button
                type="button"
                onClick={() => setReviewsOpen((v) => !v)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--cm-accent, #007BFF)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
              >
                {reviewsOpen ? "Hide" : "View all"}
              </button>
            )}
          </div>

          {(!reviewData || Number(reviewData.summary?.count || 0) === 0) && (
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 6 }}>No reviews yet.</div>
          )}

          {reviewsOpen && Array.isArray(reviewData?.records) && reviewData.records.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {reviewData.records.map((rv) => (
                <div key={rv.id} style={{ padding: 10, borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", gap: 1 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <FaStar key={n} size={10} color={n <= Math.round(Number(rv.rating) || 0) ? "#fbbf24" : "var(--cm-line)"} />
                      ))}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-ink)" }}>{rv.customerName || "Customer"}</span>
                    {rv.createdAt && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--cm-muted)" }}>
                        {new Date(rv.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {rv.comment && (
                    <div style={{ marginTop: 5, fontSize: 12, color: "var(--cm-text, #4b5563)", lineHeight: 1.4 }}>{rv.comment}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rate this product — only when there's an eligible delivered order */}
          {eligibleOrderId != null && !rateOpen && (
            <button
              type="button"
              className="mkt-btn mkt-btn--secondary"
              onClick={() => { setRateOpen(true); setRateMessage(null); }}
              style={{ marginTop: 10, width: "auto", padding: "8px 16px", fontSize: 12.5 }}
            >
              ★ Rate this product
            </button>
          )}
          {rateOpen && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRateStars(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    style={{ background: "none", border: "none", padding: 2, cursor: "pointer" }}
                  >
                    <FaStar size={20} color={n <= rateStars ? "#fbbf24" : "var(--cm-line)"} />
                  </button>
                ))}
              </div>
              <textarea
                className="mkt-textarea"
                maxLength={500}
                placeholder="Share your experience (optional)"
                value={rateComment}
                onChange={(e) => setRateComment(e.target.value)}
                style={{ minHeight: 52 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="mkt-btn mkt-btn--primary"
                  onClick={submitReview}
                  disabled={rateSubmitting}
                  style={{ width: "auto", padding: "8px 16px", fontSize: 12.5 }}
                >
                  {rateSubmitting ? "Submitting…" : "Submit review"}
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-btn--secondary"
                  onClick={() => setRateOpen(false)}
                  style={{ width: "auto", padding: "8px 14px", fontSize: 12.5 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {rateMessage && (
            <div style={{ marginTop: 8, fontSize: 12, color: rateMessage.ok ? "#22c55e" : "#f59e0b" }}>
              {rateMessage.text}
            </div>
          )}
        </div>

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

        {assurances.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Services</div>
            <div className="mkt-service-row">
              {assurances.map((s, i) => (
                <div key={i} className="mkt-service-item">
                  <div className="mkt-service-label">{s.label}</div>
                  {s.detail && <div className="mkt-service-detail">{s.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Frequently bought together — co-ordered companions (tap to view) */}
        {fbtItems.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Frequently bought together</div>
            <div className="mkt-group-row">
              {fbtItems.map((g) => {
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

        {/* Similar products — same store & category, comparable price */}
        {similarItems.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Similar products</div>
            <div className="mkt-group-row">
              {similarItems.map((g) => {
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

        {/* Goes well with — cross-category companions (Wave 6, may be other stores) */}
        {bundleCompanions.length > 0 && (
          <div className="mkt-isheet-sec">
            <div className="mkt-isheet-sec-title">Goes well with</div>
            <div className="mkt-group-row">
              {bundleCompanions.map((b) => {
                const g = b.card;
                const sameStore = String(g.storeId) === String(store?.id);
                const gPrice = Number(g.offerPrice && Number(g.offerPrice) > 0 ? g.offerPrice : g.sellingPrice) || 0;
                const onTap = () => {
                  if (sameStore && onOpenItem) {
                    const local = (allItems || []).find((it) => it.id === g.id);
                    if (local) { onOpenItem(local); return; }
                  }
                  navigate(`/customer/app/marketplace/store/${g.storeId}?item=${g.id}`);
                };
                return (
                  <button key={`${g.storeId}-${g.id}`} type="button" className="mkt-group-chip" onClick={onTap}>
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
      </div>
    </div>
  );
};

export default StoreDetailScreen;
