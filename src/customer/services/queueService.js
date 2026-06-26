/**
 * Service Bazaar Queue Management — customer join + provider-self queue control.
 * Backend: /api/customer/service-queue (see CustQueueController).
 *
 * Each call returns the standard { success, message, data, raw } envelope from apiClient.
 */
import { authGet, authPost, authPut, authDelete } from "./apiClient";

const BASE = "/api/customer/service-queue";

export const queueService = {
  // ---- Customer ----
  getProviderQueue: (providerId) => authGet(`${BASE}/provider/${providerId}`),
  join: (providerId, note) => authPost(`${BASE}/provider/${providerId}/join`, { note }),
  getMyTokens: () => authGet(`${BASE}/me/tokens`),
  cancelToken: (tokenId) => authDelete(`${BASE}/tokens/${tokenId}`),

  // ---- Provider self-service ----
  setQueueEnabled: (enabled) => authPost(`${BASE}/me/queue/enabled?enabled=${enabled ? "true" : "false"}`, {}),
  getMyQueue: () => authGet(`${BASE}/me/queue`),
  openQueue: (avgMinutes) => authPost(`${BASE}/me/queue/open${avgMinutes ? `?avgMinutes=${avgMinutes}` : ""}`, {}),
  closeQueue: () => authPost(`${BASE}/me/queue/close`, {}),
  callNext: () => authPost(`${BASE}/me/queue/call-next`, {}),
  updateToken: (tokenId, status) => authPut(`${BASE}/me/queue/tokens/${tokenId}?status=${encodeURIComponent(status)}`, {}),
};

export default queueService;
