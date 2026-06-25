import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

/**
 * Customer "My Bookings": track status, cancel (while allowed), and
 * review after completion (one review per booking, enforced server-side).
 */
export default function MyServiceBookingsScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewFor, setReviewFor] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await serviceBazaarService.getMyBookings({ pageSize: 50 });
    if (res.success) setBookings(res.data?.records || []);
    else showToast(res.message || "Could not load bookings", "error");
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (b) => {
    setBusy(true);
    const res = await serviceBazaarService.cancelBooking(b.id, "Cancelled by customer");
    setBusy(false);
    if (res.success) { showToast("Booking cancelled", "success"); load(); }
    else showToast(res.message || "Could not cancel", "error");
  };

  const submitReview = async () => {
    if (!reviewFor) return;
    setBusy(true);
    const res = await serviceBazaarService.addReview({
      bookingId: { id: reviewFor.id },
      rating,
      reviewText,
    });
    setBusy(false);
    if (res.success) {
      showToast("Review submitted. Thank you!", "success");
      setReviewFor(null);
      setRating(5);
      setReviewText("");
      load();
    } else {
      showToast(res.message || "Could not submit review", "error");
    }
  };

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate("/customer/app/service-bazaar")} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">My Bookings</h1>
      </div>

      <div className="sb-results">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <div className="sb-skel" key={i} style={{ height: 92, marginBottom: 10 }} />)
      ) : bookings.length === 0 ? (
        <div className="sb-empty">No bookings yet. Discover a service to get started!</div>
      ) : bookings.map((b) => {
        const status = b.bookingStatus || "PENDING";
        const cancellable = status !== "COMPLETED" && status !== "CANCELLED";
        const reviewable = status === "COMPLETED";
        return (
          <div className="sb-booking" key={b.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/customer/app/service-bazaar/bookings/${b.id}`)}>
            <div className="sb-booking-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="sb-offering-title">{b.serviceOfferingId?.title || "Service"}</p>
                <p className="sb-offering-desc">{b.providerProfileId?.businessName || b.providerProfileId?.providerName}</p>
                <p className="sb-offering-desc">#{b.bookingNo} • ₹{Number(b.totalAmount || 0).toFixed(0)}</p>
              </div>
              <span className={`sb-status ${status}`}>{status.replace("_", " ")}</span>
            </div>
            {(cancellable || reviewable) && (
              <div className="sb-row-actions" onClick={(e) => e.stopPropagation()}>
                {reviewable && <button className="sb-btn sm" onClick={() => setReviewFor(b)}>Leave Review</button>}
                {cancellable && <button className="sb-btn sm danger" disabled={busy} onClick={() => cancel(b)}>Cancel</button>}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {reviewFor && (
        <div className="sb-modal-backdrop" onClick={() => setReviewFor(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Rate your experience</h3>
            <div className="sb-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`sb-star ${n <= rating ? "on" : ""}`} onClick={() => setRating(n)}>★</span>
              ))}
            </div>
            <div className="sb-field" style={{ marginTop: 14 }}>
              <label>Your review (optional)</label>
              <textarea rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="How was the service?" />
            </div>
            <button className="sb-btn block" disabled={busy} onClick={submitReview}>{busy ? "Submitting…" : "Submit Review"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8 }} onClick={() => setReviewFor(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
