import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaDownload, FaSyncAlt, FaClock, FaRupeeSign, FaPlaneDeparture, FaStore, FaBookOpen } from "react-icons/fa";
import { FiShare, FiPlusSquare, FiAlertTriangle, FiClock, FiShield, FiChevronRight } from "react-icons/fi";
import { HiOutlineCurrencyRupee, HiMiniSquares2X2 } from "react-icons/hi2";
import { FaCalendarAlt, FaChevronRight } from "react-icons/fa";
import { serviceService } from "../services/serviceService";
import { advertisementService } from "../services/advertisementService";
import { userService } from "../services/userService";
import { walletService } from "../services/walletService";
import { rechargeService } from "../services/rechargeService";
import { customerStorage } from "../services/storageService";
import { useCustomerModern } from "../context/CustomerModernContext";
import { usePWAInstall } from "../hooks/usePWAInstall";
import DataState from "../components/DataState";
import ServiceIcon from "../components/ServiceIcon";
import BannerSlider from "../components/BannerSlider";
import { normalizeService, toSerializableService, getServiceVisual } from "../components/serviceUtils";

// Biller logo fallback — used when no logo URL is supplied or the supplied
// URL fails to load. The favicon ships with the app so we never end up
// showing a broken-image glyph.
const FAVICON_SRC = "/favicon.png";
const handleBillerLogoError = (e) => {
  if (e.currentTarget.dataset.fallback === "1") return;
  e.currentTarget.dataset.fallback = "1";
  e.currentTarget.src = FAVICON_SRC;
};

