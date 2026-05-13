import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaHourglassHalf } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // ~60 seconds

/**
 * Landing page after the HDFC SmartGateway redirects the browser back. Polls
 * /bookings/{id}/check-status until the booking moves out of PAYMENT_INITIATE,
 * then navigates to the success or failure screen.
 */
const BookingResultScreen = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idFromQuery = params.get("bookingId");
  const idFromStorage = (() => {
    try { return sessionStorage.getItem("rybbo_pending_booking"); } catch { return null; }
  })();
  const bookingId = idFromQuery || idFromStorage;

  const [state, setState] = useState({ status: "POLLING", message: "Verifying payment…" });
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!bookingId) {
      setState({ status: "FAILED", message: "No booking reference found." });
      return;
    }
    let cancelled = false;

    const poll = async () => {
      attemptsRef.current += 1;
      const r = await rybboService.checkBookingStatus(bookingId);
      if (cancelled) return;
      if (!r.success) {
        if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
          setState({ status: "FAILED", message: r.message || "Could not verify payment." });
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      const status = (r.data?.status || "").toUpperCase();
      if (status === "CONFIRMED") {
        try { sessionStorage.removeItem("rybbo_pending_booking"); } catch {}
        navigate(`/customer/app/rybbo/booking-success/${bookingId}`, { state: { booking: r.data }, replace: true });
        return;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        try { sessionStorage.removeItem("rybbo_pending_booking"); } catch {}
        setState({ status: "FAILED", message: "Payment failed or was cancelled." });
        return;
      }
      if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
        setState({ status: "PENDING", message: "Still waiting for confirmation. You can check My Bookings shortly." });
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
    return () => { cancelled = true; };
  }, [bookingId, navigate]);

  const renderIcon = () => {
    if (state.status === "POLLING") return <FaHourglassHalf size={48} color="#007BFF" />;
    if (state.status === "FAILED") return <FaTimesCircle size={48} color="#dc2626" />;
    if (state.status === "PENDING") return <FaHourglassHalf size={48} color="#f59e0b" />;
    return <FaCheckCircle size={48} color="#22c55e" />;
  };

  return (
    <div style={{ padding: 24, minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
      {renderIcon()}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
        {state.status === "POLLING" && "Verifying payment"}
        {state.status === "FAILED" && "Payment failed"}
        {state.status === "PENDING" && "Payment pending"}
      </h2>
      <p style={{ fontSize: 14, color: "var(--cm-muted, #6B7280)", margin: 0, maxWidth: 360 }}>{state.message}</p>
      {state.status !== "POLLING" && (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button type="button" onClick={() => navigate("/customer/app/rybbo/my-bookings")}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontWeight: 700, cursor: "pointer" }}>
            My Bookings
          </button>
          <button type="button" onClick={() => navigate("/customer/app/rybbo")}
            style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Back to RYBBO
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingResultScreen;
