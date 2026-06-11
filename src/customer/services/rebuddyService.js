// ReBuddy group API. Groups live server-side (MongoDB) and are keyed by member
// mobile numbers, so a group shows up for everyone the moment they're added.
import { authGet, authPost, authDelete, guestGet } from "./apiClient";

const BASE = "/api/customer/rebuddy/group";

export const rebuddyService = {
  // All groups the logged-in user owns or has been added to.
  getMyGroups: () => authGet(`${BASE}/my`),

  // One group (caller must be a member).
  getGroup: (id) => authGet(`${BASE}/${encodeURIComponent(id)}`),

  // Public, read-only fetch for shared invite links — no login required. The
  // server masks member mobile numbers before returning the group.
  getPublicGroup: (id) => guestGet(`${BASE}/public/${encodeURIComponent(id)}`),

  // Create or update the whole group document (upsert).
  saveGroup: (group) => authPost(`${BASE}/save`, group),

  // Delete a group (owner only).
  deleteGroup: (id) => authDelete(`${BASE}/${encodeURIComponent(id)}`),

  // Leave a group (non-owner) — the group + entries stay for everyone else.
  leaveGroup: (id) => authDelete(`${BASE}/${encodeURIComponent(id)}/leave`),

  // Archive/unarchive a group for the logged-in member only.
  archiveGroup: (id, archived = true) =>
    authPost(`${BASE}/${encodeURIComponent(id)}/archive?archived=${archived ? "true" : "false"}`, {}),

  // "Pay & Settle": create a HDFC SmartGateway order to clear what the caller
  // owes a payee. Returns { orderId, paymentUrl } — redirect to paymentUrl.
  initiateSettlement: ({ groupId, fromId, toId, amount, note, returnUrl }) =>
    authPost(`${BASE}/settlement/initiate`, { groupId, fromId, toId, amount, note, returnUrl }),

  // Reconcile a settlement order after returning from the gateway. The server
  // re-verifies with HDFC and credits the payee wallet. Returns { status }.
  confirmSettlement: (orderId) =>
    authPost(`${BASE}/settlement/confirm?orderId=${encodeURIComponent(orderId)}`, {}),
};
