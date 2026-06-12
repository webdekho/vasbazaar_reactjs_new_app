import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlusCircle, FaUsers, FaCalendarAlt, FaGlassCheers } from "react-icons/fa";
import { rybboSocialService } from "../../../services/rybboSocialService";
import DataState from "../../../components/DataState";

const ACCENT = "#7C3AED";

const SocialHomeScreen = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", events: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await rybboSocialService.getMyEvents();
      if (cancelled) return;
      setState({ loading: false, error: r.success ? "" : (r.message || "Could not load your events"), events: Array.isArray(r.data) ? r.data : [] });
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <DataState loading={state.loading} error={state.error}>
      <div style={{ width: "100%", padding: "0 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
          <button type="button" onClick={() => navigate("/customer/app/rybbo")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
            <FaArrowLeft />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>RYBBO Events</div>
        </div>

        <div style={{ padding: 14 }}>
          {/* Hero / create CTA */}
          <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #5B21B6)`, color: "#fff", borderRadius: 16, padding: "18px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.9 }}>
              <FaGlassCheers /> Plan. Invite. Celebrate. Together.
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>Host your own event</div>
            <div style={{ fontSize: 13, opacity: 0.92, marginBottom: 14 }}>
              Birthday, house party, pooja, reunion, kitty party — create an invite and share it on WhatsApp in seconds.
            </div>
            <button type="button" onClick={() => navigate("/customer/app/rybbo/social/create")}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "#fff", color: ACCENT, fontWeight: 800, cursor: "pointer" }}>
              <FaPlusCircle /> Create event
            </button>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "4px 2px 10px" }}>Your events</h3>

          {state.events.length === 0 ? (
            <div className="cm-empty" style={{ padding: 36, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <FaCalendarAlt size={30} color="#A0A0A0" />
              <strong>No events yet</strong>
              <p style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", margin: 0 }}>Create your first invite and start collecting RSVPs.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {state.events.map((e) => {
                const s = e.summary || {};
                const cancelled = String(e.status) === "CANCELLED";
                return (
                  <button key={e.id} type="button" onClick={() => navigate(`/customer/app/rybbo/social/event/${e.id}`)}
                    style={{ display: "block", textAlign: "left", width: "100%", padding: 14, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, background: "transparent", color: "inherit", cursor: "pointer", opacity: cancelled ? 0.65 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{e.title}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: cancelled ? "#fee2e2" : "#ede9fe", color: cancelled ? "#b91c1c" : ACCENT, whiteSpace: "nowrap", textTransform: "capitalize" }}>
                        {cancelled ? "Cancelled" : e.eventType}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginTop: 4 }}>
                      {e.date}{e.time ? ` · ${e.time}` : ""}{e.venue ? ` · ${e.venue}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12 }}>
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>{s.accepted ?? 0} going</span>
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>{s.maybe ?? 0} maybe</span>
                      <span style={{ color: "var(--cm-muted, #6B7280)" }}><FaUsers size={11} style={{ marginRight: 4 }} />{s.guestCount ?? 0} guests</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DataState>
  );
};

export default SocialHomeScreen;
