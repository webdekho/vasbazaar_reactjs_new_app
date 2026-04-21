export const loader = "LOADER";

// Default production API URL for native apps
const NATIVE_API_URL = 'https://api.vasbazaar.com';

// Detect if running inside Capacitor native app
const isCapacitorNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

// Get API base URL from .env
// Local: .env.local (REACT_APP_API_URL=http://localhost:8081)
// Prod:  .env (REACT_APP_API_URL=https://api.vasbazaar.com)
export const server_api = () => {
  // Native app always uses production
  if (isCapacitorNative()) return NATIVE_API_URL;

  // Use .env value
  return process.env.REACT_APP_API_URL || NATIVE_API_URL;
};
