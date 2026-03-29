import { authGet, authPost, apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS } from "./apiClient";

export const userService = {
  getUserProfile: () => authGet("/api/customer/user/getByUserId"),

  uploadProfilePhoto: async (file) => {
    try {
      const formData = new FormData();
      formData.append("photo", file, `profile_${Date.now()}.${file.name?.split(".").pop() || "jpg"}`);
      const token = localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);
      const response = await apiClient.put("/api/customer/user/updateProfile", formData, {
        headers: { "Content-Type": "multipart/form-data", access_token: token },
        timeout: 15000,
      });
      return parseApiResponse(response);
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null };
    }
  },

  getUserBalance: async () => {
    const result = await authGet("/api/customer/user/getByUserId");
    if (result.success && result.data) {
      // Handle potential nested data structure from API
      const d = result.data?.data || result.data;
      return {
        ...result,
        data: {
          balance: parseFloat(d.balance ?? d.Balance ?? d.walletBalance ?? 0).toFixed(2),
          cashback: parseFloat(d.cashback ?? d.Cashback ?? 0).toFixed(2),
          incentive: parseFloat(d.incentive ?? d.Incentive ?? 0).toFixed(2),
          referralBonus: parseFloat(d.referralBonus ?? d.referal_bonus ?? d.referral_bonus ?? 0).toFixed(2),
        },
      };
    }
    return result;
  },

  getReferredUsers: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/user/getReffered_user", { pageNumber, pageSize, isactive: 1 }),

  updateUserProfile: (profileData) =>
    authPost("/user/update-profile", profileData),
};
