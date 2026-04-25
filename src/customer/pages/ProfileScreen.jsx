import {
  FaPhone, FaEnvelope, FaCopy,
  FaShareAlt, FaWallet, FaCamera, FaSignOutAlt, FaUserCircle,
  FaCheck, FaQrcode, FaShieldAlt, FaExclamationTriangle,
  FaSun, FaMoon,
} from "react-icons/fa";
import { FiChevronRight, FiShield, FiGift, FiHelpCircle } from "react-icons/fi";
import { useCustomerModern } from "../context/CustomerModernContext";
import { useTheme } from "../context/ThemeContext";
import { userService } from "../services/userService";
import { ChangePinScreen } from "../components/AppLockGuard";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { sanitizeBackendMessage } from "../utils/userMessages";
import { captureProfilePhotoDataUrl, fileToDataUrl, shouldUseNativeCamera } from "../utils/profilePhoto";
import { getProfilePhotoCandidates, saveProfilePhoto } from "../utils/profileAvatar";
import ProfileAvatar from "../components/ProfileAvatar";
import ProfilePhotoCropper from "../components/ProfilePhotoCropper";
import ProfilePhotoPreview from "../components/ProfilePhotoPreview";

const ProfileScreen = () => {
  const { userData, logout, setAuthSession } = useCustomerModern();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  // Bump this to force <ProfileAvatar /> to re-read storage after a new photo is saved.
  const [photoVersion, setPhotoVersion] = useState(0);

  const name = userData?.name || userData?.firstName || userData?.userName || userData?.user_name || userData?.customerName || "Customer";
  const mobile = userData?.mobile || userData?.mobileNumber || "--";
  const email = userData?.email || "";
  const referral = userData?.mobile || userData?.mobileNumber || userData?.referalCode || userData?.referralCode || userData?.refferalCode || userData?.refferal_code || "--";
  const balance = userData?.balance || userData?.walletBalance || "0.00";
  const cashback = userData?.cashback || userData?.totalCashback || "0";
  // The profile API returns this as `referralUsers` / `referral_users`; accept any
  // of the legacy variants before falling back to "0".
  const referralCount = userData?.referralUsers
    ?? userData?.referral_users
    ?? userData?.referralCount
    ?? userData?.totalReferrals
    ?? "0";
  const isKycVerified = userData?.verified_status === 1 || userData?.verified_status === "1" || userData?.kyc_verified === true;

  // photoVersion state bumps trigger a re-render which re-reads localStorage here.
  const _photoVersionRead = photoVersion; // eslint-disable-line no-unused-vars
  const photoCandidates = getProfilePhotoCandidates(userData);

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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const imageSrc = await fileToDataUrl(file);
    setCropSrc(imageSrc);
  };

  const handleCropConfirm = async ({ dataUrl, file }) => {
    setCropSrc(null);
    // Persist the cropped image locally first so it's visible immediately and
    // survives refresh even if the upload fails or the device is offline.
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
      showToast(sanitizeBackendMessage(res.message, "Upload failed. Please try again."), "error");
    }
  };

  const copyReferral = () => {
    navigator.clipboard?.writeText(referral);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareReferral = () => {
    if (navigator.share) {
      navigator.share({ title: "Join VasBazaar", text: `Use my referral code: ${referral}` });
    } else {
      copyReferral();
    }
  };

  const openEmailEditor = () => {
    setEmailInput(email || "");
    setEmailError("");
    setEmailEditOpen(true);
  };

  const saveEmail = async () => {
    const trimmed = emailInput.trim();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailSaving(true);
    const res = await userService.updateEmail(trimmed);
    setEmailSaving(false);
    if (!res.success) {
      setEmailError(sanitizeBackendMessage(res.message, "Failed to save email. Please try again."));
      return;
    }
    const savedEmail = res.data?.email || trimmed;
    setAuthSession({ userData: { email: savedEmail } });
    setEmailEditOpen(false);
    showToast("Email saved.", "success");
  };

  const fields = [
    { icon: <FaPhone />, label: "Mobile", value: mobile ? `+91 ${mobile}` : "--" },
    {
      icon: <FaEnvelope />,
      label: "Email",
      value: email || "Tap to add email",
      onClick: openEmailEditor,
      isPlaceholder: !email,
    },
  ];

  const stats = [
    { label: "Balance", value: `₹${balance}`, color: "#00C853", onClick: () => navigate("/customer/app/wallet") },
    { label: "Cashback", value: `₹${cashback}`, color: "#FF9800", onClick: () => navigate("/customer/app/commission?tab=cashback") },
    { label: "Referrals", value: referralCount, color: "#40E0D0", onClick: () => navigate("/customer/app/referrals") },
  ];

  const actions = [
    { icon: <FaWallet />, label: "Wallet", onClick: () => navigate("/customer/app/wallet") },
    {
      icon: isKycVerified ? <FaShieldAlt /> : <FaExclamationTriangle />,
      label: "KYC Status",
      onClick: () => navigate("/customer/app/kyc", { state: { returnTo: "/customer/app/profile" } }),
      badge: isKycVerified ? "Verified" : "Pending",
      badgeColor: isKycVerified ? "#00C853" : "#FF9800",
    },
    { icon: <FiShield />, label: "Change PIN", onClick: () => setShowChangePin(true) },
    {
      icon: isDark ? <FaSun /> : <FaMoon />,
      label: "Appearance",
      onClick: toggleTheme,
      badge: isDark ? "Dark" : "Light",
      badgeColor: isDark ? "#374151" : "#E5E7EB",
      badgeTextColor: isDark ? "#FFFFFF" : "#111827",
    },
    { icon: <FiHelpCircle />, label: "Help & Support", onClick: () => navigate("/customer/app/help") },
    { icon: <FaSignOutAlt />, label: "Logout", onClick: logout, danger: true },
  ];

  return (
    <div className="cm-page-animate pf-page">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Header */}
      <div className="pf-header">
        <div className="pf-avatar-wrap">
          <div
            className="pf-avatar-tap"
            role="button"
            tabIndex={0}
            onClick={() => { if (photoCandidates.length > 0) setPhotoPreviewOpen(true); }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && photoCandidates.length > 0) {
                e.preventDefault();
                setPhotoPreviewOpen(true);
              }
            }}
            style={{ cursor: photoCandidates.length > 0 ? "zoom-in" : "default", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}
          >
            <ProfileAvatar
              candidates={photoCandidates}
              className="pf-avatar-img"
              alt={name}
              emptyFallback={(
                <div className="pf-avatar-fallback">
                  <FaUserCircle size={48} color="rgba(64, 224, 208, 0.6)" />
                </div>
              )}
            />
          </div>
          {uploading && (
            <div className="pf-avatar-uploading"><span className="cm-contact-loading" /></div>
          )}
          <div className="pf-avatar-edit" onClick={(e) => { e.stopPropagation(); handleProfilePhotoClick(); }}>
            <FaCamera size={12} color="#fff" />
          </div>
        </div>
        <h2 className="pf-name">
          {name}
          {isKycVerified && (
            <span className="pf-verified-badge" aria-label="Verified">
              <FaCheck />
            </span>
          )}
        </h2>
        <p className="pf-mobile">{mobile ? `+91 ${mobile}` : ""}</p>
      </div>

      {/* Stats */}
      <div className="pf-stats-row">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`pf-stat-card${s.onClick ? " pf-stat-card--clickable" : ""}`}
            role={s.onClick ? "button" : undefined}
            tabIndex={s.onClick ? 0 : undefined}
            onClick={s.onClick}
            onKeyDown={(e) => {
              if (!s.onClick) return;
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.onClick(); }
            }}
          >
            <div className="pf-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="pf-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info fields */}
      <div className="pf-card">
        {fields.map((f, i) => (
          <div
            key={f.label}
            className={`pf-field${f.onClick ? " pf-field--clickable" : ""}`}
            style={{ borderBottom: i < fields.length - 1 ? "1px solid #2A2A2A" : "none", cursor: f.onClick ? "pointer" : "default" }}
            role={f.onClick ? "button" : undefined}
            tabIndex={f.onClick ? 0 : undefined}
            onClick={f.onClick}
            onKeyDown={(e) => {
              if (!f.onClick) return;
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f.onClick(); }
            }}
          >
            <div className="pf-field-icon">{f.icon}</div>
            <div className="pf-field-info">
              <div className="pf-field-label">{f.label}</div>
              <div className="pf-field-value" style={f.isPlaceholder ? { color: "#40E0D0", fontWeight: 600 } : undefined}>
                {f.value}
              </div>
            </div>
            {f.onClick && <FiChevronRight size={16} color="#6B6B6B" />}
          </div>
        ))}
      </div>

      {/* Referral */}
      <div className="pf-referral-card">
        <div className="pf-referral-header">
          <FiGift size={18} color="#40E0D0" />
          <span className="pf-referral-title">Referral Code</span>
        </div>
        <div className="pf-referral-code-row">
          <span className="pf-referral-code">{referral}</span>
          <div className="pf-referral-actions">
            <button type="button" className="pf-referral-btn pf-referral-btn--copy" onClick={copyReferral}>
              <FaCopy size={11} /> {copied ? "Copied!" : "Copy"}
            </button>
            <button type="button" className="pf-referral-btn pf-referral-btn--share" onClick={shareReferral}>
              <FaShareAlt size={11} /> Share
            </button>
            <button type="button" className="pf-referral-btn pf-referral-btn--qr" onClick={() => navigate("/customer/app/qr")}>
              <FaQrcode size={11} /> QR
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pf-card">
        {actions.map((a, i) => (
          <div key={a.label} className={`pf-action${a.danger ? " pf-action--danger" : ""}`} onClick={a.onClick} style={{ borderBottom: i < actions.length - 1 ? "1px solid #2A2A2A" : "none" }}>
            <div className={`pf-action-icon${a.danger ? " pf-action-icon--danger" : ""}${a.label === "KYC Status" && !isKycVerified ? " pf-action-icon--warn" : ""}`}>{a.icon}</div>
            <span className="pf-action-label">{a.label}</span>
            {a.badge && (
              <span className="pf-action-badge" style={{ background: a.badgeColor, color: a.badgeTextColor || "#fff" }}>
                {a.badge}
              </span>
            )}
            <FiChevronRight size={16} color={a.danger ? "#FF3B30" : "#6B6B6B"} />
          </div>
        ))}
      </div>

      <ProfilePhotoCropper
        open={!!cropSrc}
        imageSrc={cropSrc}
        onCancel={() => setCropSrc(null)}
        onConfirm={handleCropConfirm}
      />

      <ProfilePhotoPreview
        open={photoPreviewOpen}
        candidates={photoCandidates}
        name={name}
        onClose={() => setPhotoPreviewOpen(false)}
      />

      {emailEditOpen && (
        <div className="pf-email-overlay" onClick={() => !emailSaving && setEmailEditOpen(false)}>
          <div className="pf-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pf-email-header">
              <FaEnvelope />
              <h3>{email ? "Update Email" : "Add Email"}</h3>
            </div>
            <p className="pf-email-sub">
              We'll use this email for receipts, alerts, and account recovery.
            </p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              className="pf-email-input"
              placeholder="name@example.com"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); if (emailError) setEmailError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") saveEmail(); }}
              disabled={emailSaving}
            />
            {emailError && <div className="pf-email-error">{emailError}</div>}
            <div className="pf-email-actions">
              <button type="button" className="pf-email-btn pf-email-btn--cancel" onClick={() => setEmailEditOpen(false)} disabled={emailSaving}>
                Cancel
              </button>
              <button type="button" className="pf-email-btn pf-email-btn--save" onClick={saveEmail} disabled={emailSaving}>
                {emailSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePin && (
        <ChangePinScreen onClose={(msg) => {
          setShowChangePin(false);
          if (msg) { setPinMsg(msg); setTimeout(() => setPinMsg(""), 3000); }
        }} />
      )}

      {pinMsg && (
        <div style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", background: "#00C853", color: "#fff", padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 700, zIndex: 99999, boxShadow: "0 4px 16px rgba(0,200,83,0.3)" }}>
          {pinMsg}
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
