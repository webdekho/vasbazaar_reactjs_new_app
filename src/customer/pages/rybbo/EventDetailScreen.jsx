import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaStar, FaShare, FaRegImage, FaTicketAlt } from "react-icons/fa";
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

  const event = state.event;
  const hasPoster = event?.poster && !posterFailed;

  return (
    <DataState loading={state.loading} error={state.error}>
      {event && (
        <div className="rbd-page">
          {/* Hero */}
          <header className="rbd-hero">
            {hasPoster && <div className="rbd-hero-glow" style={{ backgroundImage: `url(${event.poster})` }} aria-hidden="true" />}
            <div className="rbd-hero-art">
              {hasPoster ? (
                <img src={event.poster} alt={event.title} onError={() => setPosterFailed(true)} className="rbd-hero-img" />
              ) : (
                <div className="rbd-hero-placeholder">
                  <span className="rbd-hero-placeholder-orb" aria-hidden="true" />
                  <FaRegImage size={42} />
                  <span className="rbd-hero-placeholder-title">{event.title}</span>
                </div>
              )}
              <div className="rbd-hero-shade" aria-hidden="true" />
            </div>

            <button type="button" onClick={() => navigate(-1)} className="rbd-glass-btn rbd-glass-btn--left" aria-label="Go back">
              <FaArrowLeft />
            </button>
            <button type="button" onClick={handleShare} className="rbd-glass-btn rbd-glass-btn--right" aria-label="Share">
              <FaShare />
            </button>

            <div className="rbd-hero-copy">
              {(event.type || event.language) && (
                <div className="rbd-hero-kicker">{[event.type, event.language].filter(Boolean).join(" · ")}</div>
              )}
              <h1 className="rbd-hero-title">{event.title}</h1>
              <div className="rbd-hero-meta">
                {event.rating != null && event.rating !== "" && (
                  <span className="rbd-chip rbd-chip--rating"><FaStar /> {event.rating}</span>
                )}
                {event.durationMins ? (
                  <span className="rbd-chip"><FaClock /> {event.durationMins} mins</span>
                ) : null}
              </div>
            </div>
          </header>

          {/* Body */}
          <div className="rbd-body">
            <div className="rbd-facts">
              <div className="rbd-fact"><span className="rbd-fact-ic"><FaMapMarkerAlt /></span>{event.venue}, {event.city}</div>
              <div className="rbd-fact"><span className="rbd-fact-ic"><FaCalendarAlt /></span>{event.date} · {event.time}</div>
            </div>

            {event.description && (
              <section className="rbd-section">
                <h3 className="rbd-h3">About</h3>
                <p className="rbd-about">{event.description}</p>
              </section>
            )}

            {event.artists?.length > 0 && (
              <section className="rbd-section">
                <h3 className="rbd-h3">Cast</h3>
                <div className="rbd-tags">
                  {event.artists.map((a) => <span key={a} className="rbd-tag">{a}</span>)}
                </div>
              </section>
            )}

            <section className="rbd-section">
              <h3 className="rbd-h3">Choose showtime</h3>
              <div className="rbd-showtimes">
                {event.showtimes.map((s) => {
                  const active = selectedShowtime?.id === s.id;
                  return (
                    <button key={s.id} type="button" onClick={() => setSelectedShowtime(s)}
                      className={`rbd-show${active ? " is-active" : ""}`}>
                      <span className="rbd-show-date">{s.date}</span>
                      <span className="rbd-show-time">{s.time}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rbd-section">
              <h3 className="rbd-h3">Pricing</h3>
              <div className="rbd-prices">
                {event.ticketCategories.map((tc) => (
                  <div key={tc.id} className="rbd-price">
                    <div className="rbd-price-info">
                      <div className="rbd-price-name">{tc.name}</div>
                      <div className="rbd-price-avail">
                        <span className="rbd-dot" /> {tc.available} available
                      </div>
                    </div>
                    <div className="rbd-price-amt">₹{tc.price}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sticky CTA */}
          <div className="rbd-cta-bar">
            <div className="rbd-cta-inner">
              <div className="rbd-cta-price">
                <span className="rbd-cta-label">Starts at</span>
                <strong className="rbd-cta-amt">₹{event.minPrice}</strong>
              </div>
              <button type="button" onClick={handleBook} disabled={!selectedShowtime} className="rbd-cta-btn">
                <FaTicketAlt /> Book tickets
              </button>
            </div>
          </div>
        </div>
      )}
    </DataState>
  );
};

export default EventDetailScreen;
