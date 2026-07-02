import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * UPI Intent Plugin for iOS
 * Opens UPI deep links on iOS devices
 */
const UpiIntent = registerPlugin("UpiIntent", {
  // No web implementation needed as we handle web separately
});

/**
 * Open UPI URL on iOS
 * @param {string} url - The UPI deep link URL (upi://pay?...)
 * @returns {Promise<{success: boolean}>}
 */
export const openUpiUrlIOS = async (url) => {
  if (Capacitor.getPlatform() !== "ios") {
    throw new Error("This function is only for iOS");
  }
  return UpiIntent.openUpiUrl({ url });
};

export default UpiIntent;
