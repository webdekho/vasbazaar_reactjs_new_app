export const loader = "LOADER";

// THE single customer care number for the whole app — matches the public website
// (Footer/Contact/SEO). Every call/WhatsApp touchpoint must import from here; the app
// previously carried three different numbers, so a customer reached a different desk
// depending on which screen they started from.
//   CARE_NUMBER_TEL     — dial string, E.164
//   CARE_NUMBER_DISPLAY — what the user reads
//   CARE_NUMBER_WA      — wa.me / api.whatsapp.com form (country code, no + or spaces)
export const CARE_NUMBER_TEL = "+919669221234";
export const CARE_NUMBER_DISPLAY = "+91-9669221234";
export const CARE_NUMBER_WA = "919669221234";

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
