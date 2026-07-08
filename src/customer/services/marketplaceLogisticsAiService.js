import { authGet, authPost, authDelete } from "./apiClient";

const BASE = "/api/customer/marketplace";
const AI_BASE = "/api/customer/marketplace/discovery-ai";

/**
 * Retail Bazaar Logistics v1 + AI-lite service.
 *
 * Logistics: seller-managed store riders (max 20 active), rider assignment on
 * DELIVERY orders, proof-of-delivery photo and failed-delivery reporting.
 *
 * AI-lite (read-only heuristics, no external APIs): barcode scan-to-reorder,
 * smart monthly basket, natural-language-ish search (price phrases like
 * "under 200") and out-of-stock substitutes. AI product cards share the
 * unified /products feed row shape, so home-feed add-to-cart logic is reused.
 */
export const marketplaceLogisticsAiService = {
  // ===== Store riders (seller) =====
  getMyRiders: () => authGet(`${BASE}/store/my/riders`),

  addRider: (name, mobile) => authPost(`${BASE}/store/my/riders`, { name, mobile }),

  // Soft delete — the rider is deactivated, past assignments keep snapshots.
  removeRider: (riderId) => authDelete(`${BASE}/store/my/riders/${riderId}`),

  // ===== Rider assignment (seller; upsert = reassign) =====
  assignRider: (orderId, riderId) =>
    authPost(`${BASE}/seller/orders/${orderId}/assign-rider`, { riderId }),

  // Customer or store owner — returns { rider|null, podImageUrl,
  // deliveryFailedReason, deliveryAttempts, orderStatus }.
  getOrderLogistics: (orderId) => authGet(`${BASE}/orders/${orderId}/rider`),

  // ===== Proof of delivery (seller; upload the image first, pass its URL) =====
  submitPod: (orderId, imageUrl) =>
    authPost(`${BASE}/seller/orders/${orderId}/pod`, { imageUrl }),

  // ===== Failed delivery (seller; rolls status back to ACCEPTED for retry) =====
  reportDeliveryFailed: (orderId, reason) =>
    authPost(`${BASE}/seller/orders/${orderId}/delivery-failed`, { reason }),

  // ===== AI-lite =====
  barcodeLookup: (code, { lat, lng } = {}) =>
    authGet(`${AI_BASE}/barcode/${encodeURIComponent(code)}`, {
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    }),

  // Repeat purchases (last 90 days) with typical qty, grouped by store.
  getSmartBasket: () => authGet(`${AI_BASE}/smart-basket`),

  aiSearch: (q, { lat, lng } = {}) =>
    authGet(`${AI_BASE}/search`, {
      q,
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    }),

  getSubstitutes: (itemId, { lat, lng } = {}) =>
    authGet(`${AI_BASE}/items/${itemId}/substitutes`, {
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    }),
};

/**
 * True when the query contains a price phrase the AI search understands
 * ("under 200", "below ₹150", "less than rs 300", "upto 99", "< 300",
 * "above 500", "> 1000" …). The home search box uses this to route such
 * queries to the AI endpoint, with a transparent fallback to plain search.
 */
export const hasPricePhrase = (q) =>
  /(?:under|below|upto|up\s*to|within|less\s+than|cheaper\s+than|max(?:imum)?|above|over|more\s+than|min(?:imum)?|[<>]=?)\s*(?:rs\.?|₹|inr)?\s*\d{1,7}/i.test(
    String(q || "")
  );

export default marketplaceLogisticsAiService;
