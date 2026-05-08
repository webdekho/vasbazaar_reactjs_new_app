import { authGet, authPost, authPut, authDelete, apiClient } from "./apiClient";

const CUSTOMER_TOKEN_KEY = "customerSessionToken";
const getToken = () => localStorage.getItem(CUSTOMER_TOKEN_KEY);

export const marketplaceService = {
  // ===== Browse =====
  getCategories: () => authGet("/api/customer/marketplace/categories"),

  getNearbyStores: ({ lat, lng, search, categoryId } = {}) =>
    authGet("/api/customer/marketplace/stores", {
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
    }),

  getStore: (storeId) => authGet(`/api/customer/marketplace/stores/${storeId}`),

  getStoreItems: (storeId, search) =>
    authGet(`/api/customer/marketplace/stores/${storeId}/items`, search ? { search } : {}),

  getStoreItemCategories: (storeId) =>
    authGet(`/api/customer/marketplace/stores/${storeId}/item-categories`),

  getItemCategorySubcategories: (categoryId) =>
    authGet(`/api/customer/marketplace/item-categories/${categoryId}/subcategories`),

  // ===== My Store (owner side) =====
  getMyStore: () => authGet("/api/customer/marketplace/store/my"),

  onboardStore: async (payload, paymentRef) => {
    try {
      const token = getToken();
      if (!token) return { success: false, message: "Authentication required.", data: null };
      const headers = { "Content-Type": "application/json", access_token: token };
      if (paymentRef) headers.payment_ref = paymentRef;
      const response = await apiClient.post("/api/customer/marketplace/store/onboard", payload, { headers });
      const data = response?.data || {};
      const ok = String(data.Status || "").toUpperCase() === "SUCCESS";
      return { success: ok, message: data.message || (ok ? "Submitted" : "Failed"), data: data.data || null };
    } catch (error) {
      const msg = error?.response?.data?.message || "Submission failed";
      return { success: false, message: msg, data: null };
    }
  },

  // ===== Marketplace onboarding charges & coupons =====
  getOnboardingCharges: ({ categoryId, couponCode } = {}) =>
    authGet("/api/customer/marketplace/onboarding/charges", {
      ...(categoryId ? { categoryId } : {}),
      ...(couponCode ? { couponCode } : {}),
    }),

  validateOnboardingCoupon: ({ code, categoryId }) =>
    authPost("/api/customer/marketplace/onboarding/validate-coupon", {
      code,
      categoryId: categoryId || null,
    }),

  updateMyStore: (payload) => authPut("/api/customer/marketplace/store/my", payload),

  toggleMyStoreOpen: (isOpen) =>
    authPut(`/api/customer/marketplace/store/my/toggle-open?isOpen=${isOpen}`, {}),

  updateMyStoreTimings: ({ openTime, closeTime, autoSchedule, weeklySchedule }) =>
    authPut("/api/customer/marketplace/store/my/timings", {
      openTime: openTime || null,
      closeTime: closeTime || null,
      autoSchedule: !!autoSchedule,
      weeklySchedule: weeklySchedule || null,
    }),

  getMyItems: () => authGet("/api/customer/marketplace/store/my/items"),

  addMyItem: (payload) => authPost("/api/customer/marketplace/store/my/items", payload),

  updateMyItem: (payload) => authPut("/api/customer/marketplace/store/my/items", payload),

  deleteMyItem: (id) => authDelete(`/api/customer/marketplace/store/my/items/${id}`),

  toggleItemAvailability: (id, isAvailable) =>
    authPut(`/api/customer/marketplace/store/my/items/${id}/availability?isAvailable=${isAvailable}`, {}),

  // ===== My Store Item Categories (owner side) =====
  getMyItemCategories: () => authGet("/api/customer/marketplace/store/my/item-categories"),

  createMyItemCategory: (payload) => authPost("/api/customer/marketplace/store/my/item-categories", payload),

  updateMyItemCategory: (payload) => authPut("/api/customer/marketplace/store/my/item-categories", payload),

  deleteMyItemCategory: (id) => authDelete(`/api/customer/marketplace/store/my/item-categories/${id}`),

  toggleMyItemCategoryActive: (id, isActive) =>
    authPut(`/api/customer/marketplace/store/my/item-categories/${id}/toggle-active?isActive=${isActive}`, {}),

  // ===== My Store Item Subcategories (owner side) =====
  getMyItemSubcategories: (categoryId) =>
    authGet("/api/customer/marketplace/store/my/item-subcategories", { categoryId }),

  createMyItemSubcategory: (payload) => authPost("/api/customer/marketplace/store/my/item-subcategories", payload),

  updateMyItemSubcategory: (payload) => authPut("/api/customer/marketplace/store/my/item-subcategories", payload),

  deleteMyItemSubcategory: (id) => authDelete(`/api/customer/marketplace/store/my/item-subcategories/${id}`),

  toggleMyItemSubcategoryActive: (id, isActive) =>
    authPut(`/api/customer/marketplace/store/my/item-subcategories/${id}/toggle-active?isActive=${isActive}`, {}),

  getMyStoreOrders: ({ orderStatus, pageNumber = 0, pageSize = 10 } = {}) =>
    authGet("/api/customer/marketplace/store/my/orders", { pageNumber, pageSize, ...(orderStatus ? { orderStatus } : {}) }),

  updateStoreOrderStatus: (orderId, orderStatus) =>
    authPut(`/api/customer/marketplace/store/my/orders/${orderId}/status?orderStatus=${encodeURIComponent(orderStatus)}`, {}),

  // Seller accept/reject/status (POST + JSON body)
  acceptOrder: (orderId) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/accept`, {}),

  rejectOrder: (orderId, reason) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/reject`, { reason: reason || '' }),

  updateOrderStatus: (orderId, status) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/status`, { status }),

  // ===== Customer orders =====
  placeOrder: (payload) => authPost("/api/customer/marketplace/orders", payload),

  getMyOrders: ({ pageNumber = 0, pageSize = 10 } = {}) =>
    authGet("/api/customer/marketplace/orders/my", { pageNumber, pageSize }),

  getMyOrder: (orderId) => authGet(`/api/customer/marketplace/orders/${orderId}`),

  checkOrderPayment: (orderId) =>
    authGet(`/api/customer/marketplace/orders/${orderId}/check-payment`),

  // ===== Image upload =====
  uploadImage: async (file, purpose) => {
    try {
      const formData = new FormData();
      formData.append("file", file, file.name || `${purpose}_${Date.now()}.jpg`);
      formData.append("purpose", purpose);
      const token = getToken();
      const response = await apiClient.post("/api/customer/marketplace/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data", access_token: token },
        timeout: 30000,
      });
      const payload = response?.data || {};
      const ok = String(payload.Status || "").toUpperCase() === "SUCCESS";
      return {
        success: ok,
        message: payload.message || (ok ? "Uploaded" : "Upload failed"),
        data: payload.data || null,
      };
    } catch (error) {
      const msg = error?.response?.data?.message || "Upload failed";
      return { success: false, message: msg, data: null };
    }
  },
};

export default marketplaceService;
