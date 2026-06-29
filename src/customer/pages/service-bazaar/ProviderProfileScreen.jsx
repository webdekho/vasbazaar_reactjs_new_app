import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { FaArrowLeft, FaStar, FaMapMarkerAlt, FaShareAlt, FaEdit, FaHeart, FaRegHeart, FaComments } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { serviceChatService } from "../../services/serviceChatService";
import { TierChip, TrustBadges } from "./TrustBadges";
import { subscriptionService } from "../../services/subscriptionService";
import { queueService } from "../../services/queueService";
import { walletService } from "../../services/walletService";
import { savePaymentContext, extractPaymentUrl } from "../../services/juspayService";
import { server_api } from "../../../utils/constants";
import { useToast } from "../../context/ToastContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import LocationPickerSheet from "../../components/LocationPickerSheet";
import { isGoogleEnabled, googleReverseGeocode } from "../../services/placesService";
import "./service-bazaar.css";

// Free OpenStreetMap fallback for "use my current location" when no Google key is
// configured. Returns the full readable address (not just a city) for the booking field.
const osmReverseGeocode = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse failed");
  const r = await res.json();
  return r.display_name || "";
};

// First photo from an offering's gallery JSON (used as the list thumbnail).
const firstGalleryImage = (json) => {
  try { const a = JSON.parse(json || "[]"); return Array.isArray(a) && a.length ? a[0] : null; }
  catch { return null; }
};

// Where HDFC/Juspay redirects the user back to after payment.
// On web the gateway POSTs (form-urlencoded) to this URL, which a static SPA host
// answers with "Cannot POST" (HTTP 405). So route the return through the backend
// /ServiceBazaarPaymentCallback endpoint: it reconciles the booking on a POST, then
// 302-redirects the browser (GET) to the SPA result screen.
const buildServiceReturnUrl = () => {
  if (Capacitor.isNativePlatform()) return "vasbazaar://payment-callback?flow=serviceBazaar";
  const apiBase = (server_api() || "").replace(/\/$/, "");
  const appOrigin = encodeURIComponent(window.location.origin);
  return `${apiBase}/ServiceBazaarPaymentCallback?app=${appOrigin}`;
};

const openPaymentGateway = async (paymentUrl) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: paymentUrl });
      return;
    } catch (_) { /* fall through to web redirect */ }
  }
  window.location.href = paymentUrl;
};

/**
 * Public provider profile: trust info + bookable offerings + reviews.
 * Booking + payment stay on-platform (no raw contact exposed pre-booking),
 * per the PRD anti-leakage rule.
 */
