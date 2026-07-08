import { authGet } from "./apiClient";

const BASE = "/api/customer/marketplace";
const AI_BASE = "/api/customer/marketplace/discovery-ai";

const withLoc = ({ lat, lng } = {}) => ({
  ...(lat != null ? { lat } : {}),
  ...(lng != null ? { lng } : {}),
});

/**
 * Retail Bazaar Wave 6 — heuristic AI upgrade (read-only, non-money).
 *
 * All endpoints are pure derivations over existing order / item / offer data
 * (co-occurrence, purchase affinity, RFM). No LLM/voice/OCR/ML. Product cards
 * returned share the unified /products feed row shape, so the home-feed
 * add-to-cart and navigation logic are reused unchanged.
 */
export const marketplaceWave6Service = {
  // ===== Cross-category bundles (customer, discovery-ai) =====
  // Location-wide "goes well with" suggestions near the caller. Reads the
  // nightly bundle cache; each row is { anchor, companion, score, companionCategory }.
  getBundles: ({ lat, lng } = {}) => authGet(`${AI_BASE}/bundles`, withLoc({ lat, lng })),

  // Companions of one anchor item, computed live (cheap). Returns companion
  // product cards + score + companion category label.
  getItemBundle: (itemId) => authGet(`${AI_BASE}/items/${itemId}/bundle`),

  // ===== Personalized "For You" ranked offers (customer, discovery-ai) =====
  // Ranks already-valid StoreOffers / cashback by the caller's own purchase
  // affinity + distance. Never creates a discount. Falls back to nearest flash
  // / cashback for brand-new users. Each row carries a human "reason" string.
  getForYou: ({ lat, lng } = {}) => authGet(`${AI_BASE}/for-you`, withLoc({ lat, lng })),

  // ===== Recipe → shopping list (customer) =====
  // Browse curated recipes: { id, name, imageUrl, servings, cuisine, ingredientCount }.
  getRecipes: () => authGet(`${BASE}/recipes`),

  // Resolve each ingredient keyword to a nearby buyable item via the AI token
  // matcher. Returns a suggested cart: [{ keyword, requestedQty, unit, matched,
  // matchedItem: productCard|null, suggestedQty }]. No checkout / money here.
  resolveRecipe: (id, { lat, lng } = {}) =>
    authGet(`${BASE}/recipes/${id}/resolve`, withLoc({ lat, lng })),

  // ===== Seller insights (read-only) =====
  // Heuristic restock list: low / high-velocity items with salesVelocityPerDay,
  // currentStockQty, daysToStockout, suggestedReorderQty, urgency.
  getMyRestockSuggestions: (days = 30) =>
    authGet(`${BASE}/store/my/restock-suggestions`, { days }),

  // Seller CRM — CLV + churn-risk per customer (RFM heuristic):
  // { userId, name, mobile, orderCount, totalSpend, recencyDays, firstOrderDate,
  //   lastOrderDate, medianGapDays, churnRisk, segment }.
  getMyCustomerInsights: () => authGet(`${BASE}/store/my/customers/insights`),
};

export default marketplaceWave6Service;
