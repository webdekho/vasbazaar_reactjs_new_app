/**
 * Service Bazaar (hyperlocal services marketplace) — customer + provider-self APIs.
 * Backend: /api/customer/service-bazaar (see CustServiceBazaarController).
 *
 * Every call returns the standard { success, message, data, raw } envelope from apiClient.
 */
import { authGet, authPost, authPut, authDelete, apiClient } from "./apiClient";
import { CUSTOMER_STORAGE_KEYS } from "./apiClient";

const BASE = "/api/customer/service-bazaar";

/**
 * Reuses the generic, secured marketplace media endpoint (purpose whitelist
 * includes "profile"). Returns { success, url }.
 */
const uploadImage = async (file, purpose = "profile") => {
  try {
    const formData = new FormData();
    formData.append("file", file, file.name || `${purpose}_${Date.now()}.jpg`);
    formData.append("purpose", purpose);
    const token = localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);
    const res = await apiClient.post("/api/customer/marketplace/upload/image", formData, {
      headers: { "Content-Type": "multipart/form-data", access_token: token },
    });
    const url = res?.data?.data?.url || res?.data?.url || null;
    return { success: !!url, url, message: res?.data?.message };
  } catch (e) {
    return { success: false, url: null, message: e?.response?.data?.message || "Upload failed" };
  }
};

export const serviceBazaarService = {
  // ---- Discovery ----
  getCategories: () => authGet(`${BASE}/categories`),

  searchProviders: ({ categoryId, pincode, city, search, lat, lng, radiusKm, pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`${BASE}/providers`, {
      ...(categoryId ? { categoryId } : {}),
      ...(pincode ? { pincode } : {}),
      ...(city ? { city } : {}),
      ...(search ? { search } : {}),
      ...(lat != null && lng != null ? { lat, lng } : {}),
      ...(radiusKm ? { radiusKm } : {}),
      pageNumber,
      pageSize,
    }),

  getProviderProfile: (providerId) => authGet(`${BASE}/providers/${providerId}`),

  getProviderOfferings: (providerId) => authGet(`${BASE}/providers/${providerId}/offerings`),

  getProviderReviews: (providerId, { pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`${BASE}/providers/${providerId}/reviews`, { pageNumber, pageSize }),

  // ---- Bookings (customer) ----
  createBooking: (payload) => authPost(`${BASE}/bookings`, payload),

  getMyBookings: ({ pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`${BASE}/bookings`, { pageNumber, pageSize }),

  getBooking: (id) => authGet(`${BASE}/bookings/${id}`),

  checkBookingPayment: (id) => authGet(`${BASE}/bookings/${id}/check-payment`),

  // Owner-only: the live Start/End service OTP to read out to the provider.
  getBookingOtp: (id) => authGet(`${BASE}/bookings/${id}/otp`),

  cancelBooking: (id, reason) => authDelete(`${BASE}/bookings/${id}`, { ...(reason ? { reason } : {}) }),

  // ---- Reviews ----
  addReview: (payload) => authPost(`${BASE}/reviews`, payload),

  // ---- Disputes ----
  raiseDispute: (payload) => authPost(`${BASE}/disputes`, payload),

  getMyDisputes: ({ pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`${BASE}/disputes`, { pageNumber, pageSize }),

  // ---- Saved / favourite providers ----
  getMyFavorites: ({ pageNumber = 0, pageSize = 20 } = {}) =>
    authGet(`${BASE}/me/favorites`, { pageNumber, pageSize }),

  addFavorite: (providerId) => authPost(`${BASE}/me/favorites/${providerId}`, {}),

  removeFavorite: (providerId) => authDelete(`${BASE}/me/favorites/${providerId}`),

  // ---- Provider self-service ----
  getMyProviderProfile: () => authGet(`${BASE}/me/provider`),

  saveMyProviderProfile: (payload) => authPost(`${BASE}/me/provider`, payload),

  getMyOfferings: () => authGet(`${BASE}/me/offerings`),

  saveMyOffering: (payload) => authPost(`${BASE}/me/offerings`, payload),

  getMyProviderBookings: ({ pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`${BASE}/me/provider/bookings`, { pageNumber, pageSize }),

  updateProviderBookingStatus: (id, status) =>
    authPut(`${BASE}/me/provider/bookings/${id}/status?status=${encodeURIComponent(status)}`, {}),

  // Doorstep engine — provider live journey + Start/End OTP validation.
  updateProviderFulfillment: (id, stage) =>
    authPut(`${BASE}/me/provider/bookings/${id}/fulfillment?stage=${encodeURIComponent(stage)}`, {}),

  providerStartService: (id, otp) => authPost(`${BASE}/me/provider/bookings/${id}/start`, { otp }),

  providerCompleteService: (id, otp) => authPost(`${BASE}/me/provider/bookings/${id}/complete`, { otp }),

  // ---- Media ----
  uploadImage,
};

export default serviceBazaarService;
