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
  // slotTime (HH:mm) is required only when the provider runs appointment slots.
  join: (providerId, note, slotTime) => authPost(`${BASE}/provider/${providerId}/join`, { note, slotTime }),
  getMyTokens: () => authGet(`${BASE}/me/tokens`),
  cancelToken: (tokenId) => authDelete(`${BASE}/tokens/${tokenId}`),

  // ---- Provider self-service ----
  setQueueEnabled: (enabled) => authPost(`${BASE}/me/queue/enabled?enabled=${enabled ? "true" : "false"}`, {}),
  getMyQueue: () => authGet(`${BASE}/me/queue`),
  // opts: { avgMinutes, opensAt, closesAt, slotMinutes, slotCapacity } — opensAt/closesAt required.
  openQueue: (opts = {}) => {
    const qs = new URLSearchParams();
    if (opts.avgMinutes) qs.set("avgMinutes", opts.avgMinutes);
    if (opts.opensAt) qs.set("opensAt", opts.opensAt);
    if (opts.closesAt) qs.set("closesAt", opts.closesAt);
    if (opts.slotMinutes) qs.set("slotMinutes", opts.slotMinutes);
    if (opts.slotCapacity) qs.set("slotCapacity", opts.slotCapacity);
    const q = qs.toString();
    return authPost(`${BASE}/me/queue/open${q ? `?${q}` : ""}`, {});
  },
  closeQueue: () => authPost(`${BASE}/me/queue/close`, {}),
  callNext: () => authPost(`${BASE}/me/queue/call-next`, {}),
  updateToken: (tokenId, status) => authPut(`${BASE}/me/queue/tokens/${tokenId}?status=${encodeURIComponent(status)}`, {}),
};

export default queueService;
