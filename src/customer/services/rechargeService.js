import { guestGet, authPost, getErrorMessage } from "./apiClient";
import forge from "node-forge";

/* ── Helpers (Web Crypto - HTTPS only) ── */
const base64ToArrayBuffer = (base64) => {
  const bin = window.atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

const bytesToBase64 = (bytes) => {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return window.btoa(bin);
};

const isSecureContext = () =>
  typeof window !== "undefined" && window.crypto && window.crypto.subtle;

/* ── Encrypt with Web Crypto (HTTPS) ── */
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

/* ── Encrypt with node-forge (HTTP fallback) ── */
const encryptWithForge = (payload, publicKeyPem) => {
  const pem = publicKeyPem.includes("BEGIN PUBLIC KEY")
    ? publicKeyPem
    : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`;

  // Generate random AES key (32 bytes) and IV (16 bytes)
  const aesKey = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(16);

  // AES-CBC encrypt the payload
  const cipher = forge.cipher.createCipher("AES-CBC", aesKey);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(JSON.stringify(payload), "utf8"));
  cipher.finish();
  const encryptedPayload = cipher.output.getBytes();

  // RSA-OAEP encrypt the AES key
  const publicKey = forge.pki.publicKeyFromPem(pem);
  const encryptedAesKey = publicKey.encrypt(aesKey, "RSA-OAEP", { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha256.create() } });

  // Return three-part base64 format
  return `${forge.util.encode64(encryptedAesKey)}:${forge.util.encode64(iv)}:${forge.util.encode64(encryptedPayload)}`;
};

/* ── Main encryption function ── */
const encryptRechargePayload = async (payload) => {
  const keyResponse = await guestGet("/login/getPublicKey");
  if (!keyResponse.success || !keyResponse.data?.publicKey) {
    throw new Error(keyResponse.message || "Unable to fetch public key");
  }

  const rawKey = keyResponse.data.publicKey;
  const publicKeyPem = rawKey.includes("BEGIN PUBLIC KEY")
    ? rawKey
    : `-----BEGIN PUBLIC KEY-----\n${rawKey.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;

  if (isSecureContext()) {
    return encryptWithWebCrypto(payload, publicKeyPem);
  }

  // HTTP fallback using node-forge (pure JS, no Web Crypto needed)
  return encryptWithForge(payload, publicKeyPem);
};

/* ── Service ── */
export const rechargeService = {
  fetchOperatorCircle: (mobile) => authPost("/api/customer/operator/fetchOperatorCircle", { mobile }),

  fetchPlansByCode: ({ opCode, circleCode }) => authPost("/api/customer/plan_recharge/fetchPlansByCode", { opCode, circleCode }),

  fetchDTHPlans: ({ opCode }) => authPost("/api/customer/plan_recharge/fetch_DTHPlans", { opCode }),

  viewBill: (payload) => authPost("/api/customer/plan_recharge/viewBill", payload),

  recharge: async (payload) => {
    try {
      const encryptedData = await encryptRechargePayload(payload);
      return authPost("/api/customer/plan_recharge/recharge", { data: encryptedData });
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null, raw: null };
    }
  },

  checkRechargeStatus: (payload) => authPost("/api/customer/plan_recharge/check-status", payload),
};
