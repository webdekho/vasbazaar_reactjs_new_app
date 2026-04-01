import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPlaneDeparture, FaTicketAlt, FaCalendarAlt,
  FaTimes, FaInfoCircle, FaTimesCircle, FaCheckCircle, FaClock, FaRupeeSign
} from "react-icons/fa";
import { travelService } from "../services/travelService";

const STATUS_COLORS = {
  CONFIRMED: { bg: "#dcfce7", color: "#16a34a", text: "Confirmed" },
  PENDING: { bg: "#fef9c3", color: "#ca8a04", text: "Pending" },
  CANCELLED: { bg: "#fde2e2", color: "#dc2626", text: "Cancelled" },
  PARTIAL_CANCELLED: { bg: "#fde2e2", color: "#dc2626", text: "Partially Cancelled" },
  FAILED: { bg: "#f3f4f6", color: "#6b7280", text: "Failed" },
};

const MyBookingsScreen = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelCharges, setCancelCharges] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await travelService.getMyBookings();
      if (res.success && res.data?.data) {
        setBookings(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  const handleViewDetails = async (booking) => {
    if (!booking.clientOrderId) {
      setDetailModal(booking);
      return;
    }
    setLoadingDetail(true);
    try {
      const res = await travelService.getBookingDetails({ clientOrderId: booking.clientOrderId });
      if (res.success && res.data?.data) {
        setDetailModal({ ...booking, sarDetails: res.data.data });
      } else {
        setDetailModal(booking);
      }
    } catch (e) {
      setDetailModal(booking);
    }
    setLoadingDetail(false);
  };

  const handleCancelClick = async (booking) => {
    setCancelModal(booking);
    setCancelCharges(null);
    try {
      const res = await travelService.getCancellationCharges({
        bookingId: booking.bookingId,
        requestType: booking.journeyType === "RETURN" ? "return" : "oneway"
      });
      if (res.success && res.data?.data) {
        setCancelCharges(res.data.data);
      } else {
        setCancelCharges({ error: res.message || "Unable to fetch charges" });
      }
    } catch (e) {
      setCancelCharges({ error: "Failed to fetch cancellation charges" });
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      const res = await travelService.fullCancel({
        clientOrderId: cancelModal.clientOrderId,
        sequenceNumber: "0",
        remarks: "Customer requested cancellation"
      });
      if (res.success) {
        alert("Booking cancelled successfully");
        loadBookings();
      } else {
        alert(res.message || "Cancellation failed");
      }
    } catch (e) {
      alert("Cancellation failed");
    }
    setCancelling(false);
    setCancelModal(null);
  };

  const getStatus = (status) => STATUS_COLORS[status] || STATUS_COLORS.PENDING;

  return (
    <div className="fc-page">
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text">
          <h1 className="th-title">My Bookings</h1>
          <span className="th-count">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <span className="md-spinner" style={{ width: 32, height: 32 }} />
          <p style={{ marginTop: 16, color: "#888" }}>Loading bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
          <FaTicketAlt size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 16 }}>No bookings found</p>
          <button className="fc-submit" style={{ maxWidth: 200, margin: "20px auto" }} onClick={() => navigate("/customer/app/travel")}>Book a Flight</button>
        </div>
      ) : (
        <div style={{ padding: "0 16px 80px" }}>
          {bookings.map((b, i) => {
            const st = getStatus(b.status);
            return (
              <div key={b.id || i} className="tv-flight-card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.airline || "Flight"}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {b.airlineCode && `${b.airlineCode}-`}{b.flightNumber || ""}
                      {b.pnr && ` • PNR: ${b.pnr}`}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.text}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600 }}>{b.sourceAirportCode || b.source}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>{b.sourceAirportName || ""}</div>
                  </div>
                  <FaPlaneDeparture size={14} style={{ color: "#888" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600 }}>{b.destinationAirportCode || b.destination}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>{b.destinationAirportName || ""}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: "#888" }}><FaCalendarAlt size={10} /> {b.departureDate || "—"}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>₹{b.totalAmount ? parseFloat(b.totalAmount).toLocaleString("en-IN") : "—"}</span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => handleViewDetails(b)} disabled={loadingDetail}
                    style={{ flex: 1, padding: "8px", background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <FaInfoCircle size={10} /> Details
                  </button>
                  {b.status === "CONFIRMED" && (
                    <button type="button" onClick={() => handleCancelClick(b)}
                      style={{ flex: 1, padding: "8px", background: "#fde2e2", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <FaTimesCircle size={10} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setDetailModal(null)}>
          <div style={{ background: "#fff", borderRadius: 12, maxWidth: 500, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 20 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Booking Details</h3>
              <button onClick={() => setDetailModal(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><FaTimes /></button>
            </div>
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <div><strong>Booking ID:</strong> {detailModal.bookingId || "—"}</div>
              <div><strong>Client Order ID:</strong> {detailModal.clientOrderId || "—"}</div>
              <div><strong>PNR:</strong> {detailModal.pnr || "—"}</div>
              <div><strong>Status:</strong> {detailModal.status}</div>
              <div><strong>Airline:</strong> {detailModal.airline}</div>
              <div><strong>Flight:</strong> {detailModal.airlineCode}-{detailModal.flightNumber}</div>
              <div><strong>Route:</strong> {detailModal.sourceAirportCode} → {detailModal.destinationAirportCode}</div>
              <div><strong>Date:</strong> {detailModal.departureDate}</div>
              <div><strong>Class:</strong> {detailModal.cabinClass}</div>
              <div><strong>Duration:</strong> {detailModal.duration} min</div>
              <div><strong>Passengers:</strong> {detailModal.adultCount} Adult{detailModal.adultCount > 1 ? "s" : ""}{detailModal.childCount > 0 ? `, ${detailModal.childCount} Child` : ""}{detailModal.infantCount > 0 ? `, ${detailModal.infantCount} Infant` : ""}</div>
              <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 8, paddingTop: 8 }}>
                <div><strong>Base Fare:</strong> ₹{detailModal.baseFare || "—"}</div>
                <div><strong>Tax:</strong> ₹{detailModal.tax || "—"}</div>
                <div><strong>Discount:</strong> ₹{detailModal.discount || "—"}</div>
                <div><strong>Total:</strong> ₹{detailModal.totalAmount ? parseFloat(detailModal.totalAmount).toLocaleString("en-IN") : "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setCancelModal(null)}>
          <div style={{ background: "#fff", borderRadius: 12, maxWidth: 400, width: "100%", padding: 20 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#dc2626" }}>Cancel Booking</h3>
            {!cancelCharges ? (
              <div style={{ textAlign: "center", padding: 20 }}><span className="md-spinner" /> Loading charges...</div>
            ) : cancelCharges.error ? (
              <p style={{ color: "#dc2626" }}>{cancelCharges.error}</p>
            ) : (
              <div style={{ fontSize: 13, lineHeight: 2, marginBottom: 16 }}>
                <div><strong>Refund Amount:</strong> ₹{cancelCharges.refundAmount || "—"}</div>
                <div><strong>Cancellation Charge:</strong> ₹{cancelCharges.cancellationCharge || "—"}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setCancelModal(null)}
                style={{ flex: 1, padding: 10, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                Keep Booking
              </button>
              <button onClick={handleConfirmCancel} disabled={cancelling || !cancelCharges || cancelCharges.error}
                style={{ flex: 1, padding: 10, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingsScreen;
