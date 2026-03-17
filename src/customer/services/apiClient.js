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

const resolveApiBase = () => {
  const customerBase =
    typeof window !== "undefined" ? localStorage.getItem(CUSTOMER_STORAGE_KEYS.apiBaseUrl) : null;
  if (customerBase) return trimTrailingSlash(customerBase);

  const sharedHost = typeof window !== "undefined" ? localStorage.getItem("host") : null;
  if (sharedHost) return trimTrailingSlash(sharedHost);

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

export { apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS, trimTrailingSlash, resolveApiBase };
