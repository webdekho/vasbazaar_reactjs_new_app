export const loader = "LOADER";

// ============================================================
// API Configuration - Single Source of Truth
// ============================================================
// Local dev:  .env.local (not committed) → REACT_APP_API_URL=https://apis.uat.vasbazaar.com:8081
// Production: .env (committed)           → REACT_APP_API_URL=https://api.vasbazaar.com
// ============================================================

// Default API URL from environment variable
const DEFAULT_API_URL = process.env.REACT_APP_API_URL || 'https://api.vasbazaar.com';

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  'https://api.vasbazaar.com',
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
  'http://192.168.1.4:8081',
  '/vb-api',
];

// Check if a URL is in the allowed hosts list
export const isAllowedHost = (url) => {
  if (!url) return false;
  return ALLOWED_HOSTS.some(host => url.startsWith(host));
};

// Get API base URL
// Priority: localStorage (if valid) → .env → default production
export const server_api = () => {
  // Check localStorage for custom host (dev/testing)
  const storedUrl = localStorage.getItem('host');
  if (storedUrl && isAllowedHost(storedUrl)) {
    return storedUrl.replace(/\/+$/, ''); // trim trailing slashes
  }

  // Use environment variable (from .env.local or .env)
  return DEFAULT_API_URL;
};
