import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore, FaMapMarkerAlt, FaWallet, FaMoneyBillWave, FaLock } from "react-icons/fa";
import { Capacitor } from "@capacitor/core";
import { marketplaceService } from "../../services/marketplaceService";
import { userService } from "../../services/userService";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useCustomerModern } from "../../context/CustomerModernContext";
import { savePaymentContext, extractPaymentUrl } from "../../services/juspayService";
import { customerStorage } from "../../services/storageService";
import "./marketplace.css";

const buildMarketplaceReturnUrl = () => {
  if (Capacitor.isNativePlatform()) return "vasbazaar://payment-callback?flow=marketplace";
  const origin = window.location.origin;
  const path = window.location.pathname;
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/marketplace/payment-callback`;
};

/**
 * Combined multi-store checkout. One delivery address + one payment for items
 * from several stores; the backend creates one order per store (shared
 * paymentGroupId) and credits each seller's wallet with their share on success.
 */
const MultiStoreCheckoutScreen = () => {
  const navigate = useNavigate();
  const { storeList, totals, clearCart } = useMarketplaceCart();
  const { userData } = useCustomerModern();

  const [fulfillmentType, setFulfillmentType] = useState("DELIVERY");
  const [address, setAddress] = useState("");
  // Structured delivery address for Shiprocket courier shipments.
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [coords, setCoords] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placingMethod, setPlacingMethod] = useState(null);
  const [error, setError] = useState(null);

  // Pharmacy: one prescription upload covers every store that needs it.
  const [prescriptionUrl, setPrescriptionUrl] = useState("");
  const [rxUploading, setRxUploading] = useState(false);

  // Gift purchase (applies to every order in the combined checkout).
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  const isPickup = fulfillmentType === "PICKUP";

  // One quote per bucket: each store is a different distance from the buyer and
  // carries its own slabs, so a combined fee cannot be derived from the cart's
  // add-time snapshots. Null until quoted; the snapshot stands in meanwhile.
  const [quotes, setQuotes] = useState({}); // { [storeId]: quote }
  const [quoting, setQuoting] = useState(false);

  const bucketSubtotals = useMemo(
    () =>
      Object.fromEntries(
        (storeList || []).map((b) => [
          b.storeId,
          Object.values(b.items || {}).reduce((s, i) => s + Number(i.price) * Number(i.qty || 0), 0),
        ])
      ),
    [storeList]
  );

  useEffect(() => {
    if (!storeList || storeList.length === 0) return;
    if (isPickup) { setQuotes({}); return; }
    let cancelled = false;
    setQuoting(true);
    Promise.all(
      storeList.map((b) =>
        marketplaceService
          .getDeliveryQuote(b.storeId, {
            subtotal: bucketSubtotals[b.storeId] || 0,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            fulfillmentType: "DELIVERY",
          })
          .then((res) => [b.storeId, res.success ? res.data : null])
          .catch(() => [b.storeId, null])
      )
    )
      .then((pairs) => {
        if (cancelled) return;
        setQuotes(Object.fromEntries(pairs.filter(([, q]) => q)));
      })
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [storeList, bucketSubtotals, coords?.lat, coords?.lng, isPickup]);

  // Sum the quotes, falling back per store to its snapshot until its quote lands.
  const quotedDelivery = useMemo(
    () =>
      (storeList || []).reduce((sum, b) => {
        if ((bucketSubtotals[b.storeId] || 0) <= 0) return sum;
        const q = quotes[b.storeId];
        return sum + (q ? Number(q.fee || 0) : Number(b.deliveryCharges || 0));
      }, 0),
    [storeList, quotes, bucketSubtotals]
  );

  const effectiveDelivery = isPickup ? 0 : quotedDelivery;
  const payTotal = Math.max(0, totals.subtotal + effectiveDelivery);

  // Prefill the last-used address.
  useEffect(() => {
    const saved = customerStorage.getMarketplaceAddress();
    if (saved) {
      if (saved.address) setAddress(saved.address);
      if (saved.pincode) setPincode(saved.pincode);
      if (saved.city) setCity(saved.city);
      if (saved.state) setStateName(saved.state);
      if (saved.coords) setCoords(saved.coords);
      if (saved.resolvedAddress) setResolvedAddress(saved.resolvedAddress);
    }
    if (navigator.geolocation && !(saved && saved.coords)) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Wallet balance for the Pay-from-wallet gate.
  useEffect(() => {
    let alive = true;
    userService.getUserProfile()
      .then((res) => { if (alive) setWalletBalance(parseFloat(res?.data?.balance ?? res?.data?.walletBalance ?? 0)); })
      .catch(() => { if (alive) setWalletBalance(0); });
    return () => { alive = false; };
  }, []);

  // If the cart is no longer multi-store, this screen doesn't apply.
  useEffect(() => {
    if (!storeList || storeList.length < 2) {
      navigate("/customer/app/marketplace/cart", { replace: true });
    }
  }, [storeList, navigate]);

  // Per-store subtotal vs the store's minimum order value. Surfaced before
  // submitting so the shopper knows exactly which store is short.
  const minIssues = useMemo(
    () => (storeList || []).map((b) => {
      const sub = Object.values(b.items || {}).reduce((s, i) => s + Number(i.price) * Number(i.qty || 0), 0);
      const min = Number(b.minOrderValue || 0);
      return min > 0 && sub < min
        ? { storeId: b.storeId, name: b.storeName, min, short: min - sub }
        : null;
    }).filter(Boolean),
    [storeList]
  );

  // Which store buckets contain prescription-flagged lines.
  const rxStoreIds = useMemo(
    () => new Set(
      (storeList || [])
        .filter((b) => Object.values(b.items || {}).some((i) => i.requiresPrescription))
        .map((b) => b.storeId)
    ),
    [storeList]
  );
  const needsPrescription = rxStoreIds.size > 0;

  const storesPayload = useMemo(
    () => (storeList || []).map((b) => ({
      storeId: b.storeId,
      items: Object.values(b.items || {}).map((i) => ({
        itemId: i.id,
        quantity: i.qty,
        ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
        // Per-line customization captured on the product sheet.
        ...(i.note ? { note: i.note } : {}),
        ...(i.noteImageUrl ? { imageUrl: i.noteImageUrl } : {}),
      })),
      // Order-level extras go per-store: prescription only where required.
      ...(rxStoreIds.has(b.storeId) && prescriptionUrl ? { prescriptionUrl } : {}),
      ...(isGift ? { isGift: true, ...(giftMessage.trim() ? { giftMessage: giftMessage.trim().slice(0, 300) } : {}) } : {}),
    })),
    [storeList, rxStoreIds, prescriptionUrl, isGift, giftMessage]
  );

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

  const placeOrder = async (method) => {
    if (placing) return;
    if (minIssues.length > 0) {
      const m = minIssues[0];
      setError(`${m.name}: minimum order ₹${m.min.toFixed(0)} — add ₹${m.short.toFixed(0)} more from this store.`);
      return;
    }
    if (!isPickup && !address.trim()) { setError("Please enter delivery address"); return; }
    if (!isPickup && pincode.length !== 6) { setError("Please enter a valid 6-digit delivery pincode"); return; }
    if (needsPrescription && !prescriptionUrl) {
      setError("This order contains medicines — please upload a prescription photo before placing it.");
      return;
    }
    const orderMobile = String(userData?.mobile || userData?.mobileNumber || "").trim();
    if (!orderMobile || !/^\d{10}$/.test(orderMobile)) {
      setError("Your account mobile is missing. Please re-login and try again.");
      return;
    }
    setError(null);
    setPlacing(true);
    setPlacingMethod(method);

    const payload = {
      stores: storesPayload,
      deliveryAddress: isPickup ? "" : address.trim(),
      ...(isPickup ? {} : { deliveryPincode: pincode, deliveryCity: city.trim(), deliveryState: stateName.trim() }),
      contactMobile: orderMobile,
      paymentMethod: method,
      fulfillmentType,
      ...(method === "ONLINE" ? { returnUrl: buildMarketplaceReturnUrl() } : {}),
      ...(coords && !isPickup ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {}),
    };

    const res = await marketplaceService.placeMultiOrder(payload);
    setPlacing(false);
    setPlacingMethod(null);

    if (!res.success) {
      setError(res.message || "Failed to place order");
      return;
    }

    const data = res.data || {};
    if (!isPickup) {
      customerStorage.setMarketplaceAddress({ address: address.trim(), coords, resolvedAddress, pincode, city: city.trim(), state: stateName.trim() });
    }

    if (method === "COD" || method === "WALLET") {
      // Both settle synchronously server-side (each seller's wallet credited).
      clearCart();
      navigate("/customer/app/marketplace/my-orders", { replace: true, state: { celebrate: true } });
      return;
    }

    // ONLINE — one combined HDFC payment for the whole group.
    const paymentUrl = extractPaymentUrl(res) || data.paymentUrl || null;
    await savePaymentContext({
      flow: "marketplace",
      paymentGroupId: data.paymentGroupId || null,
      amount: data.totalAmount,
    });
    clearCart();

    if (paymentUrl) {
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
    setError("Couldn't start payment. Please check My Orders.");
    navigate("/customer/app/marketplace/my-orders", { replace: true });
  };

  const walletShort = walletBalance !== null && walletBalance < payTotal;
  const blocked = minIssues.length > 0;

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Checkout · {storeList?.length || 0} stores</h1>
      </div>

      {/* Fulfillment toggle */}
      <div style={{ display: "flex", gap: 8, padding: "12px 14px 0" }}>
        {["DELIVERY", "PICKUP"].map((ft) => (
          <button
            key={ft}
            type="button"
            onClick={() => setFulfillmentType(ft)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${fulfillmentType === ft ? "transparent" : "var(--cm-line)"}`,
              background: fulfillmentType === ft ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
              color: fulfillmentType === ft ? "#fff" : "var(--cm-muted)",
            }}
          >
            {ft === "DELIVERY" ? "Delivery" : "Pickup"}
          </button>
        ))}
      </div>

      {/* Delivery address */}
      {!isPickup && (
        <div style={{ padding: "12px 14px 0" }}>
          <label className="mkt-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaMapMarkerAlt /> Delivery address
          </label>
          <textarea
            className="mkt-input"
            rows={2}
            placeholder="House / flat, street, landmark, area…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ resize: "vertical" }}
          />
          {resolvedAddress && (
            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>📍 {resolvedAddress}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="mkt-input" inputMode="numeric" placeholder="Pincode"
              value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ flex: "0 0 38%" }} />
            <input className="mkt-input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={{ flex: 1 }} />
          </div>
          <input className="mkt-input" placeholder="State" value={stateName} onChange={(e) => setStateName(e.target.value)} style={{ marginTop: 8 }} />
        </div>
      )}

      {/* Per-store summary */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 8 }}>Your items</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(storeList || []).map((b) => {
            const lines = Object.values(b.items || {});
            const sub = lines.reduce((s, i) => s + Number(i.price) * Number(i.qty || 0), 0);
            const issue = minIssues.find((m) => m.storeId === b.storeId);
            return (
              <div key={b.storeId} style={{ padding: 12, borderRadius: 14, border: `1px solid ${issue ? "#f87171" : "var(--cm-line)"}`, background: "var(--cm-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <FaStore color="var(--cm-muted)" size={13} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>{b.storeName}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--cm-muted)" }}>₹{sub.toFixed(0)}</span>
                </div>
                {lines.map((i) => (
                  <div key={i.variantLabel ? `${i.id}-${i.variantLabel}` : i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--cm-muted)", padding: "2px 0" }}>
                    <span>{i.name}{i.variantLabel ? ` · ${i.variantLabel}` : ""} × {i.qty}</span>
                    <span>₹{(Number(i.price) * Number(i.qty || 0)).toFixed(0)}</span>
                  </div>
                ))}
                {issue && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#f87171", fontWeight: 600 }}>
                    Minimum order ₹{issue.min.toFixed(0)} — add ₹{issue.short.toFixed(0)} more to include this store.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pharmacy: mandatory prescription when any store's lines need it */}
      {needsPrescription && (
        <div style={{ padding: "16px 14px 0" }}>
          <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${prescriptionUrl ? "var(--cm-primary, #22c55e)" : "#f87171"}`, background: "var(--cm-card)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 4 }}>Prescription required</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 8 }}>
              Some items are medicines. Upload a clear photo of your doctor's prescription — it's attached to each pharmacy order.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "8px 14px", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
                {rxUploading ? "Uploading…" : prescriptionUrl ? "Change prescription" : "Upload prescription photo"}
                <input type="file" accept="image/*" hidden onChange={handlePrescriptionUpload} disabled={rxUploading} />
              </label>
              {prescriptionUrl && (
                <img src={prescriptionUrl} alt="Prescription" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
              )}
            </div>
            {!prescriptionUrl && (
              <div style={{ fontSize: 11.5, color: "#f87171", marginTop: 6, fontWeight: 600 }}>Required before placing this order</div>
            )}
          </div>
        </div>
      )}

      {/* Gift option */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--cm-ink)", cursor: "pointer" }}>
            <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
            This is a gift 🎁
          </label>
          {isGift && (
            <div style={{ marginTop: 8 }}>
              <textarea
                className="mkt-input"
                rows={2}
                maxLength={300}
                placeholder="Gift message (optional, printed on the slip)"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                style={{ resize: "vertical" }}
              />
              <div style={{ fontSize: 10.5, color: "var(--cm-muted)", marginTop: 4 }}>{giftMessage.length}/300 · Applied to every store's order.</div>
            </div>
          )}
        </div>
      </div>

      {/* Bill summary */}
      <div style={{ padding: "16px 14px 0" }}>
        <div className="mkt-summary-row"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(0)}</span></div>
        <div className="mkt-summary-row">
          <span>Delivery{!isPickup && storeList.length > 1 ? ` (${storeList.length} stores)` : ""}</span>
          <span>
            {isPickup
              ? "Free (pickup)"
              : quoting && Object.keys(quotes).length === 0
                ? "…"
                : effectiveDelivery > 0
                  ? `₹${effectiveDelivery.toFixed(0)}`
                  : "Free"}
          </span>
        </div>
        <div className="mkt-summary-row mkt-summary-row--total"><span>Total</span><span>₹{payTotal.toFixed(0)}</span></div>
        <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
          Any platform charge is added at payment. The amount is split to each seller automatically.
        </div>
      </div>

      {error && (
        <div style={{ margin: "12px 14px 0", padding: "10px 12px", borderRadius: 10, background: "rgba(248,113,113,0.12)", color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Payment actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 14px 28px" }}>
        <button
          className="mkt-btn mkt-btn--primary"
          disabled={placing || blocked}
          onClick={() => placeOrder("ONLINE")}
        >
          <FaLock style={{ marginRight: 6 }} />
          {placing && placingMethod === "ONLINE" ? "Starting payment…" : `Pay ₹${payTotal.toFixed(0)} online`}
        </button>

        <button
          className="mkt-btn mkt-btn--secondary"
          disabled={placing || walletShort || blocked}
          title={walletShort ? "Insufficient wallet balance" : undefined}
          onClick={() => placeOrder("WALLET")}
        >
          <FaWallet style={{ marginRight: 6 }} />
          {placing && placingMethod === "WALLET" ? "Paying…" : "Pay from wallet"}
          {walletBalance !== null && (
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>(₹{walletBalance.toFixed(0)})</span>
          )}
        </button>

        <button
          className="mkt-btn mkt-btn--secondary"
          disabled={placing || blocked}
          onClick={() => placeOrder("COD")}
        >
          <FaMoneyBillWave style={{ marginRight: 6 }} />
          {placing && placingMethod === "COD" ? "Placing…" : "Cash / pay on delivery"}
        </button>
      </div>
    </div>
  );
};

export default MultiStoreCheckoutScreen;
