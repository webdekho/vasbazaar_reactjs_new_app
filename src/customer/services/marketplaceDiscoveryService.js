import { authGet, authPost, authDelete } from "./apiClient";

const BASE = "/api/customer/marketplace/discovery";

/**
 * Retail Bazaar Discovery pack — recently viewed, buy again, frequently
 * bought together, similar products and featured items. All product cards
 * returned by these endpoints share the unified /products feed row shape
 * (id, name, imageUrl, mrp/sellingPrice/offerPrice, unit, storeId, storeName,
 * storeOpen, deliveryCharges, distanceKm, …) so the home-feed add-to-cart and
 * navigation logic can be reused unchanged.
 */
export const marketplaceDiscoveryService = {
  // ===== Recently viewed =====
  // Fire-and-forget on product-detail open; server upserts and keeps last 30.
  trackView: (itemId) => authPost(`${BASE}/recent-views`, { itemId }),

  getRecentlyViewed: () => authGet(`${BASE}/recent-views`),

  // ===== Buy again (derived from past DELIVERED/PICKED_UP orders) =====
  getBuyAgain: ({ lat, lng } = {}) =>
    authGet(`${BASE}/buy-again`, {
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    }),

  // ===== Frequently bought together (top 5 companions, min support 2) =====
  getFrequentlyBoughtTogether: (itemId) =>
    authGet(`${BASE}/items/${itemId}/frequently-bought-together`),

  // ===== Similar products (same store + category, comparable price) =====
  getSimilarProducts: (itemId) => authGet(`${BASE}/items/${itemId}/similar`),

  // ===== Featured (customer — nearby stores' featured picks) =====
  getFeatured: ({ lat, lng } = {}) =>
    authGet(`${BASE}/featured`, {
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    }),

  // ===== Featured (seller — own store; max 10 active) =====
  getMyFeatured: () => authGet(`${BASE}/store/my/featured`),

  featureItem: (itemId, sortOrder) =>
    authPost(`${BASE}/store/my/featured/${itemId}`, sortOrder != null ? { sortOrder } : {}),

  unfeatureItem: (itemId) => authDelete(`${BASE}/store/my/featured/${itemId}`),
};

export default marketplaceDiscoveryService;
