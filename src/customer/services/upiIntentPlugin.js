import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * UPI Intent Plugin for iOS
 * Opens UPI deep links on iOS devices
 */
const UpiIntent = registerPlugin("UpiIntent", {
  // No web implementation needed as we handle web separately
});

/**
 * List the UPI apps actually installed on this iOS device.
 * @param {string} url - The UPI deep link URL (upi://pay?...)
 * @returns {Promise<{apps: {id: string, name: string}[]}>}
 */
export const getUpiAppsIOS = async (url) => {
  if (Capacitor.getPlatform() !== "ios") {
    return { apps: [] };
  }
  return UpiIntent.getAvailableApps({ url });
};

/**
 * Open UPI URL on iOS.
 * @param {string} url - The UPI deep link URL (upi://pay?...)
 * @param {string} [app] - Optional catalog id (gpay/phonepe/paytm/cred/bhim) to
 *                         launch a specific app directly; omit for generic open.
 * @returns {Promise<{success: boolean}>}
 */
export const openUpiUrlIOS = async (url, app) => {
  if (Capacitor.getPlatform() !== "ios") {
    throw new Error("This function is only for iOS");
  }
  return UpiIntent.openUpiUrl(app ? { url, app } : { url });
};

export default UpiIntent;
