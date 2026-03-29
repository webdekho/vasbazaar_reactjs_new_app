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
  return error?.response?.data?.message || error?.message || "Unexpected error";
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

// ── App Lock flag ──
// When the app is locked, skip 401 redirect — the lock screen handles re-auth via PIN
let _appLocked = false;
export const setAppLocked = (val) => { _appLocked = val; };

// ── Global 401 Interceptor ──
// Detects session invalidation (e.g. logged_in_from_another_device) and forces re-login
let isRedirecting = false;
const LOGIN_PAGES = ["/customer/login", "/customer/verify-otp"];
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Skip 401 handling on login/OTP pages and for guest requests (no access_token)
    const isOnLoginPage = LOGIN_PAGES.some((p) => window.location.pathname.endsWith(p));
    const hasAccessToken = error?.config?.headers?.access_token;

    if (error?.response?.status === 401 && !isRedirecting && !isOnLoginPage && hasAccessToken && !_appLocked) {
      isRedirecting = true;

      // Clear auth tokens but preserve vb_pin_set (PIN is per-device, not per-session)
      Object.values(CUSTOMER_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("vb_last_active");

      // Redirect to login
      window.location.href = "/customer/login";
    }
    return Promise.reject(error);
  }
);

export { apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS, trimTrailingSlash, resolveApiBase };
