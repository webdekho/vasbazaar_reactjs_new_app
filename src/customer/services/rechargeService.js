import { guestGet, authPost, apiClient, parseApiResponse, getErrorMessage } from "./apiClient";

const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const randomHex = (length) => {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hexToBytes = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

const importPublicKey = async (publicKeyPem) => {
  const pemContent = publicKeyPem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

  const publicKeyDer = base64ToArrayBuffer(pemContent);
  return window.crypto.subtle.importKey(
    "spki",
    publicKeyDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
};

const encryptRechargePayload = async (payload) => {
  const keyResponse = await guestGet("/login/getPublicKey");
  if (!keyResponse.success || !keyResponse.data?.publicKey) {
    throw new Error(keyResponse.message || "Unable to fetch public key");
  }

  const publicKeyPem = keyResponse.data.publicKey.includes("BEGIN PUBLIC KEY")
    ? keyResponse.data.publicKey
    : `-----BEGIN PUBLIC KEY-----\n${keyResponse.data.publicKey.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;

  const aesKeyHex = randomHex(32);
  const ivHex = randomHex(16);
  const aesKeyBytes = hexToBytes(aesKeyHex);
  const ivBytes = hexToBytes(ivHex);
  const serialized = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(serialized);

  const aesCryptoKey = await window.crypto.subtle.importKey(
    "raw",
    aesKeyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  const encryptedPayload = await window.crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ivBytes },
    aesCryptoKey,
    encoded
  );

  const rsaPublicKey = await importPublicKey(publicKeyPem);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    aesKeyBytes
  );

  return `${bytesToBase64(new Uint8Array(encryptedAesKey))}:${bytesToBase64(ivBytes)}:${bytesToBase64(
    new Uint8Array(encryptedPayload)
  )}`;
};

export const rechargeService = {
  fetchOperatorCircle: (mobile) => authPost("/api/customer/operator/fetchOperatorCircle", { mobile }),

  fetchPlansByCode: async ({ opCode, circleCode }) => {
    try {
      const response = await apiClient.post("/api/customer/plan_recharge/fetchPlansByCode", {
        opCode,
        circleCode,
      });
      return parseApiResponse(response);
    } catch (error) {
      return { success: false, message: getErrorMessage(error), data: null, raw: null };
    }
  },

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
