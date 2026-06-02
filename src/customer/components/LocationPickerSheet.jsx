import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiX, FiNavigation, FiMapPin } from "react-icons/fi";
import { isGoogleEnabled, autocompletePlaces, getPlaceDetails } from "../services/placesService";

// Free OpenStreetMap-based search via Photon (komoot). Unlike Nominatim,
// Photon sends `Access-Control-Allow-Origin: *`, so it works from the browser
// / Capacitor webview. No API key; India-biased. For best coverage of small
// societies/buildings, configure a Google Maps key (see placesService.js).
const PHOTON_URL = "https://photon.komoot.io/api/";

// IMPORTANT: send NO custom headers — any header turns this into a CORS
// preflight that the free endpoints don't answer, which silently zeroes results.
const searchPlaces = async (query, signal) => {
  // Bias results toward India (centroid lat/lon) without hard-excluding others.
  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=6&lang=en&lat=22.0&lon=79.0`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Search failed");
  const json = await res.json();
  return (json.features || []).map((f) => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [];
    return {
      lat: Number(coords[1]),
      lng: Number(coords[0]),
      label: photonLabel(p),
      full: photonFull(p),
    };
  });
};

const photonLabel = (p) => p.name || p.street || p.city || p.county || p.state || "Location";
const photonFull = (p) => [p.name, p.street, p.district, p.city, p.state, p.country]
  .filter(Boolean)
  .filter((v, i, a) => a.indexOf(v) === i)
  .join(", ");

const LocationPickerSheet = ({ open, onClose, onSelect, onUseCurrent, currentLabel, allowFreeText = false }) => {
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

  const useGoogle = isGoogleEnabled();
  const minLen = useGoogle ? 2 : 3;

  useEffect(() => {
    const q = query.trim();
    if (q.length < minLen) {
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
        // Prefer Google Places (handles societies, buildings, landmarks);
        // fall back to free OpenStreetMap when no key is configured.
        const rows = useGoogle ? await autocompletePlaces(q) : await searchPlaces(q, ctl.signal);
        setResults(rows);
      } catch (e) {
        if (e.name !== "AbortError") setError("Could not search. Try again.");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, useGoogle, minLen]);

  // Resolve a tapped result. Google predictions need a details lookup to get
  // coordinates; OSM rows already carry lat/lng.
  const pickResult = async (r) => {
    if (r.placeId) {
      try {
        const d = await getPlaceDetails(r.placeId, r.label);
        if (d) { onSelect(d); onClose(); return; }
      } catch { /* fall through to label-only */ }
      onSelect({ lat: null, lng: null, label: r.label, full: r.full });
      onClose();
      return;
    }
    onSelect(r);
    onClose();
  };

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
          {!loading && !error && query.trim().length >= minLen && results.length === 0 && (
            allowFreeText ? (
              <button
                type="button"
                className="loc-sheet-result"
                onClick={() => { onSelect({ lat: null, lng: null, label: query.trim(), full: query.trim() }); onClose(); }}
              >
                <FiMapPin size={14} />
                <div>
                  <div className="loc-sheet-result-label">Use “{query.trim()}”</div>
                  <div className="loc-sheet-result-full">Set this as your location manually</div>
                </div>
              </button>
            ) : (
              <div className="loc-sheet-empty">No matches</div>
            )
          )}
          {!loading && query.trim().length < minLen && (
            <div className="loc-sheet-empty">Type at least {minLen} characters</div>
          )}
          {results.map((r, i) => (
            <button
              type="button"
              key={r.placeId || `${r.lat}-${r.lng}-${i}`}
              className="loc-sheet-result"
              onClick={() => pickResult(r)}
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
