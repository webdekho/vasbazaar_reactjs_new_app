import { authGet } from "./apiClient";
import { cachedFetch } from "./apiCache";

// Advertisements cached briefly to avoid re-fetching on every navigation,
// but short enough that admin banner changes (add/update/delete) reflect
// quickly — a 24h TTL kept serving deleted ads with missing image files.
const ADS_CACHE_TTL = 300000; // 5 minutes

export const advertisementService = {
  getHomeAdvertisements: () => cachedFetch("homeAds", () => authGet("/api/customer/advertisement/getByStatus", { status: "home" }), ADS_CACHE_TTL),
  getServiceAdvertisements: () => cachedFetch("serviceAds", () => authGet("/api/customer/advertisement/getByStatus", { status: "services" }), ADS_CACHE_TTL),
};
