/**
 * OTA (Over-The-Air) Update Service
 * ----------------------------------
 * Three-step flow used on Android/iOS Capacitor builds:
 *   1. POST /api/customer/ota/check   -> is an update available?
 *   2. POST /api/customer/ota/token   -> obtain a short-lived download token
 *   3. GET  <downloadUrl>             -> download the binary (APK zip / IPA)
 *
 * Notes:
 * - Uses the shared apiClient so baseURL, interceptors, and host validation
 *   already configured by the app are respected.
 * - Falls back gracefully on web (no native platform) — check() returns
 *   { updateAvailable: false }.
 * - The download helper returns a Blob so the caller can hand it to the
 *   native installer plugin (Android) or pass it to a store fallback (iOS).
 */

import { apiClient, parseApiResponse, getErrorMessage } from "./apiClient";
import { APP_VERSION } from "../../utils/appVersion";

const OTA_STORAGE_KEYS = {
  deviceId: "vb_ota_device_id",
  lastCheckedAt: "vb_ota_last_checked_at",
  skippedVersion: "vb_ota_skipped_version",
};

const getSessionToken = () => localStorage.getItem("customerSessionToken");

/** Generate a stable-per-install 8-char device id, persisted in localStorage. */
const getOrCreateDeviceId = () => {
  try {
    let id = localStorage.getItem(OTA_STORAGE_KEYS.deviceId);
    if (id && id.length >= 8) return id;

    // Generate 8-hex-char random id (matches sample "a1b2c3d4" shape)
    const bytes = new Uint8Array(4);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(OTA_STORAGE_KEYS.deviceId, id);
    return id;
  } catch {
    return "00000000";
  }
};

/** Detect current native platform via Capacitor global. */
const getPlatform = () => {
  try {
    if (typeof window === "undefined") return "web";
    if (window.Capacitor && window.Capacitor.getPlatform) {
      return window.Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
    }
  } catch {}
  return "web";
};

/** True if running inside a Capacitor native shell (Android or iOS). */
const isNative = () => {
  const p = getPlatform();
  return p === "android" || p === "ios";
};

const authHeaders = () => {
  const token = getSessionToken();
  if (!token) return null;
  return { access_token: token, "Content-Type": "application/json" };
};

/**
 * Step 1: Check if an update is available.
 * Returns parsed data: { updateAvailable, latestVersion, sha256Checksum, forceUpdate, nonce, releaseNotes }
 */
const checkUpdate = async () => {
  try {
    const headers = authHeaders();
    if (!headers) {
      console.debug("[OTA Service] No auth headers available");
      return { success: false, message: "Not authenticated", data: null };
    }
    const payload = {
      deviceId: getOrCreateDeviceId(),
      currentVersion: APP_VERSION,
      platform: getPlatform(),
    };
    console.debug("[OTA Service] Calling /api/customer/ota/check with:", payload);
    const response = await apiClient.post("/api/customer/ota/check", payload, { headers });
    console.debug("[OTA Service] Raw response:", response?.data);
    const parsed = parseApiResponse(response);
    console.debug("[OTA Service] Parsed response:", parsed);
    try {
      localStorage.setItem(OTA_STORAGE_KEYS.lastCheckedAt, String(Date.now()));
    } catch {}
    return parsed;
  } catch (error) {
    console.debug("[OTA Service] API error:", error?.message, error?.response?.data);
    return { success: false, message: getErrorMessage(error), data: null };
  }
};

/**
 * Step 2: Exchange the nonce from step 1 for a short-lived download URL + token.
 * Returns parsed data: { downloadUrl, expiresInSeconds, sha256Checksum }
 */
const getDownloadToken = async ({ nonce, targetVersion }) => {
  try {
    const headers = authHeaders();
    if (!headers) {
      return { success: false, message: "Not authenticated", data: null };
    }
    const payload = {
      deviceId: getOrCreateDeviceId(),
      nonce,
      targetVersion,
    };
    const response = await apiClient.post("/api/customer/ota/token", payload, { headers });
    return parseApiResponse(response);
  } catch (error) {
    return { success: false, message: getErrorMessage(error), data: null };
  }
};

/**
 * Step 3: Download the binary as a Blob with progress events.
 * @param {string} downloadUrl - relative path returned by step 2 (e.g. /api/customer/ota/download/1.2.1?token=...)
 * @param {(pct:number)=>void} onProgress - 0..100
 * @returns {Promise<Blob>}
 */
const downloadBinary = async (downloadUrl, onProgress) => {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");

  const response = await apiClient.get(downloadUrl, {
    responseType: "blob",
    headers: { access_token: token },
    onDownloadProgress: (evt) => {
      if (typeof onProgress === "function") {
        const total = evt.total || evt.event?.target?.getResponseHeader?.("content-length");
        if (total && total > 0) {
          onProgress(Math.min(100, Math.round((evt.loaded * 100) / Number(total))));
        }
      }
    },
  });
  return response.data;
};

