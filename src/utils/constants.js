export const loader = "LOADER";

export const DEFAULT_API_URL = "http://192.168.1.9:8081";

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
