/**
 * Service Bazaar Subscription Commerce — customer APIs.
 * Backend: /api/customer/service-subscriptions (see CustSubscriptionController).
 *
 * Each call returns the standard { success, message, data, raw } envelope from apiClient.
 */
import { authGet, authPost, authPut, authDelete } from "./apiClient";

const BASE = "/api/customer/service-subscriptions";

export const subscriptionService = {
  create: (payload) => authPost(BASE, payload),
  getMine: ({ pageNumber = 0, pageSize = 20 } = {}) => authGet(BASE, { pageNumber, pageSize }),
  getDeliveries: (id, { pageNumber = 0, pageSize = 20 } = {}) =>
    authGet(`${BASE}/${id}/deliveries`, { pageNumber, pageSize }),
  pause: (id, until) => authPut(`${BASE}/${id}/pause${until ? `?until=${encodeURIComponent(until)}` : ""}`, {}),
  resume: (id) => authPut(`${BASE}/${id}/resume`, {}),
  skipNext: (id) => authPut(`${BASE}/${id}/skip`, {}),
  cancel: (id) => authDelete(`${BASE}/${id}`),
};

export default subscriptionService;
