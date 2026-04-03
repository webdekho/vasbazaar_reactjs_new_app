import { CUSTOMER_STORAGE_KEYS, trimTrailingSlash, resolveApiBase, apiClient, setSessionToken, getSessionToken } from "./apiClient";

export const customerStorage = {
  keys: CUSTOMER_STORAGE_KEYS,

  getSessionToken: () => getSessionToken(),

  getApiBaseUrl: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.apiBaseUrl) || resolveApiBase(),

  getDevOtp: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.devOtp),

  getUserData: () => {
    const value = localStorage.getItem(CUSTOMER_STORAGE_KEYS.userData);
    return value ? JSON.parse(value) : null;
  },

  setApiBaseUrl: (value) => {
    if (value) {
      const normalizedValue = trimTrailingSlash(value);
      localStorage.setItem(CUSTOMER_STORAGE_KEYS.apiBaseUrl, normalizedValue);
      apiClient.defaults.baseURL = normalizedValue;
      return;
    }
    localStorage.removeItem(CUSTOMER_STORAGE_KEYS.apiBaseUrl);
    apiClient.defaults.baseURL = resolveApiBase();
  },

  setAuthSession: ({ sessionToken, userData, tempToken }) => {
    if (sessionToken) setSessionToken(sessionToken); // Use memory-backed setter for Android reliability
    if (userData) localStorage.setItem(CUSTOMER_STORAGE_KEYS.userData, JSON.stringify(userData));
    if (typeof tempToken === "string" && tempToken) {
      localStorage.setItem(CUSTOMER_STORAGE_KEYS.tempToken, tempToken);
    } else if (tempToken === null) {
      localStorage.removeItem(CUSTOMER_STORAGE_KEYS.tempToken);
    }
  },

  setTempToken: (token) => {
    if (token) {
      localStorage.setItem(CUSTOMER_STORAGE_KEYS.tempToken, token);
    } else {
      localStorage.removeItem(CUSTOMER_STORAGE_KEYS.tempToken);
    }
  },

  getTempToken: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.tempToken),

  setDevOtp: (otp) => {
    if (otp) {
      localStorage.setItem(CUSTOMER_STORAGE_KEYS.devOtp, otp);
    } else {
      localStorage.removeItem(CUSTOMER_STORAGE_KEYS.devOtp);
    }
  },

  setReferralCode: (value) => {
    if (value) {
      localStorage.setItem(CUSTOMER_STORAGE_KEYS.referralCode, value);
    } else {
      localStorage.removeItem(CUSTOMER_STORAGE_KEYS.referralCode);
    }
  },

  getReferralCode: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.referralCode),

  clear: () => {
    setSessionToken(null); // Clear memory token too
    Object.values(CUSTOMER_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
