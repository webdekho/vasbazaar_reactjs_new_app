import { useEffect, useState, useCallback, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars, FaTimes, FaChevronRight, FaGift, FaRegBell, FaSignOutAlt,
  FaUserCircle, FaWallet, FaHistory, FaQuestionCircle, FaExclamationTriangle,
  FaHome, FaSearch, FaClock, FaUsers, FaSyncAlt, FaTag,
  FaExclamationCircle, FaCamera, FaQrcode, FaPlaneDeparture,
  FaShieldAlt, FaDownload, FaShareAlt, FaCheck, FaHeadset
} from "react-icons/fa";
import { useCustomerModern } from "../context/CustomerModernContext";
import { userService } from "../services/userService";
import { notificationService } from "../services/notificationService";
import AppBrand from "../components/AppBrand";
import { APP_VERSION } from "../../shared/constants/app";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import ChatbotPanel from "../components/ChatbotPanel";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Share } from "@capacitor/share";
import {
  getQrStickerLink,
  getQrStickerUrl,
} from "../utils/qrSticker";
import { captureProfilePhotoDataUrl, fileToDataUrl, shouldUseNativeCamera } from "../utils/profilePhoto";
import { getProfilePhotoCandidates, saveProfilePhoto } from "../utils/profileAvatar";
import ProfileAvatar from "../components/ProfileAvatar";
import ProfilePhotoCropper from "../components/ProfilePhotoCropper";
import ProfilePhotoPreview from "../components/ProfilePhotoPreview";
import { openTawkChat } from "../utils/tawk";
import { useToast } from "../context/ToastContext";

