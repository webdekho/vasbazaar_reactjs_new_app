import { authGet } from "./apiClient";

export const offerService = {
  getOffers: (displayOnScreen = 1) =>
    authGet("/api/customer/coupon/allcoupons", { displayOnScreen }),

  getCoupons: (displayOnScreen = 0) =>
    authGet("/api/customer/coupon/allcoupons", { displayOnScreen }),
};
