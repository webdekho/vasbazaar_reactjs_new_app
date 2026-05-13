import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTicketAlt } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import DataState from "../../components/DataState";

const MyBookingsScreen = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", bookings: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await rybboService.getMyBookings();
      if (cancelled) return;
      setState({ loading: false, error: r.success ? "" : (r.message || "Could not load bookings"), bookings: r.data || [] });
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <DataState loading={state.loading} error={state.error}>
      <div style={{ width: "100%", padding: "0 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
            <FaArrowLeft />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>My RYBBO Bookings</div>
        </div>

        <div style={{ padding: "14px" }}>
          {state.bookings.length === 0 ? (
            <div className="cm-empty" style={{ padding: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <FaTicketAlt size={32} color="#A0A0A0" />
              <strong>No bookings yet</strong>
              <p style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", margin: 0 }}>Your RYBBO event bookings will appear here.</p>
              <button type="button" onClick={() => navigate("/customer/app/rybbo")}
                style={{ marginTop: 8, padding: "10px 20px", borderRadius: 8, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Browse events
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {state.bookings.map((b) => (
                <button key={b.id} type="button"
                  onClick={() => navigate(`/customer/app/rybbo/ticket/${b.id}`)}
                  style={{ display: "flex", gap: 12, padding: 12, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, textAlign: "left", background: "transparent", color: "inherit", cursor: "pointer", width: "100%" }}>
                  <img src={b.poster} alt="" style={{ width: 70, height: 90, objectFit: "cover", borderRadius: 8 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{b.eventTitle}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{b.venue}, {b.city}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{b.showtime?.date} · {b.showtime?.time}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>{b.status}</span>
                      <strong style={{ fontSize: 13 }}>₹{b.total}</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </DataState>
  );
};

export default MyBookingsScreen;
