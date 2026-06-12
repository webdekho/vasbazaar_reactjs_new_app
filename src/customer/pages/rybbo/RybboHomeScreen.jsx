import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaMapMarkerAlt, FaTicketAlt, FaPlusCircle, FaQrcode, FaGlassCheers, FaList, FaThLarge } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import DataState from "../../components/DataState";
import EventCard from "./components/EventCard";
import CategoryTabs from "./components/CategoryTabs";
import "./rybbo.css";

const CITY_KEY = "rybbo_city";
const VIEW_KEY = "rybbo_event_view";
const PERSONAL_EVENT_TEXT = "Plan a Personal Event";

// Extra category tabs appended to the API categories in the filter row
// (next to All, Events, Plays, …). Added only if not already returned by the API.
const EXTRA_CATEGORIES = [
  { key: "online", label: "Online events" },
  { key: "exhibitions", label: "Exhibitions" },
  { key: "other", label: "Other" },
];

const RybboHomeScreen = () => {
  const navigate = useNavigate();
  const [city, setCity] = useState(() => localStorage.getItem(CITY_KEY) || "Mumbai");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_KEY) || "list");
  const [personalEventText, setPersonalEventText] = useState("");
  const [state, setState] = useState({ loading: true, error: "", events: [], featured: [], cities: [], categories: [] });

  useEffect(() => {
    let index = 0;
    let direction = 1;
    let holdTicks = 0;

    const timer = setInterval(() => {
      if (direction === 1 && index === PERSONAL_EVENT_TEXT.length) {
        holdTicks += 1;
        if (holdTicks < 8) return;
        direction = -1;
        holdTicks = 0;
      } else if (direction === -1 && index === 0) {
        holdTicks += 1;
        if (holdTicks < 4) return;
        direction = 1;
        holdTicks = 0;
      }

      index += direction;
      setPersonalEventText(PERSONAL_EVENT_TEXT.slice(0, index));
    }, 90);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((p) => ({ ...p, loading: true, error: "" }));
      const [cities, categories, events, featured] = await Promise.all([
        rybboService.getCities(),
        rybboService.getCategories(),
        rybboService.getEvents({ city, category: category === "all" ? undefined : category, q: search || undefined }),
        rybboService.getFeatured(),
      ]);
      if (cancelled) return;
      const apiCats = Array.isArray(categories.data) ? categories.data : [];
      const hasWorkshops = apiCats.some((c) => (c.key || "").toLowerCase() === "workshops");
      const withWorkshops = hasWorkshops ? apiCats : [...apiCats, { key: "workshops", label: "Workshops" }];
      // Append Online events / Exhibitions / Other unless the API already has them.
      const missingExtras = EXTRA_CATEGORIES.filter(
        (ex) => !withWorkshops.some((c) => (c.key || "").toLowerCase() === ex.key)
      );
      const mergedCats = [...withWorkshops, ...missingExtras];
      setState({
        loading: false,
        error: [cities, categories, events, featured].find((r) => !r.success)?.message || "",
        cities: cities.data || [],
        categories: mergedCats,
        events: events.data || [],
        featured: (featured.data || []).filter((e) => e.city === city),
      });
    })();
    return () => { cancelled = true; };
  }, [city, category, search]);

  const featured = useMemo(() => state.featured, [state.featured]);
  const spotlight = featured[0] || state.events[0];
  const resultLabel = category === "all" ? "events" : state.categories.find((c) => c.key === category)?.label;

  const handleCityPick = (c) => {
    setCity(c);
    localStorage.setItem(CITY_KEY, c);
    setShowCityPicker(false);
  };

  const handleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      <div className="rybbo-page">
        <section className="rybbo-hero">
          {spotlight?.poster && <img className="rybbo-hero-art" src={spotlight.poster} alt="" />}
          <div className="rybbo-hero-shade" />
          <div className="rybbo-hero-copy">
            <div className="rybbo-hero-tools">
              <button type="button" onClick={() => setShowCityPicker(true)} className="rybbo-city-pill" aria-label={`Change city, currently ${city}`} title={city}>
                <FaMapMarkerAlt />
              </button>
              <div className="rybbo-hero-tools-right">
              <button type="button" onClick={() => navigate("/customer/app/rybbo/organizer/events")} className="rybbo-mini-tool" aria-label="Scan and enter" title="Scan and enter">
                <FaQrcode />
              </button>
              <button type="button" onClick={() => navigate("/customer/app/rybbo/my-bookings")} className="rybbo-mini-tool" aria-label="My bookings" title="My bookings">
                <FaTicketAlt />
              </button>
              </div>
            </div>
            <p className="rybbo-kicker">RYBBO Live</p>
            <h1>Every Event Begins Here.</h1>
            <p className="rybbo-hero-sub">Curated shows, workshops, games and private parties around you.</p>
          </div>
        </section>

        <div className="rybbo-action-grid">
          <button type="button" onClick={() => navigate("/customer/app/rybbo/social")} className="rybbo-action-card rybbo-action-card--primary">
            <FaGlassCheers />
            <span className="rybbo-type-text" aria-label={PERSONAL_EVENT_TEXT}>{personalEventText}</span>
          </button>
          <button type="button" onClick={() => navigate("/customer/app/rybbo/list-your-show")} className="rybbo-action-card">
            <FaPlusCircle />
            <span>List your show</span>
          </button>
        </div>

        <div className="rybbo-search-dock">
          <div className="rybbo-search">
            <FaSearch />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, venues, artists"
            />
          </div>
          <CategoryTabs categories={state.categories} value={category} onChange={setCategory} />
        </div>

        {featured.length > 0 && category === "all" && !search && (
          <section className="rybbo-section">
            <div className="rybbo-section-head">
              <p>Featured drop</p>
              <h2>Tonight's pulse in {city}</h2>
            </div>
            <div className="rybbo-featured-rail">
              {featured.map((e) => (
                <div key={e.id} className="rybbo-featured-card">
                  <EventCard event={e} onClick={() => navigate(`/customer/app/rybbo/event/${e.slug}`)} />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="rybbo-section-head rybbo-results-head">
          <div>
            <p>{state.events.length} found</p>
            <h2>{resultLabel} in {city}</h2>
          </div>
          <div className="rybbo-view-toggle" aria-label="Event view mode">
            <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => handleViewMode("list")} aria-label="List view" title="List view">
              <FaList />
              <span>List</span>
            </button>
            <button type="button" className={viewMode === "tile" ? "is-active" : ""} onClick={() => handleViewMode("tile")} aria-label="Tile view" title="Tile view">
              <FaThLarge />
              <span>Tile</span>
            </button>
          </div>
        </div>
        {state.events.length === 0 ? (
          <div className="rybbo-empty">
            No events found. Try a different city or clear your search.
          </div>
        ) : (
          <div className={`rybbo-event-list${viewMode === "tile" ? " rybbo-event-list--tile" : ""}`}>
            {state.events.map((e) => (
              <EventCard key={e.id} event={e} layout={viewMode === "tile" ? "vertical" : "horizontal"} onClick={() => navigate(`/customer/app/rybbo/event/${e.slug}`)} />
            ))}
          </div>
        )}

        {/* City picker bottom sheet */}
        {showCityPicker && (
          <div onClick={() => setShowCityPicker(false)} className="rybbo-sheet-backdrop">
            <div onClick={(e) => e.stopPropagation()} className="rybbo-sheet">
              <div className="rybbo-sheet-handle" />
              <h3>Select your city</h3>
              <div className="rybbo-city-list">
                {state.cities.map((c) => (
                  <button key={c} type="button" onClick={() => handleCityPick(c)}
                    className={`rybbo-city-option${c === city ? " is-active" : ""}`}>
                    {c}{c === city ? "  ✓" : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DataState>
  );
};

export default RybboHomeScreen;
