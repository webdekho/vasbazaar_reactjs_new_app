import { useState } from "react";
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import { FaArrowLeft, FaTag, FaCheckCircle, FaWallet, FaMobileAlt } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import { server_api } from "../../../utils/constants";

const CONVENIENCE_PCT = 2; // 2% fee — matches backend CONVENIENCE_PCT

const BookingSummaryScreen = () => {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const event = location.state?.event;
  const showtime = location.state?.showtime;
  const lineItems = location.state?.lineItems || [];
  const subtotal = location.state?.subtotal || 0;

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!event || lineItems.length === 0) return <Navigate to={`/customer/app/rybbo/event/${slug}`} replace />;

  const discount = appliedCoupon?.discount || 0;
  const fee = Math.round(((subtotal - discount) * CONVENIENCE_PCT) / 100);
  const total = subtotal - discount + fee;

  const applyCoupon = async () => {
    setCouponError("");
    if (!coupon.trim()) return;
    const r = await rybboService.applyCoupon({ code: coupon.trim(), amount: subtotal });
    if (!r.success) {
      setCouponError(r.message || "Invalid coupon");
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon({ ...r.data, discount: Number(r.data.discount) });
  };

  const handlePay = async () => {
    setSubmitting(true);
    setError("");
    // Route HDFC's POST callback through the backend so it can run the
    // success/failure side effects, then 302-redirect the browser back to a
    // GET-able SPA route (rybbo landing on cancel/fail).
    const apiBase = (server_api() || "").replace(/\/$/, "");
    const appOrigin = encodeURIComponent(window.location.origin);
    const returnUrl = `${apiBase}/RybboPaymentCallback?app=${appOrigin}`;
    const r = await rybboService.initiateBooking({
      eventId: event.id,
      showtimeId: showtime?.id,
      couponCode: appliedCoupon?.code || null,
      paymentMode,
      returnUrl,
      items: lineItems.map((li) => ({ ticketCategoryId: li.id, qty: li.qty })),
    });
    if (!r.success) {
      setSubmitting(false);
      setError(r.message || "Could not start payment");
      return;
    }
    const { bookingId, status, paymentUrl } = r.data || {};

    // Wallet path — confirmed inline by backend
    if (status === "CONFIRMED") {
      navigate(`/customer/app/rybbo/booking-success/${bookingId}`, { state: { booking: r.data } });
      return;
    }

    // UPI path — redirect to HDFC payment page
    if (paymentUrl) {
      // Persist the booking id so the result screen can poll status even after
      // the payment gateway sends the browser back via a fresh history entry.
      try { sessionStorage.setItem("rybbo_pending_booking", String(bookingId)); } catch {}
      window.location.href = paymentUrl;
      return;
    }

    setSubmitting(false);
    setError("Payment session could not be started. Please try again.");
  };

  return (
    <div style={{ paddingBottom: 130, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
          <FaArrowLeft />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Order Summary</div>
      </div>

      <div style={{ padding: "16px 14px" }}>
        <div style={{ display: "flex", gap: 12, padding: 12, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, marginBottom: 16 }}>
          <img src={event.poster} alt="" style={{ width: 70, height: 90, objectFit: "cover", borderRadius: 8 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{event.title}</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{event.venue}, {event.city}</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{showtime?.date} · {showtime?.time}</div>
          </div>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Tickets</h3>
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          {lineItems.map((li) => (
            <div key={li.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{li.name} × {li.qty}</span>
              <span>₹{li.lineTotal}</span>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "12px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <FaTag size={12} /> Apply coupon
        </h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            type="text" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Enter code (try RYBBO100)"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 14 }}
          />
          <button type="button" onClick={applyCoupon}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontWeight: 700, cursor: "pointer" }}>
            Apply
          </button>
        </div>
        {couponError && <div style={{ fontSize: 12, color: "#ff6b6b", marginBottom: 8 }}>{couponError}</div>}
        {appliedCoupon && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "rgba(34,197,94,0.1)", borderRadius: 8, fontSize: 12, color: "#22c55e", marginBottom: 8 }}>
            <FaCheckCircle /> {appliedCoupon.label} — saved ₹{appliedCoupon.discount}
          </div>
        )}

        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px" }}>Payment method</h3>
        <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
          {[
            { key: "upi", label: "UPI / Card", icon: <FaMobileAlt /> },
            { key: "wallet", label: "VasBazaar Wallet", icon: <FaWallet /> },
          ].map((opt) => {
            const active = paymentMode === opt.key;
            return (
              <button
                key={opt.key} type="button" onClick={() => setPaymentMode(opt.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
                  border: `1.5px solid ${active ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`,
                  background: active ? "rgba(0,123,255,0.06)" : "transparent",
                  color: "inherit", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left",
                }}
              >
                <span style={{ color: active ? "#007BFF" : "var(--cm-muted, #6B7280)" }}>{opt.icon}</span>
                {opt.label}
                {active && <FaCheckCircle style={{ marginLeft: "auto", color: "#007BFF" }} />}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: "1px solid var(--cm-line, #E5E7EB)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span>Subtotal</span><span>₹{subtotal}</span></div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#22c55e" }}><span>Discount</span><span>−₹{discount}</span></div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span>Convenience fee ({CONVENIENCE_PCT}%)</span><span>₹{fee}</span></div>
          <div style={{ borderTop: "1px solid var(--cm-line, #E5E7EB)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
            <span>Total payable</span><span>₹{total}</span>
          </div>
        </div>

        {error && <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(255,107,107,0.1)", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>{error}</div>}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 14px", background: "var(--cm-card, #FFFFFF)", borderTop: "1px solid var(--cm-line, #E5E7EB)", zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 8px" }}>
          <button type="button" onClick={handlePay} disabled={submitting}
            style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, fontSize: 16, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Processing…" : `Pay ₹${total}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingSummaryScreen;
