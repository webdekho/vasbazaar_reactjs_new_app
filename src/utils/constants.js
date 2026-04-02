import { Capacitor } from "@capacitor/core";

export const loader = "LOADER";

// Default API URL for native apps
const DEFAULT_API_URL = "https://api.vasbazaar.com";

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  'https://api.vasbazaar.com',
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
  '/vb-api',
];

export const server_api = () => {
    const storedUrl = localStorage.getItem('host');

    // Validate stored URL against whitelist before using
    if (storedUrl) {
      const isAllowed = ALLOWED_HOSTS.some(host => storedUrl.startsWith(host));
      if (isAllowed) return storedUrl;
    }

    // For native Capacitor apps, use full API URL directly
    if (Capacitor.isNativePlatform()) {
      return DEFAULT_API_URL;
    }

    // Use relative proxy path for web (Apache proxies /vb-api/ -> API)
    return '/vb-api';
  };
