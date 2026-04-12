import { authGet, authPost, apiClient, parseApiResponse, getErrorMessage, CUSTOMER_STORAGE_KEYS } from "./apiClient";
import { cachedFetch, invalidate } from "./apiCache";

export const userService = {
  /**
   * PERF FIX: getUserProfile was called from ~6 places simultaneously
   * (Context hydration, HomeScreen, ProtectedShell, WalletScreen, chatbot, ProfileScreen).
   * Now cached for 2 minutes with in-flight deduplication — identical concurrent calls
   * share a single network request.
   */
  getUserProfile: () => cachedFetch("getUserProfile", () => authGet("/api/customer/user/getByUserId"), 120000),

  /** Invalidate profile cache after mutations (photo upload, onboarding, profile update) */
  invalidateProfile: () => invalidate("getUserProfile"),

  uploadProfilePhoto: async (file) => {
    try {
      const formData = new FormData();
      formData.append("photo", file, `profile_${Date.now()}.${file.name?.split(".").pop() || "jpg"}`);
      const token = localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken);
      const response = await apiClient.put("/api/customer/user/updateProfile", formData, {
        headers: { "Content-Type": "multipart/form-data", access_token: token },
        timeout: 15000,
      });
      const result = parseApiResponse(response);
      // PERF FIX: Invalidate profile cache after photo upload so next fetch gets updated photo
      if (result.success) invalidate("getUserProfile");
      return result;
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null };
    }
  },

  getUserBalance: async () => {
    // Use cached getUserProfile instead of direct API call
    const result = await userService.getUserProfile();
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

  completeOnboarding: async ({ name, sessionToken }) => {
    try {
      const response = await apiClient.post(
        "/api/customer/user/completeOnboarding",
        { name },
        {
          headers: {
            "Content-Type": "application/json",
            access_token: sessionToken,
          },
        }
      );
      return parseApiResponse(response);
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null, raw: null };
    }
  },

  updateUserProfile: (profileData) =>
    authPost("/user/update-profile", profileData),
};
