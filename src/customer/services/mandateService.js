import forge from "node-forge";
import { authGet, authPost, getErrorMessage, guestGet } from "./apiClient";
import { isPwaStandalone } from "./juspayService";

const PENDING_MANDATE_KEY = "vb_pending_mandate";

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

const getMandateStorage = () => (isPwaStandalone() ? localStorage : sessionStorage);

export const getMandateReturnUrl = () => {
  const origin = window.location.origin;
  const path = window.location.pathname;
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/autopay-callback`;
};

export const savePendingMandateContext = (context) => {
  try {
    getMandateStorage().setItem(PENDING_MANDATE_KEY, JSON.stringify({ ...context, timestamp: Date.now() }));
  } catch (error) {
    console.warn("Failed to save pending mandate context:", error);
  }
};

export const getPendingMandateContext = () => {
  try {
    const storage = getMandateStorage();
    const raw = storage.getItem(PENDING_MANDATE_KEY);
    storage.removeItem(PENDING_MANDATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
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
