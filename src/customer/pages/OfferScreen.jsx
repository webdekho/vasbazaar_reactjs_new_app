import { useEffect, useState, useMemo, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTag, FaGift, FaPercent, FaTimes, FaSearch, FaCheck } from "react-icons/fa";
import { FiZap, FiArrowRight } from "react-icons/fi";
import { offerService } from "../services/offerService";

const FALLBACK_LOGO = "/assets/images/Brand_favicon.png";
const handleLogoError = (e) => { e.target.onerror = null; e.target.src = FALLBACK_LOGO; };

const numberToWords = (num) => {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };
  const whole = Math.floor(num);
  const paise = Math.round((num - whole) * 100);
  let result = "Rupees " + convert(whole);
  if (paise > 0) result += " and " + convert(paise) + " Paise";
  return result + " Only";
};

const catMeta = (cat) => {
  const n = (cat?.name || cat || "").toLowerCase();
  if (n.includes("cashback")) return { icon: <FaGift />, gradient: "linear-gradient(135deg, #059669, #10b981)", type: "cashback" };
  if (n.includes("discount")) return { icon: <FaPercent />, gradient: "linear-gradient(135deg, #ea580c, #ff7a00)", type: "discount" };
  return { icon: <FaTag />, gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)", type: "coupon" };
};

/* ── Celebration Overlay ── */
const CelebrationOverlay = ({ show, message, amount }) => {
  if (!show) return null;
  const colors = ["#40E0D0", "#007BFF", "#00C853", "#FFD700", "#FF6B6B", "#A78BFA", "#FF9800", "#06B6D4"];
  return (
    <div className="celeb-overlay">
      {/* Confetti burst */}
      <div className="celeb-confetti">
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="celeb-piece" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.6}s`,
            animationDuration: `${1.5 + Math.random() * 1.5}s`,
            width: `${4 + Math.random() * 10}px`,
            height: `${4 + Math.random() * 10}px`,
            borderRadius: i % 4 === 0 ? "50%" : i % 4 === 1 ? "2px" : "0",
            background: colors[i % colors.length],
            transform: `rotate(${Math.random() * 360}deg)`,
          }} />
        ))}
      </div>
      {/* Radial burst rings */}
      <div className="celeb-rings">
        <div className="celeb-ring celeb-ring--1" />
        <div className="celeb-ring celeb-ring--2" />
        <div className="celeb-ring celeb-ring--3" />
      </div>
      {/* Center message */}
      <div className="celeb-center">
        <div className="celeb-emoji">🎉</div>
        <div className="celeb-amount">{amount}</div>
        <div className="celeb-msg">{message}</div>
      </div>
      {/* Sparkle stars */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={`s${i}`} className="celeb-star" style={{
          top: `${15 + Math.random() * 70}%`,
          left: `${5 + Math.random() * 90}%`,
          animationDelay: `${Math.random() * 0.8}s`,
          fontSize: `${12 + Math.random() * 16}px`,
        }}>✦</div>
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
  const paymentState = location.state || {};
  const [offers, setOffers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [celebration, setCelebration] = useState(null);
  // Store random discount values per offer so they don't change on re-render
  const randomValues = useRef({});

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

      const desc = (offer.description || "")
        .replace(/\{#discount#\}/g, `₹${maxDiscount.toFixed(1)}`)
        .replace(/\{#cashback#\}/g, `₹${maxDiscount.toFixed(1)}`);

      return {
        ...offer,
        maxDiscount,
        randomDiscount,
        formattedDesc: desc || `Upto ₹${maxDiscount.toFixed(1)}`,
        catName,
        offerType: meta.type, // "cashback" | "discount" | "coupon"
      };
    });
  }, [offers, amount]);

  if (!paymentState.amount) return <Navigate to="/customer/app/services" replace />;

  const triggerCelebration = (msg, amountStr) => {
    setCelebration({ message: msg, amount: amountStr });
    setTimeout(() => setCelebration(null), 3000);
  };

  const handleApply = (offer) => {
    const wasApplied = appliedOffer?.id === offer.id;
    if (wasApplied) {
      setAppliedOffer(null);
      return;
    }

    const applied = {
      ...offer,
      discountValue: offer.randomDiscount || offer.maxDiscount || offer.amount || 0,
      formattedDesc: offer.formattedDesc || offer.description,
    };
    setAppliedOffer(applied);

    // Trigger celebration
    if (offer.offerType === "cashback") {
      triggerCelebration("Cashback will be credited after payment!", `₹${applied.discountValue.toFixed(2)} Cashback`);
    } else if (offer.offerType === "discount") {
      triggerCelebration("Instant discount applied!", `₹${applied.discountValue.toFixed(2)} OFF`);
    } else {
      triggerCelebration("Coupon applied successfully!", `₹${applied.discountValue.toFixed(2)} Saved`);
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
        // For cashback, collect full amount
        amount: payableAmount > 0 ? payableAmount : amount,
      },
    });
  };

  const mainOffers = enhancedOffers.filter((o) => !o.catName.includes("other") && o.catName !== "coupons");
  const couponOffers = enhancedOffers.filter((o) => o.catName.includes("other") || o.catName === "coupons");

  return (
    <div className="off-page">
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

      {/* Sticky footer */}
      <div className="off-sticky-footer">
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
    </div>
  );
};

export default OfferScreen;
