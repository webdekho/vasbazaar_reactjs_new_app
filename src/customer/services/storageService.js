import { CUSTOMER_STORAGE_KEYS, CUSTOMER_STORAGE_PERSISTENT_KEYS } from "./apiClient";
import { server_api } from "../../utils/constants";
import { invalidateAll } from "./apiCache";

export const customerStorage = {
  keys: CUSTOMER_STORAGE_KEYS,

  getSessionToken: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken),

  getApiBaseUrl: () => server_api(),

  getDevOtp: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.devOtp),

  getUserData: () => {
    const value = localStorage.getItem(CUSTOMER_STORAGE_KEYS.userData);
    return value ? JSON.parse(value) : null;
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

  setFirstLoginComplete: () => {
    localStorage.setItem(CUSTOMER_STORAGE_KEYS.firstLoginComplete, "1");
  },

  hasCompletedFirstLogin: () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.firstLoginComplete) === "1",

  // My Dues — per-user dismissed reminders. Key shape: `${mobile}|${operatorId}`.
  // Value = ISO timestamp of the dismissed item's submittedDate. The reminder
  // re-appears only when a newer submittedDate arrives (user re-sets it).
  getDismissedDues: () => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEYS.dismissedDues);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  dismissDue: (key, submittedDateIso) => {
    if (!key) return;
    const map = (() => {
      try {
        const raw = localStorage.getItem(CUSTOMER_STORAGE_KEYS.dismissedDues);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();
    map[key] = submittedDateIso || new Date().toISOString();
    localStorage.setItem(CUSTOMER_STORAGE_KEYS.dismissedDues, JSON.stringify(map));
  },

  clear: () => {
    Object.values(CUSTOMER_STORAGE_KEYS).forEach((key) => {
      if (CUSTOMER_STORAGE_PERSISTENT_KEYS.has(key)) return;
      localStorage.removeItem(key);
    });
    // PERF FIX: Clear API cache on logout to prevent stale data for next user
    invalidateAll();
  },
};
