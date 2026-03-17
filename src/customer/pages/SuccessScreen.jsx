import { useLocation, useNavigate } from "react-router-dom";
import { FaCheck, FaShareAlt, FaHome, FaCopy, FaReceipt, FaWallet, FaGift, FaPercent, FaTag } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";
import { useState, useEffect } from "react";

const SuccessScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state || {};
  const [copied, setCopied] = useState("");
  const [showContent, setShowContent] = useState(false);

  const txnId = data.txnId || data.statusPayload?.txnId || "--";
  const refId = data.statusPayload?.refId || data.statusPayload?.ref_id || data.statusPayload?.referenceId || "--";
  const amount = Number(data.amount || 0);
  const paymentType = String(data.paymentType || "web").toUpperCase();
  const dateTime = new Date().toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const cashback = data.statusPayload?.cashback || data.statusPayload?.cashbackAmount || data.cashbackValue || 0;
  const discount = Number(data.discountValue || 0);
  const offerType = data.offerType || null;
  const couponCode = data.couponCode || null;
  const couponName = data.couponName || null;

  // Show content after celebration animation
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(t);
  }, []);

  const copyToClipboard = (text, label) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const handleShare = () => {
    const shareText = `Payment of ₹${amount.toFixed(2)} completed successfully!\nTransaction ID: ${txnId}\nPowered by VasBazaar - Bharat Connect`;
    if (navigator.share) {
      navigator.share({ title: "Payment Successful", text: shareText });
    } else {
      copyToClipboard(shareText, "share");
    }
  };

  const COLORS = ["#40E0D0", "#007BFF", "#00C853", "#FFD700", "#FF6B6B", "#A78BFA", "#FF9800", "#06B6D4", "#F472B6", "#34D399"];

  return (
    <div className="sx-page">
      {/* ── Celebration Layer ── */}
      <div className="sx-celebration">
        {/* Confetti explosion */}
        <div className="sx-confetti">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="sx-conf-piece" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.8}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              width: `${4 + Math.random() * 10}px`,
              height: `${4 + Math.random() * 10}px`,
              borderRadius: i % 4 === 0 ? "50%" : i % 4 === 1 ? "2px" : "1px",
              background: COLORS[i % COLORS.length],
            }} />
          ))}
        </div>

        {/* Burst rings */}
        <div className="sx-rings">
          <div className="sx-ring sx-ring--1" />
          <div className="sx-ring sx-ring--2" />
          <div className="sx-ring sx-ring--3" />
        </div>

        {/* Sparkle stars */}
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={`star-${i}`} className="sx-star" style={{
            top: `${10 + Math.random() * 50}%`,
            left: `${5 + Math.random() * 90}%`,
            animationDelay: `${0.2 + Math.random()}s`,
            fontSize: `${14 + Math.random() * 18}px`,
            color: COLORS[i % COLORS.length],
          }}>✦</div>
        ))}
      </div>

      {/* ── Success Icon with pulse ── */}
      <div className="sx-icon-wrap">
        <div className="sx-icon-pulse" />
        <div className="sx-icon-pulse sx-icon-pulse--2" />
        <div className="sx-icon">
          <FaCheck />
        </div>
      </div>

      {/* ── Title ── */}
      <h1 className="sx-title">Payment Successful!</h1>
      <p className="sx-subtitle">Your transaction has been completed</p>

      {/* ── Amount ── */}
      <div className={`sx-amount-card${showContent ? " sx-in" : ""}`}>
        <div className="sx-amount-glow" />
        <div className="sx-amount-value">₹{amount.toFixed(2)}</div>

        {/* Show what was applied — cashback, discount, or coupon */}
        {offerType === "cashback" && cashback > 0 && (
          <div className="sx-offer-pill sx-offer-pill--cashback">
            <FaGift /> ₹{Number(cashback).toFixed(2)} Cashback Credited to Wallet
          </div>
        )}
        {offerType === "discount" && discount > 0 && (
          <div className="sx-offer-pill sx-offer-pill--discount">
            <FaPercent /> ₹{discount.toFixed(2)} Instant Discount Applied
          </div>
        )}
        {couponCode && (
          <div className="sx-offer-pill sx-offer-pill--coupon">
            <FaTag /> Coupon: {couponCode}{couponName ? ` — ${couponName}` : ""}
          </div>
        )}
        {!offerType && cashback > 0 && (
          <div className="sx-offer-pill sx-offer-pill--cashback">
            <FaWallet /> ₹{Number(cashback).toFixed(2)} Cashback Credited
          </div>
        )}
      </div>

      {/* ── Transaction Details Card ── */}
      <div className={`sx-details${showContent ? " sx-in sx-d1" : ""}`}>
        <div className="sx-details-header">
          <FaReceipt className="sx-details-icon" />
          <span>Transaction Details</span>
          <span className="sx-status-badge"><FaCheck /> SUCCESS</span>
        </div>

        <div className="sx-detail-row">
          <span className="sx-detail-label">Transaction ID</span>
          <span className="sx-detail-value">
            {txnId}
            <button type="button" className="sx-copy" onClick={() => copyToClipboard(txnId, "txn")}><FaCopy /></button>
          </span>
        </div>

        <div className="sx-detail-row">
          <span className="sx-detail-label">Reference ID</span>
          <span className="sx-detail-value">
            {refId}
            <button type="button" className="sx-copy" onClick={() => copyToClipboard(refId, "ref")}><FaCopy /></button>
          </span>
        </div>

        <div className="sx-detail-row">
          <span className="sx-detail-label">Payment Method</span>
          <span className="sx-detail-value">{paymentType}</span>
        </div>

        <div className="sx-detail-row">
          <span className="sx-detail-label">Date & Time</span>
          <span className="sx-detail-value">{dateTime}</span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className={`sx-actions${showContent ? " sx-in sx-d2" : ""}`}>
        <button type="button" className="sx-btn sx-btn--share" onClick={handleShare}>
          <FaShareAlt /> Share Receipt
        </button>
        <button type="button" className="sx-btn sx-btn--home" onClick={() => navigate("/customer/app/services")}>
          Go to Home <FiArrowRight />
        </button>
      </div>

      {/* Copied toast */}
      {copied && <div className="sx-toast">Copied!</div>}
    </div>
  );
};

export default SuccessScreen;
