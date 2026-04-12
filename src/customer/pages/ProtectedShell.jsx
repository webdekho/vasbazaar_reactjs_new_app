import { useEffect, useState, useCallback, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars, FaTimes, FaChevronRight, FaChevronDown, FaGift, FaRegBell, FaSignOutAlt,
  FaUserCircle, FaWallet, FaHistory, FaQuestionCircle, FaExclamationTriangle,
  FaHome, FaSearch, FaClock, FaUsers, FaSyncAlt, FaTag,
  FaExclamationCircle, FaCamera, FaQrcode, FaPlaneDeparture,
  FaMobileAlt, FaTv, FaPhoneAlt, FaBolt, FaFireAlt, FaTint, FaBroadcastTower,
  FaShieldAlt
} from "react-icons/fa";
import { HiMiniSquares2X2 } from "react-icons/hi2";
import { useCustomerModern } from "../context/CustomerModernContext";
import { userService } from "../services/userService";
import { FaSun, FaMoon } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";
import AppBrand from "../components/AppBrand";
import { APP_VERSION } from "../../shared/constants/app";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import ChatbotPanel from "../components/ChatbotPanel";
import { useChatbot } from "../context/ChatbotContext";
import { IoChatbubbleEllipses } from "react-icons/io5";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  getQrStickerUrl,
} from "../utils/qrSticker";
import { useToast } from "../context/ToastContext";

const bottomNavItems = [
  { to: "/customer/app/history", label: "History", icon: <FaHistory /> },
  { to: "/customer/app/wallet", label: "Wallet", icon: <FaWallet /> },
  { to: "/customer/app/services", label: "Services", icon: <img src="https://webdekho.in/images/b.png" alt="" style={{ width: 24, height: 24, objectFit: "contain", filter: "brightness(0) invert(1)" }} />, isCenter: true },
  { to: "/customer/app/coupons", label: "Coupons", icon: <FaGift /> },
  { key: "chatbot", label: "AI Chat", icon: <IoChatbubbleEllipses />, isChatbot: true },
];

const serviceSubItems = [
  { to: "/customer/app/services/prepaid", label: "Prepaid", icon: <FaMobileAlt /> },
  { to: "/customer/app/services/postpaid", label: "Postpaid", icon: <FaPhoneAlt /> },
  { to: "/customer/app/services/dth", label: "DTH", icon: <FaTv /> },
  { to: "/customer/app/services/landline", label: "Landline", icon: <FaBroadcastTower /> },
  { to: "/customer/app/services/electricity", label: "Electricity", icon: <FaBolt /> },
  { to: "/customer/app/services/gas", label: "Gas", icon: <FaFireAlt /> },
  { to: "/customer/app/services/water", label: "Water", icon: <FaTint /> },
];

const drawerMenuItems = [
  { to: "/customer/app/services", label: "Home", icon: <FaHome /> },
  { to: "/customer/app/wallet", label: "Wallet", icon: <FaWallet /> },
  { to: "/customer/app/history", label: "Transaction History", icon: <FaHistory /> },
  { to: "/customer/app/search-transaction", label: "Search Transaction", icon: <FaSearch /> },
  { to: "/customer/app/profile", label: "Profile", icon: <FaUserCircle /> },
  { to: "/customer/app/my-dues", label: "My Dues", icon: <FaClock /> },
  { to: "/customer/app/my-coupons", label: "My Coupons", icon: <FaTag /> },
  { to: "/customer/app/referrals", label: "Referral Users", icon: <FaUsers /> },
  { to: "/customer/app/autopay", label: "AutoPay Mandates", icon: <FaSyncAlt /> },
  { to: "/customer/app/travel", label: "Travel Booking", icon: <FaPlaneDeparture /> },
  { to: "/customer/app/notifications", label: "Notifications", icon: <FaRegBell /> },
  { to: "/customer/app/help", label: "Help & Support", icon: <FaQuestionCircle /> },
  { to: "/customer/app/file-complaint", label: "File Complaint", icon: <FaExclamationTriangle /> },
  { to: "/customer/app/complaints", label: "Complaints", icon: <FaExclamationCircle /> },
];

