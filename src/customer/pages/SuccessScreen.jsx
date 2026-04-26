import { useLocation, useNavigate } from "react-router-dom";
import { FaShareAlt, FaCopy, FaWallet, FaGift, FaPercent, FaTag, FaUsers, FaSyncAlt, FaTimes } from "react-icons/fa";
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
import { playSuccessSound } from "../services/audioService";

const ScratchCashbackModal = ({ open, cashbackAmount, onClose, onRevealed }) => {
  const canvasRef = useRef(null);
  const surfaceRef = useRef(null);
  const drawingRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return undefined;

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

    /* ── Rich green-gold gradient for cashback ── */
    const baseGrad = ctx.createLinearGradient(0, 0, width, height);
    baseGrad.addColorStop(0, "#0d3320");
    baseGrad.addColorStop(0.3, "#1a5d38");
    baseGrad.addColorStop(0.5, "#2d7a4a");
    baseGrad.addColorStop(0.7, "#1a5d38");
    baseGrad.addColorStop(1, "#0d3320");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    /* ── Holographic shimmer streaks ── */
    const shimmerColors = [
      "rgba(0, 255, 128, 0.15)", "rgba(255, 215, 0, 0.14)", "rgba(0, 200, 100, 0.12)",
      "rgba(255, 200, 0, 0.1)", "rgba(100, 255, 150, 0.12)", "rgba(255, 180, 50, 0.1)",
    ];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 15 + 10) * Math.PI / 180;
      const sx = -50 + (i * width / 8);
      ctx.save();
      ctx.translate(sx, 0);
      ctx.rotate(angle);
      const streak = ctx.createLinearGradient(0, 0, 40, height * 1.5);
      streak.addColorStop(0, "transparent");
      streak.addColorStop(0.4, shimmerColors[i % shimmerColors.length]);
      streak.addColorStop(0.6, shimmerColors[(i + 2) % shimmerColors.length]);
      streak.addColorStop(1, "transparent");
      ctx.fillStyle = streak;
      ctx.fillRect(0, -20, 28, height * 1.5);
      ctx.restore();
    }

    /* ── Glowing orbs ── */
    const drawGlow = (cx, cy, r, color) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    drawGlow(width * 0.2, height * 0.25, 80, "rgba(0, 255, 128, 0.18)");
    drawGlow(width * 0.8, height * 0.3, 70, "rgba(255, 215, 0, 0.16)");
    drawGlow(width * 0.5, height * 0.75, 90, "rgba(0, 200, 100, 0.14)");
    drawGlow(width * 0.15, height * 0.8, 60, "rgba(255, 200, 0, 0.12)");

    /* ── Sparkle dots ── */
    const sparkles = [
      [0.12, 0.18], [0.85, 0.15], [0.92, 0.55], [0.08, 0.72], [0.75, 0.82],
      [0.45, 0.12], [0.55, 0.88], [0.3, 0.5], [0.7, 0.45], [0.18, 0.42],
      [0.88, 0.38], [0.42, 0.65], [0.62, 0.2], [0.25, 0.85], [0.78, 0.65],
    ];
    sparkles.forEach(([sx, sy]) => {
      const x = sx * width;
      const y = sy * height;
      const size = 1.5 + Math.random() * 2.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      /* cross sparkle */
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - size * 2.5, y);
      ctx.lineTo(x + size * 2.5, y);
      ctx.moveTo(x, y - size * 2.5);
      ctx.lineTo(x, y + size * 2.5);
      ctx.stroke();
    });

    /* ── Coin burst (center) ── */
    const cx = width / 2;
    const cy = height / 2 - 8;
    const coinGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 44);
    coinGrad.addColorStop(0, "rgba(255, 215, 0, 0.4)");
    coinGrad.addColorStop(0.5, "rgba(255, 200, 0, 0.2)");
    coinGrad.addColorStop(1, "transparent");
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();

    /* Wallet icon */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(255, 215, 0, 0.8)";
    ctx.beginPath();
    ctx.roundRect(-18, -12, 36, 24, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 100, 50, 0.9)";
    ctx.beginPath();
    ctx.arc(10, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* ── Main text ── */
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255, 215, 0, 0.4)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = '900 22px "Arial", sans-serif';
    ctx.fillText("Scratch & Win", width / 2, height / 2 + 38);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    ctx.font = '600 12px "Arial", sans-serif';
    ctx.fillStyle = "rgba(200, 255, 220, 0.7)";
    ctx.fillText("Your cashback is hidden underneath", width / 2, height / 2 + 60);

    /* ── Border glow ── */
    ctx.strokeStyle = "rgba(0, 255, 128, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
      onRevealed?.();
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
    if (!drawingRef.current || revealed) return;
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
          <div className="sx-scratch-kicker sx-scratch-kicker--cashback"><FaWallet /> Cashback Unlocked</div>
          <h3 className="sx-scratch-title">Your cashback is waiting underneath</h3>
          <p className="sx-scratch-subtitle">
            Scratch the card to reveal the cashback credited to your wallet.
          </p>
        </div>

        <div className={`sx-scratch-shell${revealed ? " is-revealed" : ""}`}>
          <div ref={surfaceRef} className="sx-scratch-surface">
            <div className="sx-scratch-content sx-scratch-content--cashback">
              <div className="sx-scratch-chip sx-scratch-chip--cashback"><FaWallet /> Wallet Cashback</div>
              <div className="sx-scratch-cashback-amount">₹{Number(cashbackAmount).toFixed(2)}</div>
              <div className="sx-scratch-cashback-label">Credited to Wallet</div>
            </div>

            {!revealed && (
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
            <span>{revealed ? "Cashback revealed" : "Scratch to reveal"}</span>
            <strong>{revealed ? "100%" : `${progress}%`}</strong>
          </div>
        </div>

        <div className="sx-scratch-actions sx-scratch-actions--single">
          <button type="button" className="sx-scratch-btn sx-scratch-btn--primary sx-scratch-btn--cashback" onClick={onClose}>
            {revealed ? "Continue" : "Skip Reveal"}
          </button>
        </div>
      </div>
    </div>
  );
};

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

    /* ── Rich metallic gradient base ── */
    const baseGrad = ctx.createLinearGradient(0, 0, width, height);
    baseGrad.addColorStop(0, "#1a0533");
    baseGrad.addColorStop(0.3, "#2d1b69");
    baseGrad.addColorStop(0.5, "#1e3a5f");
    baseGrad.addColorStop(0.7, "#0d4f4f");
    baseGrad.addColorStop(1, "#1a0533");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    /* ── Holographic shimmer streaks ── */
    const shimmerColors = [
      "rgba(255, 0, 128, 0.15)", "rgba(0, 200, 255, 0.12)", "rgba(255, 215, 0, 0.14)",
      "rgba(0, 255, 170, 0.1)", "rgba(180, 100, 255, 0.12)", "rgba(255, 100, 50, 0.1)",
    ];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 15 + 10) * Math.PI / 180;
      const sx = -50 + (i * width / 8);
      ctx.save();
      ctx.translate(sx, 0);
      ctx.rotate(angle);
      const streak = ctx.createLinearGradient(0, 0, 40, height * 1.5);
      streak.addColorStop(0, "transparent");
      streak.addColorStop(0.4, shimmerColors[i % shimmerColors.length]);
      streak.addColorStop(0.6, shimmerColors[(i + 2) % shimmerColors.length]);
      streak.addColorStop(1, "transparent");
      ctx.fillStyle = streak;
      ctx.fillRect(0, -20, 28, height * 1.5);
      ctx.restore();
    }

    /* ── Glowing orbs ── */
    const drawGlow = (cx, cy, r, color) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    drawGlow(width * 0.2, height * 0.25, 80, "rgba(255, 0, 200, 0.18)");
    drawGlow(width * 0.8, height * 0.3, 70, "rgba(0, 200, 255, 0.16)");
    drawGlow(width * 0.5, height * 0.75, 90, "rgba(255, 215, 0, 0.14)");
    drawGlow(width * 0.15, height * 0.8, 60, "rgba(0, 255, 170, 0.12)");

    /* ── Sparkle dots ── */
    const sparkles = [
      [0.12, 0.18], [0.85, 0.15], [0.92, 0.55], [0.08, 0.72], [0.75, 0.82],
      [0.45, 0.12], [0.55, 0.88], [0.3, 0.5], [0.7, 0.45], [0.18, 0.42],
      [0.88, 0.38], [0.42, 0.65], [0.62, 0.2], [0.25, 0.85], [0.78, 0.65],
    ];
    sparkles.forEach(([sx, sy]) => {
      const x = sx * width;
      const y = sy * height;
      const size = 1.5 + Math.random() * 2.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      /* cross sparkle */
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - size * 2.5, y);
      ctx.lineTo(x + size * 2.5, y);
      ctx.moveTo(x, y - size * 2.5);
      ctx.lineTo(x, y + size * 2.5);
      ctx.stroke();
    });

    /* ── Coin/star burst (center) ── */
    const cx = width / 2;
    const cy = height / 2 - 8;
    const coinGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 44);
    coinGrad.addColorStop(0, "rgba(255, 215, 0, 0.35)");
    coinGrad.addColorStop(0.5, "rgba(255, 180, 0, 0.15)");
    coinGrad.addColorStop(1, "transparent");
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();

    /* Star icon */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(255, 215, 0, 0.7)";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 - 90) * Math.PI / 180;
      const ia = ((i * 72) + 36 - 90) * Math.PI / 180;
      ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.lineTo(Math.cos(ia) * 8, Math.sin(ia) * 8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    /* ── Main text ── */
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255, 215, 0, 0.4)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = '900 22px "Arial", sans-serif';
    ctx.fillText("Scratch & Win", width / 2, height / 2 + 38);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    ctx.font = '600 12px "Arial", sans-serif';
    ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
    ctx.fillText("Your reward is hidden underneath", width / 2, height / 2 + 60);

    /* ── Border glow ── */
    ctx.strokeStyle = "rgba(255, 215, 0, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, width - 12, height - 12);

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
  const [isEnablingAutoPay, setIsEnablingAutoPay] = useState(false);
  const [autopayError, setAutopayError] = useState("");
  const [showScratchReward, setShowScratchReward] = useState(false);
  const [rewardCoupon, setRewardCoupon] = useState(null);
  const [showScratchCashback, setShowScratchCashback] = useState(false);
  const [cashbackRevealed, setCashbackRevealed] = useState(false);
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
  const scratchCashbackEligible = Boolean((offerType === "cashback" || (!offerType && !couponCode && !couponName && !couponDesc)) && cashback > 0);

  useEffect(() => {
    if (data.label || data.operatorName) {
      const slug = (data.label || data.operatorName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      addRecentService({
        slug,
        name: data.label || data.operatorName || "Service",
        iconUrl: data.logo || null,
        accentColor: "#00E5A0",
      });
    }

    // Play success sonic at full volume. On native (Capacitor iOS/Android)
    // this routes through NativeAudio + AVAudioSession.playback so it plays
    // even when the silent switch is on.
    let handle;
    playSuccessSound().then((h) => { handle = h; }).catch(() => {});

    return () => {
      if (handle?.stop) handle.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!scratchCashbackEligible) return undefined;
    const timer = setTimeout(() => {
      setShowScratchCashback(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [scratchCashbackEligible]);

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

      await savePendingMandateContext({
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

  const COLORS = ["#00E5A0", "#3B82F6", "#A855F7", "#FFD700", "#FF6B6B", "#06B6D4"];
  const serviceName = data.label || data.operatorName || "Service";

  const rewardChip = (() => {
    if (offerType === "cashback" && cashback > 0) {
      if (!cashbackRevealed) return null;
      return { kicker: "Cashback Credited", value: `₹${Number(cashback).toFixed(2)} added to Wallet`, icon: <FaWallet /> };
    }
    if (offerType === "discount" && discount > 0) {
      return { kicker: "Instant Discount", value: `₹${discount.toFixed(2)} saved on this order`, icon: <FaPercent /> };
    }
    if (couponCode && !offerType && !cashback && !discount) {
      return { kicker: "Coupon Applied", value: `${couponCode}${couponName ? ` · ${couponName}` : ""}`, icon: <FaTag /> };
    }
    if (!offerType && cashback > 0) {
      if (!cashbackRevealed) return null;
      return { kicker: "Cashback Credited", value: `₹${Number(cashback).toFixed(2)} added to Wallet`, icon: <FaGift /> };
    }
    return null;
  })();

  const handleRefer = () => {
    const msg = `Earn cashback on every recharge & bill payment! Join VasBazaar using my referral code: ${userMobile}\n\nhttps://web.vasbazaar.com?code=${userMobile}`;
    if (navigator.share) { navigator.share({ title: "Join VasBazaar", text: msg }).catch(() => {}); }
    else { navigator.clipboard?.writeText(msg); setCopied("refer"); setTimeout(() => setCopied(""), 1500); }
  };

  return (
    <div className="sx2-page">
      <div className="sx2-mesh" aria-hidden>
        <div className="sx2-mesh-blob sx2-mesh-blob--a" />
        <div className="sx2-mesh-blob sx2-mesh-blob--b" />
        <div className="sx2-mesh-blob sx2-mesh-blob--c" />
        <div className="sx2-grain" />
      </div>

      <div className="sx2-confetti" aria-hidden>
        {Array.from({ length: 60 }).map((_, i) => (
          <span key={i} className="sx2-conf" style={{
            left: `${Math.random() * 100}%`,
            width: `${5 + Math.random() * 8}px`,
            height: `${8 + Math.random() * 12}px`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${Math.random() * 0.6}s`,
            animationDuration: `${2.4 + Math.random() * 1.6}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
            borderRadius: i % 3 === 0 ? "50%" : "2px",
          }} />
        ))}
      </div>

      <header className="sx2-hero">
        <div className="sx2-badge">
          <span className="sx2-badge-glow" aria-hidden />
          <svg className="sx2-check" viewBox="0 0 64 64" aria-hidden>
            <defs>
              <linearGradient id="sx2-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00E5A0" />
                <stop offset="100%" stopColor="#00B8D9" />
              </linearGradient>
            </defs>
            <circle className="sx2-check-ring" cx="32" cy="32" r="28" />
            <path className="sx2-check-path" d="M20 33 L29 42 L46 24" />
          </svg>
        </div>
        <p className="sx2-eyebrow">Payment Successful</p>
        <h1 className="sx2-amount">₹{amount.toFixed(2)}</h1>
        <p className="sx2-paid-to">
          Paid to <strong>{serviceName}</strong>
          {autopayTarget ? <> · {autopayTarget}</> : null}
        </p>
      </header>

      {rewardChip && (
        <div className="sx2-reward">
          <div className="sx2-reward-icon">{rewardChip.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sx2-reward-kicker">{rewardChip.kicker}</div>
            <div className="sx2-reward-value">{rewardChip.value}</div>
          </div>
          <div className="sx2-reward-shine" aria-hidden />
        </div>
      )}

      <section className="sx2-ticket">
        <div className="sx2-ticket-top">
          <div className="sx2-ticket-status">
            <span className="sx2-ticket-dot" aria-hidden /> Completed
          </div>
          <div className="sx2-ticket-time">{dateTime}</div>
        </div>
        <div className="sx2-perforation" aria-hidden />
        <dl className="sx2-rows">
          <div className="sx2-row">
            <dt>Transaction ID</dt>
            <dd>
              <span className="sx2-mono">{txnId}</span>
              <button type="button" className="sx2-chip-btn" aria-label="Copy transaction id" onClick={() => copyToClipboard(txnId, "txn")}>
                <FaCopy />
              </button>
            </dd>
          </div>
          <div className="sx2-row">
            <dt>Reference ID</dt>
            <dd>
              <span className="sx2-mono">{refId}</span>
              <button type="button" className="sx2-chip-btn" aria-label="Copy reference id" onClick={() => copyToClipboard(refId, "ref")}>
                <FaCopy />
              </button>
            </dd>
          </div>
          <div className="sx2-row">
            <dt>Payment Method</dt>
            <dd>{paymentType}</dd>
          </div>
          {autopayTarget && (
            <div className="sx2-row">
              <dt>{data.type === "bill" ? "Account / Bill No" : "Mobile Number"}</dt>
              <dd>{autopayTarget}</dd>
            </div>
          )}
        </dl>
      </section>

      {autopayEligible && (
        <section className="sx2-autopay">
          <div className="sx2-autopay-row">
            <div className="sx2-autopay-ic"><FaSyncAlt /></div>
            <div style={{ flex: 1 }}>
              <div className="sx2-autopay-t">Enable AutoPay</div>
              <div className="sx2-autopay-st">Recurring {data.type === "bill" ? "bill payment" : "recharge"} for {autopayTarget}</div>
            </div>
          </div>
          <p className="sx2-autopay-body">
            {data.type === "bill"
              ? "Never miss the due date. Set up a mandate once and let VasBazaar handle the next cycle."
              : "Set up recurring recharge so the next cycle is handled automatically."}
          </p>
          <button type="button" className="sx2-autopay-cta" onClick={handleEnableAutoPay} disabled={isEnablingAutoPay}>
            <FaSyncAlt className={isEnablingAutoPay ? "sx-spin" : ""} />
            {isEnablingAutoPay ? "Setting up AutoPay..." : "Enable AutoPay"}
          </button>
        </section>
      )}

      <button type="button" className="sx2-refer" onClick={handleRefer}>
        <span className="sx2-refer-glyph"><FaUsers /></span>
        <span className="sx2-refer-body">
          <strong>Refer & Earn Cashback</strong>
          <small>Friends get rewards. So do you.</small>
        </span>
        <FiArrowRight />
      </button>

      <div className="sx2-actionbar">
        <button type="button" className="sx2-act sx2-act--ghost" onClick={handleShare}>
          <FaShareAlt /> Share
        </button>
        <button type="button" className="sx2-act sx2-act--primary" onClick={() => navigate("/customer/app/services")}>
          Done <FiArrowRight />
        </button>
      </div>

      {copied && <div className="sx2-toast">{copied === "refer" ? "Referral link copied!" : "Copied!"}</div>}

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

      <ScratchCashbackModal
        open={showScratchCashback}
        cashbackAmount={cashback}
        onRevealed={() => setCashbackRevealed(true)}
        onClose={() => setShowScratchCashback(false)}
      />
    </div>
  );
};

export default SuccessScreen;
