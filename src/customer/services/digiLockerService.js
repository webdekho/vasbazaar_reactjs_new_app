import { authGet, authPost, CUSTOMER_STORAGE_KEYS } from "./apiClient";

/**
 * DigiLocker KYC Service
 * Provides methods for DigiLocker-based KYC verification
 * Works across Web, Android, and iOS via Capacitor
 */

const getSessionToken = () => localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);

/**
 * Initialize DigiLocker KYC verification
 * @param {string} aadhaarNumber - 12-digit Aadhaar number
 * @param {string} returnUrl - URL to redirect after verification
 * @returns {Promise<Object>} Response with kycUrl, clientId, txnId
 */
export const initializeDigiLocker = async (aadhaarNumber, returnUrl) => {
  try {
    const token = getSessionToken();
    if (!token) {
      return {
        success: false,
        message: "Session expired. Please login again.",
        data: null,
      };
    }

    const payload = {
      aadhaarNumber: aadhaarNumber.replace(/\D/g, ""),
      returnUrl,
    };

    console.log("DigiLocker init - Token exists:", !!token, "Payload:", payload);

    const result = await authPost("/login/digilocker", payload);

    if (result.success) {
      const kycUrl = result.data?.kycUrl || result.raw?.data?.kycUrl;
      const clientId = result.data?.clientId || result.raw?.data?.clientId;
      const txnId = result.data?.txnId || result.raw?.data?.txnId;

      if (!kycUrl) {
        return {
          success: false,
          message: "No KYC URL received from DigiLocker",
          data: null,
        };
      }

      return {
        success: true,
        message: result.message || "DigiLocker initialized successfully",
        data: { kycUrl, clientId, txnId },
      };
    }

    return {
      success: false,
      message: result.message || "Failed to initialize DigiLocker",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Network error while initializing DigiLocker",
      data: null,
    };
  }
};

/**
 * Process DigiLocker callback after verification
 * @param {Object} callbackParams - Parameters received from DigiLocker redirect
 * @returns {Promise<Object>} Response with verified user data
 */
export const processDigiLockerCallback = async (callbackParams) => {
  try {
    const { gateway, type, client_id, status } = callbackParams;

    console.log("DigiLocker processCallback - Input params:", callbackParams);

    if (!gateway || !type || !client_id) {
      console.log("DigiLocker processCallback - Missing params");
      return {
        success: false,
        message: "Missing required callback parameters",
        data: null,
      };
    }

    if (status !== "success") {
      console.log("DigiLocker processCallback - Status not success:", status);
      return {
        success: false,
        message: "DigiLocker verification failed or was cancelled",
        data: null,
      };
    }

    console.log("DigiLocker processCallback - Calling /login/callBack API");
    const result = await authGet("/login/callBack", {
      gateway,
      type,
      client_id,
      status,
    });
    console.log("DigiLocker processCallback - API response:", JSON.stringify(result, null, 2));

    if (result.success) {
      const verifiedData = result.data || result.raw?.data;

      if (!verifiedData) {
        return {
          success: false,
          message: "No verified data received from DigiLocker",
          data: null,
        };
      }

      return {
        success: true,
        message: result.message || "Verification completed successfully",
        data: {
          status: verifiedData.status || "SUCCESS",
          message: verifiedData.message || "Verification completed",
          name: verifiedData.name,
          city: verifiedData.city,
          state: verifiedData.state,
          mobile: verifiedData.mobile,
          verified_status: 1,
        },
      };
    }

    return {
      success: false,
      message: result.message || "Failed to process DigiLocker callback",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Network error while processing callback",
      data: null,
    };
  }
};

/**
 * Get current KYC/verification status
 * @returns {Promise<Object>} KYC status info
 */
export const getKycStatus = async () => {
  try {
    const result = await authGet("/login/kycStatus");

    if (result.success) {
      const data = result.data || result.raw?.data || {};
      return {
        success: true,
        data: {
          verified: data.verified_status === 1 || data.kyc_status === "verified",
          verifiedStatus: data.verified_status || 0,
          kycType: data.kyc_type || null,
          verifiedAt: data.verified_at || null,
          message: data.message || (data.verified_status === 1 ? "KYC Verified" : "KYC Pending"),
        },
      };
    }

    return {
      success: false,
      message: result.message || "Failed to get KYC status",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Network error",
      data: null,
    };
  }
};

export const digiLockerService = {
  initializeDigiLocker,
  processDigiLockerCallback,
  getKycStatus,
};
