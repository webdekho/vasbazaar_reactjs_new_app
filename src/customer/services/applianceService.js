/**
 * Appliance Registry + AMC Marketplace — customer APIs.
 * Backend: /api/customer/appliances (see CustApplianceController).
 *
 * Every call returns the standard { success, message, data, raw } envelope from apiClient.
 */
import { authGet, authPost, authDelete } from "./apiClient";

const BASE = "/api/customer/appliances";

export const applianceService = {
  // ---- Appliance registry ----
  getMyAppliances: () => authGet(BASE),
  saveAppliance: (payload) => authPost(BASE, payload),
  deleteAppliance: (id) => authDelete(`${BASE}/${id}`),

  // ---- AMC marketplace ----
  getAmcPlans: () => authGet(`${BASE}/amc/plans`),
  getMyAmcs: ({ pageNumber = 0, pageSize = 20 } = {}) =>
    authGet(`${BASE}/amc/mine`, { pageNumber, pageSize }),
  purchaseAmc: (payload) => authPost(`${BASE}/amc/purchase`, payload),
  checkAmcPayment: (id) => authGet(`${BASE}/amc/${id}/check-payment`),
};

export default applianceService;
