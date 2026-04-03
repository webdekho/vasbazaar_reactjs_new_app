import axios from "axios";
import { server_api } from "../../utils/constants";

const CUSTOMER_STORAGE_KEYS = {
  sessionToken: "customerSessionToken",
  userData: "customerUserData",
  tempToken: "customerTempToken",
  referralCode: "customerReferralCode",
  devOtp: "customerDevOtp",
  apiBaseUrl: "customerApiBaseUrl",
};

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  "https://api.vasbazaar.com",
  "https://apis.vasbazaar.com",
  "https://apis.uat.vasbazaar.com",
  "https://api.prod.webdekho.in",
];

const isAllowedHost = (url) =>
  url && ALLOWED_HOSTS.some((host) => url.startsWith(host));

const resolveApiBase = () => {
  if (typeof window !== "undefined") {
    const customerBase = localStorage.getItem(CUSTOMER_STORAGE_KEYS.apiBaseUrl);
    if (customerBase && isAllowedHost(trimTrailingSlash(customerBase)))
      return trimTrailingSlash(customerBase);

    const sharedHost = localStorage.getItem("host");
    if (sharedHost && isAllowedHost(trimTrailingSlash(sharedHost)))
      return trimTrailingSlash(sharedHost);
  }

  return trimTrailingSlash(server_api());
};

const apiClient = axios.create({
  baseURL: resolveApiBase(),
  headers: { "Content-Type": "application/json" },
});

// In-memory token backup for Android WebView timing issues
let memoryToken = null;

// Set token in both localStorage, memory, AND axios defaults
export const setSessionToken = (token) => {
  memoryToken = token;
  if (token) {
    localStorage.setItem(CUSTOMER_STORAGE_KEYS.sessionToken, token);
    // Also set on axios defaults for immediate availability
    apiClient.defaults.headers.common['access_token'] = token;
  } else {
    localStorage.removeItem(CUSTOMER_STORAGE_KEYS.sessionToken);
    delete apiClient.defaults.headers.common['access_token'];
  }
};

// Get token from memory first, then localStorage as fallback
export const getSessionToken = () => {
  if (memoryToken) return memoryToken;
  const stored = localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);
  if (stored) {
    memoryToken = stored; // sync to memory
    // Also sync to axios defaults
    apiClient.defaults.headers.common['access_token'] = stored;
  }
  return stored;
};

// Initialize token from localStorage on module load
(() => {
  const stored = localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);
  if (stored) {
    memoryToken = stored;
    apiClient.defaults.headers.common['access_token'] = stored;
  }
})();

// Request interceptor to ensure token is added to authenticated requests
apiClient.interceptors.request.use(
  (config) => {
    const token = getSessionToken();
    if (token) {
      config.headers.access_token = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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
  if (error?.response?.headers?.["content-type"]?.includes("text/html")) {
    return "API returned HTML instead of JSON. Check the customer panel API base URL.";
  }
  // Extract message from various API response formats
  const responseData = error?.response?.data;
  if (responseData) {
    return responseData.message || responseData.Message || responseData.error || responseData.Error || "Request failed";
  }
  // Network error or timeout
  if (error?.code === "ERR_NETWORK") {
    return "Network error. Please check your internet connection.";
  }
  if (error?.code === "ECONNABORTED") {
    return "Request timeout. Please try again.";
  }
  return error?.message || "Unexpected error";
};

const getCustomerToken = () => getSessionToken();

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

export const authGet = async (endpoint, params = {}) => {
  try {
    const response = await apiClient.get(endpoint, {
      params,
      headers: { access_token: getCustomerToken() },
    });
    return parseApiResponse(response);
  } catch (error) {
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

export const authPost = async (endpoint, payload) => {
  try {
    const response = await apiClient.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        access_token: getCustomerToken(),
      },
    });
    return parseApiResponse(response);
  } catch (error) {
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
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

// ── Global 401 Interceptor ──
// Detects session invalidation (e.g. logged_in_from_another_device) and forces re-login
let isRedirecting = false;
let loginTimestamp = 0;
const LOGIN_GRACE_PERIOD = 5000; // 5 seconds grace period after login

// Export function to set login timestamp (called after successful OTP verification)
export const markLoginTime = () => {
  loginTimestamp = Date.now();
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !isRedirecting) {
      // Skip 401 handling during grace period after login (prevents false session expired on Android)
      if (Date.now() - loginTimestamp < LOGIN_GRACE_PERIOD) {
        console.log("401 ignored during login grace period");
        return Promise.reject(error);
      }

      isRedirecting = true;
      const msg = error?.response?.data?.message || "Session expired";

      // Clear all auth data
      Object.values(CUSTOMER_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("vb_pin_set");
      localStorage.removeItem("vb_last_active");

      // Redirect to login with message
      const basePath = window.location.pathname.includes("/vasbazaar/")
        ? "/vasbazaar/customer/login"
        : "/customer/login";

      const reason = msg.includes("another_device") || msg.includes("another device")
        ? "You were logged out because your account was accessed from another device."
        : "Your session has expired. Please log in again.";

      sessionStorage.setItem("vb_logout_reason", reason);
      window.location.href = basePath;
    }
    return Promise.reject(error);
  }
);

export { apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS, trimTrailingSlash, resolveApiBase };
