import {
  FaPhone, FaEnvelope, FaIdBadge, FaCopy,
  FaShareAlt, FaWallet, FaCamera, FaSignOutAlt, FaUserCircle,
  FaCheck, FaTimes, FaCrop, FaQrcode,
} from "react-icons/fa";
import { FiEdit2, FiChevronRight, FiShield, FiGift, FiHelpCircle } from "react-icons/fi";
import { useCustomerModern } from "../context/CustomerModernContext";
import { userService } from "../services/userService";
import { ChangePinScreen } from "../components/AppLockGuard";
import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const ProfileScreen = () => {
  const { userData, logout, setAuthSession } = useCustomerModern();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [cropModal, setCropModal] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0, scale: 1 });
  const imgRef = useRef(null);
  const cropFileRef = useRef(null);

  const name = userData?.name || userData?.firstName || userData?.userName || userData?.user_name || userData?.customerName || "Customer";
  const mobile = userData?.mobile || userData?.mobileNumber || "--";
  const email = userData?.email || "Not provided";
  const referral = userData?.referalCode || userData?.referralCode || userData?.refferalCode || userData?.refferal_code || userData?.mobile || userData?.mobileNumber || "--";
  const userType = userData?.userType || "customer";
  const rawPhoto = userData?.profile || userData?.profilePhoto || userData?.photo || localStorage.getItem("profile_photo") || "";
  const [localPhoto, setLocalPhoto] = useState(null);
  const profilePhoto = localPhoto || (rawPhoto && rawPhoto.startsWith("http") ? rawPhoto : null);
  const balance = userData?.balance || userData?.walletBalance || "0.00";
  const cashback = userData?.cashback || userData?.totalCashback || "0";
  const referralCount = userData?.referralCount || userData?.totalReferrals || "0";

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    cropFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropSrc(ev.target.result);
      setCropPos({ x: 0, y: 0, scale: 1 });
      setCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = useCallback(async () => {
    if (!cropSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.arc(200, 200, 200, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const sx = (img.width - size) / 2 + (cropPos.x * size / 200);
      const sy = (img.height - size) / 2 + (cropPos.y * size / 200);
      const sSize = size / cropPos.scale;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 400, 400);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        setCropModal(false);
        setUploading(true);
        const previewUrl = URL.createObjectURL(blob);
        setLocalPhoto(previewUrl);
        const croppedFile = new File([blob], `profile_${Date.now()}.jpg`, { type: "image/jpeg" });
        const res = await userService.uploadProfilePhoto(croppedFile);
        setUploading(false);
        if (res.success) {
          const url = res.data?.profile_photo || res.data?.photo_url || res.data?.profile || previewUrl;
          if (url && url.startsWith("http")) {
            setLocalPhoto(url);
            localStorage.setItem("profile_photo", url);
          }
        } else {
          alert(res.message || "Upload failed. Please try again.");
        }
      }, "image/jpeg", 0.9);
    };
    img.src = cropSrc;
  }, [cropSrc, cropPos]);

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

  const fields = [
    { icon: <FaPhone />, label: "Mobile", value: mobile ? `+91 ${mobile}` : "--" },
    { icon: <FaEnvelope />, label: "Email", value: email },
    { icon: <FaIdBadge />, label: "User Type", value: userType.charAt(0).toUpperCase() + userType.slice(1) },
  ];

  const stats = [
    { label: "Balance", value: `₹${balance}`, color: "#00C853" },
    { label: "Cashback", value: `₹${cashback}`, color: "#FF9800" },
    { label: "Referrals", value: referralCount, color: "#40E0D0" },
  ];

  const actions = [
    { icon: <FaWallet />, label: "Wallet", onClick: () => navigate("/customer/app/wallet") },
    { icon: <FiShield />, label: "Change PIN", onClick: () => setShowChangePin(true) },
    { icon: <FiHelpCircle />, label: "Help & Support", onClick: () => navigate("/customer/app/help") },
    { icon: <FaSignOutAlt />, label: "Logout", onClick: logout, danger: true },
  ];

  return (
    <div className="cm-page-animate pf-page">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Header */}
      <div className="pf-header">
        <div className="pf-avatar-wrap">
          {profilePhoto ? (
            <img src={profilePhoto} alt={name} className="pf-avatar-img" onError={() => { setLocalPhoto(null); localStorage.removeItem("profile_photo"); }} />
          ) : (
            <div className="pf-avatar-fallback">
              <FaUserCircle size={48} color="rgba(64, 224, 208, 0.6)" />
            </div>
          )}
          {uploading && (
            <div className="pf-avatar-uploading"><span className="cm-contact-loading" /></div>
          )}
          <div className="pf-avatar-edit" onClick={() => fileInputRef.current?.click()}>
            <FaCamera size={12} color="#fff" />
          </div>
        </div>
        <h2 className="pf-name">{name}</h2>
        <p className="pf-mobile">{mobile ? `+91 ${mobile}` : ""}</p>
      </div>

      {/* Stats */}
      <div className="pf-stats-row">
        {stats.map((s) => (
          <div key={s.label} className="pf-stat-card">
            <div className="pf-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="pf-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info fields */}
      <div className="pf-card">
        {fields.map((f, i) => (
          <div key={f.label} className="pf-field" style={{ borderBottom: i < fields.length - 1 ? "1px solid #2A2A2A" : "none" }}>
            <div className="pf-field-icon">{f.icon}</div>
            <div className="pf-field-info">
              <div className="pf-field-label">{f.label}</div>
              <div className="pf-field-value">{f.value}</div>
            </div>
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
            <button type="button" className="pf-referral-btn pf-referral-btn--qr" onClick={() => {
              const qrWin = window.open("", "_blank", "width=420,height=600");
              const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`https://vasbazaar.web.webdekho.in?code=${mobile}`)}`;
              qrWin.document.write(`<html><head><title>VasBazaar QR</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f7fa;font-family:-apple-system,sans-serif}
              .card{background:#fff;border-radius:24px;padding:32px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.1);max-width:360px;width:100%}
              .accent{height:6px;background:linear-gradient(90deg,#40E0D0,#007BFF);border-radius:3px;margin-bottom:20px}
              .brand{font-size:24px;font-weight:900;color:#1a1a2e}
              .sub{font-size:12px;color:#9ca3af;margin-top:4px}
              .qr{margin:20px auto;border:2px solid #e5e7eb;border-radius:16px;padding:16px;display:inline-block}
              .name{font-size:16px;font-weight:800;color:#1a1a2e;margin-top:12px}
              .mobile{font-size:13px;color:#6b7280}
              .ref-label{font-size:10px;font-weight:700;color:#40E0D0;text-transform:uppercase;letter-spacing:.06em;margin-top:14px}
              .ref-code{font-size:18px;font-weight:900;color:#1a1a2e;letter-spacing:1px}
              .footer{font-size:10px;color:#9ca3af;margin-top:16px}
              </style></head><body><div class="card"><div class="accent"></div><div class="brand">VasBazaar</div><div class="sub">Scan & Pay with any UPI App</div><div class="qr"><img src="${qrImg}" width="240" height="240"/></div><div class="name">${name}</div><div class="mobile">+91 ${mobile}</div><div class="ref-label">REFERRAL CODE</div><div class="ref-code">${referral}</div><div class="footer">Powered by VasBazaar</div></div></body></html>`);
              qrWin.document.close();
            }}>
              <FaQrcode size={11} /> QR
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pf-card">
        {actions.map((a, i) => (
          <div key={a.label} className={`pf-action${a.danger ? " pf-action--danger" : ""}`} onClick={a.onClick} style={{ borderBottom: i < actions.length - 1 ? "1px solid #2A2A2A" : "none" }}>
            <div className={`pf-action-icon${a.danger ? " pf-action-icon--danger" : ""}`}>{a.icon}</div>
            <span className="pf-action-label">{a.label}</span>
            <FiChevronRight size={16} color={a.danger ? "#FF3B30" : "#6B6B6B"} />
          </div>
        ))}
      </div>

      {/* Crop Modal */}
      {cropModal && (
        <div className="pf-crop-overlay">
          <div className="pf-crop-modal">
            <div className="pf-crop-header">
              <h3><FaCrop /> Crop Photo</h3>
              <button type="button" className="pf-crop-close" onClick={() => setCropModal(false)}><FaTimes /></button>
            </div>
            <div className="pf-crop-preview">
              <div className="pf-crop-circle">
                <img ref={imgRef} src={cropSrc} alt="Crop preview" className="pf-crop-img" style={{ transform: `scale(${cropPos.scale}) translate(${cropPos.x}px, ${cropPos.y}px)` }} draggable={false} />
              </div>
              <p className="pf-crop-hint">Pinch or use slider to zoom</p>
            </div>
            <div className="pf-crop-controls">
              <span className="pf-crop-zoom-label">Zoom</span>
              <input type="range" min="1" max="3" step="0.05" value={cropPos.scale} onChange={(e) => setCropPos((p) => ({ ...p, scale: parseFloat(e.target.value) }))} className="pf-crop-slider" />
            </div>
            <div className="pf-crop-actions">
              <button type="button" className="pf-crop-cancel" onClick={() => setCropModal(false)}>Cancel</button>
              <button type="button" className="pf-crop-confirm" onClick={handleCropConfirm}><FaCheck /> Upload Photo</button>
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