const formatServiceLabel = (label) => String(label || "").replace(/\//g, "/\u200B");

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
  const [processingId, setProcessingId] = useState(null);
  if (!dues || dues.length === 0) return null;

  const staleCutoff = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 10);
    return d.getTime();
  })();

  // Mirror MyDuesScreen's dismissal filter so a due deleted from My Dues
  // doesn't keep popping back up here. Same key / same submittedDate guard.
  const dismissed = customerStorage.getDismissedDues() || {};
  const isDismissed = (item) => {
    const mobile = item?.mobile || item?.param || "";
    const operatorId = item?.operatorId?.id || item?.operator?.id || "";
    const dismissedAt = dismissed[`${mobile}|${operatorId}`];
    if (!dismissedAt) return false;
    const itemDate = item?.submittedDate ? new Date(item.submittedDate) : null;
    const dismissedDate = new Date(dismissedAt);
    if (!itemDate || Number.isNaN(itemDate.getTime())) return true;
    // Re-show if user submitted a newer recharge (resets dismissal).
    return itemDate.getTime() <= dismissedDate.getTime();
  };

  const sortedDues = dues
    .filter((item) => !isDismissed(item))
    .filter((item) => !item?.fromDate || new Date(item.fromDate).getTime() >= staleCutoff)
    .sort((a, b) => {
      const aTime = a?.fromDate ? new Date(a.fromDate).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b?.fromDate ? new Date(b.fromDate).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

  if (sortedDues.length === 0) return null;

  const handlePay = async (item) => {
    const mobile = item.mobile || item.param;
    if (!mobile) return;
    setProcessingId(item.id);
    const serviceName = item.operatorId?.serviceId?.serviceName || item.service?.serviceName || "prepaid";
    const slug = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const isPrepaid = slug === "prepaid" || slug === "postpaid";

    if (isPrepaid) {
      const res = await rechargeService.fetchOperatorCircle(mobile);
      setProcessingId(null);
      navigate(`/customer/app/services/${slug}`, {
        state: {
          service: item.operatorId?.serviceId || item.service,
          prefill: {
            mobile,
            contactName: item.name || "",
            operatorData: res.success ? res.data : null,
            operatorId: item.operatorId?.id,
            amount: item.amount || item.txnAmt,
          },
        },
      });
    } else {
      setProcessingId(null);
      navigate(`/customer/app/services/${slug}`, {
        state: {
          service: item.operatorId?.serviceId || item.service,
          prefill: {
            mobile,
            operatorId: item.operatorId?.id,
            operatorName: item.operatorId?.operatorName,
            operatorCode: item.operatorId?.operatorCode,
            amount: item.amount,
          },
        },
      });
    }
  };

  return (
    <div className="cm-upcoming-dues">
      <div className="cm-upcoming-dues-header">
        <h3 className="cm-upcoming-dues-title">Upcoming Dues</h3>
        <button className="cm-upcoming-dues-all" type="button" onClick={() => navigate("/customer/app/my-dues")}>
          View All <FaChevronRight />
        </button>
      </div>
      <div className="cm-upcoming-dues-list">
        {sortedDues.slice(0, 3).map((item, i) => {
          const name = item.operatorId?.operatorName || item.operator?.name || item.name || "Provider";
          const logo = item.operatorId?.logo || item.operator?.logo;
          const number = item.mobile || item.param || "";
          const amount = item.amount || item.txnAmt;
          const dueDate = item.fromDate ? new Date(item.fromDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
          const isProcessing = processingId === item.id;

          return (
            <div key={item.id || i} className="cm-upcoming-due-item" onClick={() => navigate("/customer/app/my-dues")}>
              <div className="cm-upcoming-due-logo">
                <img
                  src={logo || FAVICON_SRC}
                  alt=""
                  onError={handleBillerLogoError}
                />
              </div>
              <div className="cm-upcoming-due-info">
                <div className="cm-upcoming-due-name">{name}</div>
                <div className="cm-upcoming-due-num">
                  {number.length > 6 ? number.slice(0, 4) + "xxxx" + number.slice(-2) : number}
                </div>
                {dueDate && <div className="cm-upcoming-due-date"><FaCalendarAlt /> Due {dueDate}</div>}
              </div>
              <div className="cm-upcoming-due-right">
                {amount && <div className="cm-upcoming-due-amount">&#8377;{parseFloat(amount).toFixed(0)}</div>}
                <button
                  className="cm-upcoming-due-pay"
                  type="button"
                  disabled={isProcessing}
                  onClick={(e) => { e.stopPropagation(); handlePay(item); }}
                >
                  {isProcessing ? "..." : <>Pay <FaChevronRight /></>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const quickAccessItems = [
  { label: "Services", icon: HiMiniSquares2X2, to: "#services", color: "#40E0D0", isScroll: true, iconUrl: "/images/b.png" },
  { label: "Retail Bazaar", icon: FaStore, to: "/customer/app/marketplace", color: "#10B981" },
  { label: "ReBill", icon: FaBookOpen, to: "/customer/app/outstanding", color: "#FF7A00" },
  { label: "Travel", icon: FaPlaneDeparture, to: "/customer/app/travel", color: "#007BFF" },
  { label: "My Dues", icon: FaClock, to: "/customer/app/my-dues", color: "#FF3B30" },
  { label: "Cashback", icon: HiOutlineCurrencyRupee, to: "/customer/app/commission?tab=cashback", color: "#FF9800" },
  { label: "History", icon: FiClock, to: "/customer/app/history", color: "#007BFF" },
  { label: "Autopay", icon: FaSyncAlt, to: "/customer/app/autopay", color: "#007BFF" },
  { label: "Complaint", icon: FiAlertTriangle, to: "/customer/app/file-complaint", color: "#FF9800" },
  { label: "Earn Money", icon: FaRupeeSign, to: "/customer/app/qr", color: "#F59E0B" },
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
            <span className="cm-svc-label">{formatServiceLabel(svc.name)}</span>
          </button>
          );
        })}

        {/* Fixed quick access items */}
        {quickAccessItems.map((item, i) => {
          const isEarnLifetime = item.label === "Earn Money";
          return (
          <button
            key={item.label}
            className={`cm-svc-item${isEarnLifetime ? " cm-svc-item--earn-fx" : ""}`}
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
            <div className={isEarnLifetime ? "cm-earn-fx-wrap" : ""} style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              {isEarnLifetime && (
                <>
                  <span className="cm-earn-fx-halo" aria-hidden="true" />
                  <span className="cm-earn-fx-coin cm-earn-fx-coin--1" aria-hidden="true">₹</span>
                  <span className="cm-earn-fx-coin cm-earn-fx-coin--2" aria-hidden="true">₹</span>
                  <span className="cm-earn-fx-coin cm-earn-fx-coin--3" aria-hidden="true">₹</span>
                  <span className="cm-earn-fx-spark cm-earn-fx-spark--1" aria-hidden="true" />
                  <span className="cm-earn-fx-spark cm-earn-fx-spark--2" aria-hidden="true" />
                  <span className="cm-earn-fx-spark cm-earn-fx-spark--3" aria-hidden="true" />
                </>
              )}
              <ServiceIcon icon={item.icon} iconUrl={item.iconUrl} accentColor={item.color} highlightColor={item.color} />
            </div>
            <span className="cm-svc-label">{formatServiceLabel(item.label)}</span>
          </button>
          );
        })}
      </div>
    </div>
  );
};

const KycBanner = ({ onClick }) => (
  <div className="cm-kyc-banner" role="alert">
    <div className="cm-kyc-banner-icon" aria-hidden="true">
      <FiAlertTriangle />
    </div>
    <div className="cm-kyc-banner-body">
      <div className="cm-kyc-banner-title">KYC Pending</div>
      <div className="cm-kyc-banner-desc">Complete KYC to unlock wallet, payouts &amp; higher limits.</div>
    </div>
    <button type="button" className="cm-kyc-banner-btn" onClick={onClick} aria-label="Complete KYC">
      <FiShield />
      <span>Complete KYC</span>
      <FiChevronRight />
    </button>
  </div>
);

const ServicesScreen = () => {
  const navigate = useNavigate();
  const { userData } = useCustomerModern();
  const isKycVerified =
    userData?.verified_status === 1 ||
    userData?.verified_status === "1" ||
    userData?.kyc_verified === true ||
    userData?.kycVerified === true;
  const showKycBanner = !!userData && !isKycVerified;
  const [services, setServices] = useState([]);
  const [banners, setBanners] = useState([]);
  const [balances, setBalances] = useState({ cashback: "0.00", incentive: "0.00", wallet: "0.00" });
  const [upcomingDues, setUpcomingDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // Flattened {operator, service} pairs across every service. Loaded lazily on
  // first typed character so users who never search don't pay the fan-out.
  const [allOperators, setAllOperators] = useState([]);
  const operatorsLoadedRef = useRef(false);

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

  /**
   * PERF FIX: Memoize filtered services so the filter only runs when
   * services or query changes, not on every render (e.g., search focus/blur).
   */
  const filtered = useMemo(
    () => services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [services, query]
  );

  // Lazy-load operators the first time the user types. Fan out one request
  // per service and flatten — each call is cached (1h) so repeat searches
  // after navigation are instant. Bill services only; prepaid/postpaid are
  // mobile-number driven, not biller-name driven.
  useEffect(() => {
    if (!query || operatorsLoadedRef.current || services.length === 0) return;
    operatorsLoadedRef.current = true;
    const billServices = services.filter((s) => {
      const slug = (s.slug || "").toLowerCase();
      return slug !== "prepaid" && slug !== "postpaid";
    });
    Promise.all(
      billServices.map(async (s) => {
        const resp = await serviceService.getOperatorsByService(s.id);
        if (!resp?.success) return [];
        const raw = resp.data;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.data) ? raw.data
          : Array.isArray(raw?.content) ? raw.content
          : [];
        return list.map((op) => ({ ...op, _service: s }));
      })
    ).then((batches) => setAllOperators(batches.flat()));
  }, [query, services]);

  const filteredBillers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allOperators.filter((op) => {
      const name = (op.operatorName || op.name || "").toLowerCase();
      const code = (op.operatorCode || op.opCode || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    }).slice(0, 20);
  }, [allOperators, query]);

  // Click a biller result → jump straight into BillerFlowScreen with the
  // biller pre-selected (prefill handling lives in BillerFlowScreen).
  const handleBillerClick = (biller) => {
    const service = biller._service;
    if (!service) return;
    navigate(`/customer/app/services/${service.slug}`, {
      state: {
        service: toSerializableService(service),
        prefill: {
          operatorId: biller.id,
          operatorName: biller.operatorName || biller.name,
          operatorCode: biller.operatorCode || biller.opCode,
        },
      },
    });
  };

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

        {/* KYC pending notice — above the customer card */}
        {!query && showKycBanner && (
          <KycBanner
            onClick={() => navigate("/customer/app/kyc", { state: { returnTo: "/customer/app" } })}
          />
        )}

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

        {/* Biller search results (only while searching). Clicking one jumps
            into that biller's flow with the operator pre-selected. */}
        {query && filteredBillers.length > 0 && (
          <div className="cm-biller-results">
            <div className="cm-quick-access-title">Billers</div>
            <div className="cm-biller-list">
              {filteredBillers.map((biller, i) => {
                const name = biller.operatorName || biller.name || "Biller";
                const logo = biller.logo;
                const svcName = biller._service?.name || "";
                return (
                  <button
                    key={`${biller._service?.id}-${biller.id}`}
                    type="button"
                    className="cm-biller-row"
                    style={{ animationDelay: `${i * 25}ms` }}
                    onClick={() => handleBillerClick(biller)}
                  >
                    <div className="cm-biller-logo">
                      <img
                        src={logo || FAVICON_SRC}
                        alt=""
                        onError={handleBillerLogoError}
                      />
                    </div>
                    <div className="cm-biller-info">
                      <div className="cm-biller-name">{name}</div>
                      <div className="cm-biller-sub">{svcName}</div>
                    </div>
                    <FaChevronRight className="cm-biller-arrow" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Service icons grid - 4 per row */}
        <div id="services-grid-section" className={`cm-quick-access${query ? " is-searching" : ""}`}>
          <div className="cm-quick-access-title">Services</div>
        <div className="cm-services-grid-4" style={{ padding: "0 4px 8px", border: "none", boxShadow: "none", background: "transparent" }}>
          {filtered.length === 0 ? (
            <div className="cm-empty" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32 }}>No services matched your search.</div>
          ) : (
            filtered.map((service, i) => {
              const isPrepaid = service.slug === "prepaid";
              return (
                <button
                  key={service.id}
                  className={`cm-svc-item${isPrepaid ? " cm-svc-item--prepaid-fx" : ""}`}
                  type="button"
                  style={{ animationDelay: `${i * 30}ms`, alignItems: "flex-start", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                  onClick={() => navigate(`/customer/app/services/${service.slug}`, { state: { service: toSerializableService(service) } })}
                >
                  <div className={isPrepaid ? "cm-prepaid-fx-wrap" : ""} style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                    {isPrepaid && (
                      <>
                        <span className="cm-prepaid-fx-ring" aria-hidden="true" />
                        <span className="cm-prepaid-fx-ring cm-prepaid-fx-ring--2" aria-hidden="true" />
                        <span className="cm-prepaid-fx-ring cm-prepaid-fx-ring--3" aria-hidden="true" />
                        <span className="cm-prepaid-fx-glow" aria-hidden="true" />
                      </>
                    )}
                    <ServiceIcon icon={service.icon} iconUrl={service.iconUrl} accentColor={service.accentColor} highlightColor={service.highlightColor} />
                  </div>
                  <span className="cm-svc-label">{formatServiceLabel(service.name)}</span>
                </button>
              );
            })
          )}
        </div>
        </div>
      </div>
    </DataState>
  );
};

export default ServicesScreen;
