import { useEffect, useState, useCallback, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars, FaTimes, FaChevronRight, FaGift, FaRegBell, FaSignOutAlt,
  FaUserCircle, FaWallet, FaHistory, FaQuestionCircle, FaExclamationTriangle,
  FaHome, FaSearch, FaClock, FaUsers, FaSyncAlt, FaTrashAlt, FaDownload, FaShareAlt, FaTag,
  FaExclamationCircle, FaCamera
} from "react-icons/fa";
import { HiMiniSquares2X2 } from "react-icons/hi2";
import { useCustomerModern } from "../context/CustomerModernContext";
import { userService } from "../services/userService";
import { FaSun, FaMoon } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";
import AppBrand from "../components/AppBrand";
import PWAInstallPrompt from "../components/PWAInstallPrompt";

const bottomNavItems = [
  { to: "/customer/app/services", label: "Services", icon: <HiMiniSquares2X2 /> },
  { to: "/customer/app/wallet", label: "Wallet", icon: <FaWallet /> },
  { to: "/customer/app/coupons", label: "Coupons", icon: <FaGift /> },
  { to: "/customer/app/profile", label: "Profile", icon: <FaUserCircle /> },
];

const drawerMenuItems = [
  { to: "/customer/app/file-complaint", label: "File Complaint", icon: <FaExclamationTriangle /> },
  { to: "/customer/app/services", label: "Home", icon: <FaHome /> },
  { to: "/customer/app/wallet", label: "Wallet", icon: <FaWallet /> },
  { to: "/customer/app/history", label: "Transaction History", icon: <FaHistory /> },
  { to: "/customer/app/search-transaction", label: "Search Transaction", icon: <FaSearch /> },
  { to: "/customer/app/profile", label: "Profile", icon: <FaUserCircle /> },
  { to: "/customer/app/my-dues", label: "My Dues", icon: <FaClock /> },
  { to: "/customer/app/my-coupons", label: "My Coupons", icon: <FaTag /> },
  { to: "/customer/app/referrals", label: "Referral Users", icon: <FaUsers /> },
  { to: "/customer/app/autopay", label: "AutoPay Mandates", icon: <FaSyncAlt /> },
  { to: "/customer/app/notifications", label: "Notifications", icon: <FaRegBell /> },
  { to: "/customer/app/complaints", label: "Complaints", icon: <FaExclamationCircle /> },
  { to: "/customer/app/help", label: "Help & Support", icon: <FaQuestionCircle /> },
];