const bottomNavItems = [
  { to: "/customer/app/history", label: "History", icon: <FaHistory /> },
  { to: "/customer/app/wallet", label: "Wallet", icon: <FaWallet /> },
  { to: "/customer/app/services", label: "Services", icon: <img src="https://webdekho.in/images/b.png" alt="" style={{ width: 24, height: 24, objectFit: "contain", filter: "brightness(0) invert(1)" }} />, isCenter: true },
  { to: "/customer/app/coupons", label: "Coupons", icon: <FaGift /> },
  { key: "live-chat", label: "Live Chat", icon: <FaHeadset />, isLiveChat: true },
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
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [balances, setBalances] = useState({ balance: 0, cashback: 0, incentive: 0, referralBonus: 0, referralUsers: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  // Bump to force <ProfileAvatar /> to re-read storage after a new photo lands.
  const [photoVersion, setPhotoVersion] = useState(0);
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
      const photo = res.data.profile || res.data.profilePhoto || res.data.photo;
      if (photo && /^https?:\/\//i.test(photo)) {
        saveProfilePhoto({ serverUrl: photo });
        setPhotoVersion((v) => v + 1);
      }
    }
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  // Unread notification count — a notification disappears after `dismissNotification`
  // so anything still in the list is treated as unread. Bell icon renders only when
  // this is > 0. Refetches whenever the user navigates (covers the return-from-
  // notifications-screen case where the list may now be empty after Clear All).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await notificationService.getNotifications(0);
      if (cancelled) return;
      const list = res?.data?.records || (Array.isArray(res?.data) ? res.data : []);
      setUnreadCount(list.length || 0);
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

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
      const path = urlParams.pathname || urlParams.host; // eslint-disable-line no-unused-vars

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

  const handleProfilePhotoClick = async () => {
    if (!shouldUseNativeCamera()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const imageSrc = await captureProfilePhotoDataUrl();
      if (imageSrc) setCropSrc(imageSrc);
    } catch (error) {
      if (!String(error?.message || error).toLowerCase().includes("cancel")) {
        showToast("Photo select nahi ho paya. Please try again.", "error");
      }
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const imageSrc = await fileToDataUrl(file);
    setCropSrc(imageSrc);
  };

  const handleCropConfirm = async ({ dataUrl, file }) => {
    setCropSrc(null);
    // Save the cropped image locally so it renders immediately and persists
    // across refreshes, even if the server upload fails or is offline.
    saveProfilePhoto({ dataUrl });
    setPhotoVersion((v) => v + 1);

    setUploading(true);
    const res = await userService.uploadProfilePhoto(file);
    setUploading(false);

    if (res.success) {
      const serverUrl = res.data?.profile_photo || res.data?.photo_url || res.data?.profile;
      if (serverUrl) {
        saveProfilePhoto({ serverUrl });
        setPhotoVersion((v) => v + 1);
      }
    } else {
      showToast("Upload failed. Please try again.", "error");
    }
  };

  // `photoVersion` state bumps cause a re-render which re-reads localStorage here.
  // The variable itself isn't referenced — the state change alone drives the refresh.
  const photoCandidates = getProfilePhotoCandidates(userData); // eslint-disable-line no-unused-vars
  const _photoVersionRead = photoVersion; // eslint-disable-line no-unused-vars

  const openPhotoPreview = () => {
    if (photoCandidates.length > 0) setPhotoPreviewOpen(true);
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

  const handleQrDownload = useCallback((event) => {
    event?.stopPropagation();
    handleDrawerNav("/customer/app/qr");
  }, [handleDrawerNav]);

  const handleShareAndEarn = useCallback(async (event) => {
    event?.stopPropagation();

    const shareUrl = getQrStickerLink(userMobile);
    const shareText = `Join VasBazaar with my referral link and start earning rewards.\n${shareUrl}`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: "Share & Earn with VasBazaar",
          text: shareText,
          url: shareUrl,
          dialogTitle: "Share & Earn",
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: "Share & Earn with VasBazaar",
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard?.writeText(shareUrl);
      showToast("Referral link copied.", "success");
    } catch (error) {
      if (error?.name !== "AbortError") {
        showToast("Unable to share right now.", "error");
      }
    }
  }, [showToast, userMobile]);

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
          <div className="cm-drawer-photo-wrap" onClick={openPhotoPreview} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPhotoPreview(); } }}
          >
            <ProfileAvatar
              candidates={photoCandidates}
              className="cm-drawer-avatar-img"
              alt={userName}
              emptyFallback={<div className="cm-drawer-avatar-fallback"><FaUserCircle /></div>}
            />
            <span
              className="cm-drawer-photo-edit"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleProfilePhotoClick(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleProfilePhotoClick(); } }}
              title="Change photo"
            >
              {uploading ? "..." : <FaCamera />}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong className="cm-sidebar-profile-name">
              {userName}
              {isKycDone && (
                <>
                  {" "}
                  <span className="pf-verified-badge pf-verified-badge--sm pf-verified-badge--inline" aria-label="Verified">
                    <FaCheck />
                  </span>
                </>
              )}
            </strong>
            <div className="cm-muted">{userMobile || "Active session"}</div>
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
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/commission?tab=rewards")}><div className="cm-dwc-icon"><FaUsers /></div><strong>₹{(balances.referralBonus + balances.incentive).toFixed(2)}</strong><span>Reward Reports</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => navigate("/customer/app/commission?tab=cashback")}><div className="cm-dwc-icon"><FaGift /></div><strong>₹{balances.cashback.toFixed(2)}</strong><span>Lifetime Cashback</span></div>
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
                {unreadCount > 0 && (
                  <Link className="cm-icon-button cm-icon-button--bell" to="/customer/app/notifications" aria-label={`${unreadCount} unread notifications`}>
                    <FaRegBell />
                    <span className="cm-icon-button-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  </Link>
                )}
                <Link className="cm-icon-button cm-icon-button--avatar" to="/customer/app/profile" aria-label="Profile">
                  <ProfileAvatar
                    candidates={photoCandidates}
                    className="cm-topbar-avatar-img"
                    alt={userName}
                    emptyFallback={<FaUserCircle />}
                  />
                </Link>
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
                if (item.isLiveChat) {
                  return (
                    <button key="live-chat" type="button" className="cm-btm-nav-item" onClick={openTawkChat}>
                      <span className="cm-btm-nav-icon">{item.icon}</span>
                      <span className="cm-btm-nav-label">{item.label}</span>
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
            <div className="cm-drawer-photo-wrap" onClick={openPhotoPreview} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPhotoPreview(); } }}
            >
              <ProfileAvatar
                candidates={photoCandidates}
                className="cm-drawer-avatar-img"
                alt={userName}
                emptyFallback={<div className="cm-drawer-avatar-fallback"><FaUserCircle /></div>}
              />
              <span
                className="cm-drawer-photo-edit"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleProfilePhotoClick(); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleProfilePhotoClick(); } }}
                title="Change photo"
              >
                {uploading ? "..." : <FaCamera />}
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="cm-drawer-name">
                {userName}
                {isKycDone && (
                  <>
                    {" "}
                    <span className="pf-verified-badge pf-verified-badge--sm pf-verified-badge--inline" aria-label="Verified">
                      <FaCheck />
                    </span>
                  </>
                )}
              </div>
              <div className="cm-drawer-mobile">{userMobile || ""}</div>
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
          <div className="cm-drawer-qr-cta-row">
            <button type="button" className="cm-drawer-qr-cta cm-drawer-qr-cta--download" onClick={handleQrDownload}>
              <FaDownload />
              <span>Download</span>
            </button>
            <button type="button" className="cm-drawer-qr-cta cm-drawer-qr-cta--share" onClick={handleShareAndEarn}>
              <FaShareAlt />
              <span>Share & Earn</span>
            </button>
          </div>
        </div>

        {/* My Wallet */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">My Wallet</h3>
          <div className="cm-drawer-wallets">
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/wallet")}><div className="cm-dwc-icon"><FaWallet /></div><strong>₹{balances.balance.toFixed(2)}</strong><span>Wallet Balance</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=rewards")}><div className="cm-dwc-icon"><FaUsers /></div><strong>₹{(balances.referralBonus + balances.incentive).toFixed(2)}</strong><span>Reward Reports</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=cashback")}><div className="cm-dwc-icon"><FaGift /></div><strong>₹{balances.cashback.toFixed(2)}</strong><span>Lifetime Cashback</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/referrals")}><div className="cm-dwc-icon"><FaUsers /></div><strong>{balances.referralUsers}</strong><span>Referral Users</span></div>
          </div>
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

      {/* Shared profile-photo cropper */}
      <ProfilePhotoCropper
        open={!!cropSrc}
        imageSrc={cropSrc}
        onCancel={() => setCropSrc(null)}
        onConfirm={handleCropConfirm}
      />

      {/* Tap-to-zoom profile-photo preview */}
      <ProfilePhotoPreview
        open={photoPreviewOpen}
        candidates={photoCandidates}
        name={userName}
        onClose={() => setPhotoPreviewOpen(false)}
      />

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
