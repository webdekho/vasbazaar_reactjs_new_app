import { authGet, authPost } from "./apiClient";

export const transactionService = {
  getTransactions: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/transaction/getByUserId", { pageNumber, pageSize }),

  getTransactionDetails: (txnId) =>
    authGet("/api/customer/transaction/getById", { txnId }),

  submitComplaint: ({ txnId, description, action }) =>
    authPost("/api/customer/complaint/addComplaint", { txnId, description, action }),

  getRewardCoupon: (txnId) =>
    authGet("/api/customer/transaction/reward-coupon", { txnId }),

  checkTransactionStatus: (payload) =>
    authPost("/api/customer/plan_recharge/check-status", payload),
};
