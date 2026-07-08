import { authGet, authPost } from "./apiClient";

/**
 * Product-level extras for Retail Bazaar items: purchase-verified product
 * reviews (per store_item, distinct from store reviews). Kept out of
 * marketplaceService.js on purpose — that file stays owned by the core
 * marketplace flows.
 */
export const marketplaceItemExtrasService = {
  // Visible reviews of a product (paginated) + { average, count } summary.
  getItemReviews: (itemId, { pageNumber = 0, pageSize = 10 } = {}) =>
    authGet(`/api/customer/marketplace/items/${itemId}/reviews`, { pageNumber, pageSize }),

  // Submit a review — the backend verifies the caller actually purchased the
  // item in that order (DELIVERED / PICKED_UP) and rejects otherwise.
  createItemReview: (itemId, { orderId, rating, comment }) =>
    authPost(`/api/customer/marketplace/items/${itemId}/reviews`, {
      orderId,
      rating,
      ...(comment ? { comment } : {}),
    }),

  // Latest completed order of this user containing the item that hasn't been
  // reviewed yet: { orderId (nullable), hasPurchased, alreadyReviewed }.
  getMyEligibleOrder: (itemId) =>
    authGet(`/api/customer/marketplace/items/${itemId}/my-eligible-order`),
};

export default marketplaceItemExtrasService;