/** Compute SHA-256 hex digest of a Blob using the Web Crypto API. */
const sha256OfBlob = async (blob) => {
  if (!(crypto && crypto.subtle)) {
    throw new Error("Web Crypto API unavailable");
  }
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Capacitor registers every installed plugin on `window.Capacitor.Plugins` at
 * runtime. Reading from that registry (instead of `import '@capacitor/...'`)
 * avoids a webpack build-time dependency so the app compiles fine even before
 * the OTA plugins are installed. Once you run
 *   npm i @capacitor/filesystem @capawesome/capacitor-file-opener && npx cap sync
 * the plugins become available on native and these lookups start succeeding.
 */
const getCapPlugin = (name) => {
  try {
    return window?.Capacitor?.Plugins?.[name] || null;
  } catch {
    return null;
  }
};

// @capacitor/filesystem Directory enum — string values are stable across
// versions, so hardcoding lets us avoid importing the package at build time.
const FS_DIRECTORY_CACHE = "CACHE";

/**
 * Persist the downloaded APK to the Cache directory via the Capacitor
 * Filesystem plugin, and return a file:// URI that the native installer
 * can open.
 */
const saveApkToDevice = async (blob, filename) => {
  const Filesystem = getCapPlugin("Filesystem");
  if (!Filesystem) {
    throw new Error(
      "Capacitor Filesystem plugin is not installed. Run: npm i @capacitor/filesystem && npx cap sync"
    );
  }

  // Convert Blob -> base64 (FileReader avoids building huge strings manually).
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const comma = String(result).indexOf(",");
      resolve(comma >= 0 ? String(result).slice(comma + 1) : String(result));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: FS_DIRECTORY_CACHE,
    recursive: true,
  });
  return writeResult.uri; // file:// path usable by Intent ACTION_VIEW
};

/**
 * Open the downloaded APK with the Android package installer via the
 * @capawesome/capacitor-file-opener plugin.
 */
const installApk = async (fileUri) => {
  const FileOpener = getCapPlugin("FileOpener");
  if (!FileOpener) {
    return {
      success: false,
      message:
        "Install plugin not available. Install '@capawesome/capacitor-file-opener' then run `npx cap sync`.",
    };
  }
  try {
    await FileOpener.openFile({
      path: fileUri,
      mimeType: "application/vnd.android.package-archive",
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: getErrorMessage(e), error: e };
  }
};

/**
 * High-level orchestrator: check → token → download → verify → save → install.
 * Calls the provided callbacks so the UI can render progress/state.
 */
const runUpdateFlow = async ({ onStage, onProgress } = {}) => {
  const stage = (s) => typeof onStage === "function" && onStage(s);

  stage("checking");
  const check = await checkUpdate();
  if (!check.success) return { success: false, stage: "check", message: check.message };
  const info = check.data || {};
  if (!info.updateAvailable) {
    return { success: true, updateAvailable: false };
  }

  stage("token");
  const tokenRes = await getDownloadToken({
    nonce: info.nonce,
    targetVersion: info.latestVersion,
  });
  if (!tokenRes.success) return { success: false, stage: "token", message: tokenRes.message };
  const tokenData = tokenRes.data || {};

  stage("downloading");
  let blob;
  try {
    blob = await downloadBinary(tokenData.downloadUrl, onProgress);
  } catch (e) {
    return { success: false, stage: "download", message: getErrorMessage(e) };
  }

  stage("verifying");
  try {
    const expected = (tokenData.sha256Checksum || info.sha256Checksum || "").toLowerCase();
    if (expected) {
      const actual = (await sha256OfBlob(blob)).toLowerCase();
      if (actual !== expected) {
        return { success: false, stage: "verify", message: "Checksum mismatch" };
      }
    }
  } catch (e) {
    return { success: false, stage: "verify", message: getErrorMessage(e) };
  }

  const platform = getPlatform();
  if (platform === "android") {
    stage("saving");
    let uri;
    try {
      uri = await saveApkToDevice(blob, `vasbazaar-${info.latestVersion}.apk`);
    } catch (e) {
      return { success: false, stage: "save", message: getErrorMessage(e) };
    }
    stage("installing");
    const installRes = await installApk(uri);
    if (!installRes.success) {
      return { success: false, stage: "install", message: installRes.message };
    }
    return { success: true, updateAvailable: true, installed: true, version: info.latestVersion };
  }

  // iOS: Apple doesn't allow sideloading IPAs — direct users to the App Store.
  if (platform === "ios") {
    return {
      success: true,
      updateAvailable: true,
      requiresStoreRedirect: true,
      version: info.latestVersion,
    };
  }

  return { success: true, updateAvailable: true, version: info.latestVersion };
};

export const otaService = {
  checkUpdate,
  getDownloadToken,
  downloadBinary,
  sha256OfBlob,
  saveApkToDevice,
  installApk,
  runUpdateFlow,
  getPlatform,
  isNative,
  getOrCreateDeviceId,
  OTA_STORAGE_KEYS,
};

export default otaService;
