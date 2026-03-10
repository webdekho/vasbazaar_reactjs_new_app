import { authGet } from "./apiClient";

export const couponService = {
  getCoupons: (pageNumber = 0, pageSize = 12) =>
    authGet("/api/customer/transaction/couponDetails", { pageNumber, pageSize }),
};
