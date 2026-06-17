export const loader = "LOADER";

export const DEFAULT_API_URL = "https://api.vasbazaar.com";

// Canonical public web origin for shareable links (invites, deep links).
// Shared links are opened by guests in a browser, so they must NEVER use
// window.location.origin (which is capacitor://localhost in the native app
// or http://localhost:3008 in dev). Override per environment with REACT_APP_WEB_URL.
export const DEFAULT_WEB_URL = "https://vasbazaar.com";

// Detect if running inside Capacitor native app
const isCapacitorNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

export const getConfiguredApiUrl = () =>
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  DEFAULT_API_URL;

// Get API base URL from one shared env-backed resolver.
export const server_api = () => {
  const configuredApiUrl = getConfiguredApiUrl();

  // Native app should use the configured URL too so local environments work on device.
  if (isCapacitorNative()) return configuredApiUrl;

  return configuredApiUrl;
};

// Public web origin used to build shareable links. Always a real https web URL,
// regardless of whether the app runs in Capacitor, on localhost, or in prod.
export const web_app_url = () =>
  (process.env.REACT_APP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, "");
