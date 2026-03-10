import { authGet } from "./apiClient";

export const advertisementService = {
  getHomeAdvertisements: () => authGet("/api/customer/advertisement/getByStatus", { status: "home" }),
};
