import { authGet, authPost, authDelete } from "./apiClient";
import { cachedFetch, invalidate } from "./apiCache";

export const notificationService = {
  /**
   * PERF FIX: First page of notifications cached for 60s.
   * Prevents duplicate fetches from HomeScreen + NotificationsScreen + polling hook.
   * Subsequent pages are not cached (user is actively paginating).
   */
  getNotifications: (pageNumber = 0) =>
    pageNumber === 0
      ? cachedFetch("notifications_p0", () => authGet("/api/customer/announcement/notification", { pageNumber }), 60000)
      : authGet("/api/customer/announcement/notification", { pageNumber }),

  getNotificationsByPage: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/announcement/notification", { pageNumber, pageSize }),

  /** Per-user dismiss — hides this announcement only for the current user. */
  dismissNotification: async (id) => {
    const res = await authPost(`/api/customer/announcement/${id}/dismiss`, {});
    if (res.success) invalidate("notifications_p0");
    return res;
  },

  /** Clear all — bulk-dismisses every notification currently visible to the user. */
  clearAllNotifications: async () => {
    const res = await authDelete("/api/customer/announcement/clear-all");
    if (res.success) invalidate("notifications_p0");
    return res;
  },
};
