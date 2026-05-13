import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaSyncAlt, FaQrcode } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { rybboService } from "../../services/rybboService";
import DataState from "../../components/DataState";

// Auto-refresh the signed QR token before it expires so a screenshot kept open
// for hours still presents a valid token at the gate.
const REFRESH_BEFORE_EXP_MS = 60 * 1000;

const TicketDetailsScreen = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [state, setState] = useState({ loading: true, error: "", ticket: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await rybboService.getTicket(bookingId);
    setState({
      loading: false,
      error: r.success ? "" : (r.message || "Could not load ticket"),
      ticket: r.success ? r.data : null,
    });
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Refresh QR token a minute before it expires.
  useEffect(() => {
    const exp = state.ticket?.qrTokenExpiresAt;
    if (!exp) return undefined;
    const msUntilRefresh = exp * 1000 - Date.now() - REFRESH_BEFORE_EXP_MS;
    if (msUntilRefresh <= 0) return undefined;
    const t = setTimeout(() => { load(); }, msUntilRefresh);
    return () => clearTimeout(t);
  }, [state.ticket?.qrTokenExpiresAt, load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ticket = state.ticket;
  const qrValue = ticket?.qrToken || "";

  const statusLabel = useMemo(() => {
    if (!ticket) return "";
    if (ticket.remainingQty === 0 && ticket.totalQty > 0) return "Fully checked in";
    if (ticket.usedQty > 0) return `${ticket.usedQty}/${ticket.totalQty} used`;
    return `${ticket.totalQty} ticket${ticket.totalQty > 1 ? "s" : ""}`;
  }, [ticket]);

  return (
    <DataState loading={state.loading} error={state.error}>
      <div style={{ width: "100%", padding: "0 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }} aria-label="Back">
            <FaArrowLeft />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>Your Ticket</div>
          <button type="button" onClick={handleRefresh} disabled={refreshing}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: refreshing ? 0.4 : 1 }}
            aria-label="Refresh QR">
            <FaSyncAlt />
          </button>
        </div>

        {ticket && (
          <div style={{ padding: 16, maxWidth: 560, margin: "0 auto" }}>
            <div style={{ padding: 18, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{ticket.eventTitle}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 14 }}>
                {ticket.venue}{ticket.city ? `, ${ticket.city}` : ""}
                <br />
                {ticket.showtime?.date} · {ticket.showtime?.time}
              </div>

              <div style={{ display: "flex", justifyContent: "center", padding: 18, background: "#fff", borderRadius: 12 }}>
                {qrValue
                  ? <QRCodeSVG value={qrValue} size={220} level="H" includeMargin={false} />
                  : <div style={{ height: 220, display: "flex", alignItems: "center", color: "#888" }}><FaQrcode /></div>}
              </div>
              <div style={{ fontSize: 11, textAlign: "center", color: "var(--cm-muted, #6B7280)", marginTop: 8, fontFamily: "monospace" }}>
                {ticket.bookingCode}
              </div>

              <div style={{
                marginTop: 14, padding: 10, borderRadius: 10,
                background: ticket.checkedIn ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)",
                display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontWeight: 700, fontSize: 13
              }}>
                {ticket.checkedIn && <FaCheckCircle color="#22c55e" />}
                {statusLabel}
              </div>

              <div style={{ borderTop: "1px solid var(--cm-line, #E5E7EB)", marginTop: 14, paddingTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Ticket details</div>
                {ticket.lineItems?.map((li) => (
                  <div key={li.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{li.name} × {li.qty}</span>
                    <span>₹{li.lineTotal}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--cm-line, #E5E7EB)" }}>
                  <span>Total paid</span><span>₹{ticket.total}</span>
                </div>
              </div>

              {Array.isArray(ticket.checkIns) && ticket.checkIns.length > 0 && (
                <div style={{ borderTop: "1px solid var(--cm-line, #E5E7EB)", marginTop: 14, paddingTop: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Scan history</div>
                  {ticket.checkIns.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 4 }}>
                      <span>{c.ticketName || "Ticket"}</span>
                      <span>{new Date(c.scannedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: "var(--cm-muted, #6B7280)", textAlign: "center" }}>
              Show this QR at the venue entry. Code refreshes automatically.
            </div>
          </div>
        )}
      </div>
    </DataState>
  );
};

export default TicketDetailsScreen;
