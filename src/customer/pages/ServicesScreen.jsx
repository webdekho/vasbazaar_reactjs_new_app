import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaDownload, FaSyncAlt, FaClock, FaPlaneDeparture } from "react-icons/fa";
import { FiShare, FiPlusSquare, FiAlertTriangle, FiClock } from "react-icons/fi";
import { HiOutlineCurrencyRupee, HiMiniSquares2X2 } from "react-icons/hi2";
import { FaCalendarAlt, FaChevronRight, FaReceipt } from "react-icons/fa";
import { serviceService } from "../services/serviceService";
import { advertisementService } from "../services/advertisementService";
import { userService } from "../services/userService";
import { walletService } from "../services/walletService";
import { useCustomerModern } from "../context/CustomerModernContext";
import { usePWAInstall } from "../hooks/usePWAInstall";
import DataState from "../components/DataState";
import ServiceIcon from "../components/ServiceIcon";
import BannerSlider from "../components/BannerSlider";
import { normalizeService, toSerializableService, getServiceVisual } from "../components/serviceUtils";

const skeletonStyle = {
  background: "linear-gradient(90deg, var(--cm-bg-secondary, #121212) 25%, var(--cm-line, #2A2A2A) 50%, var(--cm-bg-secondary, #121212) 75%)",
  backgroundSize: "200% 100%",
  animation: "cm-shimmer 1.4s ease-in-out infinite",
  borderRadius: 12,
};

