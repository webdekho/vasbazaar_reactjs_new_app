import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCheck } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

// Lifecycle order used to drive the tracking timeline.
const FLOW = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];
const STEP_LABEL = {
  PENDING: "Requested",
  CONFIRMED: "Confirmed by provider",
  IN_PROGRESS: "Service in progress",
  COMPLETED: "Completed",
};

export default function ServiceBookingDetailScreen() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { showToast } = useToast();

  const [b, setB] = useState(null);
  const [otp, setOtp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [dispute, setDispute] = useState({ reason: "Service not delivered", description: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await serviceBazaarService.getBooking(bookingId);
    if (res.success) {
      setB(res.data);
      const st = res.data?.bookingStatus;
      // The live Start/End service OTP the customer reads out to the provider.
      if (st === "CONFIRMED" || st === "IN_PROGRESS") {
        const otpRes = await serviceBazaarService.getBookingOtp(bookingId);
        setOtp(otpRes.success ? otpRes.data : null);
      } else {
        setOtp(null);
      }
    } else showToast(res.message || "Booking not found", "error");
    setLoading(false);
  }, [bookingId, showToast]);

  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    setBusy(true);
    const res = await serviceBazaarService.cancelBooking(b.id, "Cancelled by customer");
    setBusy(false);
    if (res.success) { showToast("Booking cancelled", "success"); load(); }
    else showToast(res.message || "Could not cancel", "error");
  };

  const submitDispute = async () => {
    setBusy(true);
    const res = await serviceBazaarService.raiseDispute({
      bookingId: b.id,
      reason: dispute.reason,
      description: dispute.description,
    });
    setBusy(false);
    if (res.success) {
      showToast("Issue reported — our team will review it", "success");
      setShowDispute(false);
    } else {
      showToast(res.message || "Could not report the issue", "error");
    }
  };

  const checkPayment = async () => {
    setBusy(true);
    const res = await serviceBazaarService.checkBookingPayment(b.id);
    setBusy(false);
    const status = String(res?.data?.paymentStatus || "").toUpperCase();
    if (status === "PAID") showToast("Payment confirmed", "success");
    else if (status === "FAILED") showToast("Payment failed", "error");
    else showToast("Still pending — try again in a moment", "info");
    load();
  };

  if (loading) return <div className="sb-page"><div className="sb-skel" style={{ height: 200 }} /></div>;
  if (!b) return <div className="sb-page"><div className="sb-empty">Booking not found.</div></div>;

  const status = b.bookingStatus || "PENDING";
  const cancelled = status === "CANCELLED";
  const currentIdx = FLOW.indexOf(status);
  const provider = b.providerProfileId || {};
  const subtotal = Number(b.subtotal || 0);
  const platform = Number(b.platformCharge || 0);
  const travel = Number(b.travelCharge || 0);
  const discount = Number(b.discountAmount || 0);
  const total = Number(b.totalAmount || 0);
  const fulfillment = b.fulfillmentStatus;
  const otpValue = otp?.otp;
  const otpStage = otp?.stage; // START | END

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate("/customer/app/service-bazaar/my-bookings")} aria-label="Back"><FaArrowLeft /></button>
        <div>
          <h1 className="sb-title">Booking</h1>
          <p className="sb-sub">#{b.bookingNo}</p>
        </div>
        <span className={`sb-status ${status}`} style={{ marginLeft: "auto" }}>{status.replace("_", " ")}</span>
      </div>

      {/* Live service OTP — customer reads it out to the provider */}
      {otpValue && (
        <div className="sb-otp-banner">
          <p className="sb-otp-label">
            {otpStage === "START"
              ? "Share this OTP to START the service"
              : "Share this OTP to CLOSE the service"}
          </p>
          <p className="sb-otp-code">{otpValue}</p>
          <p className="sb-otp-hint">Read it out only when the professional is with you.</p>
        </div>
      )}

      {/* Tracking timeline */}
      {!cancelled ? (
        <div className="sb-section">
          <h3>Track your booking</h3>
          {fulfillment && status === "CONFIRMED" && (
            <p className="sb-card-meta" style={{ marginTop: -4, marginBottom: 8 }}>
              {fulfillment === "ON_THE_WAY" ? "Your professional is on the way" : "Professional has reached your location"}
            </p>
          )}
          <div className="sb-timeline">
            {FLOW.map((s, i) => {
              const done = i < currentIdx || status === "COMPLETED";
              const current = i === currentIdx && status !== "COMPLETED";
              const cls = done ? "done" : current ? "current" : "pendingstep";
              return (
                <div key={s} className={`sb-step ${cls}`}>
                  <span className="sb-dot">{done ? <FaCheck size={11} /> : i + 1}</span>
                  <div className="sb-step-body">
                    <p className="sb-step-title">{STEP_LABEL[s]}</p>
                    {current && <p className="sb-step-sub">Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="sb-section" style={{ borderColor: "rgba(239,68,68,0.4)" }}>
          <h3 style={{ color: "#dc2626" }}>Cancelled</h3>
          {b.cancelReason && <p className="sb-card-meta">{b.cancelReason}</p>}
        </div>
      )}

      {/* Provider + service */}
      <div className="sb-section">
        <h3>Service</h3>
        <p className="sb-offering-title">{b.serviceOfferingId?.title || "Service"}</p>
        <p className="sb-card-meta">{provider.businessName || provider.providerName}</p>
        {b.scheduledAt && <p className="sb-card-meta">Scheduled: {new Date(b.scheduledAt).toLocaleString()}</p>}
        {b.serviceAddress && <p className="sb-card-meta">Address: {b.serviceAddress}</p>}
        {b.customerNotes && <p className="sb-card-meta">Notes: {b.customerNotes}</p>}
      </div>

      {/* Bill / receipt */}
      <div className="sb-receipt">
        <div className="sb-receipt-row"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
        {travel > 0 && <div className="sb-receipt-row"><span>Travel / visit charge</span><span>₹{travel.toFixed(0)}</span></div>}
        {discount > 0 && <div className="sb-receipt-row"><span>Discount</span><span>-₹{discount.toFixed(0)}</span></div>}
        {platform > 0 && <div className="sb-receipt-row"><span style={{ opacity: 0.7 }}>Platform commission</span><span style={{ opacity: 0.7 }}>₹{platform.toFixed(0)}</span></div>}
        <div className="sb-receipt-row total"><span>Total payable</span><span>₹{total.toFixed(0)}</span></div>
        <div className="sb-receipt-row" style={{ marginTop: 6 }}>
          <span style={{ opacity: 0.7 }}>Payment</span>
          <span className={`sb-status ${b.paymentStatus === "PAID" ? "COMPLETED" : "PENDING"}`} style={{ fontSize: 10 }}>
            {b.paymentStatus === "PAID" ? "PAID" : "Online payment pending"}
          </span>
        </div>
      </div>

      {b.paymentStatus === "PENDING" && status !== "CANCELLED" && (
        <button className="sb-btn ghost block" style={{ marginBottom: 8 }} disabled={busy} onClick={checkPayment}>
          {busy ? "Checking…" : "Check online payment status"}
        </button>
      )}
      {status !== "COMPLETED" && status !== "CANCELLED" && (
        <button className="sb-btn danger block" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Cancel Booking"}</button>
      )}

      {b.paymentStatus === "PAID" && (
        <button className="sb-btn ghost block" style={{ marginTop: 8 }} onClick={() => setShowDispute(true)}>
          Report an issue
        </button>
      )}

      {showDispute && (
        <div className="sb-modal-backdrop" onClick={() => setShowDispute(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Report an issue</h3>
            <div className="sb-field">
              <label>Reason</label>
              <select value={dispute.reason} onChange={(e) => setDispute({ ...dispute, reason: e.target.value })}>
                <option>Service not delivered</option>
                <option>Poor quality of service</option>
                <option>Provider did not show up</option>
                <option>Overcharged</option>
                <option>Behaviour / safety concern</option>
                <option>Other</option>
              </select>
            </div>
            <div className="sb-field">
              <label>Describe what happened</label>
              <textarea rows={3} value={dispute.description} onChange={(e) => setDispute({ ...dispute, description: e.target.value })} placeholder="Add details to help us resolve faster" />
            </div>
            <button className="sb-btn block" disabled={busy} onClick={submitDispute}>{busy ? "Submitting…" : "Submit issue"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setShowDispute(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
