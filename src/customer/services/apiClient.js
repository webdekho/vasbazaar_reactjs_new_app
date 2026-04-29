import axios from "axios";
import { server_api } from "../../utils/constants";
import { getUserFriendlyMessage } from "../utils/userMessages";

const CUSTOMER_STORAGE_KEYS = {
  sessionToken: "customerSessionToken",
  userData: "customerUserData",
  tempToken: "customerTempToken",
  referralCode: "customerReferralCode",
  devOtp: "customerDevOtp",
  firstLoginComplete: "customerFirstLoginComplete",
  dismissedDues: "customerDismissedDues",
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
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
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
    return Promise.reject(error);
  }
);

export { apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS, CUSTOMER_STORAGE_PERSISTENT_KEYS };
