import axios from "axios";
import { server_api } from "../../utils/constants";
import { getUserFriendlyMessage } from "../utils/userMessages";
import { reportApiError } from "./errorReporterService";

// Axios keeps the request body as a JSON string; the reporter masks by key, so it
// needs an object. A non-JSON body (FormData, etc.) is dropped rather than guessed at.
const safeParse = (data) => {
  if (!data || typeof data !== "string") return null;
  try { return JSON.parse(data); } catch { return null; }
};

const CUSTOMER_STORAGE_KEYS = {
  sessionToken: "customerSessionToken",
  userData: "customerUserData",
  tempToken: "customerTempToken",
  referralCode: "customerReferralCode",
  devOtp: "customerDevOtp",
  firstLoginComplete: "customerFirstLoginComplete",
  dismissedDues: "customerDismissedDues",
  isExist: "customerIsExist",
  // Which of the seller's stores is active. Listed here so logout clears it —
  // a leftover id would belong to the previous user, and every /store/my/* call
  // would then fail its ownership check.
  activeStoreId: "customerActiveStoreId",
};

// Keys that must survive logout (persist across user sessions on the device).
const CUSTOMER_STORAGE_PERSISTENT_KEYS = new Set([
  CUSTOMER_STORAGE_KEYS.firstLoginComplete,
]);

// API base URL comes from .env via server_api()
const apiClient = axios.create({
  baseURL: server_api(),
  headers: { "Content-Type": "application/json" },
});

// ===== Active store (multi-store sellers) =====
// A seller can own several stores, so every /store/my/* call has to say WHICH.
// It rides as a header rather than a param on ~40 endpoints, set in one place
// here. No header means the seller's first store, so single-store sellers and
// older app builds behave exactly as before.
const ACTIVE_STORE_KEY = CUSTOMER_STORAGE_KEYS.activeStoreId;

export const getActiveStoreId = () => localStorage.getItem(ACTIVE_STORE_KEY) || null;

export const setActiveStoreId = (storeId) => {
  if (storeId == null) localStorage.removeItem(ACTIVE_STORE_KEY);
  else localStorage.setItem(ACTIVE_STORE_KEY, String(storeId));
};

apiClient.interceptors.request.use((config) => {
  const storeId = getActiveStoreId();
  if (storeId) config.headers["X-Store-Id"] = storeId;
  return config;
});

const parseApiResponse = (response) => {
  const payload = response?.data || {};
  const { Status, STATUS, status, message, data, RDATA, ref_id } = payload;
  const normalizedStatus = String(Status || STATUS || status || "").toLowerCase();
  const success =
    normalizedStatus === "success" ||
    normalizedStatus === "1" ||
    (!!RDATA && normalizedStatus !== "failure");

  return {
    success,
    message: message || (success ? "Success" : "Request failed"),
    data: data ?? RDATA ?? payload,
    raw: payload,
    refId: ref_id || payload.ref_id || null,
  };
};

const getErrorMessage = (error) => {
  return getUserFriendlyMessage(error, "Something went wrong. Please try again.");
};

const getCustomerToken = () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);

