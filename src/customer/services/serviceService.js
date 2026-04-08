import { authGet } from "./apiClient";
import { cachedFetch } from "./apiCache";

export const serviceService = {
  /**
   * PERF FIX: Service list rarely changes — cached for 2 minutes.
   * Eliminates redundant fetches when navigating between Home and Services screens.
   */
  getHomeServices: () => cachedFetch("getHomeServices", () => authGet("/api/customer/service/allService", { displayOnScreen: 1 }), 120000),

  getAllServices: () => cachedFetch("getAllServices", () => authGet("/api/customer/service/allService"), 120000),

  getOperatorsByService: (serviceId) =>
    authGet("/api/customer/operator/getByServiceId", { serviceId }),

  getExtraParamsByOperatorId: (operatorId) =>
    authGet("/api/customer/extra_params/getByOperatorId", { operatorId }),
};
