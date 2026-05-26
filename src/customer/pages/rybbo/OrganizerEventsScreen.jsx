import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUserShield, FaQrcode, FaEdit } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";

const OrganizerEventsScreen = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", events: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await rybboService.getMyScannableEvents();
      if (cancelled) return;
      setState({
        loading: false,
        error: r.success ? "" : (r.message || "Could not load events"),
        events: r.success ? (r.data || []) : [],
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ paddingBottom: 24, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
          <FaArrowLeft />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>My events</div>
      </div>

      <div style={{ padding: "16px 14px" }}>
        {state.loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--cm-muted, #6B7280)" }}>Loading…</div>
        ) : state.error ? (
          <div style={{ padding: 12, background: "rgba(255,107,107,0.1)", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>{state.error}</div>
        ) : state.events.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--cm-muted, #6B7280)" }}>
            You don't have any events to scan yet. Approved submissions and events where you're added as a scanner will appear here.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {state.events.map((e) => (
              <div key={e.id} style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
                      {e.venue || "—"}{e.city ? `, ${e.city}` : ""} · {e.status || "—"}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: e.role === "ORGANIZER" ? "rgba(0,123,255,0.12)" : "rgba(34,197,94,0.12)", color: e.role === "ORGANIZER" ? "#007BFF" : "#22c55e", whiteSpace: "nowrap" }}>
                    {e.role}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => navigate("/customer/app/rybbo/scan")}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    <FaQrcode /> Scan tickets
                  </button>
                  {e.role === "ORGANIZER" && e.submissionId && (
                    <button type="button" onClick={() => navigate(`/customer/app/rybbo/list-your-show?edit=${e.submissionId}`)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      <FaEdit /> Edit event
                    </button>
                  )}
                  {e.role === "ORGANIZER" && (
                    <button type="button" onClick={() => navigate(`/customer/app/rybbo/organizer/events/${e.id}/scanners`)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      <FaUserShield /> Manage scanners
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerEventsScreen;
