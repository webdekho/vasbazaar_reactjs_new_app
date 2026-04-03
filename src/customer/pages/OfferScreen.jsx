import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTag, FaGift, FaPercent, FaTimes, FaSearch, FaCheck } from "react-icons/fa";
import { FiZap, FiArrowRight } from "react-icons/fi";
import { offerService } from "../services/offerService";
import { useTheme } from "../context/ThemeContext";

const FALLBACK_LOGO = "/assets/images/Brand_favicon.png";
const handleLogoError = (e) => { e.target.onerror = null; e.target.src = FALLBACK_LOGO; };

const catMeta = (cat) => {
  const n = (cat?.name || cat || "").toLowerCase();
  if (n.includes("cashback")) return { icon: <FaGift />, gradient: "linear-gradient(135deg, #059669, #10b981)", type: "cashback" };
  if (n.includes("discount")) return { icon: <FaPercent />, gradient: "linear-gradient(135deg, #ea580c, #ff7a00)", type: "discount" };
  return { icon: <FaTag />, gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)", type: "coupon" };
};

/* ── Celebration Overlay (Full-screen high celebration) ── */
const CelebrationOverlay = ({ show, message, amount }) => {
  if (!show) return null;
  const colors = ["#40E0D0", "#007BFF", "#00C853", "#FFD700", "#FF6B6B", "#A78BFA", "#FF9800", "#06B6D4", "#E040FB", "#00E5FF", "#76FF03", "#FF4081"];
  // Use fewer particles on mobile/Safari to avoid GPU compositing limits
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const confettiCount = isMobile ? 60 : 150;
  const starCount = isMobile ? 12 : 24;
  return (
    <div className="celeb-overlay">
      {/* Full-screen confetti rain from top */}
      <div className="celeb-confetti">
        {Array.from({ length: confettiCount }).map((_, i) => (
          <div key={i} className="celeb-piece" style={{
            left: `${Math.random() * 100}%`,
            top: `${-5 - Math.random() * 10}%`,
            animationDelay: `${Math.random() * 1.2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
            width: `${5 + Math.random() * 12}px`,
            height: `${5 + Math.random() * 12}px`,
            borderRadius: i % 5 === 0 ? "50%" : i % 5 === 1 ? "2px" : i % 5 === 2 ? "0" : "50% 0",
            background: colors[i % colors.length],
            transform: `rotate(${Math.random() * 360}deg)`,
          }} />
        ))}
      </div>
      {/* Multiple radial burst rings */}
      <div className="celeb-rings">
        <div className="celeb-ring celeb-ring--1" />
        <div className="celeb-ring celeb-ring--2" />
        <div className="celeb-ring celeb-ring--3" />
      </div>
      {/* Firework bursts at different positions */}
      {[{ t: "15%", l: "20%" }, { t: "25%", l: "75%" }, { t: "70%", l: "15%" }, { t: "65%", l: "80%" }].map((pos, fi) => (
        <div key={`fw${fi}`} className="celeb-firework" style={{ top: pos.t, left: pos.l, animationDelay: `${0.3 + fi * 0.4}s` }}>
          {Array.from({ length: 8 }).map((_, si) => (
            <div key={si} className="celeb-firework-spark" style={{
              background: colors[(fi * 3 + si) % colors.length],
              transform: `rotate(${si * 45}deg) translateY(-30px)`,
            }} />
          ))}
        </div>
      ))}
      {/* Center message */}
      <div className="celeb-center">
        <div className="celeb-emoji">{amount}</div>
        <div className="celeb-msg">{message}</div>
      </div>
      {/* Sparkle stars spread across full screen */}
      {Array.from({ length: starCount }).map((_, i) => (
        <div key={`s${i}`} className="celeb-star" style={{
          top: `${5 + Math.random() * 90}%`,
          left: `${5 + Math.random() * 90}%`,
          animationDelay: `${Math.random() * 1.5}s`,
          fontSize: `${14 + Math.random() * 22}px`,
        }}>✦</div>
      ))}
      {/* Floating emoji shower */}
      {["🎊", "🥳", "✨", "💥", "🌟", "🎊", "✨", "🥳", "💥", "🌟"].map((emoji, i) => (
        <div key={`e${i}`} className="celeb-float-emoji" style={{
          left: `${8 + i * 9}%`,
          animationDelay: `${Math.random() * 1.5}s`,
          animationDuration: `${2.5 + Math.random() * 1.5}s`,
          fontSize: `${22 + Math.random() * 18}px`,
        }}>{emoji}</div>
      ))}
    </div>
  );
};

/* ── Coupon Select Modal ── */
const CouponModal = ({ open, coupons, loading, amount, appliedId, onApply, onClose }) => {
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) { setSearch(""); document.body.style.overflow = "hidden"; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  const filtered = coupons.filter((c) => `${c.couponCode || ""} ${c.couponName || ""} ${c.description || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="off-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="off-modal">
        <div className="off-modal-handle" />
        <div className="off-modal-head">
          <div>
            <h2 className="off-modal-title">Available Coupons</h2>
            <p className="off-modal-sub">{filtered.length} coupons available</p>
          </div>
          <button type="button" className="off-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="off-modal-search">
          <FaSearch />
          <input placeholder="Search by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="off-modal-list">
          {loading ? (
            <div className="off-modal-empty"><span className="cm-contact-loading" /><p>Finding best coupons...</p></div>
          ) : filtered.length === 0 ? (
            <div className="off-modal-empty"><FaTag className="off-modal-empty-icon" /><p>No coupons found</p></div>
          ) : filtered.map((c, i) => {
            const disc = c.type === "FLAT" ? c.amount : ((c.amount || 0) / 100 * amount).toFixed(1);
            const isApplied = appliedId === c.id;
            const meta = catMeta(c.categoryId);
            return (
              <div key={c.id} className={`off-modal-coupon${isApplied ? " is-applied" : ""}`} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="off-modal-coupon-left">
                  <div className="off-modal-coupon-icon" style={{ background: meta.gradient }}>{meta.icon}</div>
                  <div>
                    <div className="off-modal-coupon-code">{c.couponCode || c.couponName}</div>
                    <div className="off-modal-coupon-save">Save ₹{disc}</div>
                    {c.couponName && c.couponCode && <div className="off-modal-coupon-name">{c.couponName}</div>}
                  </div>
                </div>
                <button type="button" className={`off-modal-coupon-btn${isApplied ? " is-applied" : ""}`} onClick={() => { onApply(c); if (!isApplied) onClose(); }}>
                  {isApplied ? <><FaCheck /> Applied</> : "Apply"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── Offer Screen ── */
const OfferScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const paymentState = location.state || {};
  const [offers, setOffers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState("");
  // Store random discount values per offer so they don't change on re-render
  const randomValues = useRef({});

  // Rate limiting: only count offer SWITCHES (changing from one offer to another)
  // First selection and deselection are free — only rapid switching is blocked
  const RATE_LIMIT_KEY = "vb_offer_switch_attempts";
  const RATE_LIMIT_MAX = 10;
  const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes

  const getAttempts = () => {
    try {
      const data = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || "{}");
      const now = Date.now();
      const valid = (data.timestamps || []).filter((t) => now - t < RATE_LIMIT_WINDOW);
      return valid;
    } catch { return []; }
  };

  const checkRateLimit = () => {
    const attempts = getAttempts();
    if (attempts.length >= RATE_LIMIT_MAX) {
      const oldestAttempt = Math.min(...attempts);
      const unlockTime = oldestAttempt + RATE_LIMIT_WINDOW;
      const minsLeft = Math.ceil((unlockTime - Date.now()) / 60000);
      setRateLimited(true);
      setRateLimitMsg(`You have exceeded the maximum number of offer changes. Please try again after ${minsLeft} minute${minsLeft !== 1 ? "s" : ""}.`);
      return false;
    }
    return true;
  };

  const recordSwitchAttempt = () => {
    const attempts = getAttempts();
    attempts.push(Date.now());
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ timestamps: attempts }));
  };

  // Check on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { checkRateLimit(); }, []);

  const amount = Number(paymentState.amount || 0);
  const mobile = paymentState.mobile || paymentState.field1 || "";
  const label = paymentState.label || "Recharge";
  const opName = paymentState.operatorName || paymentState.contactName || label;
  const logo = paymentState.logo || "";

  useEffect(() => {
    offerService.getOffers(1).then((res) => {
      setLoading(false);
      if (res.success) {
        const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
        setOffers(data);
      }
    });
  }, []);

  // Get or create a random value for an offer (persists across renders)
  const getRandomValue = (offerId, maxPercent) => {
    if (!randomValues.current[offerId]) {
      // Random between 0.01% and maxPercent
      randomValues.current[offerId] = Math.random() * maxPercent;
    }
    return randomValues.current[offerId];
  };

  const enhancedOffers = useMemo(() => {
    return offers.map((offer) => {
      const catName = (offer.categoryId?.name || "").toLowerCase();
      const meta = catMeta(offer.categoryId);
      let maxDiscount = 0;
      let randomDiscount = 0;

      if (amount > 0) {
        if (offer.type === "FLAT") {
          maxDiscount = offer.amount || 0;
          randomDiscount = maxDiscount; // Flat is fixed
        } else if (offer.type === "PERCENTAGE") {
          maxDiscount = ((offer.amount || 0) / 100) * amount;
          // System randomly decides the actual discount/cashback (up to max)
          randomDiscount = parseFloat((getRandomValue(offer.id, offer.amount || 0) / 100 * amount).toFixed(2));
        }
      }

      // Show actual max value rounded to 2 decimals, drop trailing zeros
      const displayMax = Math.round(maxDiscount * 100) / 100;
      const displayStr = displayMax % 1 === 0 ? displayMax.toFixed(0) : parseFloat(displayMax.toFixed(2)).toString();
      const desc = (offer.description || "")
        .replace(/\{#discount#\}/g, `₹${displayStr}`)
        .replace(/\{#cashback#\}/g, `₹${displayStr}`);

      return {
        ...offer,
        maxDiscount,
        randomDiscount,
        formattedDesc: desc || `Upto ₹${displayStr}`,
        catName,
        offerType: meta.type, // "cashback" | "discount" | "coupon"
      };
    });
  }, [offers, amount]);

  if (!paymentState.amount) return <Navigate to="/customer/app/services" replace />;

  const triggerCelebration = (msg, amountStr) => {
    setCelebration(null);
    // Force re-mount so animations restart fresh every time
    requestAnimationFrame(() => {
      setCelebration({ message: msg, amount: amountStr });
      setTimeout(() => setCelebration(null), 3500);
    });
  };

  const handleApply = (offer) => {
    const wasApplied = appliedOffer?.id === offer.id;

    // Deselecting current offer — always allowed, no rate limit
    if (wasApplied) {
      setAppliedOffer(null);
      return;
    }

    // Switching from one offer to another — count as a switch attempt
    if (appliedOffer) {
      if (!checkRateLimit()) return;
      recordSwitchAttempt();
    }
    // First selection (no offer was applied) — always allowed

    const meta = catMeta(offer.categoryId);
    const applied = {
      ...offer,
      offerType: offer.offerType || meta.type,
      discountValue: offer.randomDiscount || offer.maxDiscount || offer.amount || 0,
      formattedDesc: offer.formattedDesc || offer.description,
    };
    setAppliedOffer(applied);

    // Trigger celebration — show upto amount rounded to 2 decimals
    const uptoRaw = offer.maxDiscount || offer.amount || 0;
    const uptoAmount = Math.round(uptoRaw * 100) / 100;
    const uptoStr = uptoAmount % 1 === 0 ? uptoAmount.toFixed(0) : parseFloat(uptoAmount.toFixed(2)).toString();
    if (offer.offerType === "cashback") {
      triggerCelebration(`You will get cashback upto ₹${uptoStr}`, "🎉");
    } else if (offer.offerType === "discount") {
      triggerCelebration(`You will get discount upto ₹${uptoStr}`, "🎉");
    } else {
      triggerCelebration(`You will get savings upto ₹${uptoStr}`, "🎉");
    }
  };

  const handleOpenCoupons = async () => {
    setShowCouponModal(true);
    if (coupons.length === 0) {
      setCouponsLoading(true);
      const res = await offerService.getCoupons(0);
      setCouponsLoading(false);
      if (res.success) {
        const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
        setCoupons(data);
      }
    }
  };

  // For discount type: reduce amount. For cashback: collect full amount, cashback after success
  const discountAmount = appliedOffer?.offerType === "discount" ? (appliedOffer?.discountValue || 0) : 0;
  const cashbackAmount = appliedOffer?.offerType === "cashback" ? (appliedOffer?.discountValue || 0) : 0;
  const payableAmount = Math.max(0, amount - discountAmount);

  const handleProceed = () => {
    navigate("/customer/app/payment", {
      state: {
        ...paymentState,
        couponId: appliedOffer?.id || null,
        couponCode: appliedOffer?.couponCode || null,
        couponName: appliedOffer?.couponName || null,
        couponDesc: appliedOffer?.formattedDesc || null,
        discountValue: discountAmount,
        cashbackValue: cashbackAmount,
        offerType: appliedOffer?.offerType || null,
        // Always send original amount — discount/cashback applied by backend via couponId
        amount: amount,
      },
    });
  };

  const mainOffers = enhancedOffers.filter((o) => !o.catName.includes("other") && o.catName !== "coupons");
  const couponOffers = enhancedOffers.filter((o) => o.catName.includes("other") || o.catName === "coupons");

  return (
    <><div className="off-page">
        {/* Celebration animation */}
        <CelebrationOverlay show={!!celebration} message={celebration?.message} amount={celebration?.amount} />

        {/* Header */}
        <div className="off-header">
          <button className="off-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="off-header-title">{label}</h1>
          <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
        </div>

        <div className="off-body">
          {/* Compact operator + amount strip */}
          <div className="off-summary-strip off-slide" style={{ animationDelay: "0s" }}>
            <img src={logo || FALLBACK_LOGO} alt="" className="off-strip-logo" onError={handleLogoError} />
            <div className="off-strip-info">
              <div className="off-strip-name">{opName}{mobile ? ` · ${mobile}` : ""}</div>
              <div className="off-strip-sub">{label}</div>
            </div>
            <div className="off-strip-amount">₹{amount}</div>
          </div>

          {/* Offers */}
          <div className="off-offers">
            <div className="off-offers-head off-slide" style={{ animationDelay: "0.06s" }}>
              <FiZap className="off-offers-head-icon" />
              <h2>Offers for You</h2>
            </div>

            {rateLimited && (
              <div className="off-rate-limit-alert">
                <strong>Too many offer changes!</strong>
                <p>{rateLimitMsg}</p>
                <p>Please proceed to pay with your current selection.</p>
              </div>
            )}

            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="off-offer off-offer-skeleton">
                  <div className="cm-skeleton-pulse" style={{ width: 44, height: 44, borderRadius: 14 }} />
                  <div style={{ flex: 1 }}><div className="cm-skeleton-pulse" style={{ width: "55%", height: 14 }} /><div className="cm-skeleton-pulse" style={{ width: "35%", height: 12, marginTop: 6 }} /></div>
                  <div className="cm-skeleton-pulse" style={{ width: 64, height: 34, borderRadius: 10 }} />
                </div>
              ))
            ) : enhancedOffers.length === 0 ? (
              <div className="off-empty-state"><FaTag className="off-empty-icon" /><p>No offers available right now</p></div>
            ) : (
              <>
                {mainOffers.map((offer, idx) => {
                  const isApplied = appliedOffer?.id === offer.id;
                  const meta = catMeta(offer.categoryId);
                  return (
                    <div key={offer.id || idx} className={`off-offer off-slide${isApplied ? " is-applied" : ""}`} style={{ animationDelay: `${0.1 + idx * 0.05}s` }}>
                      <div className="off-offer-icon" style={{ background: meta.gradient }}>{meta.icon}</div>
                      <div className="off-offer-body">
                        <div className="off-offer-name">{offer.couponName || "Offer"}</div>
                        <div className="off-offer-desc">{offer.formattedDesc}</div>
                        {offer.offerType === "cashback" && <div className="off-offer-hint">Cashback credited after payment</div>}
                        {offer.offerType === "discount" && <div className="off-offer-hint off-offer-hint--disc">Instant discount on payment</div>}
                      </div>
                      <button type="button" className={`off-offer-btn${isApplied ? " is-applied" : ""}`} onClick={() => handleApply(offer)}>
                        {isApplied ? <><FaCheck /> Applied</> : "Apply"}
                      </button>
                    </div>
                  );
                })}

                {couponOffers.map((offer, idx) => {
                  const isDirectApplied = appliedOffer?.id === offer.id;
                  const isCouponFromModal = !isDirectApplied && appliedOffer && !mainOffers.some((o) => o.id === appliedOffer.id);
                  const isApplied = isDirectApplied || isCouponFromModal;
                  const meta = catMeta(offer.categoryId);
                  return (
                    <div key={offer.id || idx} className={`off-offer off-slide${isApplied ? " is-applied" : ""}`} style={{ animationDelay: `${0.1 + (mainOffers.length + idx) * 0.05}s` }}>
                      <div className="off-offer-icon" style={{ background: meta.gradient }}>{meta.icon}</div>
                      <div className="off-offer-body">
                        <div className="off-offer-name">{isApplied && appliedOffer?.couponName ? appliedOffer.couponName : (offer.couponName || "Coupons")}</div>
                        <div className="off-offer-desc">{isApplied && appliedOffer?.couponCode ? `Code: ${appliedOffer.couponCode}` : offer.formattedDesc}</div>
                      </div>
                      <button type="button" className={`off-offer-btn off-offer-btn--select${isApplied ? " is-applied" : ""}`} onClick={() => isApplied ? setAppliedOffer(null) : handleOpenCoupons()}>
                        {isApplied ? <><FaCheck /> Selected</> : "Select"}
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Coupon Modal */}
        <CouponModal open={showCouponModal} coupons={coupons} loading={couponsLoading} amount={amount} appliedId={appliedOffer?.id} onApply={handleApply} onClose={() => setShowCouponModal(false)} />
      </div>

      {/* Payment footer — portaled to body so position:fixed works regardless of parent transforms/animations */}
      {createPortal(
        <div className={`off-sticky-footer${theme === "light" ? " theme-light" : ""}`}>
          <div className="off-sticky-footer-inner">
            {appliedOffer && (
              <div className="off-footer-summary">
                {discountAmount > 0 && <div className="off-footer-line"><span>Instant Discount</span><span className="off-footer-green">-₹{discountAmount.toFixed(2)}</span></div>}
                {cashbackAmount > 0 && <div className="off-footer-line"><span>Cashback (after payment)</span><span className="off-footer-green">₹{cashbackAmount.toFixed(2)}</span></div>}
                <div className="off-footer-line off-footer-total"><span>You Pay</span><span>₹{payableAmount}</span></div>
              </div>
            )}
            <button type="button" className="off-proceed" onClick={handleProceed}>
              <span>Proceed to Pay ₹{payableAmount}</span>
              <FiArrowRight />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default OfferScreen;
