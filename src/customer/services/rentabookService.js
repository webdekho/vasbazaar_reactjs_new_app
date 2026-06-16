/**
 * Rent-a-Book (Book Rental) — customer API client.
 * Backend: /api/customer/rentabook (see CustRentabookController).
 *
 * Every call returns the standard { success, message, data, raw } envelope from
 * apiClient. This module also carries the bidirectional mappers between the
 * backend BookListingEntity / RentalOrderEntity shapes and the UI's book/order
 * objects, so RentABookScreen can keep its existing rendering untouched.
 */
import { authGet, authPost, authPut, authDelete, apiClient, CUSTOMER_STORAGE_KEYS } from "./apiClient";

const BASE = "/api/customer/rentabook";

// ── Status mapping ──────────────────────────────────────────
// Backend moderation status (PENDING/APPROVED/REJECTED) ↔ UI label.
const STATUS_TO_UI = { PENDING: "Pending approval", APPROVED: "Live", REJECTED: "Rejected" };
export const uiStatus = (backendStatus) => STATUS_TO_UI[String(backendStatus || "").toUpperCase()] || "Pending approval";

// Deterministic cover palette so listings without an uploaded photo still get
// a stable colour (mirrors the screen's seeded look).
const COVERS = [
  { cover: "#EEF2FF", accent: "#4F46E5" }, { cover: "#ECFDF5", accent: "#059669" },
  { cover: "#FEF2F2", accent: "#DC2626" }, { cover: "#FFF7ED", accent: "#EA580C" },
  { cover: "#F5F3FF", accent: "#7C3AED" }, { cover: "#FEFCE8", accent: "#CA8A04" },
];
const coverFor = (id) => {
  const n = Math.abs(Number(id) || String(id).split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  return COVERS[n % COVERS.length];
};

const num = (v) => (v == null || v === "" ? 0 : Number(v));
const coord = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const listingRecord = (record = {}) => (
  record.listing
    ? { ...record.listing, distanceKm: record.distanceKm }
    : record
);

/**
 * Backend BookListingEntity → UI book object consumed by RentABookScreen.
 * Keeps the same field names the screen already renders (slotPrices, rentPerDay,
 * cover/accent, status label, etc.).
 */
export const mapListingToBook = (e = {}) => {
  e = listingRecord(e);
  const slotPrices = { s7: num(e.rentSlotS7), s15: num(e.rentSlotS15), s30: num(e.rentSlotS30) };
  const palette = coverFor(e.id);
  return {
    id: e.id,
    listingId: e.id,
    title: e.title || "",
    author: e.author || "",
    publisher: e.publisher || "",
    edition: e.edition || "",
    isbn: e.isbn || "",
    language: e.language || "",
    category: e.category || "",
    condition: e.bookCondition || "",
    listingType: e.listingType || "rent",
    deliveryOption: e.deliveryOption || "both",
    slotPrices,
    rentPerDay: slotPrices.s7 || slotPrices.s15 || slotPrices.s30 || 0,
    deposit: num(e.deposit),
    maxDays: num(e.maxDays) || 30,
    autoSell: e.autoSell !== false,
    mrp: num(e.mrp),
    sellPrice: num(e.sellPrice),
    deliveryCharge: num(e.deliveryCharge),
    photo: e.photoUrl || "",
    cover: palette.cover,
    accent: palette.accent,
    city: e.city || "",
    address: e.address || "",
    lat: coord(e.lat ?? e.latitude),
    lng: coord(e.lng ?? e.longitude),
    availableFrom: e.availableFrom || "",
    status: uiStatus(e.status),
    availability: e.availability || "AVAILABLE",
    rejectionReason: e.rejectionReason || "",
    distanceKm: e.distanceKm != null ? Number(e.distanceKm) : (e.distance != null ? Number(e.distance) : null),
    rating: e.ratingAvg != null ? Number(e.ratingAvg) : num(e.rating),
    reviewCount: e.reviewCount != null ? Number(e.reviewCount) : 0,
    ownerUserId: e.ownerUserId?.id ?? e.ownerUserId ?? null,
  };
};

/**
 * UI listing form (RentABookScreen's `publish` payload) → backend create/update body.
 * The screen sends slotPrices{s7,s15,s30}; the backend expects rentSlotS7/15/30.
 */
export const mapFormToPayload = (form = {}) => {
  const slots = form.slotPrices || {};
  return {
    title: (form.title || "").trim(),
    author: (form.author || "").trim(),
    publisher: form.publisher || "",
    edition: form.edition || "",
    isbn: form.isbn || "",
    language: form.language || "",
    category: form.category || "",
    condition: form.condition || "",
    listingType: form.listingType || "rent",
    deliveryOption: form.deliveryOption || "both",
    rentSlotS7: num(slots.s7),
    rentSlotS15: num(slots.s15),
    rentSlotS30: num(slots.s30),
    deposit: num(form.deposit),
    maxDays: Math.min(Math.max(num(form.maxDays) || 30, 1), 30),
    autoSell: form.autoSell !== false,
    mrp: num(form.mrp),
    sellPrice: num(form.sellPrice),
    deliveryCharge: num(form.deliveryCharge),
    photoUrl: form.photoUrl || (typeof form.photo === "string" && form.photo.startsWith("http") ? form.photo : ""),
    city: (form.city || "").trim(),
    address: (form.address || "").trim(),
    lat: form.lat ?? null,
    lng: form.lng ?? null,
    availableFrom: form.availableFrom || null,
  };
};

// Read a paginated envelope (records[] / totalRecords / totalPages) from a response.
const records = (data) => (Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []);

/**
 * Reuses the generic, secured marketplace media endpoint. Returns { success, url }.
 * Listing photos are captured as data URLs in the wizard; we upload before save.
 */
const uploadImage = async (file, purpose = "rentabook") => {
  try {
    const formData = new FormData();
    formData.append("file", file, file.name || `${purpose}_listing.jpg`);
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

// Convert a base64 data URL (from the FileReader capture) to a File for upload.
const dataUrlToFile = (dataUrl, name = "listing.jpg") => {
  const [meta, b64] = String(dataUrl).split(",");
  const mime = (meta.match(/data:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
};

export const rentabookService = {
  // ---- Listings (owner) ----
  /** Create a listing from the wizard form. Uploads a captured photo first. */
  createListing: async (form) => {
    const body = mapFormToPayload(form);
    if (!body.photoUrl && typeof form.photo === "string" && form.photo.startsWith("data:")) {
      const up = await uploadImage(dataUrlToFile(form.photo));
      if (up.success) body.photoUrl = up.url;
    }
    return authPost(`${BASE}/listings`, body);
  },

  updateListing: async (listingId, form) => {
    const body = mapFormToPayload(form);
    if (!body.photoUrl && typeof form.photo === "string" && form.photo.startsWith("data:")) {
      const up = await uploadImage(dataUrlToFile(form.photo));
      if (up.success) body.photoUrl = up.url;
    }
    return authPut(`${BASE}/listings/${listingId}`, body);
  },

  getMyListings: async ({ pageNumber = 0, pageSize = 50 } = {}) => {
    const res = await authGet(`${BASE}/listings/mine`, { pageNumber, pageSize });
    return { ...res, books: res.success ? records(res.data).map(mapListingToBook) : [] };
  },

  getListing: async (listingId) => {
    const res = await authGet(`${BASE}/listings/${listingId}`);
    return { ...res, book: res.success ? mapListingToBook(res.data) : null };
  },

  deleteListing: (listingId) => authDelete(`${BASE}/listings/${listingId}`),

  // ---- Browse ----
  /** Browse approved + available books. Maps the standard or near-me envelope. */
  browse: async ({ search, category, listingType, condition, noDeposit, nearMe, lat, lng, radiusKm, pageNumber = 0, pageSize = 30 } = {}) => {
    const body = {
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(listingType ? { listingType } : {}),
      ...(condition ? { condition } : {}),
      ...(noDeposit ? { noDeposit: true } : {}),
      ...(nearMe ? { nearMe: true, lat, lng, radiusKm } : {}),
      pageNumber, pageSize,
    };
    const res = await authPost(`${BASE}/browse`, body);
    return { ...res, books: res.success ? records(res.data).map(mapListingToBook) : [] };
  },

  // ---- Orders (escrow lifecycle) ----
  /**
   * Request a rental/sale. payload: { listingId, txnType, deliveryMode, days,
   * paymentMethod, reminderDays, deliveryAddress, meetLocation, contactMobile, returnUrl }.
   */
  requestRental: (payload) => authPost(`${BASE}/orders`, payload),

  checkPaymentStatus: (orderId) => authGet(`${BASE}/orders/${orderId}/payment-status`),

  approveOrder: (orderId) => authPost(`${BASE}/orders/${orderId}/approve`, {}),
  confirmHandover: (orderId) => authPost(`${BASE}/orders/${orderId}/handover-confirm`, {}),
  initiateReturn: (orderId) => authPost(`${BASE}/orders/${orderId}/return-initiate`, {}),
  acceptReturn: (orderId, { lateFee = 0, damageDeduction = 0 } = {}) =>
    authPost(`${BASE}/orders/${orderId}/return-accept`, { lateFee, damageDeduction }),
  cancelOrder: (orderId, reason) => authPost(`${BASE}/orders/${orderId}/cancel`, { ...(reason ? { reason } : {}) }),

  getMyOrders: async ({ pageNumber = 0, pageSize = 50 } = {}) => {
    const res = await authGet(`${BASE}/orders/mine`, { pageNumber, pageSize });
    return { ...res, orders: res.success ? records(res.data) : [] };
  },

  getMySales: async ({ pageNumber = 0, pageSize = 50 } = {}) => {
    const res = await authGet(`${BASE}/orders/sales`, { pageNumber, pageSize });
    return { ...res, orders: res.success ? records(res.data) : [] };
  },

  // ---- Wishlist & reports ----
  toggleWishlist: (listingId) => authPost(`${BASE}/listings/${listingId}/wishlist`, {}),
  getWishlist: async () => {
    const res = await authGet(`${BASE}/wishlist`);
    return { ...res, books: res.success ? records(res.data).map(mapListingToBook) : [] };
  },
  /** payload: { reason, description? }. */
  reportListing: (listingId, payload) => authPost(`${BASE}/listings/${listingId}/report`, payload),

  // ---- Condition proof (handover / return) ----
  /** payload: { stage: 'HANDOVER'|'RETURN', photoUrls?, bookCondition?, notes?, conditionAccepted? }. */
  submitProof: (orderId, payload) => authPost(`${BASE}/orders/${orderId}/proof`, payload),
  getProofs: (orderId) => authGet(`${BASE}/orders/${orderId}/proof`),

  // ---- Reviews ----
  /** payload: { stars (1-5), takeaway?, orderId? }. */
  addReview: (listingId, payload) => authPost(`${BASE}/listings/${listingId}/reviews`, payload),

  getReviews: async (listingId, { pageNumber = 0, pageSize = 20 } = {}) => {
    const res = await authGet(`${BASE}/listings/${listingId}/reviews`, { pageNumber, pageSize });
    const d = res.data || {};
    return { ...res, avg: Number(d.avg) || 0, count: Number(d.count) || 0, reviews: Array.isArray(d.records) ? d.records : [] };
  },

  // ---- Disputes ----
  /** payload: { orderId, type, description, photoUrls? }. */
  raiseDispute: (payload) => authPost(`${BASE}/disputes`, payload),

  getMyDisputes: async ({ pageNumber = 0, pageSize = 50 } = {}) => {
    const res = await authGet(`${BASE}/disputes/mine`, { pageNumber, pageSize });
    return { ...res, disputes: res.success ? records(res.data) : [] };
  },

  // ---- Media ----
  uploadImage,
};

export default rentabookService;
