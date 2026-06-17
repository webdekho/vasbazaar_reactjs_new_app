import { authPost } from "./apiClient";

// OTP-gated transaction search (NPCI Bharat Connect requirement: searching by
// mobile number must be authenticated with an OTP).
//
// NOTE: the two endpoints below must be implemented on the backend
// (see the NPCI compliance handoff doc). Until then these calls will return
// { success: false } and the screen surfaces a friendly error.
export const transactionSearchService = {
  sendOtp: (mobileNumber) =>
    authPost("/api/customer/transaction/search/send-otp", { mobileNumber }),

  verifyOtp: ({ mobileNumber, otp, fromDate, toDate }) =>
    authPost("/api/customer/transaction/search/verify-otp", {
      mobileNumber,
      otp,
      fromDate,
      toDate,
    }),
};
