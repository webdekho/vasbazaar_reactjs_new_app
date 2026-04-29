import { Capacitor } from "@capacitor/core";
import { authPost } from "./apiClient";

let initialised = false;
let cachedToken = null;
let pendingNavigateHandler = null;

const TOKEN_STORAGE_KEY = "fcmPushToken";

const safeImportPlugin = async () => {
  try {
    const mod = await import("@capacitor/push-notifications");
    return mod?.PushNotifications || null;
  } catch (err) {
    // Plugin not installed yet — keep silent so web/dev builds don't break.
    return null;
  }
};

/**
 * Send the FCM token to the backend so it can target this device.
 * Backend stores the latest token on the user row and uses it for push.
 */
const registerTokenWithBackend = async (token) => {
  if (!token) return;
  try {
    await authPost("/api/customer/fcm/register", {
      fcmToken: token,
      platform: Capacitor.getPlatform() || "android",
    });
    cachedToken = token;
    try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch (_) { /* noop */ }
  } catch (err) {
    console.warn("[pushService] backend register failed:", err?.message || err);
  }
};

/**
 * Resolve a notification payload to an in-app route. Backend includes a
 * `data.deepLink` (preferred) or a `data.orderId`/`data.kind` pair we map
 * here. Anything unknown silently no-ops so unrecognised payloads never
 * crash the tap handler.
 */
const resolveDeepLink = (data) => {
  if (!data) return null;
  if (typeof data.deepLink === "string" && data.deepLink.startsWith("/")) {
    return data.deepLink;
  }
  if (data.kind === "marketplaceOrder" && data.orderId) {
    return `/customer/app/marketplace/orders/${data.orderId}`;
  }
  if (data.kind === "marketplaceStoreOrder" && data.orderId) {
    return `/customer/app/marketplace/store-orders`;
  }
  if (data.kind === "wallet") return "/customer/app/wallet";
  if (data.kind === "transaction" && data.txnId) {
    return `/customer/app/transaction/${data.txnId}`;
  }
  return null;
};

/**
 * Wire Capacitor PushNotifications. Safe to call multiple times — only the
 * first call attaches listeners. Pass an onNavigate(path) handler to deep-link
 * notification taps into your router.
 */
export const initPushNotifications = async ({ onNavigate } = {}) => {
  pendingNavigateHandler = onNavigate || pendingNavigateHandler;
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: "not-native" };
  if (initialised) return { ok: true, token: cachedToken };

  const PushNotifications = await safeImportPlugin();
  if (!PushNotifications) {
    return { ok: false, reason: "plugin-missing" };
  }

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { ok: false, reason: "permission-denied" };
    }

    PushNotifications.addListener("registration", (registration) => {
      const t = registration?.value || registration?.token;
      if (t) registerTokenWithBackend(t);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[pushService] registration error:", err);
    });

    // Foreground delivery — relay payload to anything listening on
    // `window` (e.g. the in-app notification list could refresh).
    PushNotifications.addListener("pushNotificationReceived", (notif) => {
      try {
        window.dispatchEvent(new CustomEvent("vb:push:received", { detail: notif }));
      } catch (_) { /* noop */ }
    });

    // Tap on a notification (foreground or from killed state)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action?.notification?.data || {};
      const path = resolveDeepLink(data);
      if (path && typeof pendingNavigateHandler === "function") {
        pendingNavigateHandler(path);
      }
    });

    await PushNotifications.register();
    initialised = true;
    return { ok: true };
  } catch (err) {
    console.warn("[pushService] init failed:", err?.message || err);
    return { ok: false, reason: "init-failed", error: err };
  }
};

/** Re-send the cached/current token to backend after a fresh login. */
export const reregisterPushToken = async () => {
  const token = cachedToken || (() => {
    try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch (_) { return null; }
  })();
  if (token) await registerTokenWithBackend(token);
};

export const setPushNavigateHandler = (handler) => {
  pendingNavigateHandler = handler;
};
