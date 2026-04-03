import { authGet, authPost } from "./apiClient";

export const digiLockerService = {
  // Get current KYC status
  getKycStatus: () => authGet("/api/customer/kyc/status"),

  // Initialize DigiLocker verification
  initializeDigiLocker: async (aadhaarNumber, returnUrl) => {
    return authPost("/api/customer/kyc/digilocker/init", {
      aadhaar_number: aadhaarNumber,
      return_url: returnUrl,
    });
  },

  // Process DigiLocker callback
  processDigiLockerCallback: async (callbackData) => {
    return authPost("/api/customer/kyc/digilocker/callback", callbackData);
  },

  // Verify KYC manually (if needed)
  verifyKyc: async (data) => {
    return authPost("/api/customer/kyc/verify", data);
  },
};
