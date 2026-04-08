import { authGet } from "./apiClient";
import { cachedFetch } from "./apiCache";

export const advertisementService = {
  /**
   * PERF FIX: Advertisements cached for 2 minutes — banner content
   * doesn't change frequently, no need to re-fetch on every navigation.
   */
  getHomeAdvertisements: () => cachedFetch("homeAds", () => authGet("/api/customer/advertisement/getByStatus", { status: "home" }), 120000),
  getServiceAdvertisements: () => cachedFetch("serviceAds", () => authGet("/api/customer/advertisement/getByStatus", { status: "services" }), 120000),
};
