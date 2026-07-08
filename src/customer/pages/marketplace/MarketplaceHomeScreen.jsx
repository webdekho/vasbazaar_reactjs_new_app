import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaPlus,
  FaMinus,
  FaStore,
  FaClock,
  FaRupeeSign,
  FaShareAlt,
  FaStar,
  FaShoppingBag,
  FaCarrot,
  FaPrescriptionBottleAlt,
  FaUtensils,
  FaBookOpen,
  FaLaptop,
  FaTshirt,
  FaBreadSlice,
  FaWineBottle,
  FaCoffee,
  FaIceCream,
  FaPaw,
  FaBaby,
  FaGifts,
  FaTools,
  FaSeedling,
  FaCandyCane,
  FaMobileAlt,
  FaPizzaSlice,
  FaHamburger,
  FaFutbol,
  FaBookReader,
  FaSpa,
  FaHeart,
  FaReceipt,
  FaRedo,
  FaBarcode,
  FaShoppingBasket,
  FaBookmark,
} from "react-icons/fa";
import { FiSearch, FiMapPin, FiZap, FiTag, FiTrendingUp, FiClock } from "react-icons/fi";
import { marketplaceService } from "../../services/marketplaceService";
import { marketplaceDiscoveryService } from "../../services/marketplaceDiscoveryService";
import { marketplaceLogisticsAiService, hasPricePhrase } from "../../services/marketplaceLogisticsAiService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useToast } from "../../context/ToastContext";
import { shareStore } from "./shareStore";
import { useGeolocation } from "../../hooks/useGeolocation";
import LocationPickerSheet from "../../components/LocationPickerSheet";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
import "./marketplace.css";

