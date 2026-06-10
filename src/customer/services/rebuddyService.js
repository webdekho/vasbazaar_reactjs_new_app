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
};
