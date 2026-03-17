import { STORAGE_KEYS, SESSION_DURATION_MS, INACTIVITY_THRESHOLD_MS } from '../constants/app';

let lastSessionCheck = 0;
const SESSION_CHECK_THROTTLE = 1000;

export const saveSessionToken = (token) => {
  const expiryTime = Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(STORAGE_KEYS.sessionToken, token);
  localStorage.setItem(STORAGE_KEYS.sessionExpiry, expiryTime.toString());
};

export const getSessionToken = () => {
  const now = Date.now();
  const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
  const expiry = localStorage.getItem(STORAGE_KEYS.sessionExpiry);

  if (!token) return null;

  if (now - lastSessionCheck < SESSION_CHECK_THROTTLE) {
    if (expiry && now < parseInt(expiry, 10)) return token;
    return null;
  }
  lastSessionCheck = now;

  if (expiry && now < parseInt(expiry, 10)) return token;

  // Token expired — check activity
  if (isUserActive()) {
    extendSession();
    return token;
  }
  clearExpiredSession();
  return null;
};

export const isSessionValid = () => getSessionToken() !== null;

export const getRemainingSessionTime = () => {
  const expiry = localStorage.getItem(STORAGE_KEYS.sessionExpiry);
  if (!expiry) return 0;
  const remaining = parseInt(expiry, 10) - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
};

export const extendSession = () => {
  const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
  if (!token) return false;
  localStorage.setItem(STORAGE_KEYS.sessionExpiry, (Date.now() + SESSION_DURATION_MS).toString());
  return true;
};

export const clearExpiredSession = () => {
  localStorage.removeItem(STORAGE_KEYS.sessionToken);
  localStorage.removeItem(STORAGE_KEYS.sessionExpiry);
};

export const trackUserActivity = () => {
  localStorage.setItem(STORAGE_KEYS.lastActivity, Date.now().toString());
};

export const isUserActive = () => {
  const last = localStorage.getItem(STORAGE_KEYS.lastActivity);
  if (!last) return false;
  return Date.now() - parseInt(last, 10) < INACTIVITY_THRESHOLD_MS;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEYS.sessionToken);
  localStorage.removeItem(STORAGE_KEYS.sessionExpiry);
  localStorage.removeItem(STORAGE_KEYS.lastActivity);
};