const SkeletonGrid = () => (
  <div className="cm-services-grid-4" style={{ padding: "0 12px" }}>
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="cm-svc-item" style={{ alignItems: "flex-start", cursor: "default" }}>
        <div style={{ ...skeletonStyle, width: 52, height: 52, marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, width: "70%", height: 12 }} />
      </div>
    ))}
    <style>{`@keyframes cm-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

const isCapacitorNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

const InstallAppBanner = () => {
  const { canInstall, isInstalled, installPWA, showPrompt, deviceType } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("vb_install_banner_dismissed") === "true");
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Hide if already installed, in standalone mode, inside Capacitor native app, or dismissed
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);
  if (isInstalled || standalone || isCapacitorNative() || dismissed) return null;

  const handleInstall = async () => {
    if (deviceType === "ios") {
      setShowIosGuide(true);
      return;
    }
    if (canInstall) {
      await installPWA();
    } else {
      showPrompt();
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("vb_install_banner_dismissed", "true");
    setDismissed(true);
  };

  return (
    <>
      <div className="cm-install-banner">
        <div className="cm-install-banner-content">
          <div className="cm-install-banner-icon">
            <FaDownload />
          </div>
          <div className="cm-install-banner-text">
            <strong>Install VasBazaar App</strong>
            <span>Quick access from your home screen</span>
          </div>
        </div>
        <div className="cm-install-banner-actions">
          <button className="cm-install-banner-btn" type="button" onClick={handleInstall}>
            Install
          </button>
          <button className="cm-install-banner-dismiss" type="button" onClick={handleDismiss} aria-label="Dismiss">
            &times;
          </button>
        </div>
      </div>

      {/* iOS guide modal */}
      {showIosGuide && (
        <div className="pwa-overlay pwa-overlay--in" onClick={() => setShowIosGuide(false)}>
          <div className="pwa-sheet pwa-sheet--in" onClick={(e) => e.stopPropagation()}>
            <button className="pwa-close" type="button" onClick={() => setShowIosGuide(false)} aria-label="Close">&times;</button>
            <h2 className="pwa-title" style={{ marginTop: 16 }}>Install on iPhone</h2>
            <p className="pwa-subtitle">Follow these steps to add to home screen</p>
            <div className="pwa-ios-steps">
              <div className="pwa-step">
                <span className="pwa-step-num">1</span>
                <span className="pwa-step-text">Tap <FiShare className="pwa-step-icon" /> <strong>Share</strong> button in Safari</span>
              </div>
              <div className="pwa-step">
                <span className="pwa-step-num">2</span>
                <span className="pwa-step-text">Scroll & tap <FiPlusSquare className="pwa-step-icon" /> <strong>Add to Home Screen</strong></span>
              </div>
              <div className="pwa-step">
                <span className="pwa-step-num">3</span>
                <span className="pwa-step-text">Tap <strong>Add</strong> to confirm</span>
              </div>
            </div>
            <button className="pwa-btn pwa-btn--primary" type="button" onClick={() => setShowIosGuide(false)} style={{ marginTop: 16, width: "100%" }}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
};

const UpcomingDuesSection = ({ dues }) => {
  const navigate = useNavigate();
  if (!dues || dues.length === 0) return null;

  return (
    <div className="cm-upcoming-dues">
      <div className="cm-upcoming-dues-header">
        <h3 className="cm-upcoming-dues-title">Upcoming Dues</h3>
        <button className="cm-upcoming-dues-all" type="button" onClick={() => navigate("/customer/app/my-dues")}>
          View All <FaChevronRight />
        </button>
      </div>
      <div className="cm-upcoming-dues-list">
        {dues.slice(0, 3).map((item, i) => {
          const name = item.operatorId?.operatorName || item.operator?.name || item.name || "Provider";
          const logo = item.operatorId?.logo || item.operator?.logo;
          const number = item.mobile || item.param || "";
          const amount = item.amount || item.txnAmt;
          const dueDate = item.fromDate ? new Date(item.fromDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

          return (
            <div key={item.id || i} className="cm-upcoming-due-item" onClick={() => navigate("/customer/app/my-dues")}>
              <div className="cm-upcoming-due-logo">
                {logo ? <img src={logo} alt="" /> : <FaReceipt />}
              </div>
              <div className="cm-upcoming-due-info">
                <div className="cm-upcoming-due-name">{name}</div>
                <div className="cm-upcoming-due-num">
                  {number.length > 6 ? number.slice(0, 4) + "xxxx" + number.slice(-2) : number}
                </div>
                {dueDate && <div className="cm-upcoming-due-date"><FaCalendarAlt /> Due {dueDate}</div>}
              </div>
              {amount && <div className="cm-upcoming-due-amount">&#8377;{parseFloat(amount).toFixed(0)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const quickAccessItems = [
  { label: "Services", icon: HiMiniSquares2X2, to: "#services", color: "#40E0D0", isScroll: true, iconUrl: "/images/b.png" },
  { label: "Travel", icon: FaPlaneDeparture, to: "/customer/app/travel", color: "#007BFF" },
  { label: "My Dues", icon: FaClock, to: "/customer/app/my-dues", color: "#FF3B30" },
  { label: "Cashback", icon: HiOutlineCurrencyRupee, to: "/customer/app/commission?tab=cashback", color: "#FF9800" },
  { label: "History", icon: FiClock, to: "/customer/app/history", color: "#007BFF" },
  { label: "Autopay", icon: FaSyncAlt, to: "/customer/app/autopay", color: "#007BFF" },
  { label: "Complaint", icon: FiAlertTriangle, to: "/customer/app/file-complaint", color: "#FF9800" },
];

const RECENT_SERVICES_KEY = "vb_recent_services";

const getRecentServices = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SERVICES_KEY) || "[]");
  } catch { return []; }
};

const removeRecentService = (slug) => {
  const list = getRecentServices().filter((s) => s.slug !== slug);
  localStorage.setItem(RECENT_SERVICES_KEY, JSON.stringify(list));
  return list;
};

// Call this from SuccessScreen after a successful transaction
// addRecentService({ slug, name, iconUrl, accentColor })
export const addRecentService = (service) => {
  if (!service?.slug) return;
  let list = getRecentServices().filter((s) => s.slug !== service.slug);
  list.unshift({ slug: service.slug, name: service.name, iconUrl: service.iconUrl || null, accentColor: service.accentColor || "#40E0D0", addedAt: Date.now() });
  if (list.length > 6) list = list.slice(0, 6);
  localStorage.setItem(RECENT_SERVICES_KEY, JSON.stringify(list));
};

const QuickAccessCard = ({ services = [] }) => {
  const navigate = useNavigate();
  const [recentServices, setRecentServices] = useState(() => getRecentServices());

  const handleRemoveRecent = (e, slug) => {
    e.stopPropagation();
    setRecentServices(removeRecentService(slug));
  };

  // Match recent service slug to actual loaded service for exact same icon
  const getServiceMatch = (svc) => {
    const match = services.find((s) => s.slug === svc.slug || s.name?.toLowerCase() === svc.name?.toLowerCase());
    if (match) return { icon: match.icon, iconUrl: match.iconUrl, accentColor: match.accentColor, highlightColor: match.highlightColor };
    const visual = getServiceVisual(svc.name || svc.slug || "");
    return { icon: visual.icon, iconUrl: null, accentColor: visual.accentColor, highlightColor: visual.highlightColor };
  };

  return (
    <div className="cm-quick-access">
      <div className="cm-quick-access-title">Quick Access</div>
      <div className="cm-services-grid-4" style={{ padding: "0 4px 8px", border: "none", boxShadow: "none", background: "transparent" }}>
        {/* Recent services first */}
        {recentServices.map((svc, i) => {
          const matched = getServiceMatch(svc);
          return (
          <button
            key={`recent-${svc.slug}`}
            className="cm-svc-item"
            type="button"
            style={{ animationDelay: `${i * 40}ms`, alignItems: "flex-start", position: "relative" }}
            onClick={() => navigate(`/customer/app/services/${svc.slug}`)}
          >
            <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, position: "relative" }}>
              <ServiceIcon icon={matched.icon} iconUrl={matched.iconUrl} accentColor={matched.accentColor} highlightColor={matched.highlightColor} />
              <button className="cm-quick-access-remove" type="button" onClick={(e) => handleRemoveRecent(e, svc.slug)} aria-label="Remove">
                &times;
              </button>
            </div>
            <span className="cm-svc-label">{svc.name}</span>
          </button>
          );
        })}

        {/* Fixed quick access items */}
        {quickAccessItems.map((item, i) => (
          <button
            key={item.label}
            className="cm-svc-item"
            type="button"
            style={{ animationDelay: `${(recentServices.length + i) * 40}ms`, alignItems: "flex-start" }}
            onClick={() => {
              if (item.isScroll) {
                document.getElementById("services-grid-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                navigate(item.to);
              }
            }}
          >
            <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <ServiceIcon icon={item.icon} iconUrl={item.iconUrl} accentColor={item.color} highlightColor={item.color} />
            </div>
            <span className="cm-svc-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ServicesScreen = () => {
  const navigate = useNavigate();
  const { userData } = useCustomerModern();
  const [services, setServices] = useState([]);
  const [banners, setBanners] = useState([]);
  const [balances, setBalances] = useState({ cashback: "0.00", incentive: "0.00", wallet: "0.00" });
  const [upcomingDues, setUpcomingDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [svcRes, adRes, balRes, duesRes] = await Promise.all([
        serviceService.getAllServices(),
        advertisementService.getHomeAdvertisements(),
        userService.getUserBalance(),
        walletService.getUpcomingDues(),
      ]);
      setLoading(false);
      if (!svcRes.success) { setError(svcRes.message); return; }
      setServices((Array.isArray(svcRes.data) ? svcRes.data : []).map(normalizeService));
      setBanners(Array.isArray(adRes.data) ? adRes.data : []);
      if (balRes.success && balRes.data) {
        // Handle potential nested data structure from API
        const d = balRes.data?.data || balRes.data;
        setBalances({
          cashback: d.cashback ?? d.Cashback ?? "0.00",
          incentive: d.incentive ?? d.Incentive ?? "0.00",
          wallet: d.balance ?? d.Balance ?? d.walletBalance ?? d.wallet ?? "0.00",
        });
      }
      if (duesRes.success) {
        const duesData = Array.isArray(duesRes.data) ? duesRes.data : (duesRes.data?.records || []);
        setUpcomingDues(duesData);
      }
    };
    load();
  }, []);

  const filtered = services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  if (loading) {
    return (
      <div className="cm-services-page">
        <div className="cm-search-between">
          <div className="cm-search-with-bc">
            <div className="cm-search-bar-row" style={{ opacity: 0.5 }}>
              <FaSearch style={{ color: "var(--cm-disabled, #6B6B6B)", fontSize: 14, flexShrink: 0 }} />
              <span style={{ color: "var(--cm-disabled, #6B6B6B)", fontSize: 14 }}>Search services...</span>
            </div>
            <img src="/images/bbps.svg" alt="Bharat Connect" className="cm-bc-logo" />
          </div>
        </div>
        <SkeletonGrid />
      </div>
    );
  }

  return (
    <DataState loading={false} error={error}>
      <div className={`cm-services-page${query ? " is-searching" : ""}`}>
        {/* Install App banner */}
        {!query && <InstallAppBanner />}

        {/* Combined customer card + banner slider */}
        {!query && <BannerSlider banners={banners} userData={userData} balances={balances} />}

        {/* Search bar with Bharat Connect logo — between slider and services */}
        <div className="cm-search-between">
          <div className="cm-search-with-bc">
            <div className={`cm-search-bar-row${searchFocused ? " is-focused" : ""}`}>
              <FaSearch style={{ color: searchFocused ? "var(--cm-accent, #40E0D0)" : "var(--cm-disabled, #6B6B6B)", fontSize: 14, transition: "color 0.2s", flexShrink: 0 }} />
              <input
                className="cm-search-field-input"
                placeholder="Search services..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
            <img src="/images/bbps.svg" alt="Bharat Connect" className="cm-bc-logo" />
          </div>
        </div>

        {/* Quick Access */}
        {!query && <QuickAccessCard services={services} />}

        {/* Upcoming Dues */}
        {!query && <UpcomingDuesSection dues={upcomingDues} />}

        {/* Service icons grid - 4 per row */}
        <div id="services-grid-section" className={`cm-quick-access${query ? " is-searching" : ""}`}>
          {!query && <div className="cm-quick-access-title">Services</div>}
        <div className="cm-services-grid-4" style={{ padding: "0 4px 8px", border: "none", boxShadow: "none", background: "transparent" }}>
          {filtered.length === 0 ? (
            <div className="cm-empty" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32 }}>No services matched your search.</div>
          ) : (
            filtered.map((service, i) => (
              <button
                key={service.id}
                className="cm-svc-item"
                type="button"
                style={{ animationDelay: `${i * 30}ms`, alignItems: "flex-start", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                onClick={() => navigate(`/customer/app/services/${service.slug}`, { state: { service: toSerializableService(service) } })}
              >
                <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                  <ServiceIcon icon={service.icon} iconUrl={service.iconUrl} accentColor={service.accentColor} highlightColor={service.highlightColor} />
                </div>
                <span className="cm-svc-label">{service.name}</span>
              </button>
            ))
          )}
        </div>
        </div>
      </div>
    </DataState>
  );
};

export default ServicesScreen;
