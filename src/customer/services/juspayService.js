import { rechargeService } from "./rechargeService";
import { PENDING_PAYMENT_KEY } from "../../shared/constants/juspay";

/**
 * Juspay/HDFC payment gateway service for web.
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

/** Save payment context to sessionStorage before redirecting */
export const savePaymentContext = (context) => {
  try {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
      ...context,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn("Failed to save payment context:", e);
  }
};

/** Retrieve and clear payment context from sessionStorage */
export const getPaymentContext = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    sessionStorage.removeItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw);
    // Expire after 15 minutes
    if (Date.now() - ctx.timestamp > 15 * 60 * 1000) return null;
    return ctx;
  } catch {
    return null;
  }
};

/**
 * Build the callback URL for Juspay to redirect to after payment.
 * Uses the current origin + the payment-callback route.
 */
export const getReturnUrl = () => {
  const origin = window.location.origin;
  const path = window.location.pathname;
  // Detect base path from current URL (e.g. /vasbazaar)
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/payment-callback`;
};

/**
 * Execute a recharge with Juspay as the payment gateway.
 * Injects paymentGateway:'juspay', platform:'web', and returnUrl into the payload
 * so the backend sets the correct Juspay redirect target.
 */
export const rechargeWithJuspay = async (payload) => {
  return rechargeService.recharge({
    ...payload,
    paymentGateway: "juspay",
    platform: "web",
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
