// App-wide constants — keep in sync with backend
export const APP_VERSION = '1.0.6';
export const APP_NAME = 'vasbazaar';

// Allowed API hosts — prevents localStorage tampering from redirecting API calls
const ALLOWED_API_HOSTS = [
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
];

// API base URL resolved from localStorage → env → fallback
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('customerApiBaseUrl') || localStorage.getItem('host');
    if (stored) {
      const cleaned = stored.replace(/\/+$/, '');
      const isAllowed = ALLOWED_API_HOSTS.some(host => cleaned.startsWith(host));
      if (isAllowed) return cleaned;
    }
  }
  return process.env.REACT_APP_API_BASE_URL || 'https://apis.uat.vasbazaar.com:8081';
};

// Session configuration
export const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const INACTIVITY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// Storage keys
export const STORAGE_KEYS = {
  sessionToken: 'customerSessionToken',
  userData: 'customerUserData',
  tempToken: 'customerTempToken',
  referralCode: 'customerReferralCode',
  devOtp: 'customerDevOtp',
  apiBaseUrl: 'customerApiBaseUrl',
  profilePhoto: 'profile_photo',
  sessionExpiry: 'customerSessionExpiry',
  lastActivity: 'customerLastActivity',
};
