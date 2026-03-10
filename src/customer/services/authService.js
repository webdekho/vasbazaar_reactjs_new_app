import { guestPost } from "./apiClient";

export const authService = {
  sendOtp: async ({ mobileNumber, referralCode }) => {
    const payload = {
      mobileNumber,
      requestType: "customer_approval",
      ...(referralCode ? { referralCode } : {}),
    };
    return guestPost("/login/sendOTP", payload);
  },

  verifyOtp: async ({ otp, token, referralCode, pushToken = "customer-web" }) => {
    return guestPost("/login/verifyOTP", {
      otp,
      token,
      referalCode: referralCode || null,
      pushToken,
    });
  },
};
