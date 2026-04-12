import { authGet } from "./apiClient";
import { cachedFetch } from "./apiCache";

export const serviceService = {
  /**
   * PERF FIX: Service list rarely changes — cached for 24 hours.
   * Eliminates redundant fetches when navigating between Home and Services screens.
   */
  getHomeServices: () => cachedFetch("getHomeServices", () => authGet("/api/customer/service/allService", { displayOnScreen: 1 }), 86400000),

  getAllServices: () => cachedFetch("getAllServices", () => authGet("/api/customer/service/allService"), 86400000),

  // Operators list cached for 1 hour per service
  getOperatorsByService: (serviceId) =>
    cachedFetch(`operators_${serviceId}`, () => authGet("/api/customer/operator/getByServiceId", { serviceId }), 3600000),

  // Extra params cached for 24 hours per operator
  getExtraParamsByOperatorId: (operatorId) =>
    cachedFetch(`extraParams_${operatorId}`, () => authGet("/api/customer/extra_params/getByOperatorId", { id: operatorId }), 86400000),
};
