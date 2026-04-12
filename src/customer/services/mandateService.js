import forge from "node-forge";
import { authGet, authPost, getErrorMessage, guestGet } from "./apiClient";
import { isPwaStandalone } from "./juspayService";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const PENDING_MANDATE_KEY = "vb_pending_mandate";

// Deep link scheme for native app mandate callback
const NATIVE_MANDATE_CALLBACK_SCHEME = "vasbazaar://autopay-callback";

const base64ToArrayBuffer = (base64) => {
  const bin = window.atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

const bytesToBase64 = (bytes) => {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return window.btoa(bin);
};

const isSecureContext = () =>
  typeof window !== "undefined" && window.crypto && window.crypto.subtle;

const encryptWithWebCrypto = async (payload, publicKeyPem) => {
  const pemContent = publicKeyPem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

  const aesKeyBytes = new Uint8Array(32);
  const ivBytes = new Uint8Array(16);
  window.crypto.getRandomValues(aesKeyBytes);
  window.crypto.getRandomValues(ivBytes);

  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const aesCryptoKey = await window.crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const encryptedPayload = await window.crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, aesCryptoKey, encoded);
  const rsaKey = await window.crypto.subtle.importKey("spki", base64ToArrayBuffer(pemContent), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const encryptedAesKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaKey, aesKeyBytes);

  return `${bytesToBase64(new Uint8Array(encryptedAesKey))}:${bytesToBase64(ivBytes)}:${bytesToBase64(new Uint8Array(encryptedPayload))}`;
};

const encryptWithForge = (payload, publicKeyPem) => {
  const pem = publicKeyPem.includes("BEGIN PUBLIC KEY")
    ? publicKeyPem
    : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`;

  const aesKey = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(16);
  const cipher = forge.cipher.createCipher("AES-CBC", aesKey);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(JSON.stringify(payload), "utf8"));
  cipher.finish();

  const publicKey = forge.pki.publicKeyFromPem(pem);
  const encryptedAesKey = publicKey.encrypt(aesKey, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });

  return `${forge.util.encode64(encryptedAesKey)}:${forge.util.encode64(iv)}:${forge.util.encode64(cipher.output.getBytes())}`;
};

const encryptMandatePayload = async (payload) => {
  const keyResponse = await guestGet("/login/getPublicKey");
  if (!keyResponse.success || !keyResponse.data?.publicKey) {
    throw new Error(keyResponse.message || "Unable to fetch public key");
  }

  const rawKey = keyResponse.data.publicKey;
  const chunks = rawKey.match(/.{1,64}/g) || [rawKey];
  const publicKeyPem = rawKey.includes("BEGIN PUBLIC KEY")
    ? rawKey
    : `-----BEGIN PUBLIC KEY-----\n${chunks.join("\n")}\n-----END PUBLIC KEY-----`;

  return isSecureContext()
    ? encryptWithWebCrypto(payload, publicKeyPem)
    : encryptWithForge(payload, publicKeyPem);
};

/**
 * Get the appropriate web storage for mandate context.
 * PWA standalone mode uses localStorage (survives app switches/OS suspension).
 * Regular browser uses sessionStorage (cleared when tab closes).
 */
const getWebStorage = () => (isPwaStandalone() ? localStorage : sessionStorage);

/**
 * Build the callback URL for mandate provider to redirect to after setup.
 * For native apps: uses deep link scheme (vasbazaar://autopay-callback)
 * For web: uses the current origin + the autopay-callback route
 */
export const getMandateReturnUrl = () => {
  // For native apps, use deep link scheme
  if (Capacitor.isNativePlatform()) {
    return NATIVE_MANDATE_CALLBACK_SCHEME;
  }

  // For web, use HTTP URL
  const origin = window.location.origin;
  const path = window.location.pathname;
  // Detect base path from current URL (e.g. /vasbazaar)
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/autopay-callback`;
};

/**
 * Save mandate context - uses Preferences for native, localStorage for PWA, sessionStorage for browser
 */
export const savePendingMandateContext = async (context) => {
  const data = JSON.stringify({ ...context, timestamp: Date.now() });

  if (Capacitor.isNativePlatform()) {
    try {
      await Preferences.set({ key: PENDING_MANDATE_KEY, value: data });
    } catch (e) {
      console.warn("Failed to save mandate context to Preferences:", e);
    }
  } else {
    try {
      getWebStorage().setItem(PENDING_MANDATE_KEY, data);
    } catch (e) {
      console.warn("Failed to save pending mandate context:", e);
    }
  }
};

/**
 * Retrieve and clear mandate context - uses Preferences for native, localStorage for PWA, sessionStorage for browser
 */
export const getPendingMandateContext = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await Preferences.get({ key: PENDING_MANDATE_KEY });
      await Preferences.remove({ key: PENDING_MANDATE_KEY });
      if (!value) return null;
      const ctx = JSON.parse(value);
      // Expire after 30 minutes
      if (Date.now() - ctx.timestamp > 30 * 60 * 1000) return null;
      return ctx;
    } catch {
      return null;
    }
  } else {
    try {
      const storage = getWebStorage();
      const raw = storage.getItem(PENDING_MANDATE_KEY);
      storage.removeItem(PENDING_MANDATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Expire after 30 minutes
      if (Date.now() - parsed.timestamp > 30 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  }
};

export const createMandate = async (payload) => {
  try {
    const encryptedData = await encryptMandatePayload(payload);
    return authPost("/api/customer/mandate_customer/create", { data: encryptedData });
  } catch (error) {
    return { success: false, message: getErrorMessage(error), data: null, raw: null };
  }
};

export const getMandateOrderStatus = async (orderId) =>
  authGet("/api/customer/mandate_customer/orderStatus", { orderId });

export const isMandateActive = (status) =>
  ["ACTIVE", "CREATED", "SUCCESS"].includes(String(status || "").toUpperCase());

export const isMandatePending = (status) =>
  ["NEW", "PENDING", "INITIATED", "PROCESSING"].includes(String(status || "").toUpperCase());
