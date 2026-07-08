import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaMinus, FaTrash, FaStore, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { userService } from "../../services/userService";
import { FaWallet, FaArrowRight, FaMoneyBillWave, FaLock } from "react-icons/fa";
import { useMarketplaceCart, addOnPerUnit } from "../../context/MarketplaceCartContext";
import { useCustomerModern } from "../../context/CustomerModernContext";
import { savePaymentContext, extractPaymentUrl } from "../../services/juspayService";
import { customerStorage } from "../../services/storageService";
import { Capacitor } from "@capacitor/core";
import "./marketplace.css";

const buildMarketplaceReturnUrl = () => {
  if (Capacitor.isNativePlatform()) return "vasbazaar://payment-callback?flow=marketplace";
  const origin = window.location.origin;
  const path = window.location.pathname;
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/marketplace/payment-callback`;
};

// Haversine distance in km between two lat/lng points
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Average delivery rider speed (km/h) used to convert distance into travel time.
const AVG_DELIVERY_SPEED_KMH = 22;

// Named delivery presets (feature 7). Pure display labels sent as `deliveryPreset`
// alongside the existing scheduling fields the client already computes — the
// backend stores the string verbatim and derives NO scheduling from it.
const DELIVERY_PRESETS = ["Express", "Same Day", "Tomorrow", "Morning", "Afternoon", "Evening"];
const pad2 = (n) => String(n).padStart(2, "0");
const localDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Totals for a single store bucket — mirrors the per-store math the cart
// context uses when aggregating, so a single-store checkout stays correct even
// when other stores' items also sit in the cart.
const bucketTotals = (b) => {
  if (!b || !b.items) return { count: 0, subtotal: 0, total: 0, deliveryCharges: 0 };
  const lines = Object.values(b.items);
  const subtotal = lines.reduce((s, i) => s + (Number(i.price) + addOnPerUnit(i)) * Number(i.qty || 0), 0);
  const count = lines.reduce((s, i) => s + (i.qty || 0), 0);
  const deliveryCharges = subtotal > 0 ? Number(b.deliveryCharges || 0) : 0;
  return { count, subtotal, total: subtotal + deliveryCharges, deliveryCharges };
};

const CartScreen = () => {
  const navigate = useNavigate();
  const { cart: rawCart, totals: globalTotals, addItem, decrementItem, removeItem, clearCart, lineKeyOf } = useMarketplaceCart();
  const [searchParams] = useSearchParams();
  const { userData } = useCustomerModern();

  // The cart context exposes either a single-store bucket, or, when items from
  // several stores coexist, { multi: true, storeList }. This screen checks out
  // one store at a time, so resolve the active bucket from the ?store= param.
  const activeStoreId = searchParams.get("store");
  const activeBucket = rawCart && rawCart.multi
    ? (rawCart.storeList || []).find((b) => String(b.storeId) === String(activeStoreId)) || null
    : rawCart;
  const needsStorePick = !!(rawCart && rawCart.multi && !activeBucket);
  // Downstream code treats `cart`/`totals` as a single store; substitute the
  // active bucket and its per-store totals so the rich single-store flow works.
  const cart = activeBucket;
  const totals = (rawCart && rawCart.multi) ? bucketTotals(activeBucket) : globalTotals;

  const [step, setStep] = useState("cart"); // cart | checkout
  // Multi-store cart: which checkout style the shopper picked.
  // null = not chosen yet, "separate" = pick one store at a time.
  const [multiChoice, setMultiChoice] = useState(null);
  const [address, setAddress] = useState("");
  // Structured delivery address for Shiprocket courier shipments.
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [coords, setCoords] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placingMethod, setPlacingMethod] = useState(null); // "ONLINE" | "COD" | "WALLET"
  const [walletBalance, setWalletBalance] = useState(null); // null until loaded
  const [error, setError] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [storeCoords, setStoreCoords] = useState(() =>
    cart && cart.storeLatitude != null && cart.storeLongitude != null
      ? { lat: Number(cart.storeLatitude), lng: Number(cart.storeLongitude) }
      : null
  );

  // Fulfillment (Click & Collect): DELIVERY | PICKUP. Default to delivery.
  const [fulfillmentType, setFulfillmentType] = useState("DELIVERY");
  // Whether the store supports pickup/delivery. The cart metadata may not
  // carry these flags, so we fetch the store on mount (see effect below).
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);

  // Delivery timing: NOW (deliver immediately) | SCHEDULE (one-time future) |
  // SUBSCRIBE (recurring auto-order).
  const [deliveryMode, setDeliveryMode] = useState("NOW");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  // Named delivery preset label (feature 7) carried alongside the computed
  // schedule fields; null = shopper is on the raw NOW/SCHEDULE controls.
  const [deliveryPreset, setDeliveryPreset] = useState(null);
  // Subscription config.
  const [subFrequency, setSubFrequency] = useState("DAILY"); // DAILY | WEEKLY | MONTHLY | INTERVAL
  const [subDays, setSubDays] = useState([]); // ["MON", ...] for WEEKLY
  const [subInterval, setSubInterval] = useState(15); // gap in days for INTERVAL
  const [subAnchor, setSubAnchor] = useState("TODAY"); // TODAY | START — anchor for INTERVAL
  const [subTime, setSubTime] = useState("09:00");
  const [subStartDate, setSubStartDate] = useState("");
  const [subEndDate, setSubEndDate] = useState("");
  const [subPayMethod, setSubPayMethod] = useState("WALLET"); // WALLET | COD | AUTOPAY
  const [creatingSub, setCreatingSub] = useState(false);
  // Store-defined delivery slots (shown in schedule + subscribe).
  const [deliverySlots, setDeliverySlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");

  // Pharmacy: any cart line flagged requiresPrescription forces a prescription
  // image upload before the order can be placed (pure gate — no money math).
  const [prescriptionUrl, setPrescriptionUrl] = useState("");
  const [rxUploading, setRxUploading] = useState(false);

  // Gift purchase: pack as a gift + optional message (≤300 chars).
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  // Wave 4: protection / financing INTENT capture (money-neutral — no charge).
  const [warrantyMonths, setWarrantyMonths] = useState("");
  const [amcOpted, setAmcOpted] = useState(false);
  const [emiSelected, setEmiSelected] = useState("");
  const [insuranceOpted, setInsuranceOpted] = useState(false);

  // Offers / coupons.
  const [offers, setOffers] = useState([]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedOffer, setAppliedOffer] = useState(null); // { code, discount }
  const [couponError, setCouponError] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Load available offers for the store on mount.
  useEffect(() => {
    if (!cart) return;
    let cancelled = false;
    marketplaceService.getStoreOffers(cart.storeId).then((res) => {
      if (cancelled || !res?.success || !Array.isArray(res.data)) return;
      setOffers(res.data);
    });
    return () => { cancelled = true; };
  }, [cart]);

  // Load store-defined delivery slots on mount.
  useEffect(() => {
    if (!cart) return;
    let cancelled = false;
    marketplaceService.getStoreDeliverySlots(cart.storeId).then((res) => {
      if (cancelled || !res?.success || !Array.isArray(res.data)) return;
      setDeliverySlots(res.data);
    });
    return () => { cancelled = true; };
  }, [cart]);

  const isPickup = fulfillmentType === "PICKUP";

  // Fetch store coords if we don't have them in the cart (older carts may
  // have been started before lat/lng were captured).
  useEffect(() => {
    if (!cart || storeCoords) return;
    let cancelled = false;
    marketplaceService.getStore(cart.storeId).then((res) => {
      if (cancelled || !res?.success || !res.data) return;
      const lat = res.data.latitude;
      const lng = res.data.longitude;
      if (lat != null && lng != null) {
        setStoreCoords({ lat: Number(lat), lng: Number(lng) });
      }
    });
    return () => { cancelled = true; };
  }, [cart, storeCoords]);

  // Fetch store fulfillment flags on mount. The cart's store metadata may not
  // include deliveryEnabled/pickupEnabled, so pull them from the store record.
  // (Separate from the coords effect because that one is skipped once coords
  // are already known from the cart.)
  useEffect(() => {
    if (!cart) return;
    let cancelled = false;
    marketplaceService.getStore(cart.storeId).then((res) => {
      if (cancelled || !res?.success || !res.data) return;
      const d = res.data;
      if (d.pickupEnabled != null) setPickupEnabled(!!d.pickupEnabled);
      if (d.deliveryEnabled != null) setDeliveryEnabled(!!d.deliveryEnabled);
      // If only pickup is supported, default the toggle to pickup.
      if (d.deliveryEnabled === false && d.pickupEnabled) {
        setFulfillmentType("PICKUP");
      }
    });
    return () => { cancelled = true; };
  }, [cart]);

  // Reverse geocode the captured coordinates into a readable address using
  // OpenStreetMap Nominatim. Free, no API key — but please be polite with usage.
  useEffect(() => {
    if (!coords) { setResolvedAddress(null); return; }
    let cancelled = false;
    setResolving(true);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`;
    fetch(url, { headers: { "Accept": "application/json" } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        const a = data.address || {};
        const parts = [
          a.house_number,
          a.road || a.pedestrian || a.neighbourhood,
          a.suburb || a.village || a.town || a.city_district,
          a.city || a.town || a.village,
          a.state,
          a.postcode,
        ].filter(Boolean);
        const pretty = parts.length ? parts.join(", ") : data.display_name;
        setResolvedAddress(pretty || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [coords]);

  // Load wallet balance once the customer reaches checkout, so we can show the
  // available balance and gate the Pay-from-wallet button.
  useEffect(() => {
    if (step !== "checkout" || walletBalance !== null) return;
    let alive = true;
    (async () => {
      try {
        const res = await userService.getUserProfile();
        const bal = parseFloat(res?.data?.balance ?? res?.data?.walletBalance ?? 0);
        if (alive) setWalletBalance(isNaN(bal) ? 0 : bal);
      } catch {
        if (alive) setWalletBalance(0);
      }
    })();
    return () => { alive = false; };
  }, [step, walletBalance]);

  // Compute estimated delivery: preparation time (from store profile) +
  // travel time derived from distance between customer and store.
  const eta = (() => {
    const prep = Number(cart?.deliveryTimeMinutes || 0);
    if (!coords || !storeCoords) {
      return { distanceKm: null, prep, travel: null, min: prep || null, max: prep ? prep + 10 : null };
    }
    const distanceKm = haversineKm(coords.lat, coords.lng, storeCoords.lat, storeCoords.lng);
    const travel = Math.max(2, Math.round((distanceKm / AVG_DELIVERY_SPEED_KMH) * 60));
    const total = prep + travel;
    // Show a 10-min window for realism
    return { distanceKm, prep, travel, min: total, max: total + 10 };
  })();

  const formatDistance = (km) => {
    if (km == null) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(km < 10 ? 1 : 0)} km`;
  };

  // Apply the entered coupon code by validating it against the current
  // subtotal. On success we store { code, discount }; otherwise show message.
  const applyCoupon = async (codeArg) => {
    const code = String(codeArg ?? couponCode).trim();
    if (!code) { setCouponError("Enter a coupon code"); return; }
    if (validatingCoupon) return;
    setCouponError(null);
    setValidatingCoupon(true);
    const res = await marketplaceService.validateOffer({
      storeId: cart.storeId,
      code,
      subtotal: totals.subtotal,
    });
    setValidatingCoupon(false);
    if (!res.success) {
      setCouponError(res.message || "Couldn't validate coupon");
      return;
    }
    const d = res.data || {};
    if (d.valid) {
      setAppliedOffer({ code: d.code || code, discount: Number(d.discount || 0) });
      setCouponCode(d.code || code);
      setCouponError(null);
    } else {
      setAppliedOffer(null);
      setCouponError(d.message || "Coupon not applicable");
    }
  };

  const removeCoupon = () => {
    setAppliedOffer(null);
    setCouponCode("");
    setCouponError(null);
  };

  const tapOfferChip = (offer) => {
    setCouponCode(offer.code);
    applyCoupon(offer.code);
  };

  // Multiple stores in the cart and none selected yet → let the shopper choose
  // how to check out: one combined payment (we split the money to each seller),
  // or one store at a time as separate orders.
  if (needsStorePick) {
    const grand = globalTotals;
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => (multiChoice ? setMultiChoice(null) : navigate(-1))}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Your cart</h1>
        </div>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, color: "var(--cm-muted)" }}>
          You have items from {rawCart.storeList.length} stores.
          {multiChoice === "separate" ? " Pick a store to check out — each is a separate order." : " How would you like to pay?"}
        </div>

        {multiChoice == null ? (
          /* Step 1 — choose checkout style */
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "10px 14px 20px" }}>
            <button
              type="button"
              onClick={() => navigate("/customer/app/marketplace/checkout-all")}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                padding: 16, borderRadius: 16, border: "1px solid var(--cm-accent, #007BFF)",
                background: "var(--cm-card)", cursor: "pointer", width: "100%",
              }}
            >
              <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(0,123,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--cm-accent, #007BFF)" }}>
                <FaWallet />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--cm-ink)" }}>Single order — pay once</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--cm-muted)" }}>
                  Pay ₹{grand.subtotal.toFixed(0)}+ together; we split it to each seller.
                </span>
              </span>
              <FaArrowRight color="var(--cm-accent, #007BFF)" />
            </button>

            <button
              type="button"
              onClick={() => setMultiChoice("separate")}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                padding: 16, borderRadius: 16, border: "1px solid var(--cm-line)",
                background: "var(--cm-card)", cursor: "pointer", width: "100%",
              }}
            >
              <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--cm-line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--cm-muted)" }}>
                <FaStore />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--cm-ink)" }}>Order each store separately</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--cm-muted)" }}>
                  Check out one store at a time as separate orders.
                </span>
              </span>
              <FaArrowRight color="var(--cm-muted)" />
            </button>
          </div>
        ) : (
          /* Step 2 (separate) — pick a store */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 14px 20px" }}>
            {rawCart.storeList.map((b) => {
              const t = bucketTotals(b);
              return (
                <button
                  key={b.storeId}
                  type="button"
                  onClick={() => navigate(`/customer/app/marketplace/cart?store=${b.storeId}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                    padding: 14, borderRadius: 14, border: "1px solid var(--cm-line)",
                    background: "var(--cm-card)", cursor: "pointer", width: "100%",
                  }}
                >
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cm-line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--cm-muted)" }}>
                    <FaStore />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{b.storeName}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--cm-muted)" }}>
                      {t.count} item{t.count !== 1 ? "s" : ""} · ₹{t.subtotal.toFixed(0)}
                    </span>
                  </span>
                  <FaArrowRight color="var(--cm-muted)" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!cart || totals.count === 0) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Cart</h1>
        </div>
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaStore /></div>
          <div>Your cart is empty</div>
          <button
            className="mkt-btn mkt-btn--primary"
            onClick={() => navigate("/customer/app/marketplace")}
            style={{ width: "auto", padding: "10px 24px", marginTop: 12 }}
          >
            Browse stores
          </button>
        </div>
      </div>
    );
  }

  const items = Object.values(cart.items || {});
  const minOrder = Number(cart.minOrderValue || 0);
  const belowMin = totals.subtotal < minOrder;

  // Pickup has no delivery charge. Any extra order charge (packing, taxes…) is
  // whatever the cart's total adds on top of subtotal + delivery.
  const orderCharge = Math.max(0, totals.total - totals.subtotal - totals.deliveryCharges);
  const effectiveDelivery = isPickup ? 0 : totals.deliveryCharges;
  const discount = appliedOffer ? Number(appliedOffer.discount || 0) : 0;
  const payTotal = Math.max(0, totals.subtotal + effectiveDelivery + orderCharge - discount);

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* silently ignore */ },
      { timeout: 5000 }
    );
  };

  const proceedToCheckout = () => {
    if (belowMin) return;
    // Prefill address fields from the last successful order if the user
    // hasn't entered anything in this session yet.
    const saved = customerStorage.getMarketplaceAddress();
    if (saved) {
      if (!address && saved.address) setAddress(saved.address);
      if (!coords && saved.coords) setCoords(saved.coords);
      if (!resolvedAddress && saved.resolvedAddress) setResolvedAddress(saved.resolvedAddress);
      if (!pincode && saved.pincode) setPincode(saved.pincode);
      if (!city && saved.city) setCity(saved.city);
      if (!stateName && saved.state) setStateName(saved.state);
    }
    if (!coords && !(saved && saved.coords)) captureLocation();
    setStep("checkout");
  };

  const itemsPayload = () =>
    items.map((i) => ({
      itemId: i.id,
      quantity: i.qty,
      ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
      // Per-line customization captured on the product sheet (cake message/photo).
      ...(i.note ? { note: i.note } : {}),
      ...(i.noteImageUrl ? { imageUrl: i.noteImageUrl } : {}),
      // Wave 4: chosen add-on service CODES only — server re-prices authoritatively.
      ...(Array.isArray(i.addOns) && i.addOns.length ? { addOns: i.addOns.map((a) => a.code) } : {}),
    }));

  // Pharmacy gate: does any line require a prescription?
  const needsPrescription = items.some((i) => i.requiresPrescription);

  const handlePrescriptionUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Prescription image must be under 5 MB"); return; }
    setError(null);
    setRxUploading(true);
    const res = await marketplaceService.uploadImage(file, "item");
    setRxUploading(false);
    if (res.success && res.data?.url) setPrescriptionUrl(res.data.url);
    else setError(res.message || "Prescription upload failed");
  };

  const hasSlots = deliverySlots.length > 0;
  const selectedSlot = () => deliverySlots.find((s) => String(s.id) === String(selectedSlotId)) || null;
  const slotTime = (s) => (s?.startTime ? String(s.startTime).slice(0, 5) : "");

  // Slots whose days include the chosen date's weekday (null days = every day).
  const slotsForDate = (dateStr) => {
    if (!dateStr) return deliverySlots;
    const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(`${dateStr}T00:00`).getDay()];
    return deliverySlots.filter((s) => !s.daysOfWeek || s.daysOfWeek.split(",").includes(dow));
  };

  // For SCHEDULE mode: combined ISO local date-time (yyyy-MM-ddTHH:mm).
  const scheduledForIso = () => {
    if (deliveryMode !== "SCHEDULE" || !scheduleDate) return null;
    const slot = selectedSlot();
    const time = slot ? slotTime(slot) : scheduleTime;
    return time ? `${scheduleDate}T${time}` : null;
  };

  // Apply a named delivery preset: it just drives the EXISTING scheduling
  // controls (mode / date / time / slot) — no new delivery or refund logic.
  // "Express" = deliver now; the rest schedule a date+time window and, when the
  // store defines slots, auto-pick the first slot that fits.
  const applyPreset = (preset) => {
    setError(null);
    setDeliveryPreset(preset);
    const now = new Date();
    if (preset === "Express") {
      setDeliveryMode("NOW");
      setScheduleDate(""); setScheduleTime(""); setSelectedSlotId("");
      return;
    }
    setDeliveryMode("SCHEDULE");
    const target = new Date(now);
    let timeStr;
    if (preset === "Same Day") {
      target.setTime(now.getTime() + 2 * 60 * 60 * 1000); // ~2h out, still today-ish
      timeStr = `${pad2(target.getHours())}:${pad2(target.getMinutes())}`;
    } else if (preset === "Tomorrow") {
      target.setDate(target.getDate() + 1);
      timeStr = "10:00";
    } else {
      // Morning / Afternoon / Evening — today if the window hasn't passed, else tomorrow.
      const hour = preset === "Morning" ? 9 : preset === "Afternoon" ? 14 : 18;
      if (now.getHours() >= hour) target.setDate(target.getDate() + 1);
      timeStr = `${pad2(hour)}:00`;
    }
    const dStr = localDateStr(target);
    setScheduleDate(dStr);
    setScheduleTime(timeStr);
    if (deliverySlots.length > 0) {
      const daySlots = slotsForDate(dStr);
      const pick = daySlots.find((s) => slotTime(s) >= timeStr) || daySlots[0] || null;
      setSelectedSlotId(pick ? String(pick.id) : "");
    } else {
      setSelectedSlotId("");
    }
  };

  const placeOrder = async (method = "ONLINE") => {
    if (placing) return;
    // Delivery requires an address; pickup does not (collect from store).
    if (!isPickup && !address.trim()) { setError("Please enter delivery address"); return; }
    if (!isPickup && pincode.length !== 6) { setError("Please enter a valid 6-digit delivery pincode"); return; }
    if (deliveryMode === "SCHEDULE") {
      if (!scheduleDate) { setError("Pick a delivery date"); return; }
      if (hasSlots && !selectedSlotId) { setError("Pick a delivery slot"); return; }
      if (!hasSlots && !scheduleTime) { setError("Pick a delivery time"); return; }
      const iso = scheduledForIso();
      if (!iso || new Date(iso) <= new Date()) { setError("Scheduled time must be in the future"); return; }
    }
    const orderMobile = String(userData?.mobile || userData?.mobileNumber || "").trim();
    if (!orderMobile || !/^\d{10}$/.test(orderMobile)) {
      setError("Your account mobile is missing. Please re-login and try again.");
      return;
    }
    if (needsPrescription && !prescriptionUrl) {
      setError("This order contains medicines — please upload a prescription photo before placing it.");
      return;
    }
    if (isGift && giftMessage.length > 300) {
      setError("Gift message can be at most 300 characters.");
      return;
    }
    setError(null);
    setPlacing(true);
    setPlacingMethod(method);

    const payload = {
      storeId: cart.storeId,
      items: itemsPayload(),
      deliveryAddress: isPickup ? "" : address.trim(),
      ...(isPickup ? {} : { deliveryPincode: pincode, deliveryCity: city.trim(), deliveryState: stateName.trim() }),
      contactMobile: orderMobile,
      paymentMethod: method,
      fulfillmentType,
      ...(needsPrescription && prescriptionUrl ? { prescriptionUrl } : {}),
      ...(isGift ? { isGift: true, ...(giftMessage.trim() ? { giftMessage: giftMessage.trim().slice(0, 300) } : {}) } : {}),
      // Wave 4 protection/financing INTENT — captured on the order, no charge change.
      ...(warrantyMonths ? { warrantyMonths: Number(warrantyMonths) } : {}),
      ...(amcOpted ? { amcOpted: true } : {}),
      ...(emiSelected ? { emiSelected } : {}),
      ...(insuranceOpted ? { insuranceOpted: true } : {}),
      ...(appliedOffer?.code ? { offerCode: appliedOffer.code } : {}),
      ...(method === "ONLINE" ? { returnUrl: buildMarketplaceReturnUrl() } : {}),
      ...(coords && !isPickup ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {}),
      ...(scheduledForIso() ? { scheduledFor: scheduledForIso() } : {}),
      ...(deliveryMode === "SCHEDULE" && selectedSlotId ? { deliverySlotId: Number(selectedSlotId) } : {}),
      // Pure display label (feature 7) — persisted verbatim; drives no scheduling.
      ...(!isPickup && deliveryPreset ? { deliveryPreset } : {}),
    };

    const res = await marketplaceService.placeOrder(payload);
    setPlacing(false);
    setPlacingMethod(null);

    if (!res.success) {
      setError(res.message || "Failed to place order");
      return;
    }
    const { orderId, orderNo, totalAmount } = res.data || {};
    // The backend may return the Juspay URL in any of several shapes
    // (paymentUrl, payment_links.web, rawResponse.payment_links.web). Use
    // the same extractor that PaymentScreen uses for recharges.
    const paymentUrl = extractPaymentUrl(res) || res.data?.paymentUrl || null;

    // Persist the address now that the order is confirmed — only on success
    // so we don't pollute storage with abandoned drafts.
    customerStorage.setMarketplaceAddress({
      address: address.trim(),
      coords,
      resolvedAddress,
      pincode,
      city: city.trim(),
      state: stateName.trim(),
    });

    // Persist context so the marketplace callback screen can pick up the
    // order id even if the URL params are stripped on return.
    await savePaymentContext({
      flow: "marketplace",
      orderId,
      orderNo,
      amount: totalAmount,
      storeId: cart.storeId,
    });
    clearCart();

    if (method === "COD" || method === "WALLET") {
      // Both settle synchronously server-side (COD = pay later, WALLET = debited now).
      navigate(`/customer/app/marketplace/orders/${orderId}`, { replace: true, state: { celebrate: true } });
      return;
    }

    if (paymentUrl) {
      // Redirect to HDFC Juspay payment page. After payment the gateway
      // returns to /marketplace/payment-callback which polls for status.
      if (Capacitor.isNativePlatform()) {
        try {
          const { Browser } = await import("@capacitor/browser");
          await Browser.open({ url: paymentUrl });
        } catch {
          window.location.href = paymentUrl;
        }
      } else {
        window.location.href = paymentUrl;
      }
      return;
    }

    // Payment session creation failed — show the order so they can retry
    setError("Couldn't start payment. Please retry from order details.");
    navigate(`/customer/app/marketplace/orders/${orderId}`, { replace: true });
  };

  const toggleSubDay = (d) =>
    setSubDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const createSubscription = async () => {
    if (creatingSub) return;
    if (!isPickup && !address.trim()) { setError("Please enter delivery address"); return; }
    if (!isPickup && pincode.length !== 6) { setError("Please enter a valid 6-digit delivery pincode"); return; }
    if (hasSlots && !selectedSlotId) { setError("Pick a delivery slot"); return; }
    if (!hasSlots && !subTime) { setError("Pick a delivery time for the subscription"); return; }
    if (subFrequency === "WEEKLY" && subDays.length === 0) { setError("Pick at least one weekday"); return; }
    if (subFrequency === "INTERVAL" && (!Number(subInterval) || Number(subInterval) < 1)) {
      setError("Enter a valid gap (number of days) for the custom schedule"); return;
    }
    if (subFrequency === "INTERVAL" && subAnchor === "START" && !subStartDate) {
      setError("Pick a start date to repeat from"); return;
    }
    const orderMobile = String(userData?.mobile || userData?.mobileNumber || "").trim();
    if (!orderMobile || !/^\d{10}$/.test(orderMobile)) {
      setError("Your account mobile is missing. Please re-login and try again.");
      return;
    }
    setError(null);
    setCreatingSub(true);
    const payload = {
      storeId: cart.storeId,
      items: itemsPayload(),
      fulfillmentType,
      deliveryAddress: isPickup ? "" : address.trim(),
      ...(isPickup ? {} : { deliveryPincode: pincode, deliveryCity: city.trim(), deliveryState: stateName.trim() }),
      contactMobile: orderMobile,
      paymentMethod: subPayMethod,
      frequency: subFrequency,
      ...(subFrequency === "WEEKLY" ? { daysOfWeek: subDays } : {}),
      ...(subFrequency === "INTERVAL" ? { intervalDays: Number(subInterval) } : {}),
      ...(selectedSlotId ? { deliverySlotId: Number(selectedSlotId) } : { deliveryTime: subTime }),
      // INTERVAL anchors on startDate: "from today" forces today; "from start date" uses the picked date.
      ...(subFrequency === "INTERVAL"
        ? { startDate: subAnchor === "START" && subStartDate ? subStartDate : new Date().toISOString().slice(0, 10) }
        : (subStartDate ? { startDate: subStartDate } : {})),
      ...(subEndDate ? { endDate: subEndDate } : {}),
      ...(appliedOffer?.code ? { offerCode: appliedOffer.code } : {}),
      ...(coords && !isPickup ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {}),
    };
    const res = await marketplaceService.createSubscription(payload);
    setCreatingSub(false);
    if (!res.success) { setError(res.message || "Could not create subscription"); return; }
    clearCart();
    navigate("/customer/app/marketplace/subscriptions", { replace: true });
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => step === "checkout" ? setStep("cart") : navigate(-1)}>
          <FaArrowLeft />
        </button>
        <h1 className="mkt-header-title">{step === "cart" ? "Cart" : "Checkout"}</h1>
      </div>

      {step === "cart" ? (
        <>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--cm-muted)" }}>
            <FaStore size={12} style={{ marginRight: 6 }} />
            From <strong style={{ color: "var(--cm-ink)" }}>{cart.storeName}</strong>
          </div>
          {items.map((it) => {
            const key = lineKeyOf(it);
            return (
            <div key={key} className="mkt-cart-line">
              <div className="mkt-cart-line-img">
                {it.image ? <img src={it.image} alt="" /> : <FaStore size={20} />}
              </div>
              <div className="mkt-cart-line-info">
                <p className="mkt-cart-line-name">{it.name}{it.variantLabel ? <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}> · {it.variantLabel}</span> : null}</p>
                <div className="mkt-cart-line-price">₹{Number(it.price).toFixed(0)} each</div>
                {(it.note || it.noteImageUrl) && (
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>
                    ✏️ {it.note ? `"${it.note}"` : "Photo attached"}{it.note && it.noteImageUrl ? " · 📷" : ""}
                  </div>
                )}
                {Array.isArray(it.addOns) && it.addOns.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>
                    + {it.addOns.map((a) => `${a.label} (₹${Number(a.price).toFixed(0)})`).join(", ")}
                  </div>
                )}
                {it.requiresPrescription && (
                  <div style={{ fontSize: 11, color: "#f87171", marginTop: 2, fontWeight: 600 }}>℞ Prescription required</div>
                )}
                <div className="mkt-stepper" style={{ marginTop: 6 }}>
                  <button className="mkt-stepper-btn" onClick={() => decrementItem(key)}><FaMinus size={10} /></button>
                  <span className="mkt-stepper-qty">{it.qty}</span>
                  <button className="mkt-stepper-btn" onClick={() => addItem({ id: cart.storeId, businessName: cart.storeName, deliveryCharges: cart.deliveryCharges, minOrderValue: cart.minOrderValue, deliveryTimeMinutes: cart.deliveryTimeMinutes, latitude: cart.storeLatitude, longitude: cart.storeLongitude }, { id: it.id, name: it.name, sellingPrice: it.price, imageUrl: it.image }, it.variantLabel ? { variant: { label: it.variantLabel, price: it.price } } : undefined)}><FaPlus size={10} /></button>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>₹{((Number(it.price) + addOnPerUnit(it)) * it.qty).toFixed(0)}</div>
                <button
                  onClick={() => removeItem(key)}
                  style={{ background: "none", border: "none", color: "#f87171", marginTop: 8, cursor: "pointer" }}
                  aria-label="Remove"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </div>
            );
          })}

          <div className="mkt-summary">
            <div className="mkt-summary-row"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(0)}</span></div>
            <div className="mkt-summary-row"><span>Delivery</span><span>{totals.deliveryCharges > 0 ? `₹${totals.deliveryCharges.toFixed(0)}` : "Free"}</span></div>
            <div className="mkt-summary-row mkt-summary-row--total"><span>Total</span><span>₹{totals.total.toFixed(0)}</span></div>
            {belowMin && (
              <div className="mkt-error-text" style={{ marginTop: 6 }}>
                Minimum order ₹{minOrder.toFixed(0)} — add ₹{(minOrder - totals.subtotal).toFixed(0)} more
              </div>
            )}
          </div>

          <div style={{ padding: "0 14px 24px" }}>
            <button
              className="mkt-btn mkt-btn--primary"
              onClick={proceedToCheckout}
              disabled={belowMin}
            >
              Proceed to Checkout
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mkt-form">
            {pickupEnabled && (
              <>
                <div className="mkt-form-section-title">How would you like it?</div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    background: "var(--cm-bg-secondary)",
                    border: "1px solid var(--cm-line)",
                    borderRadius: 12,
                    padding: 4,
                    marginBottom: 14,
                  }}
                >
                  {[
                    { key: "DELIVERY", label: "Home Delivery", disabled: !deliveryEnabled },
                    { key: "PICKUP", label: "Store Pickup", disabled: false },
                  ].map((opt) => {
                    const active = fulfillmentType === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => {
                          if (opt.disabled) return;
                          setFulfillmentType(opt.key);
                          // Pickup has no delivery timing — collect whenever the store is open.
                          if (opt.key === "PICKUP") { setDeliveryMode("NOW"); setError(null); }
                        }}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 9,
                          border: "none",
                          cursor: opt.disabled ? "not-allowed" : "pointer",
                          fontSize: 13,
                          fontWeight: 700,
                          opacity: opt.disabled ? 0.4 : 1,
                          background: active ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
                          color: active ? "#fff" : "var(--cm-ink)",
                          boxShadow: active ? "0 4px 12px rgba(0,123,255,0.3)" : "none",
                          transition: "background 0.15s, box-shadow 0.15s",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {isPickup ? (
              <div className="mkt-loc-card" style={{ marginBottom: 14 }}>
                <div className="mkt-loc-card-row">
                  <FaStore size={12} className="mkt-loc-card-icon" />
                  <div className="mkt-loc-card-body">
                    <div className="mkt-loc-card-title">Collect from store — no delivery charge</div>
                    <div className="mkt-loc-card-text">
                      Pick up your order at <strong style={{ color: "var(--cm-ink)" }}>{cart.storeName}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
            <div className="mkt-form-section-title">Delivery Address</div>
            <div className="mkt-field">
              <label className="mkt-field-label">Full Address</label>
              <textarea
                className="mkt-textarea"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / Flat no., Street, Landmark, Area"
              />
            </div>
            <div className="mkt-field" style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: "0 0 38%" }}>
                <label className="mkt-field-label">Pincode</label>
                <input
                  className="mkt-input"
                  value={pincode}
                  inputMode="numeric"
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mkt-field-label">City</label>
                <input className="mkt-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">State</label>
              <input className="mkt-input" value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="State" />
            </div>
            <button
              className="mkt-btn mkt-btn--secondary"
              onClick={captureLocation}
              type="button"
              style={{ padding: 10, fontSize: 13 }}
            >
              <FaMapMarkerAlt size={12} style={{ marginRight: 6 }} />
              {coords ? "Location captured ✓" : "Use my current location"}
            </button>

            {coords && (
              <div className="mkt-loc-card">
                <div className="mkt-loc-card-row">
                  <FaMapMarkerAlt size={12} className="mkt-loc-card-icon" />
                  <div className="mkt-loc-card-body">
                    <div className="mkt-loc-card-title">Delivering to</div>
                    <div className="mkt-loc-card-text">
                      {resolving ? "Resolving address…" : (resolvedAddress || `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}`)}
                    </div>
                    {eta.distanceKm != null && (
                      <div className="mkt-loc-card-sub">
                        {formatDistance(eta.distanceKm)} from {cart.storeName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mkt-eta-row">
                  <FaClock size={12} className="mkt-loc-card-icon" />
                  <div className="mkt-loc-card-body">
                    <div className="mkt-loc-card-title">Estimated delivery</div>
                    {eta.min != null ? (
                      <>
                        <div className="mkt-eta-value">{eta.min}–{eta.max} min</div>
                        {eta.travel != null && (
                          <div className="mkt-loc-card-sub">
                            {eta.prep} min prep + {eta.travel} min travel
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mkt-loc-card-sub">Capture location to estimate</div>
                    )}
                  </div>
                </div>
              </div>
            )}
              </>
            )}

            {/* Delivery timing: now / schedule / subscribe. Not shown for store
                pickup — there's no delivery to schedule, the customer collects
                from the store directly. */}
            {!isPickup && (
            <>
            <div className="mkt-form-section-title">When to deliver</div>
            {/* Quick delivery presets (feature 7) — drive the existing schedule fields */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {DELIVERY_PRESETS.map((p) => {
                const on = deliveryPreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: "7px 13px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: on ? "1px solid transparent" : "1px solid var(--cm-line)",
                      background: on ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "var(--cm-card)",
                      color: on ? "#fff" : "var(--cm-ink)",
                      boxShadow: on ? "0 4px 12px rgba(0,123,255,0.3)" : "none",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[
                { key: "NOW", label: "Deliver now" },
                { key: "SCHEDULE", label: "Schedule" },
                { key: "SUBSCRIBE", label: "Subscribe" },
              ].map((m) => {
                const on = deliveryMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => { setDeliveryMode(m.key); setDeliveryPreset(null); setError(null); }}
                    style={{
                      flex: 1, padding: "9px 6px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: on ? "1px solid transparent" : "1px solid var(--cm-line)",
                      background: on ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "var(--cm-card)",
                      color: on ? "#fff" : "var(--cm-ink)",
                      boxShadow: on ? "0 6px 16px rgba(0,123,255,0.3)" : "none",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {deliveryMode === "SCHEDULE" && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                    <label className="mkt-field-label">Date</label>
                    <input type="date" className="mkt-input" value={scheduleDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => { setScheduleDate(e.target.value); setSelectedSlotId(""); setDeliveryPreset(null); }} />
                  </div>
                  {!hasSlots && (
                    <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                      <label className="mkt-field-label">Time</label>
                      <input type="time" className="mkt-input" value={scheduleTime}
                        onChange={(e) => { setScheduleTime(e.target.value); setDeliveryPreset(null); }} />
                    </div>
                  )}
                </div>
                {hasSlots && (
                  <div className="mkt-field" style={{ margin: "10px 0 0" }}>
                    <label className="mkt-field-label">Delivery slot</label>
                    <select className="mkt-input" value={selectedSlotId}
                      onChange={(e) => { setSelectedSlotId(e.target.value); setDeliveryPreset(null); }}>
                      <option value="">-- Select a slot --</option>
                      {slotsForDate(scheduleDate).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({slotTime(s)}–{String(s.endTime).slice(0, 5)})
                        </option>
                      ))}
                    </select>
                    {scheduleDate && slotsForDate(scheduleDate).length === 0 && (
                      <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                        No slots on this day — pick another date.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {deliveryMode === "SUBSCRIBE" && (
              <div style={{ marginBottom: 10, padding: 12, borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 10 }}>
                  We'll auto-place this order on your chosen schedule and charge the selected method each time.
                </div>
                {/* Frequency */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
                  {[
                    { key: "DAILY", label: "Daily" },
                    { key: "WEEKLY", label: "Weekly" },
                    { key: "MONTHLY", label: "Monthly" },
                    { key: "INTERVAL", label: "Custom" },
                  ].map((f) => {
                    const on = subFrequency === f.key;
                    return (
                      <button key={f.key} type="button" onClick={() => setSubFrequency(f.key)}
                        style={{
                          padding: "8px 4px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          border: on ? "1px solid #007BFF" : "1px solid var(--cm-line)",
                          background: on ? "rgba(0,123,255,0.1)" : "transparent",
                          color: on ? "#007BFF" : "var(--cm-ink)",
                        }}>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                {/* Custom gap (INTERVAL) */}
                {subFrequency === "INTERVAL" && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>Repeat every</span>
                      <input
                        type="number" min={1} max={365} inputMode="numeric"
                        className="mkt-input"
                        style={{ width: 72, textAlign: "center", height: 40, padding: "0 8px" }}
                        value={subInterval}
                        onChange={(e) => setSubInterval(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>days</span>
                    </div>
                    {/* Anchor: from today vs from a chosen start date */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ key: "TODAY", label: "From today" }, { key: "START", label: "From start date" }].map((a) => {
                        const on = subAnchor === a.key;
                        return (
                          <button key={a.key} type="button" onClick={() => setSubAnchor(a.key)}
                            style={{
                              flex: 1, padding: "7px 6px", borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                              border: on ? "1px solid #007BFF" : "1px solid var(--cm-line)",
                              background: on ? "rgba(0,123,255,0.1)" : "transparent",
                              color: on ? "#007BFF" : "var(--cm-muted)",
                            }}>
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 6 }}>
                      e.g. every {Number(subInterval) || 0} days — next on day {Number(subInterval) || 0} from {subAnchor === "START" ? "your start date" : "today"}, then repeating.
                    </div>
                  </div>
                )}
                {/* Monthly note */}
                {subFrequency === "MONTHLY" && (
                  <div style={{ fontSize: 11.5, color: "var(--cm-muted)", marginBottom: 10 }}>
                    Repeats monthly on day {Number((subStartDate || new Date().toISOString().slice(0, 10)).slice(8, 10))} of every month
                    {" "}(adjusts to the last day for shorter months). Set a Start date below to change the day.
                  </div>
                )}
                {/* Weekdays (weekly only) */}
                {subFrequency === "WEEKLY" && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => {
                      const on = subDays.includes(d);
                      return (
                        <button key={d} type="button" onClick={() => toggleSubDay(d)}
                          style={{
                            width: 38, height: 34, borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            border: on ? "1px solid transparent" : "1px solid var(--cm-line)",
                            background: on ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
                            color: on ? "#fff" : "var(--cm-muted)",
                          }}>
                          {d[0] + d[1].toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Slot (store-defined) or free time */}
                {hasSlots && (
                  <div className="mkt-field" style={{ margin: "0 0 10px" }}>
                    <label className="mkt-field-label">Delivery slot</label>
                    <select className="mkt-input" value={selectedSlotId}
                      onChange={(e) => { setSelectedSlotId(e.target.value); setDeliveryPreset(null); }}>
                      <option value="">-- Select a slot --</option>
                      {deliverySlots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({slotTime(s)}–{String(s.endTime).slice(0, 5)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Time + dates */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {!hasSlots && (
                    <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                      <label className="mkt-field-label">Time</label>
                      <input type="time" className="mkt-input" value={subTime} onChange={(e) => setSubTime(e.target.value)} />
                    </div>
                  )}
                  <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                    <label className="mkt-field-label">Start (optional)</label>
                    <input type="date" className="mkt-input" value={subStartDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setSubStartDate(e.target.value)} />
                  </div>
                  <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                    <label className="mkt-field-label">End (optional)</label>
                    <input type="date" className="mkt-input" value={subEndDate}
                      min={subStartDate || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setSubEndDate(e.target.value)} />
                  </div>
                </div>
                {/* Payment method for auto-orders */}
                <label className="mkt-field-label" style={{ display: "block", marginBottom: 6 }}>Auto-pay using</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { key: "WALLET", label: "Wallet" },
                    { key: "COD", label: "Cash" },
                    { key: "AUTOPAY", label: "Autopay" },
                  ].map((p) => {
                    const on = subPayMethod === p.key;
                    return (
                      <button key={p.key} type="button" onClick={() => setSubPayMethod(p.key)}
                        style={{
                          flex: 1, padding: "8px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          border: on ? "1px solid #007BFF" : "1px solid var(--cm-line)",
                          background: on ? "rgba(0,123,255,0.1)" : "transparent",
                          color: on ? "#007BFF" : "var(--cm-ink)",
                        }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </>
            )}

            {/* Pharmacy: mandatory prescription upload when any line needs it */}
            {needsPrescription && (
              <>
                <div className="mkt-form-section-title">Prescription <span className="mkt-req">*</span></div>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${prescriptionUrl ? "var(--cm-primary, #22c55e)" : "#f87171"}`, background: "var(--cm-card)", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 8 }}>
                    Some items in this order are medicines. Upload a clear photo of your doctor's prescription — the seller verifies it before accepting the order.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label
                      className="mkt-btn mkt-btn--secondary"
                      style={{ width: "auto", padding: "8px 14px", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}
                    >
                      {rxUploading ? "Uploading…" : prescriptionUrl ? "Change prescription" : "Upload prescription photo"}
                      <input type="file" accept="image/*" hidden onChange={handlePrescriptionUpload} disabled={rxUploading} />
                    </label>
                    {prescriptionUrl && (
                      <img src={prescriptionUrl} alt="Prescription" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                    )}
                  </div>
                  {prescriptionUrl ? (
                    <div style={{ fontSize: 11.5, color: "var(--cm-primary, #22c55e)", marginTop: 6, fontWeight: 600 }}>Prescription attached ✓</div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: "#f87171", marginTop: 6, fontWeight: 600 }}>Required before placing this order</div>
                  )}
                </div>
              </>
            )}

            {/* Gift option */}
            <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--cm-ink)", cursor: "pointer" }}>
                <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                This is a gift 🎁
              </label>
              {isGift && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    className="mkt-textarea"
                    maxLength={300}
                    placeholder="Gift message (optional, printed on the slip)"
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    style={{ minHeight: 52 }}
                  />
                  <div style={{ fontSize: 10.5, color: "var(--cm-muted)", marginTop: 4 }}>{giftMessage.length}/300 · Prices are hidden on the packing slip.</div>
                </div>
              )}
            </div>

            {/* Wave 4: Protection & financing (intent capture only, no charge) */}
            <div style={{ padding: "12px", borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--cm-ink)", marginBottom: 4 }}>Protect your purchase</div>
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 10 }}>Optional — the store will get in touch to arrange these. No extra charge is added now.</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--cm-ink)" }}>Extended warranty</span>
                <select className="mkt-input" style={{ width: 130 }} value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)}>
                  <option value="">None</option>
                  <option value="6">6 months</option>
                  <option value="12">1 year</option>
                  <option value="24">2 years</option>
                  <option value="36">3 years</option>
                </select>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cm-ink)", cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={amcOpted} onChange={(e) => setAmcOpted(e.target.checked)} />
                Add annual maintenance (AMC)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cm-ink)", cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={insuranceOpted} onChange={(e) => setInsuranceOpted(e.target.checked)} />
                Add product insurance
              </label>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--cm-ink)" }}>EMI (no-cost intent)</span>
                <select className="mkt-input" style={{ width: 130 }} value={emiSelected} onChange={(e) => setEmiSelected(e.target.value)}>
                  <option value="">One-time</option>
                  <option value="3 months">3 months</option>
                  <option value="6 months">6 months</option>
                  <option value="9 months">9 months</option>
                  <option value="12 months">12 months</option>
                </select>
              </div>
            </div>

            {/* Coupons / Offers */}
            <div className="mkt-form-section-title">Apply coupon</div>
            {!appliedOffer ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: offers.length ? 10 : 4 }}>
                  <input
                    className="mkt-textarea"
                    style={{ flex: 1, minHeight: 0, height: 42, padding: "0 12px", resize: "none", textTransform: "uppercase" }}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                  />
                  <button
                    type="button"
                    className="mkt-btn mkt-btn--secondary"
                    onClick={() => applyCoupon()}
                    disabled={validatingCoupon}
                    style={{ width: "auto", padding: "0 18px", height: 42 }}
                  >
                    {validatingCoupon ? "…" : "Apply"}
                  </button>
                </div>
                {offers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    {offers.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => tapOfferChip(o)}
                        style={{
                          textAlign: "left",
                          background: "var(--cm-surface, #1a1a1a)",
                          border: `1px dashed ${o.isFlash ? "#f59e0b" : "var(--cm-primary, #22c55e)"}`,
                          borderRadius: 10,
                          padding: "8px 10px",
                          cursor: "pointer",
                          maxWidth: "100%",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: o.isFlash ? "#f59e0b" : "var(--cm-primary, #22c55e)" }}>
                          {o.code}{o.isFlash ? " ⚡" : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--cm-ink)" }}>{o.title}</div>
                        {o.description && (
                          <div style={{ fontSize: 10, color: "var(--cm-muted)" }}>{o.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid var(--cm-primary, #22c55e)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 6,
                }}
              >
                <span style={{ color: "var(--cm-primary, #22c55e)", fontSize: 13, fontWeight: 600 }}>
                  Coupon {appliedOffer.code} applied – you save ₹{discount.toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  aria-label="Remove coupon"
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
                >
                  ✕
                </button>
              </div>
            )}
            {couponError && <div className="mkt-error-text" style={{ marginBottom: 6 }}>{couponError}</div>}

            <div className="mkt-summary" style={{ margin: 0 }}>
              <div className="mkt-summary-row"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(0)}</span></div>
              <div className="mkt-summary-row"><span>Delivery</span><span>{isPickup ? "Free (pickup)" : (effectiveDelivery > 0 ? `₹${effectiveDelivery.toFixed(0)}` : "Free")}</span></div>
              {orderCharge > 0 && (
                <div className="mkt-summary-row"><span>Other charges</span><span>₹{orderCharge.toFixed(0)}</span></div>
              )}
              {discount > 0 && (
                <div className="mkt-summary-row" style={{ color: "var(--cm-primary, #22c55e)" }}>
                  <span>Coupon discount</span><span>−₹{discount.toFixed(0)}</span>
                </div>
              )}
              <div className="mkt-summary-row mkt-summary-row--total"><span>Pay total</span><span>₹{payTotal.toFixed(0)}</span></div>
            </div>

            {error && <div className="mkt-error-text">{error}</div>}

            {deliveryMode === "SUBSCRIBE" ? (
              <div className="mkt-pay-actions">
                <button
                  type="button"
                  className="mkt-btn mkt-btn--primary"
                  onClick={createSubscription}
                  disabled={creatingSub}
                >
                  {creatingSub ? "Creating subscription…" : `Subscribe — ${
                    subFrequency === "DAILY" ? "every day"
                    : subFrequency === "WEEKLY" ? "selected days"
                    : subFrequency === "MONTHLY" ? "monthly"
                    : `every ${Number(subInterval) || 0} days`
                  } · ${hasSlots ? (selectedSlot()?.label || "pick a slot") : (subTime || "--:--")}`}
                </button>
                <div style={{ fontSize: 11, color: "var(--cm-muted)", textAlign: "center", marginTop: 6 }}>
                  Auto-charged via {subPayMethod === "WALLET" ? "Wallet" : subPayMethod === "COD" ? "Cash on Delivery" : "Autopay (HDFC)"} each time. Manage anytime under My Subscriptions.
                </div>
              </div>
            ) : (
            <>
            <div className="mkt-pay-actions">
              <button
                type="button"
                className="mkt-btn mkt-btn--primary mkt-pay-online"
                onClick={() => placeOrder("ONLINE")}
                disabled={placing}
              >
                {placing && placingMethod === "ONLINE" ? (
                  "Placing order…"
                ) : (
                  <>
                    <span className="mkt-pay-online-label">Pay ₹{payTotal.toFixed(0)} via</span>
                    <img
                      src="https://webdekho.in/images/vasbazaar.png"
                      alt="vasbazaar"
                      className="mkt-pay-logo"
                    />
                    <FaArrowRight className="mkt-pay-online-arrow" size={13} />
                  </>
                )}
              </button>

              <div className="mkt-pay-alt-row">
                <button
                  type="button"
                  className="mkt-btn mkt-pay-wallet"
                  onClick={() => placeOrder("WALLET")}
                  disabled={placing || (walletBalance !== null && walletBalance < payTotal)}
                  title={walletBalance !== null && walletBalance < payTotal ? "Insufficient wallet balance" : undefined}
                >
                  {placing && placingMethod === "WALLET" ? (
                    "Paying…"
                  ) : (
                    <>
                      <FaWallet className="mkt-pay-alt-icon" size={16} />
                      <span className="mkt-pay-alt-title">Wallet</span>
                      {walletBalance !== null && (
                        <span className="mkt-pay-alt-sub">₹{walletBalance.toFixed(0)}</span>
                      )}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-pay-cod"
                  onClick={() => placeOrder("COD")}
                  disabled={placing}
                >
                  {placing && placingMethod === "COD" ? (
                    "Placing…"
                  ) : (
                    <>
                      <FaMoneyBillWave className="mkt-pay-alt-icon" size={16} />
                      <span className="mkt-pay-alt-title">Cash</span>
                      <span className="mkt-pay-alt-sub">on Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="mkt-pay-secure">
              <FaLock size={9} />
              Secured by HDFC Juspay payment gateway
            </div>
            </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CartScreen;