export const guestPost = async (endpoint, payload) => {
  try {
    const response = await apiClient.post(endpoint, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return parseApiResponse(response);
  } catch (error) {
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

export const guestGet = async (endpoint, params = {}) => {
  try {
    const response = await apiClient.get(endpoint, {
      params,
      headers: { "Content-Type": "application/json" },
    });
    return parseApiResponse(response);
  } catch (error) {
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

/**
 * PERF FIX: Removed 4 console.log/console.error calls that ran on EVERY
 * authenticated GET request. On mobile (Capacitor WebView), console calls
 * are significantly more expensive than on desktop — they serialize objects,
 * format strings, and bridge to native logging on each call.
 */
export const authGet = async (endpoint, params = {}) => {
  try {
    const token = getCustomerToken();
    if (!token) {
      return { success: false, message: "Authentication required. Please login.", data: null, raw: null };
    }
    const response = await apiClient.get(endpoint, {
      params,
      headers: { access_token: token },
    });
    return parseApiResponse(response);
  } catch (error) {
    const errorData = error?.response?.data;
    const apiMessage =
      errorData?.message ||
      errorData?.error ||
      errorData?.errorMessage ||
      errorData?.msg ||
      errorData?.reason ||
      errorData?.detail;
    if (apiMessage && typeof apiMessage === "string") {
      return { success: false, message: apiMessage, data: errorData, raw: errorData, status: error?.response?.status };
    }
    return { success: false, message: getErrorMessage(error), data: null, raw: null, status: error?.response?.status };
  }
};

export const authPost = async (endpoint, payload) => {
  try {
    const token = getCustomerToken();
    if (!token) {
      return { success: false, message: "Authentication required. Please login.", data: null, raw: null };
    }
    const response = await apiClient.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        access_token: token,
      },
    });
    return parseApiResponse(response);
  } catch (error) {
    // Extract message from error response if available (e.g., 400 errors)
    const errorData = error?.response?.data;
    // Check multiple possible message fields
    const apiMessage =
      errorData?.message ||
      errorData?.error ||
      errorData?.errorMessage ||
      errorData?.msg ||
      errorData?.reason ||
      errorData?.detail;

    if (apiMessage && typeof apiMessage === "string") {
      return { success: false, message: apiMessage, data: errorData, raw: errorData };
    }
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

export const authPut = async (endpoint, payload) => {
  try {
    const response = await apiClient.put(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        access_token: getCustomerToken(),
      },
    });
    return parseApiResponse(response);
  } catch (error) {
    const errorData = error?.response?.data;
    const apiMessage =
      errorData?.message ||
      errorData?.error ||
      errorData?.errorMessage ||
      errorData?.msg ||
      errorData?.reason ||
      errorData?.detail;

    if (apiMessage && typeof apiMessage === "string") {
      return {
        success: false,
        message: apiMessage,
        data: errorData,
        raw: errorData,
        status: error?.response?.status,
      };
    }
    return {
      success: false,
      message: getErrorMessage(error),
      data: errorData || null,
      raw: errorData || null,
      status: error?.response?.status,
    };
  }
};

export const authDelete = async (endpoint, params = {}) => {
  try {
    const token = getCustomerToken();
    if (!token) {
      return { success: false, message: "Authentication required. Please login.", data: null, raw: null };
    }
    const response = await apiClient.delete(endpoint, {
      params,
      headers: { access_token: token },
    });
    return parseApiResponse(response);
  } catch (error) {
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

// ── App Lock state ──
// When a 401 occurs, lock the app instead of redirecting to login.
// PIN unlock returns a fresh token — the user never needs to re-login via OTP.
let _appLocked = false;
let _onSessionExpired = null;
export const setAppLocked = (val) => { _appLocked = val; };
export const onSessionExpired = (cb) => { _onSessionExpired = cb; };

// ── Global 401 Interceptor ──
// On session expiry: lock the app so the user re-authenticates with PIN.
// PIN login returns a fresh token — session is revalidated, never re-registered.
let _handling401 = false;
const LOGIN_PAGES = ["/customer/login", "/customer/verify-otp"];
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isOnLoginPage = LOGIN_PAGES.some((p) => window.location.pathname.endsWith(p));
    const hasAccessToken = error?.config?.headers?.access_token;

    if (error?.response?.status === 401 && !_handling401 && !isOnLoginPage && hasAccessToken && !_appLocked) {
      _handling401 = true;

      // Don't clear sessionToken — pinLogin needs it to identify the user
      // Just clear last-active so the lock screen shows immediately
      localStorage.removeItem("vb_last_active");

      // Trigger app lock instead of redirecting to login
      if (_onSessionExpired) _onSessionExpired();

      setTimeout(() => { _handling401 = false; }, 2000);
    }

    // Report API failures centrally. 401 is excluded — it is an expected part of the
    // lock/PIN flow above, not a defect. The reporter posts via raw fetch, so this
    // cannot recurse back through this interceptor.
    const status = error?.response?.status;
    if (status !== 401) {
      try {
        reportApiError({
          endpoint: error?.config?.url || "unknown",
          method: (error?.config?.method || "get").toUpperCase(),
          status: status || 0, // 0 = no response: network failure, timeout or CORS
          requestBody: safeParse(error?.config?.data),
          responseBody: error?.response?.data,
          errorMessage: error?.message || "Request failed",
        });
      } catch { /* reporting must never break the request path */ }
    }
    return Promise.reject(error);
  }
);

export { apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS, CUSTOMER_STORAGE_PERSISTENT_KEYS };
