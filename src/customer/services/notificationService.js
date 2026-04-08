import { authGet } from "./apiClient";
import { cachedFetch } from "./apiCache";

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
};
