import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaPlus,
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
} from "react-icons/fa";
import { FiSearch, FiMapPin, FiZap, FiTag, FiTrendingUp } from "react-icons/fi";
import { marketplaceService } from "../../services/marketplaceService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useToast } from "../../context/ToastContext";
import { shareStore } from "./shareStore";
import "./marketplace.css";

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

const matchesQuickFilter = (store, filter) => {
  if (!filter) return true;
  if (filter === "free_delivery") return Number(store.deliveryCharges || 0) === 0;
  if (filter === "fast") return Number(store.deliveryTimeMinutes || 999) <= 30;
  if (filter === "open") return store.isOpen !== false;
  return true;
};

const MarketplaceHomeScreen = () => {
  const navigate = useNavigate();
  const { totals, cart } = useMarketplaceCart();
  const { showToast } = useToast();

  const [coords, setCoords] = useState(null);
  const [coordsError, setCoordsError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeQuick, setActiveQuick] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchHintIdx, setSearchHintIdx] = useState(0);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMyStore, setHasMyStore] = useState(false);
  const checkedMyStore = useRef(false);

  // Rotating search placeholder
  useEffect(() => {
    const t = setInterval(() => setSearchHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoordsError("Location not available — showing all reachable stores");
      setCoords({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        setCoordsError(err?.code === 1 ? "Enable location to see nearby stores" : "Location unavailable");
        setCoords({ lat: null, lng: null });
      },
      { timeout: 5000, maximumAge: 60000 }
    );
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

  const loadStores = useCallback(async () => {
    if (!coords) return;
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
  }, [coords, debouncedSearch, activeCategoryId]);

  useEffect(() => { loadStores(); }, [loadStores]);

  const onPlusClick = () => {
    navigate(hasMyStore ? "/customer/app/marketplace/my-store" : "/customer/app/marketplace/onboard");
  };

  const filteredStores = useMemo(
    () => stores.filter((s) => matchesQuickFilter(s, activeQuick)),
    [stores, activeQuick]
  );

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

      {/* Categories — icon avatar rail */}
      {categories.length > 0 && (
        <div className="mkt-section">
          <div className="mkt-section-head">
            <h2 className="mkt-section-title">Browse categories</h2>
          </div>
          <div className="mkt-cat-rail">
            <button
              className={`mkt-cat-tile${activeCategoryId == null ? " is-active" : ""}`}
              onClick={() => setActiveCategoryId(null)}
            >
              <span className="mkt-cat-tile-avatar">
                <FaShoppingBag size={18} />
              </span>
              <span className="mkt-cat-tile-label">All</span>
            </button>
            {categories.map((cat) => {
              const isActive = activeCategoryId === cat.id;
              const { Icon, color } = getCategoryIcon(cat.name);
              return (
                <button
                  key={cat.id}
                  className={`mkt-cat-tile${isActive ? " is-active" : ""}`}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  <span
                    className="mkt-cat-tile-avatar"
                    style={!isActive && color ? { color } : undefined}
                  >
                    {cat.iconUrl ? <img src={cat.iconUrl} alt="" /> : <Icon size={18} />}
                  </span>
                  <span className="mkt-cat-tile-label">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stores */}
      <div className="mkt-section">
        <div className="mkt-section-head">
          <h2 className="mkt-section-title">
            {activeQuick || debouncedSearch ? "Matching stores" : "Stores near you"}
          </h2>
          {!loading && !error && (
            <span className="mkt-section-count">{filteredStores.length}</span>
          )}
        </div>

        {loading ? (
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
    </div>
  );
};

export default MarketplaceHomeScreen;
