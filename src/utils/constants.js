export const loader = "LOADER";

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  'https://api.vasbazaar.com',
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
  'http://192.168.1.4:8081',
  '/vb-api',
];

// Default production API URL for native apps
const NATIVE_API_URL = 'https://api.vasbazaar.com';

// Detect if running inside Capacitor native app
const isCapacitorNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

export const server_api = () => {

     // Local dev (npm start) → localhost backend (overrides any stale localStorage host)
     // Production build (Vercel `npm run build`) → production URL
     if (process.env.NODE_ENV === 'development' && !isCapacitorNative()) return 'http://localhost:8081';

    const storedUrl = localStorage.getItem('host');

     // Validate stored URL against whitelist before using
     if (storedUrl) {
       const isAllowed = ALLOWED_HOSTS.some(host => storedUrl.startsWith(host));
       if (isAllowed) return storedUrl;
     }

     // In native Capacitor app, use the production API URL directly
     if (isCapacitorNative()) return NATIVE_API_URL;

     // Use REACT_APP_API_URL from .env if explicitly set (e.g., Vercel env var)
     if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

     // Fallback: production API URL
     return 'https://api.vasbazaar.com';
   };
