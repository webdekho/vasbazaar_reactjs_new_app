import { authGet, authPost, authPut, authDelete } from "./apiClient";
import { userService } from "./userService";
import { cachedFetch } from "./apiCache";

export const walletService = {
  getWalletTransactions: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/wallet_transaction/getAll", { pageNumber, pageSize }),

  // Default pageSize lowered to 5 — Rewards/Cashback screens are mostly
  // previewed at a glance; anything beyond the first 5 is loaded on demand
  // via a "View More" button so initial paint stays fast.
  getWalletHistory: (type, pageNumber = 0, pageSize = 5) =>
    authGet("/api/customer/wallet_transaction/getHistory", { type, pageNumber, pageSize }),

  getTransactionHistory: (pageNumber = 0) =>
    authGet("/api/customer/transaction/getByUserId", { pageNumber }),

  getReferredUsers: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/user/getReffered_user", { pageNumber, pageSize, isactive: 1 }),

  // Referral stats — computed server-side on demand. Returns the referee's
  // total transaction amount, the bonus the referrer earned from them, and
  // the cashback the referee themselves earned.
  getReferralStats: (refUserId) =>
    authGet("/api/customer/user/referral_stats", { refUserId }),

  // Upcoming dues cached for 1 hour
  getUpcomingDues: () =>
    cachedFetch("upcomingDues", () => authGet("/api/customer/schedular/getAllRecharges"), 3600000),

  deleteReminder: (id) =>
    authDelete(`/api/customer/schedular/${id}`),

  getCoupons: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/transaction/couponDetails", { pageNumber, pageSize }),

  getMandateList: (page = 1, pageSize = 10, status = "") =>
    authGet("/api/customer/mandate_customer/cust-mandateList", { page, pageSize, status: status || undefined }),

  revokeMandate: (mandateId) =>
    authGet("/api/customer/mandate_customer/revokeMandate", { mandateId }),

  stopMandateExecution: (mandateId, orderId) =>
    authPost("/api/customer/mandate_customer/stopMandateExecution", { mandateId, orderId }),

  // Bank Details
  getBankDetails: (pageNumber = 0, pageSize = 10, status = "active") =>
    authGet("/api/customer/bank_details/myBankDetails", { pageNumber, pageSize, status }),

  addBankDetails: (payload) =>
    authPost("/api/customer/bank_details/add", payload),

  updateBankDetails: (payload) =>
    authPut("/api/customer/bank_details/update", payload),

  fundTransfer: (payload) =>
    authPost("/api/customer/wallet_transaction/fund-transfer", payload),

  getWalletBalance: async () => {
    // Use cached getUserProfile instead of direct API call
    const result = await userService.getUserProfile();
    if (result.success && result.data) {
      return { ...result, data: { balance: result.data.balance } };
    }
    return result;
  },

  getWalletTransactionDetails: (txnId) =>
    authGet("/api/customer/wallet_transaction/getById", { txnId }),

  addMoneyToWallet: (amount, paymentMethod) =>
    authPost("/api/customer/wallet/addMoney", { amount, paymentMethod }),

  // Note: createMandate payload needs encryption before sending (see rechargeService for encryption utils)
  createMandate: (payload) =>
    authPost("/api/customer/mandate_customer/create", payload),

  getMandateOrderStatus: (orderId) =>
    authGet("/api/customer/mandate_customer/orderStatus", { orderId }),
};
