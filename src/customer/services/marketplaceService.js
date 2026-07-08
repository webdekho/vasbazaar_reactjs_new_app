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

  // Unified product feed — items across all stores servicing a location, with
  // typo-tolerant item search.
  getNearbyProducts: ({ lat, lng, search, categoryId, pageNumber = 0, pageSize = 30 } = {}) =>
    authGet("/api/customer/marketplace/products", {
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      pageNumber,
      pageSize,
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

  // Bulk import: rows is an array of plain objects parsed from a CSV/Excel.
  bulkAddItems: (rows) => authPost("/api/customer/marketplace/store/my/items/bulk", { rows }),

  updateMyItem: (payload) => authPut("/api/customer/marketplace/store/my/items", payload),

  deleteMyItem: (id) => authDelete(`/api/customer/marketplace/store/my/items/${id}`),

  toggleItemAvailability: (id, isAvailable) =>
    authPut(`/api/customer/marketplace/store/my/items/${id}/availability?isAvailable=${isAvailable}`, {}),

  // ===== My Store Item Categories (owner side) =====
  getMyItemCategories: () => authGet("/api/customer/marketplace/store/my/item-categories"),

  createMyItemCategory: (payload) => authPost("/api/customer/marketplace/store/my/item-categories", payload),

  // Propose a category plus one or more subcategories in a single call.
  createMyItemCategoryWithSubs: (payload) =>
    authPost("/api/customer/marketplace/store/my/item-categories/with-subs", payload),

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

  updateOrderStatus: (orderId, status, reason) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/status`, { status, ...(reason ? { reason } : {}) }),

  // ===== Customer orders =====
  placeOrder: (payload) => authPost("/api/customer/marketplace/orders", payload),

  // Combined multi-store checkout: one payment for items from several stores;
  // backend creates one order per store (shared paymentGroupId) and settles each
  // seller's wallet share on payment success.
  placeMultiOrder: (payload) => authPost("/api/customer/marketplace/orders/multi", payload),

  // Poll the combined payment's status by its group id.
  checkGroupPayment: (groupId) =>
    authGet(`/api/customer/marketplace/orders/group/${groupId}/check-payment`),

  getMyOrders: ({ pageNumber = 0, pageSize = 10 } = {}) =>
    authGet("/api/customer/marketplace/orders/my", { pageNumber, pageSize }),

  getMyOrder: (orderId) => authGet(`/api/customer/marketplace/orders/${orderId}`),

  // Customer self-serve cancel (allowed while PLACED/ACCEPTED/PREPARING);
  // backend auto-refunds (wallet instantly, online/autopay to source) and notifies the store.
  cancelMyOrder: (orderId, reasonCode, reason) =>
    authPost(`/api/customer/marketplace/orders/${orderId}/cancel`, {
      ...(reasonCode ? { reasonCode } : {}),
      ...(reason ? { reason } : {}),
    }),

  // Partial cancel — remove one item from an active order (auto partial refund).
  cancelOrderItem: (orderId, lineId) =>
    authPost(`/api/customer/marketplace/orders/${orderId}/items/${lineId}/cancel`, {}),

  // Seller: mark order lines out of stock (partial availability, auto partial refund).
  markItemsUnavailable: (orderId, lineIds) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/items-unavailable`, { lineIds }),

  // GST tax invoice data (customer or store owner).
  getOrderInvoice: (orderId) => authGet(`/api/customer/marketplace/orders/${orderId}/invoice`),

  // ===== Wishlist (manual 'request-an-item' want-list) =====
  createWishlist: (payload) => authPost("/api/customer/marketplace/wishlist", payload),
  getMyWishlist: () => authGet("/api/customer/marketplace/wishlist/my"),
  deleteWishlist: (id) => authDelete(`/api/customer/marketplace/wishlist/${id}`),

  // ===== Saved-product wishlist (Retail Wave 1) =====
  // Separate feature from the 'request-an-item' wishlist above. This one saves a
  // catalog product and is keyed by ITEM id (not the saved-row id). Save is
  // upsert-idempotent server-side (UNIQUE user_id+item_id); delete-by-item-id is
  // idempotent too. Each list element carries the embedded { item } StoreItem.
  getSavedItems: () => authGet("/api/customer/marketplace/saved-items"),
  saveItem: (itemId) => authPost("/api/customer/marketplace/saved-items", { itemId }),
  removeSavedItem: (itemId) => authDelete(`/api/customer/marketplace/saved-items/${itemId}`),

  checkOrderPayment: (orderId) =>
    authGet(`/api/customer/marketplace/orders/${orderId}/check-payment`),

  // ===== Recurring subscriptions =====
  createSubscription: (payload) => authPost("/api/customer/marketplace/subscriptions", payload),

  getMySubscriptions: () => authGet("/api/customer/marketplace/subscriptions/my"),

  toggleSubscription: (id, active) =>
    authPut(`/api/customer/marketplace/subscriptions/${id}/active?active=${active}`, {}),

  cancelSubscription: (id) => authDelete(`/api/customer/marketplace/subscriptions/${id}`),

  // Modify an existing subscription's cadence/time/payment/dates.
  updateSubscription: (id, payload) =>
    authPut(`/api/customer/marketplace/subscriptions/${id}`, payload),

  // One-time move of the next delivery to { date, time }.
  rescheduleSubscription: (id, payload) =>
    authPost(`/api/customer/marketplace/subscriptions/${id}/reschedule`, payload),

  // ===== Delivery slots =====
  getStoreDeliverySlots: (storeId) => authGet(`/api/customer/marketplace/stores/${storeId}/delivery-slots`),

  getMyDeliverySlots: () => authGet("/api/customer/marketplace/store/my/delivery-slots"),

  createMyDeliverySlot: (payload) => authPost("/api/customer/marketplace/store/my/delivery-slots", payload),

  updateMyDeliverySlot: (payload) => authPut("/api/customer/marketplace/store/my/delivery-slots", payload),

  deleteMyDeliverySlot: (id) => authDelete(`/api/customer/marketplace/store/my/delivery-slots/${id}`),

  toggleMyDeliverySlot: (id, isActive) =>
    authPut(`/api/customer/marketplace/store/my/delivery-slots/${id}/toggle-active?isActive=${isActive}`, {}),

  // ===== Ratings & Reviews =====
  getStoreReviews: (storeId, { pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`/api/customer/marketplace/stores/${storeId}/reviews`, { pageNumber, pageSize }),

  createReview: (payload) => authPost("/api/customer/marketplace/reviews", payload),

  getOrderReviewState: (orderId) =>
    authGet(`/api/customer/marketplace/orders/${orderId}/review-state`),

  // Merchant: reviews on my store + reply
  getMyStoreReviews: () => authGet("/api/customer/marketplace/store/my/reviews"),

  replyToReview: (reviewId, reply) =>
    authPost(`/api/customer/marketplace/reviews/${reviewId}/reply`, { reply }),

  // ===== Offers & Promotions =====
  getStoreOffers: (storeId) => authGet(`/api/customer/marketplace/stores/${storeId}/offers`),

  validateOffer: ({ storeId, code, subtotal }) =>
    authPost("/api/customer/marketplace/offers/validate", { storeId, code, subtotal }),

  // Merchant offer CRUD
  getMyOffers: () => authGet("/api/customer/marketplace/store/my/offers"),

  createOffer: (payload) => authPost("/api/customer/marketplace/store/my/offers", payload),

  updateOffer: (payload) => authPut("/api/customer/marketplace/store/my/offers", payload),

  deleteOffer: (id) => authDelete(`/api/customer/marketplace/store/my/offers/${id}`),

  toggleOffer: (id, isActive) =>
    authPut(`/api/customer/marketplace/store/my/offers/${id}/toggle-active?isActive=${isActive}`, {}),

  // ===== Click & Collect =====
  verifyPickup: (orderId, code) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/verify-pickup`, { code }),

  // ===== Home delivery OTP =====
  verifyDelivery: (orderId, code) =>
    authPost(`/api/customer/marketplace/seller/orders/${orderId}/verify-delivery`, { code }),

  // ===== Digital Khata (merchant side) =====
  getMyStoreKhatas: () => authGet("/api/customer/marketplace/store/my/khata"),
  createKhata: (payload) => authPost("/api/customer/marketplace/store/my/khata", payload),
  getKhataStatement: (khataId) => authGet(`/api/customer/marketplace/store/my/khata/${khataId}`),
  addKhataEntry: (khataId, payload) => authPost(`/api/customer/marketplace/store/my/khata/${khataId}/entry`, payload),
  updateKhata: (khataId, payload) => authPut(`/api/customer/marketplace/store/my/khata/${khataId}`, payload),
  remindKhata: (khataId) => authPost(`/api/customer/marketplace/store/my/khata/${khataId}/remind`, {}),

  // ===== Digital Khata (customer side) =====
  getMyKhatas: () => authGet("/api/customer/marketplace/khata/my"),
  getMyKhataStatement: (khataId) => authGet(`/api/customer/marketplace/khata/my/${khataId}`),

  // ===== Disputes / returns (customer side) =====
  raiseDispute: (payload) => authPost("/api/customer/marketplace/disputes", payload),
  getMyDisputes: () => authGet("/api/customer/marketplace/disputes/my"),

  // ===== RMA — Returns / Replacements (Retail Wave 2) =====
  // Structured reverse-logistics + refund state machine, distinct from the
  // free-form disputes above. Refund rides the existing order refund machinery
  // server-side; the app only calls these endpoints.
  createReturn: (payload) => authPost("/api/customer/marketplace/returns", payload),

  getMyReturns: ({ pageNumber = 0, pageSize = 50 } = {}) =>
    authGet("/api/customer/marketplace/returns/my", { pageNumber, pageSize }),

  getReturn: (id) => authGet(`/api/customer/marketplace/returns/${id}`),

  // Seller side — incoming RMAs on my store + lifecycle actions.
  getMyStoreReturns: ({ status, pageNumber = 0, pageSize = 50 } = {}) =>
    authGet("/api/customer/marketplace/store/my/returns", {
      pageNumber,
      pageSize,
      ...(status ? { status } : {}),
    }),

  approveReturn: (id, resolutionNote) =>
    authPost(`/api/customer/marketplace/seller/returns/${id}/approve`,
      resolutionNote ? { resolutionNote } : {}),

  rejectReturn: (id, reason) =>
    authPost(`/api/customer/marketplace/seller/returns/${id}/reject`, { reason: reason || "" }),

  assignReverseRider: (id, { riderId, awb } = {}) =>
    authPost(`/api/customer/marketplace/seller/returns/${id}/assign-reverse-rider`, {
      ...(riderId != null ? { riderId } : {}),
      ...(awb ? { awb } : {}),
    }),

  markReturnPicked: (id) =>
    authPost(`/api/customer/marketplace/seller/returns/${id}/mark-picked`, {}),

  completeReturn: (id) =>
    authPost(`/api/customer/marketplace/seller/returns/${id}/complete`, {}),

  // Merchant: enable/disable delivery & pickup without re-approval
  updateFulfillmentModes: ({ deliveryEnabled, pickupEnabled }) =>
    authPut("/api/customer/marketplace/store/my/fulfillment", { deliveryEnabled, pickupEnabled }),

  // ===== Merchant Analytics =====
  // Accepts either a plain number (legacy `days`) or an object
  // { from, to, days }. When from/to are supplied the backend uses the explicit
  // date range and `days` is ignored; otherwise it falls back to `days`.
  getMyStoreAnalytics: (arg = 30) => {
    const params =
      arg && typeof arg === "object"
        ? {
            ...(arg.from ? { from: arg.from } : {}),
            ...(arg.to ? { to: arg.to } : {}),
            ...(arg.days != null ? { days: arg.days } : {}),
          }
        : { days: arg };
    return authGet("/api/customer/marketplace/store/my/analytics", params);
  },

  // ===== Rewards: Loyalty points (Retail Wave 3) =====
  // Balance returns { points, valueInRupees }.
  getLoyaltyBalance: () => authGet("/api/customer/marketplace/loyalty/balance"),

  // Convert points -> wallet ₹ (server writes a REDEEM ledger row; guarded so
  // the balance can never go negative). Returns the credited amount.
  redeemLoyalty: (points) =>
    authPost("/api/customer/marketplace/loyalty/redeem", { points }),

  // ===== Rewards: Cashback ledger (read-only) =====
  getMyCashback: () => authGet("/api/customer/marketplace/cashback/my"),

  // ===== Rewards: Membership (Retail Wave 3) =====
  getMembershipPlans: () => authGet("/api/customer/marketplace/membership/plans"),

  getMyMembership: () => authGet("/api/customer/marketplace/membership/my"),

  // Wallet-only purchase; server is idempotent on its purchase_ref.
  purchaseMembership: (planId) =>
    authPost("/api/customer/marketplace/membership/purchase", { planId }),

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