const ProtectedShell = () => {
  const { logout, userData } = useCustomerModern();
  const { theme, toggleTheme } = useTheme();
  const { isOpen: isChatbotOpen, togglePanel: toggleChatbot } = useChatbot();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [balances, setBalances] = useState({ balance: 0, cashback: 0, incentive: 0, referralBonus: 0, referralUsers: 0 });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showKycPopup, setShowKycPopup] = useState(false);
  const fileInputRef = useRef(null);

  const userName = userData?.name || userData?.firstName || userData?.userName || userData?.user_name || userData?.customerName || "Customer";
  const userMobile = userData?.mobile || userData?.mobileNumber || "";
  const qrUrl = getQrStickerUrl(userMobile, 220);

  const isKycDone = userData?.verified_status === 1 || userData?.verified_status === "1" || userData?.kyc_verified === true;

  // Show KYC popup once per session after login/PIN verification
  // The payment screen already shows a KYC error with a redirect button
  useEffect(() => {
    if (userData && !isKycDone && !sessionStorage.getItem("kyc_popup_shown")) {
      const isKycPage = location.pathname.startsWith("/customer/app/kyc");
      if (!isKycPage) {
        setShowKycPopup(true);
        sessionStorage.setItem("kyc_popup_shown", "1");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, isKycDone]); // removed location.pathname — only run on mount/login

  // Load profile photo from localStorage on mount (only valid URLs)
  useEffect(() => {
    const stored = localStorage.getItem("profile_photo");
    if (stored && stored.startsWith("http")) {
      setProfilePhoto(stored);
    } else if (stored) {
      // Clear invalid cached photo
      localStorage.removeItem("profile_photo");
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    const res = await userService.getUserProfile();
    if (res.success && res.data) {
      setBalances({
        balance: Number(res.data.balance || 0),
        cashback: Number(res.data.cashback || 0),
        incentive: Number(res.data.incentive || 0),
        referralBonus: Number(res.data.referralBonus || res.data.referal_bonus || 0),
        referralUsers: Number(res.data.referralUsers || res.data.referral_users || 0),
      });
      // Update profile photo from API if available (must be valid URL)
      const photo = res.data.profile || res.data.profilePhoto || res.data.photo;
      if (photo && photo.startsWith("http")) {
        setProfilePhoto(photo);
        localStorage.setItem("profile_photo", photo);
      }
    }
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);
  /**
   * PERF FIX: Removed duplicate balance fetch on drawer open.
   * Previously, opening the drawer triggered another getUserProfile() call.
   * The mount-level fetch + API cache (30s TTL) ensures fresh data is displayed.
   */
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Global deep link listener for callbacks (Android/iOS)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrl = (event) => {
      console.log("Deep link received:", event.url);
      if (!event.url || !event.url.startsWith("vasbazaar://")) return;

      // Parse URL parameters
      const urlParams = new URL(event.url.replace("vasbazaar://", "https://"));
      const path = urlParams.pathname || urlParams.host;

      // KYC callback
      if (event.url.includes("kyc-callback")) {
        const gateway = urlParams.searchParams.get("gateway");
        const type = urlParams.searchParams.get("type");
        const client_id = urlParams.searchParams.get("client_id");
        const status = urlParams.searchParams.get("status");
        navigate(`/customer/app/kyc-callback?gateway=${gateway}&type=${type}&client_id=${client_id}&status=${status}`);
        return;
      }

      // Payment callback (Juspay/HDFC)
      if (event.url.includes("payment-callback")) {
        const orderId = urlParams.searchParams.get("order_id") || urlParams.searchParams.get("orderId");
        navigate(`/customer/app/payment-callback${orderId ? `?order_id=${orderId}` : ""}`);
        return;
      }

      // AutoPay/Mandate callback
      if (event.url.includes("autopay-callback")) {
        const orderId = urlParams.searchParams.get("order_id") || urlParams.searchParams.get("orderId");
        navigate(`/customer/app/autopay-callback${orderId ? `?order_id=${orderId}` : ""}`);
        return;
      }
    };

    const listener = App.addListener("appUrlOpen", handleAppUrl);

    return () => {
      listener.remove();
    };
  }, [navigate]);

  // Profile photo upload with canvas crop (1:1 square)
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    // Crop to square using canvas
    const img = new Image();
    img.onload = async () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], `profile_${Date.now()}.jpg`, { type: "image/jpeg" });
        setUploading(true);
        const res = await userService.uploadProfilePhoto(croppedFile);
        setUploading(false);
        if (res.success) {
          const url = res.data?.profile_photo || res.data?.photo_url || res.data?.profile || URL.createObjectURL(blob);
          setProfilePhoto(url);
          localStorage.setItem("profile_photo", url);
        } else {
          showToast("Upload failed. Please try again.", "error");
        }
      }, "image/jpeg", 0.9);
    };
    img.src = URL.createObjectURL(file);
  };

  /**
   * PERF FIX: Wrapped with useCallback to prevent re-creation on every render.
   * This function is passed to 14+ drawer menu items — without memoization,
   * each render created a new function reference causing all items to re-render.
   */
  const handleDrawerNav = useCallback((to) => {
    setDrawerOpen(false);
    navigate(to);
  }, [navigate]);

  const isServiceFlowPage = location.pathname === "/customer/app/payment";
  const isQrPage = location.pathname === "/customer/app/qr";
  const hideBottomNav = isServiceFlowPage || isQrPage || location.pathname === "/customer/app/offers" || location.pathname === "/customer/app/success";

  return (
    <div className={`customer-modern-protected${!sidebarOpen ? " cm-sidebar-hidden" : ""}`}>
      {/* Desktop sidebar */}
      <aside className={`cm-sidebar${sidebarOpen ? "" : " cm-sidebar--collapsed"}`}>
        <div className="cm-sidebar-top-row">
          <AppBrand />
          <button type="button" className="cm-sidebar-toggle" onClick={() => setSidebarOpen(false)} title="Close sidebar"><FaTimes /></button>
        </div>

        {/* Profile card */}
        <div className="cm-sidebar-profile">
          <div className="cm-drawer-photo-wrap" onClick={() => fileInputRef.current?.click()}>
            {profilePhoto ? (
              <img src={profilePhoto} alt="" className="cm-drawer-avatar-img" onError={() => { setProfilePhoto(null); localStorage.removeItem("profile_photo"); }} />
            ) : (
              <div className="cm-drawer-avatar-fallback"><FaUserCircle /></div>
            )}
            <span className="cm-drawer-photo-edit">{uploading ? "..." : <FaCamera />}</span>
          </div>
          <div style={{ flex: 1 }}>
            <strong>{userName}</strong>
            <div className="cm-muted">{userMobile ? `+91 ${userMobile}` : "Active session"}</div>
          </div>
          <div className="cm-sidebar-qr-actions">
            <button type="button" className="cm-sidebar-qr-btn" onClick={() => navigate("/customer/app/qr")} title="Show QR Code"><FaQrcode /></button>
          </div>
        </div>

        {/* Wallet cards */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">My Wallet</h3>
          <div className="cm-drawer-wallets">
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/wallet")}><div className="cm-dwc-icon"><FaWallet /></div><strong>₹{balances.balance.toFixed(2)}</strong><span>Wallet Balance</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/commission?tab=bonus")}><div className="cm-dwc-icon"><FaUsers /></div><strong>₹{balances.referralBonus.toFixed(2)}</strong><span>Referral Bonus</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/commission?tab=cashback")}><div className="cm-dwc-icon"><FaGift /></div><strong>₹{balances.cashback.toFixed(2)}</strong><span>Lifetime Cashback</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/commission?tab=incentive")}><div className="cm-dwc-icon"><HiMiniSquares2X2 /></div><strong>₹{balances.incentive.toFixed(2)}</strong><span>Lifetime Incentive</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/referrals")}><div className="cm-dwc-icon"><FaUsers /></div><strong>{balances.referralUsers}</strong><span>Referral Users</span></div>
          </div>
        </div>

        {/* Services menu */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">Services</h3>
          <nav className="cm-side-links">
            {drawerMenuItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "is-active" : "")}>
                <span>{item.icon} {item.label}</span>
                <FaChevronRight />
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom actions */}
        <div className="cm-drawer-bottom">
          <button className="cm-drawer-action-btn cm-drawer-action-btn--danger" type="button" onClick={() => setShowLogoutConfirm(true)}>
            <span className="cm-drawer-link-icon"><FaSignOutAlt /></span>
            <span>Logout</span>
            <FaChevronRight className="cm-drawer-link-arrow" />
          </button>
        </div>
      </aside>

      <div className="cm-main">
        {!isServiceFlowPage && !isQrPage && (
          <header className="cm-topbar">
            <div className="cm-topbar-inner">
              <div className="cm-topbar-left">
                <button className="cm-hamburger" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><FaBars /></button>
                {!sidebarOpen && <button className="cm-sidebar-open-btn" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><FaBars /></button>}
                <div className="cm-topbar-brand"><AppBrand /></div>
              </div>
              <div className="cm-topbar-actions">
                <button className="cm-icon-button cm-theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme">
                  {theme === "dark" ? <FaSun /> : <FaMoon />}
                </button>
                <Link className="cm-icon-button" to="/customer/app/notifications"><FaRegBell /></Link>
                <Link className="cm-icon-button" to="/customer/app/profile"><FaUserCircle /></Link>
              </div>
            </div>
          </header>
        )}
        <main className="cm-content"><Outlet /></main>
        <PWAInstallPrompt />
        {!hideBottomNav && (
          <nav className="cm-btm-nav">
            <div className="cm-btm-nav-inner">
              {bottomNavItems.map((item) => {
                if (item.isChatbot) {
                  return (
                    <button key="chatbot" type="button" className={`cm-btm-nav-item${isChatbotOpen ? " is-active" : ""}`} onClick={toggleChatbot}>
                      <span className="cm-btm-nav-icon">{item.icon}</span>
                      <span className="cm-btm-nav-label">{item.label}</span>
                      {isChatbotOpen && <span className="cm-btm-nav-indicator" />}
                    </button>
                  );
                }
                const isActive = location.pathname === item.to;
                return (
                  <NavLink key={item.to} to={item.to} className={`cm-btm-nav-item${isActive ? " is-active" : ""}${item.isCenter ? " cm-btm-nav-center" : ""}`}>
                    <span className="cm-btm-nav-icon">{item.icon}</span>
                    <span className="cm-btm-nav-label">{item.label}</span>
                    {isActive && !item.isCenter && <span className="cm-btm-nav-indicator" />}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* Drawer overlay */}
      <div className={`cm-drawer-overlay${drawerOpen ? " is-open" : ""}`} onClick={() => setDrawerOpen(false)} />

      {/* Drawer panel */}
      <aside className={`cm-drawer${drawerOpen ? " is-open" : ""}`}>
        <button className="cm-drawer-close" type="button" onClick={() => setDrawerOpen(false)}><FaTimes /></button>

        {/* Dark header with profile + QR */}
        <div className="cm-drawer-header-dark">
          <div className="cm-drawer-version">App Version : v{APP_VERSION}</div>
          <div className="cm-drawer-profile-row">
            <div className="cm-drawer-photo-wrap" onClick={() => fileInputRef.current?.click()}>
              {profilePhoto ? (
                <img src={profilePhoto} alt="" className="cm-drawer-avatar-img" onError={() => { setProfilePhoto(null); localStorage.removeItem("profile_photo"); }} />
              ) : (
                <div className="cm-drawer-avatar-fallback"><FaUserCircle /></div>
              )}
              <span className="cm-drawer-photo-edit">{uploading ? "..." : <FaCamera />}</span>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />
            </div>
            <div>
              <div className="cm-drawer-name">{userName}</div>
              <div className="cm-drawer-mobile">{userMobile ? `+91 ${userMobile}` : ""}</div>
            </div>
          </div>
          <div
            className="cm-drawer-qr-wrap"
            onClick={() => navigate("/customer/app/qr")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/customer/app/qr");
              }
            }}
            title="Open QR sticker"
          >
            {/* PERF FIX: Lazy-load QR code image — drawer is closed by default, no need to fetch immediately */}
            <img src={qrUrl} alt="QR Code" className="cm-drawer-qr-img" loading="lazy" />
          </div>
        </div>

        {/* My Wallet */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">My Wallet</h3>
          <div className="cm-drawer-wallets">
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/wallet")}><div className="cm-dwc-icon"><FaWallet /></div><strong>₹{balances.balance.toFixed(2)}</strong><span>Wallet Balance</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=bonus")}><div className="cm-dwc-icon"><FaUsers /></div><strong>₹{balances.referralBonus.toFixed(2)}</strong><span>Referral Bonus</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=cashback")}><div className="cm-dwc-icon"><FaGift /></div><strong>₹{balances.cashback.toFixed(2)}</strong><span>Lifetime Cashback</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=incentive")}><div className="cm-dwc-icon"><HiMiniSquares2X2 /></div><strong>₹{balances.incentive.toFixed(2)}</strong><span>Lifetime Incentive</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/referrals")}><div className="cm-dwc-icon"><FaUsers /></div><strong>{balances.referralUsers}</strong><span>Referral Users</span></div>
          </div>
        </div>

        {/* Recharge & Bill Pay services — collapsible */}
        <div className="cm-drawer-section">
          <button type="button" className="cm-drawer-section-toggle" onClick={() => setServicesOpen((p) => !p)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}>
            <h3 className="cm-drawer-section-title" style={{ margin: 0 }}>Recharge & Bill Pay</h3>
            {servicesOpen ? <FaChevronDown style={{ fontSize: 12, opacity: 0.5 }} /> : <FaChevronRight style={{ fontSize: 12, opacity: 0.5 }} />}
          </button>
          {servicesOpen && (
            <nav className="cm-drawer-menu" style={{ marginTop: 8 }}>
              {serviceSubItems.map((item) => (
                <button key={item.label} type="button" className="cm-drawer-link" onClick={() => handleDrawerNav(item.to)}>
                  <span className="cm-drawer-link-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <FaChevronRight className="cm-drawer-link-arrow" />
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Menu — using buttons instead of NavLink to avoid highlight bug */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">Menu</h3>
          <nav className="cm-drawer-menu">
            {drawerMenuItems.map((item) => (
              <button key={item.label} type="button" className="cm-drawer-link" onClick={() => handleDrawerNav(item.to)}>
                <span className="cm-drawer-link-icon">{item.icon}</span>
                <span>{item.label}</span>
                <FaChevronRight className="cm-drawer-link-arrow" />
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom actions */}
        <div className="cm-drawer-bottom">
          <button className="cm-drawer-action-btn cm-drawer-action-btn--danger" type="button" onClick={() => setShowLogoutConfirm(true)}>
            <span className="cm-drawer-link-icon"><FaSignOutAlt /></span>
            <span>Logout</span>
            <FaChevronRight className="cm-drawer-link-arrow" />
          </button>
        </div>
      </aside>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="tc-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-status-wrap" style={{ "--tc-color": "#FF3B30" }}>
              <FaSignOutAlt />
            </div>
            <h3 className="tc-modal-title">Logout?</h3>
            <p style={{ color: "var(--cm-muted)", fontSize: "0.85rem", margin: "0 0 20px", textAlign: "center" }}>
              Are you sure you want to logout from VasBazaar?
            </p>
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button className="pf-crop-cancel" type="button" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="pf-crop-confirm" type="button" style={{ background: "#FF3B30", boxShadow: "none" }} onClick={() => { setShowLogoutConfirm(false); logout(); }}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Panel — toggled from bottom nav */}
      <ChatbotPanel />

      {/* KYC Pending Popup */}
      {showKycPopup && (
        <div className="tc-modal-overlay" onClick={() => setShowKycPopup(false)}>
          <div className="tc-modal kyc-popup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kyc-popup-icon-wrap">
              <FaShieldAlt />
            </div>
            <h3 className="tc-modal-title">Proceed with KYC</h3>
            <p className="kyc-popup-desc">
              Complete your KYC now to unlock unlimited transactions and full access to all features.
            </p>
            <div className="kyc-popup-benefits">
              <div className="kyc-popup-benefit"><FaShieldAlt /> Unlimited Transactions</div>
              <div className="kyc-popup-benefit"><FaWallet /> Full Wallet Access</div>
              <div className="kyc-popup-benefit"><FaGift /> Exclusive Offers & Rewards</div>
            </div>
            <div className="kyc-popup-actions">
              <button
                type="button"
                className="kyc-popup-btn kyc-popup-btn--primary"
                onClick={() => { setShowKycPopup(false); navigate("/customer/app/kyc", { state: { returnTo: location.pathname } }); }}
              >
                <FaShieldAlt /> Proceed with KYC
              </button>
              <button
                type="button"
                className="kyc-popup-btn kyc-popup-btn--skip"
                onClick={() => setShowKycPopup(false)}
              >
                Skip KYC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProtectedShell;
