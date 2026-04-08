import { CUSTOMER_STORAGE_KEYS, trimTrailingSlash, resolveApiBase, apiClient } from "./apiClient";
import { invalidateAll } from "./apiCache";

export const customerStorage = {
  keys: CUSTOMER_STORAGE_KEYS,

  getSessionToken: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken),

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
    if (sessionToken) localStorage.setItem(CUSTOMER_STORAGE_KEYS.sessionToken, sessionToken);
    if (userData) {
      // Merge with existing userData to preserve fields not in the payload
      const existing = localStorage.getItem(CUSTOMER_STORAGE_KEYS.userData);
      const existingData = existing ? JSON.parse(existing) : {};
      const merged = { ...existingData, ...userData };
      localStorage.setItem(CUSTOMER_STORAGE_KEYS.userData, JSON.stringify(merged));
    }
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
    Object.values(CUSTOMER_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    // PERF FIX: Clear API cache on logout to prevent stale data for next user
    invalidateAll();
  },
};
