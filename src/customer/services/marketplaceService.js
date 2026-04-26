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

  // ===== My Store (owner side) =====
  getMyStore: () => authGet("/api/customer/marketplace/store/my"),

  onboardStore: (payload) => authPost("/api/customer/marketplace/store/onboard", payload),

  updateMyStore: (payload) => authPut("/api/customer/marketplace/store/my", payload),

  toggleMyStoreOpen: (isOpen) =>
    authPut(`/api/customer/marketplace/store/my/toggle-open?isOpen=${isOpen}`, {}),

  getMyItems: () => authGet("/api/customer/marketplace/store/my/items"),

  addMyItem: (payload) => authPost("/api/customer/marketplace/store/my/items", payload),

  updateMyItem: (payload) => authPut("/api/customer/marketplace/store/my/items", payload),

  deleteMyItem: (id) => authDelete(`/api/customer/marketplace/store/my/items/${id}`),

  toggleItemAvailability: (id, isAvailable) =>
    authPut(`/api/customer/marketplace/store/my/items/${id}/availability?isAvailable=${isAvailable}`, {}),

  getMyStoreOrders: ({ orderStatus, pageNumber = 0, pageSize = 10 } = {}) =>
    authGet("/api/customer/marketplace/store/my/orders", { pageNumber, pageSize, ...(orderStatus ? { orderStatus } : {}) }),

  updateStoreOrderStatus: (orderId, orderStatus) =>
    authPut(`/api/customer/marketplace/store/my/orders/${orderId}/status?orderStatus=${encodeURIComponent(orderStatus)}`, {}),

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
