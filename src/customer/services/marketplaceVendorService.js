import { authGet, authPost, authDelete } from "./apiClient";

/**
 * Vendor management pack (Retail Bazaar sellers): holiday calendar, pincode
 * serviceability, CRM-lite and the seller scorecard. Kept separate from
 * marketplaceService.js on purpose — that file is owned by the shopping flow.
 * All endpoints are backed by CustStoreVendorMgmtController.
 */
export const marketplaceVendorService = {
  // ===== Holiday calendar (seller) =====
  getMyHolidays: () => authGet("/api/customer/marketplace/store/my/holidays"),

  addHoliday: ({ holidayDate, note }) =>
    authPost("/api/customer/marketplace/store/my/holidays", {
      holidayDate,
      ...(note ? { note } : {}),
    }),

  deleteHoliday: (id) => authDelete(`/api/customer/marketplace/store/my/holidays/${id}`),

  // ===== Pincode serviceability (seller, max 50) =====
  getMyPincodes: () => authGet("/api/customer/marketplace/store/my/pincodes"),

  addPincode: (pincode) =>
    authPost("/api/customer/marketplace/store/my/pincodes", { pincode }),

  deletePincode: (id) => authDelete(`/api/customer/marketplace/store/my/pincodes/${id}`),

  // ===== CRM-lite & scorecard (seller, read-only) =====
  getMyCrm: () => authGet("/api/customer/marketplace/store/my/crm"),

  getMyScorecard: (days = 30) =>
    authGet("/api/customer/marketplace/store/my/scorecard", { days }),

  // ===== Customer-facing reads =====
  // { closedToday, nextHoliday, upcoming: [{ holidayDate, note }] }
  getStoreHolidays: (storeId) =>
    authGet(`/api/customer/marketplace/stores/${storeId}/holidays`),

  // { restricted, pincodes: [] } — restricted=false means radius-only, never warn.
  getStorePincodes: (storeId) =>
    authGet(`/api/customer/marketplace/stores/${storeId}/pincodes`),
};

export default marketplaceVendorService;
