import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaStar, FaShare, FaRegImage } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import DataState from "../../components/DataState";

const EventDetailScreen = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", event: null });
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await rybboService.getEventBySlug(slug);
      if (cancelled) return;
      if (!r.success) {
        setState({ loading: false, error: r.message, event: null });
        return;
      }
      setState({ loading: false, error: "", event: r.data });
      setSelectedShowtime(r.data.showtimes?.[0] || null);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const handleShare = async () => {
    if (!state.event) return;
    const url = window.location.href;
    const text = `Check out ${state.event.title} on RYBBO — ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: state.event.title, text, url }); } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert("Link copied");
    }
  };

  const handleBook = () => {
    if (!state.event || !selectedShowtime) return;
    navigate(`/customer/app/rybbo/event/${state.event.slug}/seats`, { state: { event: state.event, showtime: selectedShowtime } });
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      {state.event && (
        <div style={{ paddingBottom: 90, width: "100%" }}>
          {/* Hero poster */}
          <div style={{ position: "relative" }}>
            {state.event.poster && !posterFailed ? (
              <img src={state.event.poster} alt={state.event.title} onError={() => setPosterFailed(true)}
                style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", background: "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" }}>
                <FaRegImage size={48} style={{ opacity: 0.85 }} />
                <span style={{ fontSize: 18, fontWeight: 800, textAlign: "center", padding: "0 24px" }}>{state.event.title}</span>
              </div>
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(0,0,0,0.85) 100%)" }} />
            <button type="button" onClick={() => navigate(-1)} style={{ position: "absolute", top: 14, left: 14, width: 38, height: 38, borderRadius: 19, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer" }}>
              <FaArrowLeft />
            </button>
            <button type="button" onClick={handleShare} style={{ position: "absolute", top: 14, right: 14, width: 38, height: 38, borderRadius: 19, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer" }}>
              <FaShare />
            </button>
            <div style={{ position: "absolute", bottom: 14, left: 14, right: 14, color: "#fff" }}>
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{state.event.type} · {state.event.language}</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{state.event.title}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
                <FaStar color="#F4A261" /> {state.event.rating} · <FaClock size={11} /> {state.event.durationMins} mins
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--cm-muted, #6B7280)", marginBottom: 8 }}>
              <FaMapMarkerAlt size={11} /> {state.event.venue}, {state.event.city}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--cm-muted, #6B7280)", marginBottom: 16 }}>
              <FaCalendarAlt size={11} /> {state.event.date} · {state.event.time}
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "12px 0 8px" }}>About</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--cm-muted, #6B7280)", margin: 0 }}>{state.event.description}</p>

            {state.event.artists?.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 8px" }}>Cast</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {state.event.artists.map((a) => (
                    <span key={a} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--cm-line, #E5E7EB)", fontSize: 12 }}>{a}</span>
                  ))}
                </div>
              </>
            )}

            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 8px" }}>Choose showtime</h3>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 2px 6px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {state.event.showtimes.map((s) => {
                const active = selectedShowtime?.id === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setSelectedShowtime(s)}
                    style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 10, border: `1px solid ${active ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`, background: active ? "rgba(0,123,255,0.12)" : "transparent", color: "inherit", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{s.date}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.time}</div>
                  </button>
                );
              })}
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 8px" }}>Pricing</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {state.event.ticketCategories.map((tc) => (
                <div key={tc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{tc.name}</div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>{tc.available} available</div>
                  </div>
                  <strong style={{ color: "#007BFF" }}>₹{tc.price}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky CTA */}
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 14px", background: "var(--cm-card, #FFFFFF)", borderTop: "1px solid var(--cm-line, #E5E7EB)", zIndex: 50 }}>
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>Starts at</div>
                <strong style={{ fontSize: 17 }}>₹{state.event.minPrice}</strong>
              </div>
              <button type="button" onClick={handleBook} disabled={!selectedShowtime}
                style={{ flex: 1, maxWidth: 240, padding: "13px 22px", borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Book tickets
              </button>
            </div>
          </div>
        </div>
      )}
    </DataState>
  );
};

export default EventDetailScreen;
