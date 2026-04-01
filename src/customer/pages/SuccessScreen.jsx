import { useLocation, useNavigate } from "react-router-dom";
import { FaCheck, FaShareAlt, FaCopy, FaReceipt, FaWallet, FaGift, FaPercent, FaTag, FaUsers, FaSyncAlt, FaTimes } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";
import { useCustomerModern } from "../context/CustomerModernContext";
import { useState, useEffect, useRef } from "react";
import { addRecentService } from "./ServicesScreen";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import {
  createMandate,
  getMandateReturnUrl,
  savePendingMandateContext,
} from "../services/mandateService";

const ScratchRewardModal = ({ open, couponCode, couponName, couponDesc, copied, onCopy, onClose, loading, error }) => {
  const canvasRef = useRef(null);
  const surfaceRef = useRef(null);
  const drawingRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open || loading || error) return undefined;

    setRevealed(false);
    setProgress(0);
    document.body.style.overflow = "hidden";

    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    if (!surface || !canvas) {
      return () => {
        document.body.style.overflow = "";
      };
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = surface.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width));
    const height = Math.max(220, Math.floor(rect.height));

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const coverGradient = ctx.createLinearGradient(0, 0, width, height);
    coverGradient.addColorStop(0, "#EEF2FF");
    coverGradient.addColorStop(0.5, "#C7D2FE");
    coverGradient.addColorStop(1, "#BFDBFE");
    ctx.fillStyle = coverGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    for (let index = 0; index < 7; index += 1) {
      const x = (width / 6) * index - 30;
      ctx.fillRect(x, 0, 18, height);
    }

    ctx.fillStyle = "#1E3A8A";
    ctx.font = '800 24px "Arial", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Scratch To Reveal", width / 2, height / 2 - 8);
    ctx.font = '600 13px "Arial", sans-serif';
    ctx.fillStyle = "#475569";
    ctx.fillText("Your selected coupon is hidden below", width / 2, height / 2 + 22);

    return () => {
      document.body.style.overflow = "";
    };
  }, [open, loading, error]);

  const updateRevealProgress = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let transparent = 0;
    for (let index = 3; index < pixels.length; index += 16) {
      if (pixels[index] < 30) transparent += 1;
    }
    const total = pixels.length / 16;
    const nextProgress = Math.min(100, Math.round((transparent / total) * 100));
    setProgress(nextProgress);
    if (nextProgress >= 42) {
      ctx.clearRect(0, 0, width, height);
      setRevealed(true);
    }
  };

  const scratchAtPoint = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerDown = (event) => {
    drawingRef.current = true;
    scratchAtPoint(event.clientX, event.clientY);
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current || revealed || loading || error) return;
    scratchAtPoint(event.clientX, event.clientY);
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    updateRevealProgress();
  };

  if (!open) return null;

  return (
    <div className="sx-scratch-backdrop" onClick={onClose}>
      <div className="sx-scratch-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="sx-scratch-close" onClick={onClose} aria-label="Close reward popup">
          <FaTimes />
        </button>

        <div className="sx-scratch-head">
          <div className="sx-scratch-kicker"><FaGift /> Reward Unlocked</div>
          <h3 className="sx-scratch-title">{error ? "Reward is getting ready" : "Your coupon is waiting underneath"}</h3>
          <p className="sx-scratch-subtitle">
            {error
              ? error
              : "Scratch the card to reveal the coupon you selected for this transaction."}
          </p>
        </div>

        <div className={`sx-scratch-shell${revealed ? " is-revealed" : ""}`}>
          <div ref={surfaceRef} className="sx-scratch-surface">
            {loading ? (
              <div className="sx-scratch-loading">
                <div className="sx-scratch-spinner" />
                <div className="sx-scratch-loading-title">Preparing your coupon</div>
                <div className="sx-scratch-loading-copy">We are preparing the coupon you selected for this transaction.</div>
              </div>
            ) : (
              <div className="sx-scratch-content">
                <div className="sx-scratch-chip"><FaTag /> Your Selected Coupon</div>
                <div className="sx-scratch-name">{couponName || "Coupon"}</div>
                <div className="sx-scratch-code-wrap">
                  <div className="sx-scratch-code">{couponCode || couponName || "--"}</div>
                  {couponCode && (
                    <button type="button" className="sx-scratch-copy" onClick={() => onCopy(couponCode, "coupon")}>
                      <FaCopy /> {copied === "coupon" ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
                {couponDesc && <div className="sx-scratch-description">{couponDesc}</div>}
              </div>
            )}

            {!revealed && !loading && !error && (
              <canvas
                ref={canvasRef}
                className="sx-scratch-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            )}
          </div>

          <div className="sx-scratch-progress">
            <span>{loading ? "Preparing reward" : error ? "Reward unavailable" : revealed ? "Coupon revealed" : "Scratch to reveal"}</span>
            <strong>{loading ? "..." : revealed ? "100%" : `${progress}%`}</strong>
          </div>
        </div>

        <div className="sx-scratch-actions">
          <button type="button" className="sx-scratch-btn sx-scratch-btn--ghost" onClick={() => couponCode && onCopy(couponCode, "coupon")} disabled={loading || !couponCode}>
            <FaCopy /> {copied === "coupon" ? "Copied" : "Copy Code"}
          </button>
          <button type="button" className="sx-scratch-btn sx-scratch-btn--primary" onClick={onClose}>
            {revealed ? "Continue" : loading ? "Wait" : "Skip Reveal"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SuccessScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state || {};
  const { userData } = useCustomerModern();
  const [copied, setCopied] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [isEnablingAutoPay, setIsEnablingAutoPay] = useState(false);
  const [autopayError, setAutopayError] = useState("");
  const [showScratchReward, setShowScratchReward] = useState(false);
  const [rewardCoupon, setRewardCoupon] = useState(null);
  const userMobile = userData?.mobile || userData?.mobileNumber || "";

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
  const couponDesc = data.couponDesc || null;
  const autopayTarget = String(data.field1 || data.mobile || "").trim();
  const autopayOperatorId = Number(data.operatorId || 0);
  const autopayValidity = Number.parseInt(String(data.validity || "").replace(/\D/g, ""), 10) || 30;
  const autopayEligible = Boolean(autopayTarget && autopayOperatorId && amount > 0);
  const autopayType = data.type === "bill" ? "bill" : "mobileRecharge";
  const scratchRewardEligible = Boolean((offerType === "coupon" || (!offerType && (couponCode || couponName || couponDesc))) && (couponCode || couponName || couponDesc));

  // Show content after celebration animation + save recent service
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 800);
    // Save the service to recent quick access
    if (data.label || data.operatorName) {
      const slug = (data.label || data.operatorName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      addRecentService({
        slug,
        name: data.label || data.operatorName || "Service",
        iconUrl: data.logo || null,
        accentColor: "#40E0D0",
      });
    }
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!scratchRewardEligible) return undefined;
    const timer = setTimeout(() => {
      // Use the selected coupon data passed through navigation state
      // instead of fetching a generic reward coupon from the API
      setRewardCoupon({
        couponCode: couponCode || null,
        couponName: couponName || null,
        couponDesc: couponDesc || null,
      });
      setShowScratchReward(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [scratchRewardEligible, couponCode, couponName, couponDesc]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const handleShare = async () => {
    const shareText = `Payment of ₹${amount.toFixed(2)} completed successfully!\nTransaction ID: ${txnId}\nReference ID: ${refId}\nDate: ${dateTime}\n\nPowered by VasBazaar - Bharat Connect`;
    const shareUrl = "https://web.vasbazaar.com";

    // Use Capacitor Share for native apps
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: "Transaction Successful",
          text: shareText,
          url: shareUrl,
          dialogTitle: "Share Payment Receipt",
        });
        return;
      } catch (e) {
        console.log("Native share error:", e);
      }
    }

    // Web: use navigator.share or WhatsApp fallback
    if (navigator.share) {
      try {
        await navigator.share({ title: "Transaction Successful", text: shareText, url: shareUrl });
        return;
      } catch (e) {
        console.log("Web share error:", e);
      }
    }

    // Final fallback: open WhatsApp
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`, "_blank");
  };

  const handleEnableAutoPay = async () => {
    if (!autopayEligible || isEnablingAutoPay) return;

    setIsEnablingAutoPay(true);
    setAutopayError("");

    const executionDay = new Date().getDate();
    const mandatePayload = {
      returnUrl: getMandateReturnUrl(),
      billNo: autopayTarget,
      operatorId: autopayOperatorId,
      field1: data.field1 || autopayTarget,
      executionDay,
      amount: amount.toFixed(2),
      validity: autopayType === "mobileRecharge" ? autopayValidity : 60,
      mandateType: autopayType,
    };

    try {
      const response = await createMandate(mandatePayload);

      if (!response.success) {
        setAutopayError(response.message || "Failed to start AutoPay setup.");
        setIsEnablingAutoPay(false);
        return;
      }

      const paymentLink =
        response?.data?.paymentLink ||
        response?.data?.rawResponse?.payment_links?.web ||
        response?.raw?.data?.paymentLink ||
        response?.raw?.data?.rawResponse?.payment_links?.web;

      const orderId =
        response?.data?.mandateCustomerId ||
        response?.data?.rawResponse?.order_id ||
        response?.raw?.data?.mandateCustomerId ||
        response?.raw?.data?.rawResponse?.order_id ||
        null;

      savePendingMandateContext({
        orderId,
        mandateCustomerId: response?.data?.mandateCustomerId || response?.raw?.data?.mandateCustomerId || null,
        type: autopayType,
        target: autopayTarget,
        amount,
        operatorId: autopayOperatorId,
        operatorName: data.operatorName || data.label || "",
        txnId,
      });

      if (paymentLink) {
        window.location.href = paymentLink;
        return;
      }

      setAutopayError("AutoPay setup link was not received. Please try again.");
      setIsEnablingAutoPay(false);
    } catch (error) {
      setAutopayError(error.message || "Unable to enable AutoPay right now.");
      setIsEnablingAutoPay(false);
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
      <h1 className="sx-title">Transaction Successful!</h1>
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
        {couponCode && !offerType && !cashback && !discount && (
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

        {autopayTarget && (
          <div className="sx-detail-row">
            <span className="sx-detail-label">{data.type === "bill" ? "Account / Bill No" : "Mobile Number"}</span>
            <span className="sx-detail-value">{autopayTarget}</span>
          </div>
        )}

        <div className="sx-detail-row">
          <span className="sx-detail-label">Date & Time</span>
          <span className="sx-detail-value">{dateTime}</span>
        </div>
      </div>

      {autopayEligible && (
        <div className={`sx-autopay-card${showContent ? " sx-in sx-d2" : ""}`}>
          <div className="sx-autopay-head">
            <div className="sx-autopay-icon"><FaSyncAlt /></div>
            <div>
              <div className="sx-autopay-title">Enable AutoPay</div>
              <div className="sx-autopay-subtitle">Turn this {data.type === "bill" ? "bill payment" : "recharge"} into a recurring payment.</div>
            </div>
          </div>
          <div className="sx-autopay-copy">
            {data.type === "bill"
              ? "Never miss the due date. Set up a mandate once and let VasBazaar handle the next cycle."
              : "Set up recurring recharge for this number so the next cycle is handled automatically."}
          </div>
          <button type="button" className="sx-autopay-btn" onClick={handleEnableAutoPay} disabled={isEnablingAutoPay}>
            <FaSyncAlt className={isEnablingAutoPay ? "sx-spin" : ""} /> {isEnablingAutoPay ? "Setting up AutoPay..." : "Enable AutoPay"}
          </button>
        </div>
      )}

      {/* ── Actions ── */}
      <div className={`sx-actions${showContent ? " sx-in sx-d3" : ""}`}>
        <button type="button" className="sx-btn sx-btn--share" onClick={handleShare}>
          <FaShareAlt /> Share
        </button>
        <button type="button" className="sx-btn sx-btn--home" onClick={() => navigate("/customer/app/services")}>
          Home <FiArrowRight />
        </button>
      </div>

      {/* ── Refer Button ── */}
      <button type="button" className={`sx-refer-btn${showContent ? " sx-in sx-d3" : ""}`} onClick={() => {
        const msg = `Earn cashback on every recharge & bill payment! Join VasBazaar using my referral code: ${userMobile}\n\nhttps://web.vasbazaar.com?code=${userMobile}`;
        if (navigator.share) { navigator.share({ title: "Join VasBazaar", text: msg }).catch(() => {}); }
        else { navigator.clipboard?.writeText(msg); setCopied("refer"); setTimeout(() => setCopied(""), 1500); }
      }}>
        <FaUsers /> Refer & Earn Cashback
      </button>

      {/* Copied toast */}
      {copied && <div className="sx-toast">{copied === "refer" ? "Referral link copied!" : "Copied!"}</div>}

      {(isEnablingAutoPay || autopayError) && (
        <div className="sx-modal-backdrop" onClick={() => { if (!isEnablingAutoPay) setAutopayError(""); }}>
          <div className="sx-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className={`sx-modal-icon${autopayError ? " is-error" : ""}`}>
              {autopayError ? <FaTimes /> : <FaSyncAlt className="sx-spin" />}
            </div>
            <h3 className="sx-modal-title">{autopayError ? "AutoPay Setup Failed" : "Setting up AutoPay"}</h3>
            <p className="sx-modal-text">
              {autopayError || "Please wait while we create your AutoPay mandate and redirect you to complete the setup."}
            </p>
            {autopayError && (
              <button type="button" className="sx-modal-btn" onClick={() => setAutopayError("")}>
                Close
              </button>
            )}
          </div>
        </div>
      )}

      <ScratchRewardModal
        open={showScratchReward}
        couponCode={rewardCoupon?.couponCode || null}
        couponName={rewardCoupon?.couponName || null}
        couponDesc={rewardCoupon?.couponDesc || null}
        copied={copied}
        onCopy={copyToClipboard}
        onClose={() => setShowScratchReward(false)}
        loading={false}
        error=""
      />
    </div>
  );
};

export default SuccessScreen;
