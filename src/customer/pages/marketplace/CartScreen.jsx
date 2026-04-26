import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaMinus, FaTrash, FaStore, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useCustomerModern } from "../../context/CustomerModernContext";
import { savePaymentContext } from "../../services/juspayService";
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

const CartScreen = () => {
  const navigate = useNavigate();
  const { cart, totals, addItem, decrementItem, removeItem, clearCart } = useMarketplaceCart();
  const { userData } = useCustomerModern();

  const [step, setStep] = useState("cart"); // cart | checkout
  const [address, setAddress] = useState("");
  const [contactMobile, setContactMobile] = useState(userData?.mobile || userData?.mobileNumber || "");
  const [coords, setCoords] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placingMethod, setPlacingMethod] = useState(null); // "ONLINE" | "COD"
  const [error, setError] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [storeCoords, setStoreCoords] = useState(() =>
    cart && cart.storeLatitude != null && cart.storeLongitude != null
      ? { lat: Number(cart.storeLatitude), lng: Number(cart.storeLongitude) }
      : null
  );

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

  const items = Object.values(cart.items);
  const minOrder = Number(cart.minOrderValue || 0);
  const belowMin = totals.subtotal < minOrder;

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
    captureLocation();
    setStep("checkout");
  };

  const placeOrder = async (method = "ONLINE") => {
    if (placing) return;
    if (!address.trim()) { setError("Please enter delivery address"); return; }
    if (!contactMobile || !/^\d{10}$/.test(String(contactMobile).trim())) {
      setError("Please enter a valid 10-digit contact mobile");
      return;
    }
    setError(null);
    setPlacing(true);
    setPlacingMethod(method);

    const payload = {
      storeId: cart.storeId,
      items: items.map((i) => ({ itemId: i.id, quantity: i.qty })),
      deliveryAddress: address.trim(),
      contactMobile: contactMobile.trim(),
      paymentMethod: method,
      ...(method === "ONLINE" ? { returnUrl: buildMarketplaceReturnUrl() } : {}),
      ...(coords ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {}),
    };

    const res = await marketplaceService.placeOrder(payload);
    setPlacing(false);
    setPlacingMethod(null);

    if (!res.success) {
      setError(res.message || "Failed to place order");
      return;
    }
    const { orderId, orderNo, totalAmount, paymentUrl } = res.data || {};

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

    if (method === "COD") {
      navigate(`/customer/app/marketplace/orders/${orderId}`, { replace: true });
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
          {items.map((it) => (
            <div key={it.id} className="mkt-cart-line">
              <div className="mkt-cart-line-img">
                {it.image ? <img src={it.image} alt="" /> : <FaStore size={20} />}
              </div>
              <div className="mkt-cart-line-info">
                <p className="mkt-cart-line-name">{it.name}</p>
                <div className="mkt-cart-line-price">₹{Number(it.price).toFixed(0)} each</div>
                <div className="mkt-stepper" style={{ marginTop: 6 }}>
                  <button className="mkt-stepper-btn" onClick={() => decrementItem(it.id)}><FaMinus size={10} /></button>
                  <span className="mkt-stepper-qty">{it.qty}</span>
                  <button className="mkt-stepper-btn" onClick={() => addItem({ id: cart.storeId, businessName: cart.storeName, deliveryCharges: cart.deliveryCharges, minOrderValue: cart.minOrderValue, deliveryTimeMinutes: cart.deliveryTimeMinutes, latitude: cart.storeLatitude, longitude: cart.storeLongitude }, { id: it.id, name: it.name, sellingPrice: it.price, imageUrl: it.image })}><FaPlus size={10} /></button>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>₹{(Number(it.price) * it.qty).toFixed(0)}</div>
                <button
                  onClick={() => removeItem(it.id)}
                  style={{ background: "none", border: "none", color: "#f87171", marginTop: 8, cursor: "pointer" }}
                  aria-label="Remove"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </div>
          ))}

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

            <div className="mkt-form-section-title">Contact</div>
            <div className="mkt-field">
              <label className="mkt-field-label">Mobile Number</label>
              <input
                className="mkt-input"
                inputMode="numeric"
                value={contactMobile}
                onChange={(e) => setContactMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>

            <div className="mkt-summary" style={{ margin: 0 }}>
              <div className="mkt-summary-row"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(0)}</span></div>
              <div className="mkt-summary-row"><span>Delivery</span><span>{totals.deliveryCharges > 0 ? `₹${totals.deliveryCharges.toFixed(0)}` : "Free"}</span></div>
              <div className="mkt-summary-row mkt-summary-row--total"><span>Pay total</span><span>₹{totals.total.toFixed(0)}</span></div>
            </div>

            {error && <div className="mkt-error-text">{error}</div>}

            <div className="mkt-pay-actions">
              <button
                type="button"
                className="mkt-btn mkt-btn--secondary mkt-pay-cod"
                onClick={() => placeOrder("COD")}
                disabled={placing}
              >
                {placing && placingMethod === "COD" ? "Placing…" : "Cash on Delivery"}
              </button>
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
                    <span>Pay ₹{totals.total.toFixed(0)} via</span>
                    <img
                      src="https://webdekho.in/images/vasbazaar.png"
                      alt="vasbazaar"
                      className="mkt-pay-logo"
                    />
                  </>
                )}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--cm-muted)", textAlign: "center", marginTop: 6 }}>
              Secured by HDFC Juspay payment gateway
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CartScreen;
