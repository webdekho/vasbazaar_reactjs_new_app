import { authGet, authPost, authPut, authDelete } from "./apiClient";

/**
 * Retail Bazaar Wave 4 — customer-facing endpoints kept out of the core
 * marketplaceService.js (owned by another workstream). Covers:
 *  - category attribute defs (dynamic spec/filter schema, read-only for the app)
 *  - reminders (medicine / refill / vaccination / AMC / custom)
 *  - appointments (jewellery visit / technician / vet / installation / trial)
 *  - indicative live gold/silver rate
 * All price-bearing logic (add-ons) stays server-side; the app only ever sends
 * add-on CODES through the existing placeOrder payload.
 */
export const marketplaceWave4Service = {
  // ===== Category attribute defs (public read) =====
  getAttributeDefs: (categoryId) =>
    authGet(`/api/customer/marketplace/categories/${categoryId}/attribute-defs`),

  // ===== Reminders (customer CRUD) =====
  getReminders: () => authGet("/api/customer/marketplace/reminders"),
  createReminder: (payload) => authPost("/api/customer/marketplace/reminders", payload),
  updateReminder: (id, payload) => authPut(`/api/customer/marketplace/reminders/${id}`, payload),
  deleteReminder: (id) => authDelete(`/api/customer/marketplace/reminders/${id}`),

  // ===== Appointments (customer) =====
  getMyAppointments: () => authGet("/api/customer/marketplace/appointments"),
  bookAppointment: (payload) => authPost("/api/customer/marketplace/appointments", payload),

  // ===== Appointments (seller inbox) =====
  getSellerAppointments: () => authGet("/api/customer/marketplace/seller/appointments"),
  confirmAppointment: (id) => authPost(`/api/customer/marketplace/seller/appointments/${id}/confirm`, {}),
  cancelAppointment: (id, reason) =>
    authPost(`/api/customer/marketplace/seller/appointments/${id}/cancel`, reason ? { cancelReason: reason } : {}),
  completeAppointment: (id) => authPost(`/api/customer/marketplace/seller/appointments/${id}/done`, {}),

  // ===== Gold rate (indicative display only) =====
  getCurrentGoldRate: ({ metal = "GOLD", purity = "22K" } = {}) =>
    authGet("/api/customer/marketplace/gold-rates/current", { metal, purity }),
};

export default marketplaceWave4Service;
