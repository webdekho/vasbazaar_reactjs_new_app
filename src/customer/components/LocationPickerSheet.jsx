import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiX, FiNavigation, FiMapPin } from "react-icons/fi";

// Free OpenStreetMap Nominatim search — restricted to India, rate-limited (~1 req/sec).
// No API key required, fine for personal/dev use; for production traffic, switch to
// a paid provider (Google Places, Mapbox) and keep this shape.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const searchPlaces = async (query, signal) => {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=in&addressdetails=1`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Search failed");
  const rows = await res.json();
  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: shortLabel(r),
    full: r.display_name,
  }));
};

const shortLabel = (r) => {
  const a = r.address || {};
  const primary = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.city || a.county;
  const secondary = a.city || a.state_district || a.state;
  if (primary && secondary && primary !== secondary) return `${primary}, ${secondary}`;
  return primary || secondary || (r.display_name || "").split(",").slice(0, 2).join(",");
};

const LocationPickerSheet = ({ open, onClose, onSelect, onUseCurrent, currentLabel }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      setLoading(true);
      setError(null);
      try {
        const rows = await searchPlaces(q, ctl.signal);
        setResults(rows);
      } catch (e) {
        if (e.name !== "AbortError") setError("Could not search. Try again.");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  if (!open) return null;

  return createPortal(
    <div className="loc-sheet-overlay" onClick={onClose}>
      <div className="loc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="loc-sheet-head">
          <div>
            <div className="loc-sheet-title">Choose location</div>
            {currentLabel && <div className="loc-sheet-sub">Currently: {currentLabel}</div>}
          </div>
          <button className="loc-sheet-close" type="button" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        <button
          type="button"
          className="loc-sheet-current"
          onClick={() => { onUseCurrent(); onClose(); }}
        >
          <FiNavigation size={16} />
          <span>Use my current location</span>
        </button>

        <div className="loc-sheet-search">
          <FiSearch size={16} />
          <input
            type="search"
            inputMode="search"
            autoFocus
            placeholder="Search area, city or pincode"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="loc-sheet-results">
          {loading && <div className="loc-sheet-empty">Searching…</div>}
          {!loading && error && <div className="loc-sheet-empty loc-sheet-error">{error}</div>}
          {!loading && !error && query.trim().length >= 3 && results.length === 0 && (
            <div className="loc-sheet-empty">No matches</div>
          )}
          {!loading && query.trim().length < 3 && (
            <div className="loc-sheet-empty">Type at least 3 characters</div>
          )}
          {results.map((r, i) => (
            <button
              type="button"
              key={`${r.lat}-${r.lng}-${i}`}
              className="loc-sheet-result"
              onClick={() => { onSelect(r); onClose(); }}
            >
              <FiMapPin size={14} />
              <div>
                <div className="loc-sheet-result-label">{r.label}</div>
                <div className="loc-sheet-result-full">{r.full}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationPickerSheet;
