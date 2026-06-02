// Google Places + Geocoding via the Maps JavaScript SDK.
//
// Set the key in your .env (Create React App reads REACT_APP_* at build time):
//   REACT_APP_GOOGLE_MAPS_API_KEY=AIza...your-key...
// On the key (Google Cloud Console) enable: "Maps JavaScript API" and "Places API".
// Restrict the key by HTTP referrer / app bundle id for safety.
//
// We use the JS SDK (not the REST web service) because the REST endpoints do
// NOT send CORS headers and fail from a browser / Capacitor webview. If the key
// is absent, isGoogleEnabled() is false and callers fall back to OpenStreetMap.

const KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

export const isGoogleEnabled = () => Boolean(KEY);

let loaderPromise = null;

// Load the Maps JS SDK once (with the places library).
const loadSdk = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const cb = "__vbGmapsReady";
    window[cb] = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&callback=${cb}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps SDK"));
    document.head.appendChild(s);
  });
  return loaderPromise;
};

let autoSvc = null;
let geocoder = null;
let sessionToken = null;

const ensureServices = async () => {
  const g = await loadSdk();
  if (!autoSvc) autoSvc = new g.maps.places.AutocompleteService();
  if (!geocoder) geocoder = new g.maps.Geocoder();
  if (!sessionToken) sessionToken = new g.maps.places.AutocompleteSessionToken();
  return g;
};

export const resetPlacesSession = () => { sessionToken = null; };

/** Autocomplete predictions (India-biased). Returns [{ placeId, label, full }]. */
export const autocompletePlaces = async (query) => {
  if (!KEY || !query || query.trim().length < 2) return [];
  const g = await ensureServices();
  return new Promise((resolve, reject) => {
    autoSvc.getPlacePredictions(
      { input: query, componentRestrictions: { country: "in" }, sessionToken },
      (preds, status) => {
        const ok = g.maps.places.PlacesServiceStatus;
        if (status === ok.ZERO_RESULTS) return resolve([]);
        if (status !== ok.OK || !preds) return reject(new Error(status || "autocomplete error"));
        resolve(preds.map((p) => ({
          placeId: p.place_id,
          label: p.structured_formatting?.main_text || p.description,
          full: p.description,
        })));
      }
    );
  });
};

/** Resolve a place_id to { lat, lng, label, full }. */
export const getPlaceDetails = async (placeId, fallbackLabel = "") => {
  if (!KEY || !placeId) return null;
  const g = await ensureServices();
  // PlacesService needs a node/map; an offscreen div is fine.
  const svc = new g.maps.places.PlacesService(document.createElement("div"));
  return new Promise((resolve, reject) => {
    svc.getDetails(
      { placeId, fields: ["geometry", "formatted_address", "name"], sessionToken },
      (r, status) => {
        resetPlacesSession();
        if (status !== g.maps.places.PlacesServiceStatus.OK || !r?.geometry?.location) {
          return reject(new Error(status || "details error"));
        }
        resolve({
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          label: r.name || fallbackLabel || (r.formatted_address || "").split(",")[0],
          full: r.formatted_address || fallbackLabel,
        });
      }
    );
  });
};

/** Reverse-geocode lat/lng to a city-ish label. Returns a string or "". */
export const googleReverseGeocode = async (lat, lng) => {
  if (!KEY) return "";
  await ensureServices();
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.length) return resolve("");
      const first = results[0];
      const comp = (type) => first.address_components?.find((c) => c.types.includes(type))?.long_name;
      resolve(
        comp("locality") || comp("administrative_area_level_2") || comp("administrative_area_level_1")
        || (first.formatted_address || "").split(",")[0] || ""
      );
    });
  });
};
