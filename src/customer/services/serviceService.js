import { authGet } from "./apiClient";

export const serviceService = {
  getHomeServices: () => authGet("/api/customer/service/allService", { displayOnScreen: 1 }),

  getAllServices: () => authGet("/api/customer/service/allService"),

  getOperatorsByService: (serviceId) =>
    authGet("/api/customer/operator/getByServiceId", { serviceId }),

  getExtraParamsByOperatorId: (operatorId) =>
    authGet("/api/customer/extra_params/getByOperatorId", { operatorId }),
};
