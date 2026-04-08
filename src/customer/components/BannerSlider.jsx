import { useCallback, useEffect, useRef, useState } from "react";
import { FaTimes, FaChevronLeft, FaChevronRight, FaUserCircle } from "react-icons/fa";

// Extract dominant color from image edges using canvas
const getDominantColor = (imgEl) => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, 0, 0, 10, 10);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
  } catch {
    return null;
  }
};

const maskMobile = (mobile) => {
  if (!mobile) return "XXX XXX XXXX";
  const str = String(mobile).replace(/\D/g, "");
  const last4 = str.slice(-4);
  return `XXX XXX ${last4}`;
};

const BannerSlider = ({ banners = [], userData, balances, showCustomerCard = true }) => {
  const [current, setCurrent] = useState(0);
  const [slideBgColors, setSlideBgColors] = useState({});
  const [popupSlide, setPopupSlide] = useState(null);
  const trackRef = useRef(null);
  const touchStart = useRef(0);
  const touchDelta = useRef(0);
  const autoTimer = useRef(null);
  const isSwiping = useRef(false);

  // Build slides: customer card first, then banners
  const bannerSlides = banners.length > 0
    ? banners.map((b) => ({
        id: b.id,
        type: "banner",
        imageUrl: b.banner || b.image || b.imageUrl || null,
        title: b.title || "",
        description: b.description || "",
      }))
    : [
        { id: "d1", type: "banner", title: "Pay Bills Instantly", description: "Electricity, water, gas & more via Bharat Connect. Pay all your utility bills in seconds with guaranteed cashback on every payment.", gradient: "linear-gradient(135deg, #0B0B0B 0%, #121212 40%, #1A1A1A 100%)" },
        { id: "d2", type: "banner", title: "Recharge & Save", description: "Prepaid, DTH, broadband with exclusive cashback. Get the best deals on all your recharges and save money every time.", gradient: "linear-gradient(135deg, #0B0B0B 0%, rgba(64, 224, 208, 0.1) 50%, rgba(0, 123, 255, 0.08) 100%)" },
        { id: "d3", type: "banner", title: "Wallet Rewards", description: "Earn cashback on every payment. Auto-credited to your wallet. Refer friends and earn even more rewards!", gradient: "linear-gradient(135deg, #0B0B0B 0%, rgba(0, 200, 83, 0.08) 50%, rgba(64, 224, 208, 0.06) 100%)" },
      ];

  const slides = [
    ...(showCustomerCard ? [{ id: "customer-card", type: "customer" }] : []),
    ...bannerSlides,
  ];

  const handleImageLoad = (e, slideId) => {
    const color = getDominantColor(e.target);
    if (color) {
      setSlideBgColors((prev) => ({ ...prev, [slideId]: color }));
    }
  };

  const total = slides.length;

  const goTo = useCallback((i) => setCurrent(((i % total) + total) % total), [total]);

  // Auto-play
  useEffect(() => {
    if (total <= 1) return;
    autoTimer.current = setInterval(() => setCurrent((p) => (p + 1) % total), 4000);
    return () => clearInterval(autoTimer.current);
  }, [total]);

  const resetAuto = () => {
    clearInterval(autoTimer.current);
    if (total > 1) autoTimer.current = setInterval(() => setCurrent((p) => (p + 1) % total), 4000);
  };

  // Touch handlers for swipe
  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
    isSwiping.current = false;
    clearInterval(autoTimer.current);
  };

  const onTouchMove = (e) => {
    touchDelta.current = e.touches[0].clientX - touchStart.current;
    if (Math.abs(touchDelta.current) > 10) isSwiping.current = true;
    if (trackRef.current) {
      const offset = -(current * 100) + (touchDelta.current / trackRef.current.offsetWidth) * 100;
      trackRef.current.style.transition = "none";
      trackRef.current.style.transform = `translateX(${offset}%)`;
    }
  };

  const onTouchEnd = () => {
    const threshold = 50;
    if (trackRef.current) trackRef.current.style.transition = "";
    if (touchDelta.current < -threshold) goTo(current + 1);
    else if (touchDelta.current > threshold) goTo(current - 1);
    else goTo(current);
    resetAuto();
  };

  // Mouse drag support
  const onMouseDown = (e) => {
    e.preventDefault();
    touchStart.current = e.clientX;
    touchDelta.current = 0;
    isSwiping.current = false;
    clearInterval(autoTimer.current);

    const onMouseMove = (ev) => {
      touchDelta.current = ev.clientX - touchStart.current;
      if (Math.abs(touchDelta.current) > 10) isSwiping.current = true;
      if (trackRef.current) {
        const offset = -(current * 100) + (touchDelta.current / trackRef.current.offsetWidth) * 100;
        trackRef.current.style.transition = "none";
        trackRef.current.style.transform = `translateX(${offset}%)`;
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      const threshold = 50;
      if (trackRef.current) trackRef.current.style.transition = "";
      if (touchDelta.current < -threshold) goTo(current + 1);
      else if (touchDelta.current > threshold) goTo(current - 1);
      else goTo(current);
      resetAuto();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const pauseAuto = () => clearInterval(autoTimer.current);
  const resumeAuto = () => resetAuto();

  const goPrev = () => { goTo(current - 1); resetAuto(); };
  const goNext = () => { goTo(current + 1); resetAuto(); };

  const handleSlideClick = (slide) => {
    if (isSwiping.current) return;
    if (slide.type === "banner" && (slide.title || slide.description)) {
      setPopupSlide(slide);
      clearInterval(autoTimer.current);
    }
  };

  const closePopup = () => {
    setPopupSlide(null);
    resetAuto();
  };

  const name = userData?.name || userData?.firstName || "Customer";
  const mobile = userData?.mobile || userData?.mobileNumber || "";
  const profilePhoto = userData?.profile || userData?.profilePhoto || localStorage.getItem("profile_photo") || "";

  return (
    <>
      <div className="cm-slider" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onMouseDown={onMouseDown} onMouseEnter={pauseAuto} onMouseLeave={resumeAuto}>
        <div className="cm-slider-track" ref={trackRef} style={{ transform: `translateX(-${current * 100}%)` }}>
          {slides.map((slide) => {
            if (slide.type === "customer") {
              return (
                <div key={slide.id} className="cm-slider-slide cm-slider-slide--customer">
                  {/* Animated background layers */}
                  <div className="cmc-bg-mesh" />
                  <div className="cmc-bg-orb cmc-bg-orb--1" />
                  <div className="cmc-bg-orb cmc-bg-orb--2" />
                  <div className="cmc-bg-line" />

                  <div className="cmc-content">
                    {/* Top row: greeting + photo */}
                    <div className="cmc-header">
                      <div>
                        <div className="cmc-greeting">Welcome back</div>
                        <div className="cmc-name">{name}</div>
                        <div className="cmc-mobile-badge">
                          <span className="cmc-mobile-dot" />
                          {maskMobile(mobile)}
                        </div>
                      </div>
                      {profilePhoto && profilePhoto.startsWith("http") ? (
                        <img src={profilePhoto} alt="" className="cmc-photo" />
                      ) : (
                        <div className="cmc-avatar">
                          <FaUserCircle />
                        </div>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="cmc-stats-row">
                      <div className="cmc-stat-pill">
                        <div className="cmc-stat-label">Balance</div>
                        <div className="cmc-stat-value">
                          <span className="cmc-rupee">&#8377;</span>{balances?.wallet || "0.00"}
                        </div>
                      </div>
                      <div className="cmc-stat-divider" />
                      <div className="cmc-stat-pill">
                        <div className="cmc-stat-label">Cashback</div>
                        <div className="cmc-stat-value">
                          <span className="cmc-rupee">&#8377;</span>{balances?.cashback || "0.00"}
                        </div>
                      </div>
                      <div className="cmc-stat-divider" />
                      <div className="cmc-stat-pill">
                        <div className="cmc-stat-label">Incentives</div>
                        <div className="cmc-stat-value">
                          <span className="cmc-rupee">&#8377;</span>{balances?.incentive || "0.00"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={slide.id}
                className={`cm-slider-slide${slide.imageUrl ? " cm-slider-slide--banner" : " cm-slider-slide--text"}`}
                style={{ background: slide.imageUrl ? (slideBgColors[slide.id] || "var(--cm-bg, #0B0B0B)") : (slide.gradient || "linear-gradient(135deg, var(--cm-bg, #0B0B0B), var(--cm-card, #1A1A1A) 48%, rgba(64, 224, 208, 0.08) 100%)"), cursor: (slide.title || slide.description) ? "pointer" : "default" }}
                onClick={() => handleSlideClick(slide)}
              >
                {slide.imageUrl ? (
                  <>
                    {/**
                     * PERF FIX: Replaced duplicate <img> (same src loaded twice —
                     * once for blur bg, once for display) with a single image.
                     * The background blur effect is achieved via CSS class
                     * cm-slider-img-bg using the same image's src as background-image,
                     * set in the onLoad callback. This halves banner image downloads.
                     */}
                    <div
                      className="cm-slider-img-bg"
                      aria-hidden="true"
                      style={slideBgColors[slide.id] ? { backgroundImage: `url(${slide.imageUrl})` } : undefined}
                    />
                    <img
                      src={slide.imageUrl}
                      alt={slide.title || "Banner"}
                      className="cm-slider-img"
                      crossOrigin="anonymous"
                      onLoad={(e) => handleImageLoad(e, slide.id)}
                    />
                  </>
                ) : (
                  <div className="cm-slider-content">
                    <h2 className="cm-slider-title">{slide.title}</h2>
                    <p className="cm-slider-desc">{slide.description}</p>
                  </div>
                )}
                {(slide.title || slide.description) && (
                  <div className="cm-slider-tap-hint">Tap for details</div>
                )}
              </div>
            );
          })}
        </div>
        {slides.length > 1 && (
          <>
            <button className="cm-slider-arrow cm-slider-arrow--prev" type="button" onClick={goPrev} aria-label="Previous">
              <FaChevronLeft />
            </button>
            <button className="cm-slider-arrow cm-slider-arrow--next" type="button" onClick={goNext} aria-label="Next">
              <FaChevronRight />
            </button>
            <div className="cm-slider-dots">
              {slides.map((_, i) => (
                <button key={i} type="button" className={`cm-slider-dot${i === current ? " is-active" : ""}`}
                  onClick={() => { goTo(i); resetAuto(); }} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Banner description popup */}
      {popupSlide && (
        <div className="cm-banner-popup-overlay" onClick={closePopup}>
          <div className="cm-banner-popup" onClick={(e) => e.stopPropagation()}>
            <button className="cm-banner-popup-close" type="button" onClick={closePopup}>
              <FaTimes />
            </button>
            {popupSlide.imageUrl && (
              <div className="cm-banner-popup-img-wrap">
                <img src={popupSlide.imageUrl} alt={popupSlide.title || "Banner"} className="cm-banner-popup-img" />
              </div>
            )}
            {popupSlide.title && (
              <h3 className="cm-banner-popup-title">{popupSlide.title}</h3>
            )}
            {popupSlide.description && (
              <p className="cm-banner-popup-desc">{popupSlide.description}</p>
            )}
            <button className="cm-banner-popup-btn" type="button" onClick={closePopup}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default BannerSlider;
