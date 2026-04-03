import { Capacitor } from "@capacitor/core";

export const loader = "LOADER";

// API Base URL - used by proxy and native apps
export const API_BASE_URL = "https://api.vasbazaar.com";
const DEFAULT_API_URL = API_BASE_URL;

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  'https://api.vasbazaar.com',
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
  '',
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

    // Development uses proxy, production uses direct API URL
    const isDev = process.env.NODE_ENV === 'development';
    return isDev ? '' : DEFAULT_API_URL;
  };