const ProtectedShell = () => {
  const { logout, userData } = useCustomerModern();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [balances, setBalances] = useState({ balance: 0, cashback: 0, incentive: 0, referralBonus: 0, referralUsers: 0 });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const userName = userData?.name || userData?.firstName || userData?.userName || userData?.user_name || userData?.customerName || "Customer";
  const userMobile = userData?.mobile || userData?.mobileNumber || "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://vasbazaar.web.webdekho.in?code=${userMobile}`)}`;
  const referralLink = `https://vasbazaar.web.webdekho.in?code=${userMobile}`;

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

  useEffect(() => { if (drawerOpen) fetchBalances(); }, [drawerOpen, fetchBalances]);
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleShareLink = () => {
    const message = `Turn your transactions into earnings! Join VasBazaar today & get cashback on every spend. Sign up here: ${referralLink}`;
    if (navigator.share) {
      navigator.share({ title: "VasBazaar", text: message, url: referralLink });
    } else {
      // Fallback: open WhatsApp like the old project
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    }
  };

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vasbazaar-qr-${userMobile || "code"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {
      window.open(qrUrl, "_blank");
    }
  };

  const handleClearCache = () => {
    if (window.confirm("Clear all cached data?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

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
          alert(res.message || "Upload failed.");
        }
      }, "image/jpeg", 0.9);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleDrawerNav = (to) => {
    setDrawerOpen(false);
    navigate(to);
  };

  const isServiceFlowPage = location.pathname === "/customer/app/payment";

  return (
    <div className="customer-modern-protected">
      {/* Desktop sidebar */}
      <aside className="cm-sidebar">
        <AppBrand />
        <div className="cm-card">
          <strong>{userName}</strong>
          <div className="cm-muted">{userMobile ? `+91 ${userMobile}` : "Active session"}</div>
        </div>
        <nav className="cm-side-links">
          {bottomNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "is-active" : "")}>
              <span>{item.icon} {item.label}</span>
              <FaChevronRight />
            </NavLink>
          ))}
          <button type="button" onClick={logout}><span><FaSignOutAlt /> Logout</span><FaChevronRight /></button>
        </nav>
      </aside>

      <div className="cm-main">
        {!isServiceFlowPage && (
          <header className="cm-topbar">
            <div className="cm-topbar-inner">
              <div className="cm-topbar-left">
                <button className="cm-hamburger" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><FaBars /></button>
                <div className="cm-topbar-brand"><AppBrand /></div>
              </div>
              <div className="cm-topbar-actions">
                <button className="cm-icon-button cm-theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme">
                  {theme === "dark" ? <FaSun /> : <FaMoon />}
                </button>
                <Link className="cm-icon-button" to="/customer/app/notifications"><FaRegBell /></Link>
              </div>
            </div>
          </header>
        )}
        <main className="cm-content"><Outlet /></main>
        <PWAInstallPrompt />
        {!isServiceFlowPage && (
          <nav className="cm-btm-nav">
            <div className="cm-btm-nav-inner">
              {bottomNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink key={item.to} to={item.to} className={`cm-btm-nav-item${isActive ? " is-active" : ""}`}>
                    <span className="cm-btm-nav-icon">{item.icon}</span>
                    <span className="cm-btm-nav-label">{item.label}</span>
                    {isActive && <span className="cm-btm-nav-indicator" />}
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
          <div className="cm-drawer-version">App Version : v1.0.0</div>
          <div className="cm-drawer-profile-row">
            <div className="cm-drawer-photo-wrap" onClick={() => fileInputRef.current?.click()}>
              {profilePhoto ? (
                <img src={profilePhoto} alt="" className="cm-drawer-avatar-img" />
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
          <div className="cm-drawer-qr-wrap">
            <img src={qrUrl} alt="QR Code" className="cm-drawer-qr-img" />
          </div>
          <div className="cm-drawer-qr-actions">
            <button type="button" className="cm-drawer-qr-btn" onClick={handleDownloadQR}><FaDownload /> Download QR</button>
            <button type="button" className="cm-drawer-qr-btn" onClick={handleShareLink}><FaShareAlt /> Share Link</button>
          </div>
        </div>

        {/* My Wallet */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">My Wallet</h3>
          <div className="cm-drawer-wallets">
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/wallet")}><div className="cm-dwc-icon"><FaWallet /></div><strong>₹{balances.balance.toFixed(2)}</strong><span>Wallet Balance</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/wallet")}><div className="cm-dwc-icon"><FaUsers /></div><strong>₹{balances.referralBonus.toFixed(2)}</strong><span>Referral Bonus</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=cashback")}><div className="cm-dwc-icon"><FaGift /></div><strong>₹{balances.cashback.toFixed(2)}</strong><span>Lifetime Cashback</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/commission?tab=incentive")}><div className="cm-dwc-icon"><HiMiniSquares2X2 /></div><strong>₹{balances.incentive.toFixed(2)}</strong><span>Lifetime Incentive</span></div>
            <div className="cm-drawer-wallet-card" onClick={() => handleDrawerNav("/customer/app/referrals")}><div className="cm-dwc-icon"><FaUsers /></div><strong>{balances.referralUsers}</strong><span>Referral Users</span></div>
          </div>
        </div>

        {/* Services menu — using buttons instead of NavLink to avoid highlight bug */}
        <div className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">Services</h3>
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
          <button className="cm-drawer-action-btn" type="button" onClick={handleClearCache}>
            <span className="cm-drawer-link-icon"><FaTrashAlt /></span>
            <span>Clear Cache</span>
            <FaChevronRight className="cm-drawer-link-arrow" />
          </button>
          <button className="cm-drawer-action-btn cm-drawer-action-btn--danger" type="button" onClick={logout}>
            <span className="cm-drawer-link-icon"><FaSignOutAlt /></span>
            <span>Logout</span>
            <FaChevronRight className="cm-drawer-link-arrow" />
          </button>
        </div>
      </aside>
    </div>
  );
};

export default ProtectedShell;
