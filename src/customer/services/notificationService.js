import { authGet } from "./apiClient";

export const notificationService = {
  getNotifications: (pageNumber = 0) =>
    authGet("/api/customer/announcement/notification", { pageNumber }),
};
