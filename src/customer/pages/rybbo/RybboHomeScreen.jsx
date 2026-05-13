import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaMapMarkerAlt, FaTicketAlt, FaPlusCircle, FaQrcode } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import DataState from "../../components/DataState";
import EventCard from "./components/EventCard";
import CategoryTabs from "./components/CategoryTabs";

const CITY_KEY = "rybbo_city";

const RybboHomeScreen = () => {
  const navigate = useNavigate();
  const [city, setCity] = useState(() => localStorage.getItem(CITY_KEY) || "Mumbai");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [state, setState] = useState({ loading: true, error: "", events: [], featured: [], cities: [], categories: [] });

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
      const mergedCats = hasWorkshops ? apiCats : [...apiCats, { key: "workshops", label: "Workshops" }];
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

  const handleCityPick = (c) => {
    setCity(c);
    localStorage.setItem(CITY_KEY, c);
    setShowCityPicker(false);
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      <div style={{ padding: "12px 12px 24px", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
        {/* Header strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <button type="button" onClick={() => setShowCityPicker(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
            <FaMapMarkerAlt color="#007BFF" /> {city} ▾
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 2px 10px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <button type="button" onClick={() => navigate("/customer/app/rybbo/list-your-show")} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            <FaPlusCircle /> List your show
          </button>
          <button type="button" onClick={() => navigate("/customer/app/rybbo/scan")} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            <FaQrcode /> Scan &amp; Enter
          </button>
          <button type="button" onClick={() => navigate("/customer/app/rybbo/my-bookings")} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            <FaTicketAlt /> My Bookings
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--cm-card, #FFFFFF)", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, marginBottom: 12 }}>
          <FaSearch size={14} color="var(--cm-muted, #6B7280)" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, venues, artists"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--cm-ink, inherit)", fontSize: 14 }}
          />
        </div>

        {/* Categories */}
        <CategoryTabs categories={state.categories} value={category} onChange={setCategory} />

        {/* Featured rail */}
        {featured.length > 0 && category === "all" && !search && (
          <div style={{ marginTop: 8, marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, margin: "8px 2px 10px", fontWeight: 700 }}>Featured in {city}</h3>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 2px 8px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {featured.map((e) => (
                <div key={e.id} style={{ flexShrink: 0, width: 220 }}>
                  <EventCard event={e} onClick={() => navigate(`/customer/app/rybbo/event/${e.slug}`)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events list */}
        <h3 style={{ fontSize: 16, margin: "12px 2px 10px", fontWeight: 700 }}>
          {state.events.length} {category === "all" ? "events" : state.categories.find((c) => c.key === category)?.label} in {city}
        </h3>
        {state.events.length === 0 ? (
          <div className="cm-empty" style={{ padding: 32, textAlign: "center" }}>
            No events found. Try a different city or clear your search.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {state.events.map((e) => (
              <EventCard key={e.id} event={e} layout="horizontal" onClick={() => navigate(`/customer/app/rybbo/event/${e.slug}`)} />
            ))}
          </div>
        )}

        {/* City picker bottom sheet */}
        {showCityPicker && (
          <div onClick={() => setShowCityPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "var(--cm-card, #FFFFFF)", color: "var(--cm-ink, #1A1A2E)", borderRadius: "20px 20px 0 0", padding: "18px 16px 28px", maxHeight: "70vh", overflowY: "auto", boxShadow: "0 -8px 24px rgba(0,0,0,0.12)" }}>
              <div style={{ width: 40, height: 4, background: "var(--cm-line, #E5E7EB)", borderRadius: 2, margin: "0 auto 14px" }} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>Select your city</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {state.cities.map((c) => (
                  <button key={c} type="button" onClick={() => handleCityPick(c)}
                    style={{ padding: "12px 14px", textAlign: "left", borderRadius: 10, border: `1px solid ${c === city ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`, background: "transparent", color: "inherit", fontSize: 14, fontWeight: c === city ? 700 : 500, cursor: "pointer" }}>
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
