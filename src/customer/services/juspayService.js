import { rechargeService } from "./rechargeService";
import { PENDING_PAYMENT_KEY } from "../../shared/constants/juspay";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

// Deep link scheme for native app payment callback
const NATIVE_PAYMENT_CALLBACK_SCHEME = "vasbazaar://payment-callback";

/**
 * Detect if the app is running as an installed PWA (standalone mode).
 * This is true when the user has added the app to their home screen.
 */
export const isPwaStandalone = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
};

/**
 * Juspay/HDFC payment gateway service for web and native apps.
 * Handles redirect-based payment flow:
 *   1. Encrypt & send recharge payload with paymentGateway:'juspay'
 *   2. Extract payment URL from response
 *   3. Save context to sessionStorage
 *   4. Redirect user to Juspay payment page
 *   5. On return, callback screen verifies order status
 */

/** Extract the Juspay web payment URL from the recharge API response */
export const extractPaymentUrl = (response) => {
  const d = response?.data || response?.raw?.data || response;
  return (
    d?.rawResponse?.payment_links?.web ||
    d?.payment_links?.web ||
    d?.rawResponse?.paymentUrl ||
    d?.paymentUrl ||
    null
  );
};

/** Extract the order ID from the recharge API response */
export const extractOrderId = (response) => {
  const d = response?.data || response?.raw?.data || response;
  return (
    d?.rawResponse?.order_id ||
    d?.requestId ||
    d?.order_id ||
    d?.orderId ||
    d?.rawResponse?.sdk_payload?.payload?.orderId ||
    d?.txnId ||
    d?.txnid ||
    d?.transactionId ||
    null
  );
};

/**
 * Get the appropriate web storage for payment context.
 * PWA standalone mode uses localStorage (survives app switches/OS suspension).
 * Regular browser uses sessionStorage (cleared when tab closes).
 */
const getWebStorage = () => isPwaStandalone() ? localStorage : sessionStorage;

/** Save payment context - uses Preferences for native, localStorage for PWA, sessionStorage for browser */
export const savePaymentContext = async (context) => {
  const data = JSON.stringify({ ...context, timestamp: Date.now() });

  if (Capacitor.isNativePlatform()) {
    try {
      await Preferences.set({ key: PENDING_PAYMENT_KEY, value: data });
    } catch (e) {
      console.warn("Failed to save payment context to Preferences:", e);
    }
  } else {
    try {
      getWebStorage().setItem(PENDING_PAYMENT_KEY, data);
    } catch (e) {
      console.warn("Failed to save payment context:", e);
    }
  }
};

/** Retrieve and clear payment context - uses Preferences for native, localStorage for PWA, sessionStorage for browser */
export const getPaymentContext = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await Preferences.get({ key: PENDING_PAYMENT_KEY });
      await Preferences.remove({ key: PENDING_PAYMENT_KEY });
      if (!value) return null;
      const ctx = JSON.parse(value);
      // Expire after 15 minutes
      if (Date.now() - ctx.timestamp > 15 * 60 * 1000) return null;
      return ctx;
    } catch {
      return null;
    }
  } else {
    try {
      const storage = getWebStorage();
      const raw = storage.getItem(PENDING_PAYMENT_KEY);
      storage.removeItem(PENDING_PAYMENT_KEY);
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      // Expire after 15 minutes
      if (Date.now() - ctx.timestamp > 15 * 60 * 1000) return null;
      return ctx;
    } catch {
      return null;
    }
  }
};

/**
 * Build the callback URL for Juspay to redirect to after payment.
 * For native apps: uses deep link scheme (vasbazaar://payment-callback)
 * For web: uses the current origin + the payment-callback route
 */
export const getReturnUrl = () => {
  // For native apps, use deep link scheme
  if (Capacitor.isNativePlatform()) {
    return NATIVE_PAYMENT_CALLBACK_SCHEME;
  }

  // For web, use HTTP URL
  const origin = window.location.origin;
  const path = window.location.pathname;
  // Detect base path from current URL (e.g. /vasbazaar)
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/payment-callback`;
};

/**
 * Execute a recharge with Juspay as the payment gateway.
 * For native apps: uses deep link return URL and platform:'app'
 * For web: uses HTTP return URL and platform:'web'
 */
export const rechargeWithJuspay = async (payload) => {
  const isNative = Capacitor.isNativePlatform();
  return rechargeService.recharge({
    ...payload,
    paymentGateway: "juspay",
    platform: isNative ? "app" : "web",
    returnUrl: getReturnUrl(),
  });
};

/**
 * Check order status after payment redirect.
 * Polls with retry for pending status (webhook may not have arrived yet).
 */
export const checkOrderStatus = async (orderId, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const response = await rechargeService.checkRechargeStatus({
      txnId: orderId,
      field1: "",
      field2: "",
      validity: 30,
      recharge: true,
      viewBillResponse: {},
    });

    const status = (
      response?.data?.status ||
      response?.data?.txnStatus ||
      response?.data?.Status ||
      ""
    ).toUpperCase();

    // If we got a definitive result, return immediately
    if (status && status !== "PENDING" && status !== "STARTED" && status !== "AUTHORIZING") {
      return response;
    }

    // Wait 3 seconds before retrying for pending status
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Return last response (still pending)
  return { success: true, data: { status: "PENDING" }, message: "Payment is being processed" };
};

export const juspayService = {
  extractPaymentUrl,
  extractOrderId,
  savePaymentContext,
  getPaymentContext,
  getReturnUrl,
  rechargeWithJuspay,
  checkOrderStatus,
};

export default juspayService;
