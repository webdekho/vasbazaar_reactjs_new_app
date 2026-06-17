import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { FaArrowLeft, FaStar, FaCheckCircle, FaMapMarkerAlt, FaShareAlt } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { savePaymentContext, extractPaymentUrl } from "../../services/juspayService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

// Where HDFC/Juspay redirects the user back to after payment.
const buildServiceReturnUrl = () => {
  if (Capacitor.isNativePlatform()) return "vasbazaar://payment-callback?flow=serviceBazaar";
  const origin = window.location.origin;
  const match = window.location.pathname.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/service-bazaar/payment-callback`;
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
  const [bookingFor, setBookingFor] = useState(null); // offering being booked
  const [form, setForm] = useState({ scheduledAt: "", serviceAddress: "", customerNotes: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await serviceBazaarService.getProviderProfile(providerId);
    if (res.success) setData(res.data);
    else showToast(res.message || "Provider not available", "error");
    setLoading(false);
  }, [providerId, showToast]);

  useEffect(() => { load(); }, [load]);

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

  const submitBooking = async () => {
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
      customerNotes: form.customerNotes,
      subtotal: bookingFor.basePrice,
      paymentMethod: "ONLINE",
      returnUrl: buildServiceReturnUrl(),
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

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">Provider</h1>
        <button className="sb-share" onClick={shareProfile} aria-label="Share"><FaShareAlt /></button>
      </div>

      <div className="sb-section">
        <div style={{ display: "flex", gap: 12 }}>
          <div className="sb-avatar" style={{ width: 64, height: 64 }}>
            {p.profilePhotoUrl
              ? <img src={p.profilePhotoUrl} alt={p.providerName} style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} />
              : (p.businessName || p.providerName || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p className="sb-card-name" style={{ fontSize: 18 }}>{p.businessName || p.providerName}</p>
            <p className="sb-card-meta">{p.headline || p.categoryId?.name}</p>
            <div className="sb-badges">
              {Number(p.ratingAvg) > 0 && (
                <span className="sb-badge rating"><FaStar style={{ marginRight: 3, fontSize: 10 }} />{Number(p.ratingAvg).toFixed(1)} ({p.reviewCount || 0})</span>
              )}
              <span className="sb-badge"><FaCheckCircle style={{ marginRight: 3, fontSize: 10 }} /> Verified</span>
            </div>
          </div>
        </div>
        {p.about && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 12 }}>{p.about}</p>}
        {(p.city || p.serviceAreas) && (
          <p className="sb-card-meta" style={{ marginTop: 8 }}>
            <FaMapMarkerAlt style={{ marginRight: 4 }} />
            {[p.city, p.serviceAreas].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      <div className="sb-section">
        <h3>Services</h3>
        {offerings.length === 0 ? (
          <p className="sb-card-meta">No services listed yet.</p>
        ) : offerings.map((o) => (
          <div className="sb-offering" key={o.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="sb-offering-title">{o.title}</p>
              {o.description && <p className="sb-offering-desc">{o.description}</p>}
              {o.durationMinutes ? <p className="sb-offering-desc">~{o.durationMinutes} min</p> : null}
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="sb-price">₹{Number(o.basePrice || 0).toFixed(0)}{o.pricingType === "STARTING_FROM" ? "+" : ""}</div>
              <button className="sb-btn sm" style={{ marginTop: 6 }} onClick={() => { setBookingFor(o); setForm({ scheduledAt: "", serviceAddress: "", customerNotes: "" }); }}>
                Book
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

      {bookingFor && (
        <div className="sb-modal-backdrop" onClick={() => setBookingFor(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Book: {bookingFor.title}</h3>
            <p className="sb-price" style={{ marginBottom: 14 }}>₹{Number(bookingFor.basePrice || 0).toFixed(0)}</p>
            <div className="sb-field">
              <label>Preferred date & time</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </div>
            <div className="sb-field">
              <label>Service address</label>
              <textarea rows={2} value={form.serviceAddress} onChange={(e) => setForm({ ...form, serviceAddress: e.target.value })} placeholder="Where should the provider come?" />
            </div>
            <div className="sb-field">
              <label>Notes (optional)</label>
              <textarea rows={2} value={form.customerNotes} onChange={(e) => setForm({ ...form, customerNotes: e.target.value })} />
            </div>
            <button className="sb-btn block" disabled={submitting} onClick={submitBooking}>
              {submitting ? "Please wait…" : `Pay ₹${Number(bookingFor.basePrice || 0).toFixed(0)} online`}
            </button>
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setBookingFor(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
