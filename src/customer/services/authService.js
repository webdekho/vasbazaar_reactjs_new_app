import { guestPost, apiClient, parseApiResponse, getErrorMessage } from "./apiClient";

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

  sendPinOtp: async (permanentToken) => {
    return guestPost("/login/sendOTPToken", {
      token: permanentToken,
      requestType: "customer_approval",
    });
  },

  verifyPinOtp: async ({ otp, tempToken, permanentToken }) => {
    try {
      const response = await apiClient.post(
        "/login/verifyOTP_token",
        { otp, token: tempToken },
        { headers: { "Content-Type": "application/json", access_token: permanentToken } }
      );
      return parseApiResponse(response);
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null, raw: null };
    }
  },

  setUserPin: async ({ pin, sessionToken }) => {
    try {
      const response = await apiClient.post(
        "/login/pin",
        { pin, token: sessionToken },
        { headers: { "Content-Type": "application/json", access_token: sessionToken } }
      );
      return parseApiResponse(response);
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null, raw: null };
    }
  },

  authenticateWithPin: async ({ pin, permanentToken }) => {
    return guestPost("/login/pinLogin", {
      pin,
      token: permanentToken,
    });
  },

  sendPinToWhatsapp: async () => {
    return guestPost("/login/getPin", {});
  },
};