const SELECTED_LOC_KEY = "marketplaceSelectedLocation";
const readSelectedLocation = () => {
  try {
    const raw = localStorage.getItem(SELECTED_LOC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") return parsed;
    return null;
  } catch { return null; }
};

const CATEGORY_ICON_RULES = [
  { match: /(grocery|kirana|supermarket|mart)/i, icon: FaCarrot, color: "#10b981" },
  { match: /(pharma|medic|chemist|drug|clinic|health)/i, icon: FaPrescriptionBottleAlt, color: "#ef4444" },
  { match: /(pizza)/i, icon: FaPizzaSlice, color: "#f59e0b" },
  { match: /(burger|fast\s*food)/i, icon: FaHamburger, color: "#f59e0b" },
  { match: /(restaurant|food|kitchen|dhaba|tiffin|meal)/i, icon: FaUtensils, color: "#f97316" },
  { match: /(stationery|book|paper|office)/i, icon: FaBookOpen, color: "#3b82f6" },
  { match: /(electronic|gadget|computer|laptop)/i, icon: FaLaptop, color: "#6366f1" },
  { match: /(mobile|phone|accessor)/i, icon: FaMobileAlt, color: "#8b5cf6" },
  { match: /(cloth|fashion|apparel|garment|wear|boutique)/i, icon: FaTshirt, color: "#ec4899" },
  { match: /(bakery|bread|cake)/i, icon: FaBreadSlice, color: "#d97706" },
  { match: /(beverage|juice|drink|liquor|wine)/i, icon: FaWineBottle, color: "#7c3aed" },
  { match: /(cafe|coffee|tea)/i, icon: FaCoffee, color: "#92400e" },
  { match: /(ice\s*cream|dessert|sweet|mithai)/i, icon: FaIceCream, color: "#ec4899" },
  { match: /(candy|chocolate|confection)/i, icon: FaCandyCane, color: "#db2777" },
  { match: /(pet)/i, icon: FaPaw, color: "#0ea5e9" },
  { match: /(baby|kid|toy)/i, icon: FaBaby, color: "#fb7185" },
  { match: /(gift|florist|flower)/i, icon: FaGifts, color: "#f43f5e" },
  { match: /(hardware|tool|repair|electric)/i, icon: FaTools, color: "#64748b" },
  { match: /(plant|nursery|garden|organic)/i, icon: FaSeedling, color: "#16a34a" },
  { match: /(sport|fitness|gym)/i, icon: FaFutbol, color: "#0d9488" },
  { match: /(library|education|tuition)/i, icon: FaBookReader, color: "#1d4ed8" },
  { match: /(salon|beauty|cosmetic|spa)/i, icon: FaSpa, color: "#a855f7" },
  { match: /(love|romance|dating)/i, icon: FaHeart, color: "#ef4444" },
];

const getCategoryIcon = (name) => {
  const rule = CATEGORY_ICON_RULES.find((r) => r.match.test(name || ""));
  if (rule) return { Icon: rule.icon, color: rule.color };
  return { Icon: FaStore, color: null };
};

const formatDistance = (km) => {
  if (km == null) return null;
  const n = Number(km);
  if (Number.isNaN(n)) return null;
  if (n < 1) return `${Math.round(n * 1000)} m`;
  return `${n.toFixed(1)} km`;
};

const SEARCH_HINTS = ["milk", "paracetamol", "biryani", "notebooks", "fruits"];

// Marketplace feed loads 10 products at a time ("View more" fetches the next 10).
const PRODUCT_PAGE_SIZE = 10;

const QUICK_FILTERS = [
  { id: "free_delivery", label: "Free delivery", icon: FiTag },
  { id: "fast", label: "Under 30 min", icon: FiZap },
  { id: "open", label: "Open now", icon: FiTrendingUp },
];

const StoreCardSkeleton = () => (
  <div className="mkt-store-card-v2 mkt-skeleton-card">
    <div className="mkt-store-cover mkt-skel" />
    <div className="mkt-store-body">
      <div className="mkt-skel mkt-skel--line" style={{ width: "60%", height: 14 }} />
      <div className="mkt-skel mkt-skel--line" style={{ width: "40%", height: 11, marginTop: 8 }} />
    </div>
  </div>
);

// Client-side sort options for the unified product feed (v1 — applied to the
// already-fetched list only; the backend keeps its relevance/distance order).
const SORT_OPTIONS = [
  { id: "relevance", label: "Recommended" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "newest", label: "Newest" },
  { id: "name", label: "Name A–Z" },
];

const productPrice = (p) => (p.offerPrice != null ? Number(p.offerPrice) : Number(p.sellingPrice || 0));

/**
 * Horizontal discovery rail (Featured / Recently viewed / Buy again). Cards
 * share the unified product-feed row shape, so open/add/qty handlers from the
 * feed are reused unchanged. Renders nothing while empty.
 */
const DiscoveryRail = ({ title, icon, items, onOpen, onAdd, onDecrement, qtyOf }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="mkt-section" style={{ paddingBottom: 0 }}>
      <div className="mkt-section-head">
        <h2 className="mkt-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon}
          {title}
        </h2>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 2px 8px", scrollbarWidth: "none" }}>
        {items.map((p) => {
          const price = productPrice(p);
          const mrp = Number(p.mrp || 0);
          const qty = qtyOf(p);
          const closed = p.storeOpen === false;
          return (
            <article
              key={`${p.storeId}-${p.id}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => { if (e.key === "Enter") onOpen(p); }}
              style={{
                flexShrink: 0,
                width: 132,
                borderRadius: 14,
                border: "1px solid var(--cm-line)",
                background: "var(--cm-card)",
                overflow: "hidden",
                cursor: "pointer",
                opacity: closed ? 0.6 : 1,
              }}
            >
              <div style={{ height: 88, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "var(--cm-line)" }}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <FaShoppingBag size={20} color="var(--cm-muted)" />}
              </div>
              <div style={{ padding: "8px 10px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cm-ink)", lineHeight: 1.3, height: 31, overflow: "hidden" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--cm-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                  {p.storeName}{closed ? " · Closed" : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)", whiteSpace: "nowrap" }}>
                    ₹{price.toFixed(0)}
                    {mrp > price && (
                      <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 500, color: "var(--cm-muted)", textDecoration: "line-through" }}>
                        ₹{mrp.toFixed(0)}
                      </span>
                    )}
                  </div>
                  {qty > 0 ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                    >
                      <button
                        type="button"
                        aria-label={`Remove one ${p.name}`}
                        onClick={() => onDecrement(p)}
                        style={{ width: 20, height: 20, borderRadius: 6, border: "1px solid var(--cm-line)", background: "var(--cm-card)", color: "var(--cm-ink)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                      >
                        <FaMinus size={8} />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-ink)", minWidth: 12, textAlign: "center" }}>{qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one more ${p.name}`}
                        onClick={() => onAdd(p, true)}
                        style={{ width: 20, height: 20, borderRadius: 6, border: "none", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                      >
                        <FaPlus size={8} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Add ${p.name} to cart`}
                      onClick={(e) => { e.stopPropagation(); onAdd(p); }}
                      style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                    >
                      <FaPlus size={10} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const matchesQuickFilter = (store, filter) => {
  if (!filter) return true;
  if (filter === "free_delivery") return Number(store.deliveryCharges || 0) === 0;
  if (filter === "fast") return Number(store.deliveryTimeMinutes || 999) <= 30;
  if (filter === "open") return store.isOpen !== false;
  return true;
};

const MarketplaceHomeScreen = () => {
  const navigate = useNavigate();
  const { totals, cart, addItem, decrementLine, getStoreItemQty } = useMarketplaceCart();
  const { showToast } = useToast();

  // Use Capacitor geolocation hook for proper Android/iOS permission handling
  const {
    coords: geoCoords,
    error: geoError,
    permissionStatus,
    requestLocation: requestGeo,
  } = useGeolocation({ autoRequest: true, timeout: 10000, maximumAge: 60000 });

  // Manually-picked location takes priority over device GPS so users on a
  // denied/inaccurate location can still browse stores in any area.
  const [selectedLoc, setSelectedLoc] = useState(readSelectedLocation);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Human-readable name for the device GPS position (reverse-geocoded).
  const [gpsLabel, setGpsLabel] = useState("");

  // Reverse-geocode the device GPS coords into a place name so the chip shows
  // e.g. "Kothrud, Pune" instead of a static "Current location".
  useEffect(() => {
    if (!geoCoords) { setGpsLabel(""); return; }
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      lat: String(geoCoords.lat),
      lon: String(geoCoords.lng),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "16",
    });
    fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const a = j?.address || {};
        const primary = a.neighbourhood || a.suburb || a.village || a.town || a.city_district || a.road || a.amenity;
        const city = a.city || a.town || a.village || a.county;
        const label = [primary, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ")
          || j?.display_name?.split(",").slice(0, 2).join(", ");
        if (label) setGpsLabel(label);
      })
      .catch(() => { /* keep fallback label */ });
    return () => ctrl.abort();
  }, [geoCoords]);

  const coords = useMemo(() => {
    if (selectedLoc) return { lat: selectedLoc.lat, lng: selectedLoc.lng };
    if (geoCoords) return { lat: geoCoords.lat, lng: geoCoords.lng };
    if (geoError) return { lat: null, lng: null };
    return null;
  }, [selectedLoc, geoCoords, geoError]);

  const locationLabel = useMemo(() => {
    if (selectedLoc?.label) return selectedLoc.label;
    if (geoCoords) return gpsLabel || "Current location";
    if (geoError) return "Set location";
    return "Detecting…";
  }, [selectedLoc, geoCoords, geoError, gpsLabel]);

  const handleSelectLocation = (place) => {
    const next = { lat: place.lat, lng: place.lng, label: place.label };
    setSelectedLoc(next);
    try { localStorage.setItem(SELECTED_LOC_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
  };

  const handleUseCurrentLocation = () => {
    setSelectedLoc(null);
    try { localStorage.removeItem(SELECTED_LOC_KEY); } catch { /* ignore */ }
    if (requestGeo) requestGeo();
  };

  const coordsError = useMemo(() => {
    if (!geoError) return null;
    return permissionStatus === "denied"
      ? "Enable location permission to see nearby stores"
      : "Location unavailable — showing all reachable stores";
  }, [geoError, permissionStatus]);

  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeQuick, setActiveQuick] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchHintIdx, setSearchHintIdx] = useState(0);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Browse mode: "stores" (store cards — the default landing) or "products"
  // (unified Marketplace feed). A non-empty search always shows item results.
  const [viewMode, setViewMode] = useState("stores");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [productsRefresh, setProductsRefresh] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastProductKey = useRef("");
  const [hasMyStore, setHasMyStore] = useState(false);
  const checkedMyStore = useRef(false);
  const lastFetchKey = useRef(""); // Track last fetch params to prevent duplicate calls

  // ===== Discovery rails (Featured / Recently viewed / Buy again) =====
  const [featuredItems, setFeaturedItems] = useState([]);
  const [recentViews, setRecentViews] = useState([]);
  const [buyAgain, setBuyAgain] = useState([]);
  const lastDiscoveryKey = useRef("");
  // Client-side sort for the product feed (v1 — sorts the fetched list only).
  const [sortBy, setSortBy] = useState("relevance");

  // ===== AI-lite: barcode scan-to-reorder + smart monthly basket =====
  const [scannerOpen, setScannerOpen] = useState(false);
  // { code, loading, items } — results sheet after a scan.
  const [scanResults, setScanResults] = useState(null);
  // { loading, groups } — smart-basket sheet (groups = per-store suggestions).
  const [basketSheet, setBasketSheet] = useState(null);

  // Rotating search placeholder
  useEffect(() => {
    const t = setInterval(() => setSearchHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    marketplaceService.getCategories().then((res) => {
      if (res.success) setCategories(Array.isArray(res.data) ? res.data : []);
    });
  }, []);

  useEffect(() => {
    if (checkedMyStore.current) return;
    checkedMyStore.current = true;
    marketplaceService.getMyStore().then((res) => {
      if (res.success && res.data && res.data.id) setHasMyStore(true);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Recently viewed rail — no location needed, refreshed once per visit.
  useEffect(() => {
    marketplaceDiscoveryService.getRecentlyViewed().then((res) => {
      if (res.success) setRecentViews(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  // Featured + Buy again rails — refetched when the browse location changes.
  // Featured requires coordinates; Buy again degrades gracefully without them
  // (it then skips the "store still services you" filter).
  useEffect(() => {
    if (!coords) return;
    const key = `${coords.lat}-${coords.lng}`;
    if (lastDiscoveryKey.current === key) return;
    lastDiscoveryKey.current = key;
    const loc = coords.lat != null && coords.lng != null ? { lat: coords.lat, lng: coords.lng } : {};
    if (loc.lat != null) {
      marketplaceDiscoveryService.getFeatured(loc).then((res) => {
        if (res.success) setFeaturedItems(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
    marketplaceDiscoveryService.getBuyAgain(loc).then((res) => {
      if (res.success) setBuyAgain(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, [coords]);

  // Load stores with deduplication to prevent infinite API calls
  useEffect(() => {
    if (!coords) return;

    // Create a unique key for this fetch request
    const fetchKey = `${coords.lat}-${coords.lng}-${debouncedSearch}-${activeCategoryId}`;

    // Skip if we already fetched with these exact params
    if (lastFetchKey.current === fetchKey) return;
    lastFetchKey.current = fetchKey;

    const loadStores = async () => {
      setLoading(true);
      setError(null);
      const res = await marketplaceService.getNearbyStores({
        lat: coords.lat,
        lng: coords.lng,
        search: debouncedSearch || undefined,
        categoryId: activeCategoryId || undefined,
      });
      setLoading(false);
      if (res.success) {
        setStores(Array.isArray(res.data) ? res.data : []);
      } else {
        setError(res.message || "Could not load stores");
      }
    };

    loadStores();
  }, [coords, debouncedSearch, activeCategoryId]);

  // Expose loadStores for manual refresh (e.g., retry button)
  const loadStores = useCallback(async () => {
    if (!coords) return;
    lastFetchKey.current = ""; // Reset to force refetch
    setLoading(true);
    setError(null);
    const res = await marketplaceService.getNearbyStores({
      lat: coords.lat,
      lng: coords.lng,
      search: debouncedSearch || undefined,
      categoryId: activeCategoryId || undefined,
    });
    setLoading(false);
    if (res.success) {
      setStores(Array.isArray(res.data) ? res.data : []);
      lastFetchKey.current = `${coords.lat}-${coords.lng}-${debouncedSearch}-${activeCategoryId}`;
    } else {
      setError(res.message || "Could not load stores");
    }
  }, [coords, debouncedSearch, activeCategoryId]);

  // A search query always surfaces item-level results (typo-tolerant), even when
  // the toggle is on "stores" — you search for things, not shop names.
  const showProducts = viewMode === "products" || !!debouncedSearch;

  // Fetch one page of products. append=false replaces (fresh load), true grows
  // the list for "View more". Pages are 10 items each.
  const loadProducts = useCallback(async (page, append) => {
    if (!coords) return;
    if (append) setLoadingMore(true);
    else { setProductsLoading(true); setProductsError(null); }

    // AI-lite search: queries with a price phrase ("milk under 50") go to the
    // discovery-ai endpoint (token match + price filter). Cards share the feed
    // row shape. Any failure falls through to the plain feed transparently.
    if (!append && debouncedSearch && hasPricePhrase(debouncedSearch)) {
      try {
        const aiRes = await marketplaceLogisticsAiService.aiSearch(debouncedSearch, {
          ...(coords.lat != null ? { lat: coords.lat, lng: coords.lng } : {}),
        });
        if (aiRes.success && Array.isArray(aiRes.data)) {
          setProductsLoading(false);
          setProducts(aiRes.data);
          setProductPage(0);
          setProductsHasMore(false); // AI search returns one ranked list
          return;
        }
      } catch { /* fall back to the plain feed below */ }
    }

    const res = await marketplaceService.getNearbyProducts({
      lat: coords.lat,
      lng: coords.lng,
      search: debouncedSearch || undefined,
      categoryId: activeCategoryId || undefined,
      pageNumber: page,
      pageSize: PRODUCT_PAGE_SIZE,
    });
    if (append) setLoadingMore(false);
    else setProductsLoading(false);
    if (res.success) {
      const data = res.data || {};
      const recs = Array.isArray(data.records) ? data.records : [];
      setProducts((prev) => (append ? [...prev, ...recs] : recs));
      setProductPage(page);
      const totalPages = Number(data.totalPages || 0);
      const current = Number(data.currentPage || page + 1);
      setProductsHasMore(current < totalPages);
    } else if (!append) {
      setProductsError(res.message || "Could not load products");
    }
  }, [coords, debouncedSearch, activeCategoryId]);

  // Reset and load the first page whenever the feed shows or its filters change.
  useEffect(() => {
    if (!showProducts || !coords) return;
    const fetchKey = `${coords.lat}-${coords.lng}-${debouncedSearch}-${activeCategoryId}-${productsRefresh}`;
    if (lastProductKey.current === fetchKey) return;
    lastProductKey.current = fetchKey;
    loadProducts(0, false);
  }, [showProducts, coords, debouncedSearch, activeCategoryId, productsRefresh, loadProducts]);

  // Qty of this product currently in the cart (items from many stores coexist).
  const productQty = (p) => getStoreItemQty(p.storeId, p.id);

  const addProductToCart = (p, silent = false) => {
    // Quick-add the product at its displayed price. Shoppers who want a specific
    // variant can open the store (tap the card) and pick there.
    if (p.storeOpen === false) {
      showToast("This store is currently closed", "error");
      return;
    }
    const store = {
      id: p.storeId,
      businessName: p.storeName,
      deliveryCharges: p.deliveryCharges,
      minOrderValue: p.minOrderValue,
      deliveryTimeMinutes: p.deliveryTimeMinutes,
      latitude: p.storeLatitude,
      longitude: p.storeLongitude,
    };
    const item = {
      id: p.id,
      name: p.name,
      sellingPrice: p.offerPrice != null ? p.offerPrice : p.sellingPrice,
      imageUrl: p.imageUrl,
    };
    const ok = addItem(store, item);
    if (ok && !silent) showToast(`${p.name} added to cart`, "success");
  };

  // Lift toasts above the floating cart bar while it's on screen so the
  // "added to cart" toast doesn't sit on top of it.
  useEffect(() => {
    const show = totals.count > 0 && !!cart;
    document.body.classList.toggle("mkt-cartbar-visible", show);
    return () => document.body.classList.remove("mkt-cartbar-visible");
  }, [totals.count, cart]);

  const onPlusClick = () => {
    navigate(hasMyStore ? "/customer/app/marketplace/my-store" : "/customer/app/marketplace/onboard");
  };

  const filteredStores = useMemo(
    () => stores.filter((s) => matchesQuickFilter(s, activeQuick)),
    [stores, activeQuick]
  );

  // Client-side sort of the fetched product feed. "relevance" keeps the
  // backend's order (best match / nearest store); "newest" approximates by id.
  const sortedProducts = useMemo(() => {
    if (sortBy === "relevance") return products;
    const arr = [...products];
    if (sortBy === "price_asc") arr.sort((a, b) => productPrice(a) - productPrice(b));
    else if (sortBy === "price_desc") arr.sort((a, b) => productPrice(b) - productPrice(a));
    else if (sortBy === "newest") arr.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    else if (sortBy === "name") arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return arr;
  }, [products, sortBy]);

  // Shared handlers for the discovery rails (cards use the feed row shape).
  const openRailProduct = (p) => navigate(`/customer/app/marketplace/store/${p.storeId}`);
  const decrementRailProduct = (p) => decrementLine(p.storeId, String(p.id));
  const railQty = (p) => productQty(p);
  // Rails are browse aids — hide them while the user is actively searching.
  const showRails = !debouncedSearch;

  // ===== AI-lite handlers =====

  // Barcode scanned (or typed) — look the product up in nearby stores.
  const onBarcodeDetected = async (code) => {
    setScannerOpen(false);
    setScanResults({ code, loading: true, items: [] });
    const loc = coords && coords.lat != null ? { lat: coords.lat, lng: coords.lng } : {};
    const res = await marketplaceLogisticsAiService.barcodeLookup(code, loc);
    setScanResults((s) => (s && s.code === code
      ? { code, loading: false, items: res.success && Array.isArray(res.data) ? res.data : [] }
      : s));
  };

  const openSmartBasket = async () => {
    setBasketSheet({ loading: true, groups: [] });
    const res = await marketplaceLogisticsAiService.getSmartBasket();
    setBasketSheet((s) => (s
      ? { loading: false, groups: res.success && Array.isArray(res.data) ? res.data : [] }
      : s));
  };

  // Add every suggested item of one store's basket at its typical quantity.
  const addBasketGroupToCart = (group) => {
    let added = 0;
    (group.items || []).forEach((p) => {
      if (p.storeOpen === false) return;
      const times = Math.max(1, Number(p.suggestedQty) || 1);
      for (let i = 0; i < times; i++) addProductToCart(p, true);
      added += times;
    });
    if (added > 0) showToast(`${added} item${added > 1 ? "s" : ""} added from ${group.storeName}`, "success");
    else showToast("This store is currently closed", "error");
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="mkt mkt-v2">
      {/* Hero header with gradient backdrop */}
      <div className="mkt-hero">
        <div className="mkt-hero-blob mkt-hero-blob--1" />
        <div className="mkt-hero-blob mkt-hero-blob--2" />

        <div className="mkt-hero-topline">
          <button className="mkt-hero-back" onClick={() => navigate(-1)} aria-label="Back">
            <FaArrowLeft />
          </button>
          <span className="mkt-hero-eyebrow mkt-hero-eyebrow--inline">{greeting}</span>
          <button
            type="button"
            className="mkt-loc-chip"
            onClick={() => setPickerOpen(true)}
            aria-label="Change location"
            title={locationLabel}
          >
            <FiMapPin size={12} />
            <span className="mkt-loc-chip-label">{locationLabel}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/customer/app/marketplace/my-saved")}
            className="mkt-hero-action mkt-hero-action--icon"
            aria-label="Saved Products"
            title="Saved Products"
          >
            <FaBookmark size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/customer/app/marketplace/my-wishlist")}
            className="mkt-hero-action mkt-hero-action--icon"
            aria-label="My Wishlist"
            title="My Wishlist"
          >
            <FaHeart size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/customer/app/marketplace/my-orders")}
            className="mkt-hero-action mkt-hero-action--icon"
            aria-label="My Orders"
            title="My Orders"
          >
            <FaReceipt size={14} />
          </button>
          <button
            type="button"
            onClick={onPlusClick}
            className="mkt-hero-action"
            aria-label={hasMyStore ? "My store" : "Become a seller"}
            title={hasMyStore ? "My Store" : "Sell on Marketplace"}
          >
            {hasMyStore ? <FaStore size={14} /> : <FaPlus size={14} />}
            <span>{hasMyStore ? "My Store" : "Sell"}</span>
          </button>
        </div>

        <div className="mkt-hero-search">
          <FiSearch size={18} />
          <input
            className="mkt-hero-search-input"
            placeholder={`Search "${SEARCH_HINTS[searchHintIdx]}"`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan a product barcode"
            title="Scan barcode to reorder"
            style={{ flexShrink: 0, background: "none", border: "none", padding: "0 2px", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <FaBarcode size={18} />
          </button>
        </div>
      </div>

      {/* Quick filter strip */}
      <div className="mkt-quickbar">
        {QUICK_FILTERS.map((f) => {
          const Icon = f.icon;
          const active = activeQuick === f.id;
          return (
            <button
              key={f.id}
              className={`mkt-quick-chip${active ? " is-active" : ""}`}
              onClick={() => setActiveQuick(active ? null : f.id)}
            >
              <Icon size={12} />
              {f.label}
            </button>
          );
        })}
      </div>

      {coordsError && (
        <div className="mkt-status-banner mkt-status--pending" style={{ margin: "0 14px 10px" }}>
          <FiMapPin size={16} style={{ marginTop: 2 }} />
          <span>{coordsError}</span>
        </div>
      )}

      {/* Featured — seller-curated picks from nearby stores */}
      {showRails && (
        <DiscoveryRail
          title="Featured"
          icon={<FaStar size={13} color="#fbbf24" />}
          items={featuredItems}
          onOpen={openRailProduct}
          onAdd={addProductToCart}
          onDecrement={decrementRailProduct}
          qtyOf={railQty}
        />
      )}

      {/* Categories — modern morphic rail */}
      {categories.length > 0 && (
        <div className="mkt-section mkt-cat-section">
          <div className="mkt-cat-chip-rail">
            <button
              className={`mkt-cat-chip${activeCategoryId == null ? " is-active" : ""}`}
              onClick={() => setActiveCategoryId(null)}
              style={{ "--cat-accent": "#6366f1" }}
            >
              <FaShoppingBag size={13} />
              <span>All</span>
            </button>
            {categories.map((cat) => {
              const isActive = activeCategoryId === cat.id;
              const { Icon, color } = getCategoryIcon(cat.name);
              const accent = color || "#6366f1";
              return (
                <button
                  key={cat.id}
                  className={`mkt-cat-chip${isActive ? " is-active" : ""}`}
                  onClick={() => setActiveCategoryId(cat.id)}
                  style={{ "--cat-accent": accent }}
                >
                  {cat.iconUrl ? <img src={cat.iconUrl} alt="" className="mkt-cat-chip-img" /> : <Icon size={13} />}
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Smart basket — one-tap monthly repeat purchases (AI-lite) */}
      {showRails && (
        <div style={{ padding: "0 14px", marginTop: 10 }}>
          <button
            type="button"
            onClick={openSmartBasket}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 14, cursor: "pointer",
              border: "1px solid rgba(20,184,166,0.35)",
              background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(16,185,129,0.08))",
              color: "var(--cm-ink)",
            }}
          >
            <FaShoppingBasket size={16} color="#14b8a6" />
            <span style={{ flex: 1, textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>Smart basket</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--cm-muted)" }}>
                Your usual items, ready to reorder in one tap
              </span>
            </span>
            <span aria-hidden="true" style={{ color: "#14b8a6", fontWeight: 800 }}>→</span>
          </button>
        </div>
      )}

      {/* Buy again — most-frequent / most-recent items from past orders */}
      {showRails && (
        <DiscoveryRail
          title="Buy again"
          icon={<FaRedo size={12} color="#10b981" />}
          items={buyAgain}
          onOpen={openRailProduct}
          onAdd={addProductToCart}
          onDecrement={decrementRailProduct}
          qtyOf={railQty}
        />
      )}

      {/* Recently viewed — products whose detail sheet was opened */}
      {showRails && (
        <DiscoveryRail
          title="Recently viewed"
          icon={<FiClock size={13} color="#6366f1" />}
          items={recentViews}
          onOpen={openRailProduct}
          onAdd={addProductToCart}
          onDecrement={decrementRailProduct}
          qtyOf={railQty}
        />
      )}

      {/* Stores / Products */}
      <div className="mkt-section">
        <div className="mkt-section-head">
          <h2 className="mkt-section-title">
            {debouncedSearch
              ? `Results for "${debouncedSearch}"`
              : showProducts
                ? "Marketplace"
                : (activeQuick ? "Matching stores" : "Stores near you")}
          </h2>
          {!debouncedSearch && (
            <div className="mkt-view-toggle" role="tablist" aria-label="Browse mode">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "products"}
                className={`mkt-view-toggle-btn${viewMode === "products" ? " is-active" : ""}`}
                onClick={() => setViewMode("products")}
              >
                <FaShoppingBag size={11} /> Marketplace
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "stores"}
                className={`mkt-view-toggle-btn${viewMode === "stores" ? " is-active" : ""}`}
                onClick={() => setViewMode("stores")}
              >
                <FaStore size={11} /> Stores
              </button>
            </div>
          )}
        </div>

        {/* Sort control — client-side v1, applies to the fetched product list */}
        {showProducts && !productsLoading && products.length > 1 && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, margin: "0 0 10px" }}>
            <label htmlFor="mkt-product-sort" style={{ fontSize: 11, color: "var(--cm-muted)", fontWeight: 600 }}>
              Sort
            </label>
            <select
              id="mkt-product-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid var(--cm-line)",
                background: "var(--cm-card)",
                color: "var(--cm-ink)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {showProducts ? (
          productsLoading ? (
            <div className="mkt-product-list">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mkt-product-row mkt-product-row--skel" />)}
            </div>
          ) : productsError ? (
            <div className="mkt-empty mkt-empty-v2">
              <div className="mkt-empty-icon-v2">!</div>
              <div className="mkt-empty-title">Couldn't load products</div>
              <div className="mkt-empty-sub">{productsError}</div>
              <button
                className="mkt-btn mkt-btn--secondary"
                onClick={() => setProductsRefresh((n) => n + 1)}
                style={{ width: "auto", marginTop: 14, padding: "10px 22px" }}
              >
                Try again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="mkt-empty mkt-empty-v2">
              <div className="mkt-empty-icon-v2"><FaShoppingBag /></div>
              <div className="mkt-empty-title">{debouncedSearch ? "No items found" : "No products yet"}</div>
              <div className="mkt-empty-sub">
                {debouncedSearch
                  ? "Try a different spelling or keyword"
                  : "Stores near you haven't listed items yet"}
              </div>
            </div>
          ) : (
            <div className="mkt-product-list">
              {sortedProducts.map((p) => {
                const price = p.offerPrice != null ? Number(p.offerPrice) : Number(p.sellingPrice || 0);
                const mrp = Number(p.mrp || 0);
                const hasDiscount = mrp > price;
                const dist = formatDistance(p.distanceKm);
                const closed = p.storeOpen === false;
                return (
                  <article
                    key={`${p.storeId}-${p.id}`}
                    className={`mkt-product-row${closed ? " is-closed" : ""}`}
                    onClick={() => navigate(`/customer/app/marketplace/store/${p.storeId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/customer/app/marketplace/store/${p.storeId}`); }}
                  >
                    <div className="mkt-product-thumb">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <FaShoppingBag size={20} />}
                    </div>
                    <div className="mkt-product-info">
                      <h3 className="mkt-product-name">{p.name}</h3>
                      <div className="mkt-product-store">
                        <FaStore size={10} /> {p.storeName}
                        {dist && <span className="mkt-product-dist"> · {dist}</span>}
                        {closed && <span className="mkt-product-closed"> · Closed</span>}
                      </div>
                      <div className="mkt-product-price">
                        <span className="mkt-product-price-now"><FaRupeeSign size={10} />{price.toFixed(0)}</span>
                        {hasDiscount && <span className="mkt-product-price-mrp">₹{mrp.toFixed(0)}</span>}
                        {p.unit && <span className="mkt-product-unit"> / {p.unit}</span>}
                      </div>
                    </div>
                    {productQty(p) > 0 ? (
                      <div className="mkt-product-stepper" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="mkt-product-step"
                          aria-label={`Remove one ${p.name}`}
                          onClick={() => decrementLine(p.storeId, String(p.id))}
                        >
                          <FaMinus size={11} />
                        </button>
                        <span className="mkt-product-step-qty">{productQty(p)}</span>
                        <button
                          type="button"
                          className="mkt-product-step"
                          aria-label={`Add one more ${p.name}`}
                          onClick={() => addProductToCart(p, true)}
                        >
                          <FaPlus size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mkt-product-add"
                        aria-label={`Add ${p.name} to cart`}
                        onClick={(e) => { e.stopPropagation(); addProductToCart(p); }}
                      >
                        <FaPlus size={12} /> Add
                      </button>
                    )}
                  </article>
                );
              })}
              {productsHasMore && (
                <button
                  type="button"
                  className="mkt-product-more"
                  onClick={() => loadProducts(productPage + 1, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "View more"}
                </button>
              )}
            </div>
          )
        ) : loading ? (
          <div className="mkt-store-grid">
            {Array.from({ length: 4 }).map((_, i) => <StoreCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="mkt-empty mkt-empty-v2">
            <div className="mkt-empty-icon-v2">!</div>
            <div className="mkt-empty-title">Couldn't load stores</div>
            <div className="mkt-empty-sub">{error}</div>
            <button
              className="mkt-btn mkt-btn--secondary"
              onClick={loadStores}
              style={{ width: "auto", marginTop: 14, padding: "10px 22px" }}
            >
              Try again
            </button>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="mkt-empty mkt-empty-v2">
            <div className="mkt-empty-icon-v2"><FaStore /></div>
            <div className="mkt-empty-title">No stores match</div>
            <div className="mkt-empty-sub">
              {activeQuick || debouncedSearch
                ? "Try clearing filters or search"
                : "Be the first — tap Sell to onboard your store"}
            </div>
            {(activeQuick || debouncedSearch) && (
              <button
                className="mkt-btn mkt-btn--secondary"
                onClick={() => { setActiveQuick(null); setSearch(""); }}
                style={{ width: "auto", marginTop: 14, padding: "10px 22px" }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="mkt-store-grid">
            {filteredStores.map((store) => {
              const closed = store.isOpen === false;
              const distance = formatDistance(store.distanceKm);
              const isFree = Number(store.deliveryCharges || 0) === 0;
              const fast = Number(store.deliveryTimeMinutes || 999) <= 30;
              return (
                <article
                  key={store.id}
                  className={`mkt-store-card-v2${closed ? " is-closed" : ""}`}
                  onClick={() => navigate(`/customer/app/marketplace/store/${store.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/customer/app/marketplace/store/${store.id}`); }}
                >
                  <div className="mkt-store-cover">
                    {store.bannerUrl ? (
                      <img src={store.bannerUrl} alt="" />
                    ) : (
                      <div className="mkt-store-cover-fallback" />
                    )}
                    <span className={`mkt-store-status-pill ${closed ? "is-closed" : "is-open"}`}>
                      <span className="mkt-store-status-dot" />
                      {closed ? "Closed" : "Open"}
                    </span>
                    {fast && !closed && (
                      <span className="mkt-store-fast-pill">
                        <FiZap size={10} /> Fast
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Share ${store.businessName}`}
                      title="Share store"
                      className="mkt-store-share-fab"
                      onClick={(e) => {
                        e.stopPropagation();
                        shareStore(store, {
                          onCopied: () => showToast("Link copied to clipboard", "success"),
                          onError: () => showToast("Could not share. Try again.", "error"),
                        });
                      }}
                    >
                      <FaShareAlt size={12} />
                    </button>
                  </div>

                  <div className="mkt-store-body">
                    <div className="mkt-store-logo-overlay">
                      {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <FaStore size={20} />}
                    </div>

                    <div className="mkt-store-headline">
                      <h3 className="mkt-store-name-v2">{store.businessName}</h3>
                      {Number(store.rating) > 0 && (
                        <span className="mkt-store-rating">
                          <FaStar size={11} /> {Number(store.rating).toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div className="mkt-store-meta-v2">
                      {distance && (
                        <span className="mkt-meta-chip">
                          <FiMapPin size={11} /> {distance}
                        </span>
                      )}
                      {store.deliveryTimeMinutes && (
                        <span className="mkt-meta-chip">
                          <FaClock size={11} /> {store.deliveryTimeMinutes} min
                        </span>
                      )}
                      <span className={`mkt-meta-chip ${isFree ? "mkt-meta-chip--free" : ""}`}>
                        {isFree ? "Free delivery" : (
                          <>
                            <FaRupeeSign size={10} /> {Number(store.deliveryCharges).toFixed(0)} delivery
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {totals.count > 0 && cart && (
        <div className="mkt-cart-bar mkt-cart-bar-v2" onClick={() => navigate("/customer/app/marketplace/cart")}>
          <div className="mkt-cart-bar-info">
            <span className="mkt-cart-bar-count">{totals.count}</span>
            <span>item{totals.count > 1 ? "s" : ""} · ₹{totals.subtotal.toFixed(0)}</span>
          </div>
          <div className="mkt-cart-bar-cta">View cart →</div>
        </div>
      )}

      <LocationPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectLocation}
        onUseCurrent={handleUseCurrentLocation}
        currentLabel={locationLabel}
      />

      {/* Barcode scanner (AI-lite scan-to-reorder) */}
      {scannerOpen && (
        <BarcodeScannerModal
          onDetected={onBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Scan results sheet */}
      {scanResults && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setScanResults(null)}
        >
          <div
            style={{ background: "var(--cm-card)", width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 16, maxHeight: "75vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <FaBarcode /> Scanned product
            </div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
              Barcode {scanResults.code}
            </div>
            {scanResults.loading ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--cm-muted)", fontSize: 13 }}>Searching nearby stores…</div>
            ) : scanResults.items.length === 0 ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: "var(--cm-muted)", fontSize: 13 }}>
                No nearby store sells this barcode right now.
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {scanResults.items.map((p) => {
                  const price = productPrice(p);
                  const qty = productQty(p);
                  return (
                    <div key={`${p.storeId}-${p.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--cm-line)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", background: "var(--cm-line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaShoppingBag size={16} color="var(--cm-muted)" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--cm-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.storeName}
                          {formatDistance(p.distanceKm) ? ` · ${formatDistance(p.distanceKm)}` : ""}
                          {p.storeOpen === false ? " · Closed" : ""}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--cm-ink)", marginTop: 2 }}>₹{price.toFixed(0)}</div>
                      </div>
                      {qty > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <button type="button" aria-label={`Remove one ${p.name}`} onClick={() => decrementRailProduct(p)} style={{ width: 24, height: 24, borderRadius: 8, border: "1px solid var(--cm-line)", background: "var(--cm-card)", color: "var(--cm-ink)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                            <FaMinus size={9} />
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{qty}</span>
                          <button type="button" aria-label={`Add one more ${p.name}`} onClick={() => addProductToCart(p, true)} style={{ width: 24, height: 24, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                            <FaPlus size={9} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mkt-product-add"
                          aria-label={`Add ${p.name} to cart`}
                          onClick={() => addProductToCart(p)}
                        >
                          <FaPlus size={12} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className="mkt-btn mkt-btn--secondary"
              onClick={() => setScanResults(null)}
              style={{ width: "100%", marginTop: 14, padding: "10px", fontSize: 13 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Smart basket sheet — suggested repeat purchases grouped by store */}
      {basketSheet && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setBasketSheet(null)}
        >
          <div
            style={{ background: "var(--cm-card)", width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 16, maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <FaShoppingBasket color="#14b8a6" /> Smart basket
            </div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
              Items you bought 2+ times in the last 90 days, at your usual quantity.
            </div>
            {basketSheet.loading ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--cm-muted)", fontSize: 13 }}>Building your basket…</div>
            ) : basketSheet.groups.length === 0 ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: "var(--cm-muted)", fontSize: 13 }}>
                Not enough repeat purchases yet — order a few times and your basket will appear here.
              </div>
            ) : (
              basketSheet.groups.map((g) => (
                <div key={g.storeId} style={{ marginTop: 14, border: "1px solid var(--cm-line)", borderRadius: 14, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", background: "var(--cm-line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {g.storeLogoUrl ? <img src={g.storeLogoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaStore size={13} color="var(--cm-muted)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--cm-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {g.storeName}{g.storeOpen === false ? " · Closed" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{(g.items || []).length} suggested item{(g.items || []).length > 1 ? "s" : ""}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addBasketGroupToCart(g)}
                      disabled={g.storeOpen === false}
                      className="mkt-btn mkt-btn--primary"
                      style={{ width: "auto", padding: "7px 12px", fontSize: 12, opacity: g.storeOpen === false ? 0.6 : 1 }}
                    >
                      Add all to cart
                    </button>
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {(g.items || []).map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--cm-ink)" }}>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                        <span style={{ color: "var(--cm-muted)" }}>× {Math.max(1, Number(p.suggestedQty) || 1)}</span>
                        <span style={{ fontWeight: 700 }}>₹{productPrice(p).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              className="mkt-btn mkt-btn--secondary"
              onClick={() => setBasketSheet(null)}
              style={{ width: "100%", marginTop: 14, padding: "10px", fontSize: 13 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceHomeScreen;
