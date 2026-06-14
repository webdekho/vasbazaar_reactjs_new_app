import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaClock } from "react-icons/fa";
import { getPaymentContext } from "../../services/juspayService";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { playSuccessSound } from "../../services/audioService";
import "./service-bazaar.css";

const STATE = { VERIFYING: "verifying", SUCCESS: "success", FAILED: "failed", PENDING: "pending" };

/**
 * Post-gateway return screen for Service Bazaar online prepayment.
 * Mirrors the marketplace callback: poll the backend (which reconciles with HDFC)
 * until PAID/FAILED, then route to the booking detail.
 */
export default function ServicePaymentCallbackScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState(STATE.VERIFYING);
  const [bookingId, setBookingId] = useState(null);
  const [message, setMessage] = useState("Verifying your payment…");
  const polledRef = useRef(false);

  useEffect(() => {
    if (polledRef.current) return;
    polledRef.current = true;

    const verify = async () => {
      const ctx = await getPaymentContext();
      const localBookingId = ctx?.bookingId || searchParams.get("bookingId");
      if (!localBookingId) {
        setState(STATE.FAILED);
        setMessage("Could not identify your booking. Please check My Bookings.");
        return;
      }
      setBookingId(localBookingId);

      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const res = await serviceBazaarService.checkBookingPayment(localBookingId);
          const status = String(res?.data?.paymentStatus || "").toUpperCase();
          if (status === "PAID") {
            setState(STATE.SUCCESS);
            playSuccessSound().catch(() => {});
            setTimeout(() => navigate(`/customer/app/service-bazaar/bookings/${localBookingId}`, { replace: true }), 1200);
            return;
          }
          if (status === "FAILED") {
            setState(STATE.FAILED);
            setMessage("Payment failed. You can retry from the booking details.");
            return;
          }
        } catch (_) { /* retry */ }
        await new Promise((r) => setTimeout(r, 3000));
      }
      setState(STATE.PENDING);
      setMessage("Payment is still processing. We'll update your booking once confirmed.");
    };

    verify();
  }, [navigate, searchParams]);

  const Icon = state === STATE.SUCCESS ? FaCheckCircle : state === STATE.FAILED ? FaTimesCircle : FaClock;
  const color = state === STATE.SUCCESS ? "#10b981" : state === STATE.FAILED ? "#ef4444" : "#f59e0b";

  return (
    <div className="sb-page" style={{ textAlign: "center", paddingTop: 80 }}>
      {state === STATE.VERIFYING ? (
        <>
          <div className="md-spinner" style={{ margin: "0 auto 16px" }} />
          <p>{message}</p>
        </>
      ) : (
        <>
          <Icon size={64} color={color} style={{ marginBottom: 16 }} />
          <h2 style={{ margin: "0 0 8px" }}>
            {state === STATE.SUCCESS ? "Payment successful" : state === STATE.FAILED ? "Payment failed" : "Payment pending"}
          </h2>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>{state === STATE.SUCCESS ? "Redirecting to your booking…" : message}</p>
          {bookingId && state !== STATE.SUCCESS && (
            <button className="sb-btn block" onClick={() => navigate(`/customer/app/service-bazaar/bookings/${bookingId}`, { replace: true })}>
              View Booking
            </button>
          )}
          <button className="sb-btn ghost block" style={{ marginTop: 8 }} onClick={() => navigate("/customer/app/service-bazaar/my-bookings", { replace: true })}>
            My Bookings
          </button>
        </>
      )}
    </div>
  );
}
