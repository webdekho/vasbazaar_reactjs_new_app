import { authGet, authPost } from "./apiClient";

export const couponService = {
  getCoupons: (pageNumber = 0, pageSize = 12) =>
    authGet("/api/customer/transaction/couponDetails", { pageNumber, pageSize }),

  applyCoupon: (coupon_code, service_id, amount) =>
    authPost("/coupon/apply", { coupon_code, service_id, amount }),

  getAvailableCoupons: (service_id, amount) =>
    authPost("/coupon/list", { service_id, amount }),
};
