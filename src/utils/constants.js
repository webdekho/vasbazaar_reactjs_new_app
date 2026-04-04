export const loader = "LOADER";

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  'https://api.vasbazaar.com',
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
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

    const storedUrl = localStorage.getItem('host');

     // Validate stored URL against whitelist before using
     if (storedUrl) {
       const isAllowed = ALLOWED_HOSTS.some(host => storedUrl.startsWith(host));
       if (isAllowed) return storedUrl;
     }

     // In native Capacitor app, use the production API URL directly
     if (isCapacitorNative()) return NATIVE_API_URL;

     // Always use the production API URL (localhost and production both)
     return 'https://api.vasbazaar.com';
   };
