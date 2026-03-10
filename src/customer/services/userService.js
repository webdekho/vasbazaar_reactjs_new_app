import { authGet } from "./apiClient";

export const userService = {
  getUserProfile: () => authGet("/api/customer/user/getByUserId"),
};