export default function ProviderProfileScreen() {
  const navigate = useNavigate();
  const { providerId } = useParams();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [bookingFor, setBookingFor] = useState(null); // offering being booked
  const [form, setForm] = useState({ scheduledAt: "", serviceAddress: "", serviceLat: null, serviceLng: null, customerNotes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [subscribeFor, setSubscribeFor] = useState(null); // offering being subscribed
  const [subForm, setSubForm] = useState({ frequency: "DAILY", quantity: 1, serviceAddress: "", serviceLat: null, serviceLng: null });
  const [queue, setQueue] = useState(null);
  const [myToken, setMyToken] = useState(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Map-based service-address picker (search via Google Places / OSM fallback, or GPS).
  // locTarget tells the shared sheet which form to write the chosen address into.
  const [locPickerOpen, setLocPickerOpen] = useState(false);
  const [locTarget, setLocTarget] = useState("booking"); // "booking" | "sub"
  const [locating, setLocating] = useState(false);
  const { requestLocation } = useGeolocation({ autoRequest: false });

  const applyPickedAddress = useCallback((place) => {
    const address = place.full || place.label || "";
    const patch = { serviceAddress: address, serviceLat: place.lat ?? null, serviceLng: place.lng ?? null };
    if (locTarget === "sub") setSubForm((f) => ({ ...f, ...patch }));
    else setForm((f) => ({ ...f, ...patch }));
  }, [locTarget]);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const c = await requestLocation();
      if (c?.lat) {
        let address = "";
        try {
          address = isGoogleEnabled()
            ? await googleReverseGeocode(c.lat, c.lng)
            : await osmReverseGeocode(c.lat, c.lng);
        } catch { /* keep coords even if reverse-geocode fails */ }
        applyPickedAddress({ full: address, label: address, lat: c.lat, lng: c.lng });
      } else {
        showToast("Could not get your location", "error");
      }
    } catch {
      showToast("Location permission denied", "error");
    } finally {
      setLocating(false);
    }
  }, [requestLocation, applyPickedAddress, showToast]);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, mineRes] = await Promise.all([
      serviceBazaarService.getProviderProfile(providerId),
      serviceBazaarService.getMyProviderProfile(),
    ]);
    if (res.success) { setData(res.data); setFavorite(!!res.data?.isFavorite); }
    else showToast(res.message || "Provider not available", "error");
    // The viewer owns this profile when their own provider id matches the one on screen.
    setIsOwner(!!(mineRes?.success && mineRes.data && String(mineRes.data.id) === String(providerId)));
    setLoading(false);
  }, [providerId, showToast]);

  useEffect(() => { load(); }, [load]);

  // Live queue status for this provider (token-based salons/clinics).
  const loadQueue = useCallback(async () => {
    const res = await queueService.getProviderQueue(providerId);
    if (res.success) setQueue(res.data);
    const mine = await queueService.getMyTokens();
    if (mine.success) {
      const t = (mine.data || []).find((x) => x.provider && String(x.provider.id) === String(providerId));
      setMyToken(t || null);
    }
  }, [providerId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const joinQueue = async () => {
    if (queue?.slotMode && !selectedSlot) { showToast("Please pick a time slot", "error"); return; }
    setQueueBusy(true);
    const res = await queueService.join(providerId, null, queue?.slotMode ? selectedSlot : null);
    setQueueBusy(false);
    if (res.success) {
      showToast(`You got token #${res.data?.tokenNumber}`, "success");
      setSelectedSlot(null);
      loadQueue();
    } else showToast(res.message || "Could not join queue", "error");
  };

  const leaveQueue = async () => {
    if (!myToken) return;
    setQueueBusy(true);
    const res = await queueService.cancelToken(myToken.tokenId);
    setQueueBusy(false);
    if (res.success) { showToast("Left the queue", "success"); loadQueue(); }
    else showToast(res.message || "Could not leave", "error");
  };

  // Pull the wallet balance when a booking modal opens, to offer pay-from-wallet.
  useEffect(() => {
    if (!bookingFor) return;
    let cancelled = false;
    walletService.getWalletBalance().then((res) => {
      if (!cancelled && res.success) setWalletBalance(Number(res.data?.balance ?? 0));
    });
    return () => { cancelled = true; };
  }, [bookingFor]);

  const toggleFavorite = async () => {
    if (favBusy) return;
    setFavBusy(true);
    const next = !favorite;
    setFavorite(next); // optimistic
    const res = next
      ? await serviceBazaarService.addFavorite(providerId)
      : await serviceBazaarService.removeFavorite(providerId);
    if (!res.success) {
      setFavorite(!next); // revert
      showToast(res.message || "Could not update saved providers", "error");
    } else {
      showToast(next ? "Saved to your providers" : "Removed from saved", "success");
    }
    setFavBusy(false);
  };

  const submitSubscription = async () => {
    if (!subscribeFor) return;
    if (!subForm.serviceAddress.trim()) { showToast("Service address is required", "error"); return; }
    setSubmitting(true);
    const res = await subscriptionService.create({
      serviceOfferingId: subscribeFor.id,
      frequency: subForm.frequency,
      quantity: Number(subForm.quantity) || 1,
      serviceAddress: subForm.serviceAddress,
      serviceLat: subForm.serviceLat,
      serviceLng: subForm.serviceLng,
    });
    setSubmitting(false);
    if (res.success) {
      showToast("Subscription created", "success");
      setSubscribeFor(null);
      navigate("/customer/app/service-bazaar/subscriptions");
    } else {
      showToast(res.message || "Could not subscribe", "error");
    }
  };

  const [chatBusy, setChatBusy] = useState(false);
  const startChat = async () => {
    if (chatBusy) return;
    setChatBusy(true);
    const res = await serviceChatService.openThreadWithProvider(providerId);
    setChatBusy(false);
    if (res.success && res.data?.id) {
      navigate(`/customer/app/service-bazaar/chat/${res.data.id}`);
    } else {
      showToast(res.message || "Could not open chat", "error");
    }
  };

  const shareProfile = async () => {
    const url = window.location.href;
    const title = data?.provider?.businessName || data?.provider?.providerName || "Service provider";
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Check out ${title} on VasBazaar Service Bazaar`, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard", "success");
      }
    } catch (_) { /* user dismissed share sheet */ }
  };

  const submitBooking = async (paymentMethod = "ONLINE") => {
    if (!bookingFor) return;
    if (!form.scheduledAt) {
      showToast("Please select a preferred date and time", "error");
      return;
    }
    if (!form.serviceAddress.trim()) {
      showToast("Service address is required", "error");
      return;
    }
    setSubmitting(true);
    const payload = {
      serviceOfferingId: bookingFor.id,
      bookingType: "REQUEST",
      scheduledAt: form.scheduledAt,
      serviceAddress: form.serviceAddress,
      serviceLat: form.serviceLat,
      serviceLng: form.serviceLng,
      customerNotes: form.customerNotes,
      subtotal: bookingFor.basePrice,
      paymentMethod,
      ...(paymentMethod === "ONLINE" ? { returnUrl: buildServiceReturnUrl() } : {}),
    };
    const res = await serviceBazaarService.createBooking(payload);
    if (!res.success) {
      setSubmitting(false);
      showToast(res.message || "Could not create booking", "error");
      return;
    }

    const data = res.data || {};
    setBookingFor(null);
    setSubmitting(false);

    // Wallet path settles instantly — straight to the booking, no gateway hop.
    if (paymentMethod === "WALLET" || data.paymentStatus === "PAID") {
      showToast("Booking paid from wallet", "success");
      navigate(`/customer/app/service-bazaar/bookings/${data.bookingId}`);
      return;
    }

    const paymentUrl = extractPaymentUrl(res) || data.paymentUrl;
    if (paymentUrl) {
      await savePaymentContext({ flow: "serviceBazaar", bookingId: data.bookingId, bookingNo: data.bookingNo, amount: data.totalAmount });
      await openPaymentGateway(paymentUrl);
      return;
    }

    showToast("Couldn't start payment. Please try again.", "error");
  };

  if (loading) return (
    <div className="sb-page">
      <div className="sb-skel" style={{ height: 110, marginBottom: 12 }} />
      <div className="sb-skel" style={{ height: 160, marginBottom: 12 }} />
      <div className="sb-skel" style={{ height: 120 }} />
    </div>
  );
  if (!data?.provider) return <div className="sb-page"><div className="sb-empty">Provider not available.</div></div>;

  const p = data.provider;
  const offerings = data.offerings || [];
  const reviews = data.reviews || [];

  // The payable amount mirrors the backend: service base price + the provider's
  // doorstep travel/visit fee. Showing only basePrice here let a "₹0" service jump
  // to ₹500 at the gateway — surface the breakdown so the displayed amount matches.
  const bookingBase = Number(bookingFor?.basePrice || 0);
  const bookingTravel = Number(p?.travelCharge || 0);
  const bookingTotal = Math.max(0, bookingBase + bookingTravel);

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">Provider</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {!isOwner && (
            <button
              className="sb-share"
              onClick={toggleFavorite}
              disabled={favBusy}
              aria-label={favorite ? "Remove from saved" : "Save provider"}
              style={favorite ? { color: "#ef4444" } : undefined}
            >
              {favorite ? <FaHeart /> : <FaRegHeart />}
            </button>
          )}
          <button className="sb-share" onClick={shareProfile} aria-label="Share"><FaShareAlt /></button>
        </div>
      </div>

      {p.bannerUrl && (
        <div className="sb-cover-banner">
          <img src={p.bannerUrl} alt={`${p.businessName || p.providerName} cover`} />
        </div>
      )}

      <div className="sb-section">
        <div style={{ display: "flex", gap: 12 }}>
          <div className="sb-avatar" style={{ width: 64, height: 64 }}>
            {p.profilePhotoUrl
              ? <img src={p.profilePhotoUrl} alt={p.providerName} style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} />
              : (p.businessName || p.providerName || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p className="sb-card-name" style={{ fontSize: 18 }}>
              {p.businessName || p.providerName}
              <TierChip level={p.verificationLevel} />
            </p>
            <p className="sb-card-meta">{p.headline || p.categoryId?.name}</p>
            <div className="sb-badges">
              {Number(p.ratingAvg) > 0 && (
                <span className="sb-badge rating"><FaStar style={{ marginRight: 3, fontSize: 10 }} />{Number(p.ratingAvg).toFixed(1)} ({p.reviewCount || 0})</span>
              )}
            </div>
            <TrustBadges badges={p.trustBadges} />
          </div>
        </div>
        {p.about && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 12 }}>{p.about}</p>}
        {(p.city || p.serviceAreas) && (
          <p className="sb-card-meta" style={{ marginTop: 8 }}>
            <FaMapMarkerAlt style={{ marginRight: 4 }} />
            {[p.city, p.serviceAreas].filter(Boolean).join(" • ")}
          </p>
        )}
        {!isOwner && (
          <button className="sb-btn ghost block" style={{ marginTop: 12 }} disabled={chatBusy} onClick={startChat}>
            <FaComments style={{ marginRight: 6 }} /> {chatBusy ? "Opening…" : "Chat with provider"}
          </button>
        )}
        {isOwner && (
          <div style={{ marginTop: 12 }}>
            <button className="sb-btn block" onClick={() => navigate("/customer/app/service-bazaar/provider")}>
              <FaEdit style={{ marginRight: 6 }} /> Edit profile
            </button>
            <p className="sb-card-meta" style={{ marginTop: 6 }}>
              Any edit is resubmitted to VasBazaar for approval.
            </p>
          </div>
        )}
      </div>

      {queue?.queueEnabled && (queue?.open || myToken) && (
        <div className="sb-section">
          <h3>Live queue</h3>
          {(queue?.opensAt || queue?.closesAt) && (
            <p className="sb-card-meta" style={{ marginTop: -4, marginBottom: 8 }}>
              Open today {String(queue.opensAt || "").slice(0, 5)}–{String(queue.closesAt || "").slice(0, 5)}
            </p>
          )}
          {myToken ? (
            <>
              <div className="sb-otp-banner" style={{ marginTop: 4 }}>
                <p className="sb-otp-label">Your token</p>
                <p className="sb-otp-code">#{myToken.tokenNumber}</p>
                {myToken.slotTime && (
                  <p className="sb-otp-hint">Slot: {String(myToken.slotTime).slice(0, 5)}</p>
                )}
                <p className="sb-otp-hint">
                  Now serving #{myToken.nowServing ?? 0} • {myToken.peopleAhead} ahead • ~{myToken.estWaitMinutes} min wait
                </p>
              </div>
              <button className="sb-btn ghost block" style={{ marginTop: 8 }} disabled={queueBusy} onClick={leaveQueue}>Leave queue</button>
            </>
          ) : queue?.open ? (
            <>
              <p className="sb-card-meta">Now serving #{queue.nowServing ?? 0} • {queue.waiting ?? 0} waiting • ~{queue.avgServiceMinutes} min each</p>
              {queue?.slotMode ? (
                <>
                  <p className="sb-card-meta" style={{ marginTop: 8 }}>Pick a slot:</p>
                  <div className="sb-slot-grid">
                    {(queue.slots || []).map((s) => {
                      const disabled = s.full || s.past;
                      const isSel = selectedSlot === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          className={`sb-slot-chip${isSel ? " selected" : ""}`}
                          disabled={disabled}
                          onClick={() => setSelectedSlot(s.start)}
                        >
                          {String(s.start).slice(0, 5)}
                          <span className="sb-slot-left">{s.full ? "Full" : s.past ? "Passed" : `${s.available} left`}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button className="sb-btn block" style={{ marginTop: 8 }} disabled={queueBusy || !selectedSlot} onClick={joinQueue}>
                    {queueBusy ? "Please wait…" : selectedSlot ? `Book ${selectedSlot.slice(0, 5)} slot` : "Select a slot above"}
                  </button>
                </>
              ) : (
                <button className="sb-btn block" style={{ marginTop: 8 }} disabled={queueBusy} onClick={joinQueue}>{queueBusy ? "Please wait…" : "Join queue (get a token)"}</button>
              )}
            </>
          ) : null}
        </div>
      )}

      <div className="sb-section">
        <h3>Services</h3>
        {offerings.length === 0 ? (
          <p className="sb-card-meta">No services listed yet.</p>
        ) : offerings.map((o) => (
          <div className="sb-offering" key={o.id}>
            {firstGalleryImage(o.galleryJson) && (
              <img src={firstGalleryImage(o.galleryJson)} alt={o.title} className="sb-avatar" style={{ width: 48, height: 48 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="sb-offering-title">{o.title}</p>
              {o.description && <p className="sb-offering-desc">{o.description}</p>}
              {o.durationMinutes ? <p className="sb-offering-desc">~{o.durationMinutes} min</p> : null}
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="sb-price">₹{Number(o.basePrice || 0).toFixed(0)}{o.pricingType === "STARTING_FROM" ? "+" : ""}</div>
              <button className="sb-btn sm" style={{ marginTop: 6 }} onClick={() => { setBookingFor(o); setForm({ scheduledAt: "", serviceAddress: "", serviceLat: null, serviceLng: null, customerNotes: "" }); }}>
                Book
              </button>
              <button className="sb-btn ghost sm" style={{ marginTop: 6 }} onClick={() => { setSubscribeFor(o); setSubForm({ frequency: "DAILY", quantity: 1, serviceAddress: "", serviceLat: null, serviceLng: null }); }}>
                Subscribe
              </button>
            </div>
          </div>
        ))}
      </div>

      {reviews.length > 0 && (
        <div className="sb-section">
          <h3>Reviews</h3>
          {reviews.map((r) => (
            <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(127,127,127,0.12)" }}>
              <div style={{ color: "#f59e0b", fontSize: 13 }}>{"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</div>
              {r.reviewText && <p style={{ fontSize: 13, margin: "4px 0 0" }}>{r.reviewText}</p>}
            </div>
          ))}
        </div>
      )}

      {subscribeFor && (
        <div className="sb-modal-backdrop" onClick={() => setSubscribeFor(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Subscribe: {subscribeFor.title}</h3>
            <p className="sb-price" style={{ marginBottom: 10 }}>₹{Number(subscribeFor.basePrice || 0).toFixed(0)} per delivery</p>
            <div className="sb-field">
              <label>Frequency</label>
              <select value={subForm.frequency} onChange={(e) => setSubForm({ ...subForm, frequency: e.target.value })}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="sb-field">
              <label>Quantity</label>
              <input type="number" min={1} value={subForm.quantity} onChange={(e) => setSubForm({ ...subForm, quantity: e.target.value })} />
            </div>
            <div className="sb-field">
              <label>Service address</label>
              <button
                type="button"
                className="sb-loc-btn"
                disabled={locating}
                onClick={() => { setLocTarget("sub"); setLocPickerOpen(true); }}
              >
                <FaMapMarkerAlt style={{ marginRight: 6 }} />
                {locating ? "Locating…" : (subForm.serviceLat != null ? "Change location on map" : "Pick location on map")}
              </button>
              <textarea rows={2} value={subForm.serviceAddress} onChange={(e) => setSubForm({ ...subForm, serviceAddress: e.target.value, serviceLat: null, serviceLng: null })} placeholder="Where should it be delivered?" />
            </div>
            <p className="sb-card-meta" style={{ marginBottom: 10 }}>Each delivery is billed from your VasBazaar wallet. Pause, skip or cancel anytime.</p>
            <button className="sb-btn block" disabled={submitting} onClick={submitSubscription}>{submitting ? "Please wait…" : "Start subscription"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setSubscribeFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      {bookingFor && (
        <div className="sb-modal-backdrop" onClick={() => setBookingFor(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Book: {bookingFor.title}</h3>
            <div style={{ marginBottom: 14 }}>
              {bookingTravel > 0 && (
                <>
                  <div className="sb-row-between" style={{ fontSize: 13, opacity: 0.8 }}>
                    <span>Service price</span><span>₹{bookingBase.toFixed(0)}</span>
                  </div>
                  <div className="sb-row-between" style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                    <span>Travel / visit charge</span><span>₹{bookingTravel.toFixed(0)}</span>
                  </div>
                </>
              )}
              <div className="sb-row-between" style={{ marginTop: bookingTravel > 0 ? 6 : 0 }}>
                <span className="sb-price">₹{bookingTotal.toFixed(0)}</span>
                {bookingTravel > 0 && <span style={{ fontSize: 12, opacity: 0.7 }}>Total payable</span>}
              </div>
            </div>
            <div className="sb-field">
              <label>Preferred date & time</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </div>
            <div className="sb-field">
              <label>Service address</label>
              <button
                type="button"
                className="sb-loc-btn"
                disabled={locating}
                onClick={() => { setLocTarget("booking"); setLocPickerOpen(true); }}
              >
                <FaMapMarkerAlt style={{ marginRight: 6 }} />
                {locating ? "Locating…" : (form.serviceLat != null ? "Change location on map" : "Pick location on map")}
              </button>
              <textarea rows={2} value={form.serviceAddress} onChange={(e) => setForm({ ...form, serviceAddress: e.target.value, serviceLat: null, serviceLng: null })} placeholder="Where should the provider come?" />
            </div>
            <div className="sb-field">
              <label>Notes (optional)</label>
              <textarea rows={2} value={form.customerNotes} onChange={(e) => setForm({ ...form, customerNotes: e.target.value })} />
            </div>
            <button className="sb-btn block" disabled={submitting} onClick={() => submitBooking("ONLINE")}>
              {submitting ? "Please wait…" : `Pay ₹${bookingTotal.toFixed(0)} online`}
            </button>
            {(() => {
              const price = bookingTotal;
              const canWallet = walletBalance != null && walletBalance >= price;
              return (
                <button
                  className="sb-btn ghost block"
                  style={{ marginTop: 8 }}
                  disabled={submitting || !canWallet}
                  onClick={() => submitBooking("WALLET")}
                  title={canWallet ? "" : "Insufficient wallet balance"}
                >
                  {walletBalance == null
                    ? "Checking wallet…"
                    : canWallet
                      ? `Pay ₹${price.toFixed(0)} from wallet (₹${walletBalance.toFixed(0)})`
                      : `Wallet too low (₹${walletBalance.toFixed(0)})`}
                </button>
              );
            })()}
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setBookingFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      <LocationPickerSheet
        open={locPickerOpen}
        onClose={() => setLocPickerOpen(false)}
        onSelect={applyPickedAddress}
        onUseCurrent={handleUseCurrentLocation}
        currentLabel={locTarget === "sub" ? subForm.serviceAddress : form.serviceAddress}
        allowFreeText
      />
    </div>
  );
}
