import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";

const BookingSuccessScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams();
  const booking = location.state?.booking;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
      <FaCheckCircle size={56} color="#22c55e" style={{ margin: "16px auto 8px" }} />
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 4px" }}>Booking Confirmed</h2>
      <p style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", margin: "0 0 20px" }}>
        Booking ID: <strong>{bookingId}</strong>
      </p>

      {booking && (
        <div style={{ padding: 18, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 14, textAlign: "left", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{booking.eventTitle}</div>
          <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 12 }}>
            {booking.venue}, {booking.city} · {booking.showtime?.date} · {booking.showtime?.time}
          </div>
          <div style={{ display: "flex", justifyContent: "center", padding: 18, background: "#fff", borderRadius: 10, marginBottom: 12 }}>
            <QRCodeSVG value={booking.qrPayload || booking.bookingCode || ""} size={160} level="M" includeMargin={false} />
          </div>
          <div style={{ fontSize: 11, textAlign: "center", color: "var(--cm-muted, #6B7280)", marginBottom: 12, fontFamily: "monospace" }}>{booking.bookingCode || booking.qrPayload}</div>

          <div style={{ borderTop: "1px solid var(--cm-line, #E5E7EB)", paddingTop: 10 }}>
            {booking.lineItems?.map((li) => (
              <div key={li.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{li.name} × {li.qty}</span><span>₹{li.lineTotal}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, marginTop: 8 }}>
              <span>Total paid</span><span>₹{booking.total}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" onClick={() => navigate(`/customer/app/rybbo/ticket/${bookingId}`)}
          style={{ padding: 13, borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          View ticket & entry QR
        </button>
        <button type="button" onClick={() => navigate("/customer/app/rybbo/my-bookings")}
          style={{ padding: 13, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
          View my bookings
        </button>
        <button type="button" onClick={() => navigate("/customer/app/rybbo")}
          style={{ padding: 13, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
          Browse more events
        </button>
      </div>
    </div>
  );
};

export default BookingSuccessScreen;
