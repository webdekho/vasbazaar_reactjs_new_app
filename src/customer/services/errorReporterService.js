import { Capacitor } from "@capacitor/core";

// ── Configuration ──
const CUSTOMER_STORAGE_KEYS = { sessionToken: "customerSessionToken" };
const REPORT_ENDPOINT = "/api/customer/app_errors/add";
const MAX_BREADCRUMBS = 20;

// Phase 2: Rate limiting
const RATE_LIMIT = { perMinute: 10, perHour: 100 };
const minuteTimestamps = [];
const hourTimestamps = [];

// Phase 8: Retry queue with exponential backoff
const MAX_RETRY = 5;
const RETRY_BASE_MS = 3000;
let retryQueue = [];
let retryTimer = null;

// Phase 3: Sensitive field masking — covers all required variations case-insensitively
const SENSITIVE_KEYS = new Set([
  "password", "passwd", "pwd",
  "token", "accesstoken", "sessiontoken", "authtoken", "refreshtoken",
  "authorization", "auth",
  "aadhaar", "aadhar", "aadhaarnumber", "aadhaarno",
  "pan", "pannumber", "panno", "pancard",
  "mobile", "mobileno", "mobilenumber", "phonenumber", "phone",
  "otp", "pin", "secret", "secretkey",
  "creditcard", "cardnumber", "cvv", "cvc",
]);

let breadcrumbs = [];

// ── Phase 1: Fingerprinting with robust normalization ──
async function computeFingerprint(message, stack, endpoint) {
  const raw = `${normalizeMessage(message)}|${normalizeStack(stack)}|${normalizeEndpoint(endpoint)}`;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
  } catch {
    let h = 5381;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0");
  }
}

function normalizeMessage(msg) {
  if (!msg) return "";
  return msg.trim()
    .replace(/\s+/g, " ")                       // collapse whitespace
    .replace(/\b\d{10,}\b/g, "<NUM>")           // long numbers (timestamps, IDs)
    .replace(/\b[0-9a-f]{8,}\b/gi, "<HEX>")    // hex IDs / tokens
    .replace(/:\s*\d+/g, ": <N>")               // "status: 500" → "status: <N>"
    .replace(/["'][^"']{20,}["']/g, '"<STR>"')  // long string literals
    .substring(0, 300);
}

function normalizeStack(stack) {
  if (!stack) return "";
  return stack.split("\n").slice(0, 5)
    .map(line => line.replace(/:\d+:\d+/g, "").replace(/\?\S+/g, "").trim()) // strip line:col and query params
    .filter(Boolean).join("|").substring(0, 300);
}

function normalizeEndpoint(ep) {
  if (!ep) return "";
  try { return new URL(ep, "https://x").pathname; } catch { /* not a URL */ }
  return ep.split("?")[0].split("#")[0]; // strip query/hash from relative paths
}

// ── Phase 3: Sensitive Data Masking (recursive) ──
function maskSensitive(obj, depth = 0) {
  if (depth > 8 || obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    try {
      const parsed = JSON.parse(obj);
      if (typeof parsed === "object") return JSON.stringify(maskSensitive(parsed, depth));
    } catch { /* not JSON */ }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(item => maskSensitive(item, depth + 1));
  if (typeof obj === "object") {
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
      if (SENSITIVE_KEYS.has(normalizedKey)) {
        masked[key] = "***";
      } else {
        masked[key] = maskSensitive(value, depth + 1);
      }
    }
    return masked;
  }
  return obj;
}

// ── Phase 2: Rate Limiting (in-memory + localStorage for cross-tab persistence) ──
function isRateLimited() {
  const now = Date.now();

  // Hydrate from localStorage on first call or periodically
  hydrateFromStorage(now);

  while (minuteTimestamps.length && minuteTimestamps[0] < now - 60_000) minuteTimestamps.shift();
  while (hourTimestamps.length && hourTimestamps[0] < now - 3_600_000) hourTimestamps.shift();

  if (minuteTimestamps.length >= RATE_LIMIT.perMinute) return true;
  if (hourTimestamps.length >= RATE_LIMIT.perHour) return true;

  minuteTimestamps.push(now);
  hourTimestamps.push(now);
  persistToStorage(now);
  return false;
}

const RATE_STORAGE_KEY = "vb_err_rate";
let lastHydration = 0;

function hydrateFromStorage(now) {
  if (now - lastHydration < 5000) return; // only hydrate every 5s
  lastHydration = now;
  try {
    const raw = localStorage.getItem(RATE_STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    // Merge stored timestamps that are still valid and not already in memory
    const memSet = new Set(minuteTimestamps);
    (stored.ts || []).forEach(t => { if (t > now - 3_600_000 && !memSet.has(t)) { minuteTimestamps.push(t); hourTimestamps.push(t); } });
    minuteTimestamps.sort((a, b) => a - b);
    hourTimestamps.sort((a, b) => a - b);
  } catch { /* corrupt storage, ignore */ }
}

function persistToStorage(now) {
  try {
    // Store only last hour's timestamps (compact)
    const valid = hourTimestamps.filter(t => t > now - 3_600_000);
    localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify({ ts: valid.slice(-100) }));
  } catch { /* quota exceeded or private browsing, ignore */ }
}

// ── Device & environment info ──
const getDeviceInfo = () => {
  const ua = navigator.userAgent || "";
  const platform = Capacitor.getPlatform();
  let osName = platform, osVersion = "";

  if (/Android\s([\d.]+)/.test(ua)) { osName = "Android"; osVersion = RegExp.$1; }
  else if (/iPhone OS ([\d_]+)/.test(ua) || /iPad.*OS ([\d_]+)/.test(ua)) { osName = "iOS"; osVersion = RegExp.$1.replace(/_/g, "."); }
  else if (/Windows NT ([\d.]+)/.test(ua)) { osName = "Windows"; osVersion = RegExp.$1; }
  else if (/Mac OS X ([\d_.]+)/.test(ua)) { osName = "macOS"; osVersion = RegExp.$1.replace(/_/g, "."); }

  return { device: ua.substring(0, 250), osName, osVersion, appVersion: process.env.REACT_APP_VERSION || "1.0.0", platform, isNative: Capacitor.isNativePlatform() };
};

let cachedDeviceInfo = null;
const deviceInfo = () => { if (!cachedDeviceInfo) cachedDeviceInfo = getDeviceInfo(); return cachedDeviceInfo; };

// ── Phase 6: Environment detection ──
function detectEnvironment() {
  if (process.env.NODE_ENV === "development") return "dev";
  try {
    const host = window.location.hostname;
    if (host.includes("uat") || host.includes("staging") || host.includes("localhost")) return "staging";
  } catch { /* ignore */ }
  return "production";
}

// ── Breadcrumb tracking ──
export function addBreadcrumb(action, data) {
  breadcrumbs.push({
    action,
    data: typeof data === "string" ? data : JSON.stringify(data || "").substring(0, 200),
    time: new Date().toISOString(),
  });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

export function trackNavigation(path) { addBreadcrumb("navigate", path); }

// ── Helpers ──
function getToken() { try { return localStorage.getItem(CUSTOMER_STORAGE_KEYS.sessionToken) || null; } catch { return null; } }
function getCurrentScreen() { try { return window.location.pathname + window.location.hash; } catch { return "unknown"; } }
function getNetworkInfo() { try { const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection; return c ? c.effectiveType || c.type || "unknown" : "unknown"; } catch { return "unknown"; } }
async function getBatteryLevel() { try { if (navigator.getBattery) { const b = await navigator.getBattery(); return Math.round(b.level * 100); } } catch {} return null; }

// ── Payload builder ──
async function buildPayload(errorData) {
  const info = deviceInfo();
  const message = String(errorData.message || "Unknown error").substring(0, 2000);
  const stack = String(errorData.stack || "").substring(0, 3000);
  const endpoint = errorData.endpoint || null;

  const fingerprintId = await computeFingerprint(message, stack, endpoint);

  // Phase 3: Mask sensitive data
  const maskedReqBody = errorData.apiRequestBody ? maskSensitive(errorData.apiRequestBody) : null;
  const maskedResBody = errorData.apiResponseBody ? maskSensitive(errorData.apiResponseBody) : null;

  return {
    errorMessage: message,
    errorType: String(errorData.type || "UnknownError").substring(0, 200),
    severity: errorData.severity || "ERROR",
    screenPage: errorData.screen || getCurrentScreen(),
    device: info.device,
    appVersion: info.appVersion,
    endpoint,
    params: JSON.stringify({
      fingerprintId,
      environment: detectEnvironment(),
      stackTrace: stack,
      osName: info.osName,
      osVersion: info.osVersion,
      platform: info.platform,
      httpMethod: errorData.httpMethod || null,
      httpStatusCode: errorData.httpStatusCode || null,
      apiRequestBody: maskedReqBody ? JSON.stringify(maskedReqBody).substring(0, 1000) : null,
      apiResponseBody: maskedResBody ? JSON.stringify(maskedResBody).substring(0, 1000) : null,
      networkType: errorData.networkType || getNetworkInfo(),
      batteryLevel: errorData.batteryLevel || null,
      userAction: errorData.userAction || null,
      breadcrumbs: [...breadcrumbs],
    }),
    status: "OPEN",
  };
}

// ── Phase 8: Send with retry + exponential backoff ──
async function sendReport(payload, attempt = 0) {
  const token = getToken();
  if (!token) return;

  try {
    const { server_api } = await import("../../utils/constants");
    const baseUrl = server_api();
    const response = await fetch(`${baseUrl}${REPORT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: token },
      body: JSON.stringify(payload),
    });
    if (!response.ok && attempt < MAX_RETRY) scheduleRetry(payload, attempt + 1);
  } catch {
    if (attempt < MAX_RETRY) scheduleRetry(payload, attempt + 1);
  }
}

function scheduleRetry(payload, attempt) {
  // Exponential backoff with jitter: base * 2^(attempt-1) + random(0..base)
  const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * RETRY_BASE_MS);
  retryQueue.push({ payload, attempt, executeAt: Date.now() + delay });
  if (!retryTimer) retryTimer = setTimeout(processRetryQueue, delay);
}

function processRetryQueue() {
  retryTimer = null;
  const now = Date.now();
  const ready = [], remaining = [];
  for (const item of retryQueue) { (item.executeAt <= now ? ready : remaining).push(item); }
  retryQueue = remaining;
  ready.slice(0, 3).forEach(item => sendReport(item.payload, item.attempt));
  if (retryQueue.length > 0) {
    const nextDelay = Math.min(...retryQueue.map(i => i.executeAt)) - now;
    retryTimer = setTimeout(processRetryQueue, Math.max(nextDelay, 1000));
  }
}

// ── Deduplication by fingerprint ──
const recentFingerprints = new Map();
function isDuplicate(fingerprintId) {
  const now = Date.now();
  const last = recentFingerprints.get(fingerprintId);
  if (last && now - last < 5000) return true;
  recentFingerprints.set(fingerprintId, now);
  if (recentFingerprints.size > 50) {
    for (const [key, ts] of recentFingerprints) { if (now - ts > 60000) recentFingerprints.delete(key); }
  }
  return false;
}

async function enqueueReport(errorData) {
  if (isRateLimited()) return;
  const payload = await buildPayload(errorData);
  const fp = JSON.parse(payload.params).fingerprintId;
  if (isDuplicate(fp)) return;
  sendReport(payload);
}

// ── Public API ──

export function reportError(error, context = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  enqueueReport({ message: err.message, type: err.name || context.type || "Error", stack: err.stack, severity: context.severity || "ERROR", screen: context.screen, userAction: context.userAction, ...context });
}

export function reportApiError({ endpoint, method, status, requestBody, responseBody, errorMessage }) {
  enqueueReport({
    message: `API ${method} ${endpoint} failed: ${status} — ${errorMessage}`,
    type: "ApiError", severity: status >= 500 ? "CRITICAL" : "ERROR",
    endpoint, httpMethod: method, httpStatusCode: String(status || ""),
    apiRequestBody: requestBody, apiResponseBody: responseBody, networkType: getNetworkInfo(),
  });
}

export function reportComponentCrash(error, componentStack, screen) {
  enqueueReport({
    message: error?.message || "Component crash", type: "ReactComponentCrash", severity: "CRITICAL",
    stack: (error?.stack || "") + "\n\nComponent Stack:\n" + (componentStack || ""), screen, userAction: "component_render",
  });
}

// ── Global handlers ──

export function initGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    if (event.message === "Script error." && !event.filename) return;
    reportError(event.error || event.message, { type: "UncaughtError", severity: "CRITICAL", userAction: "uncaught_exception" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || "Unhandled rejection");
    reportError(new Error(message), { type: "UnhandledRejection", severity: "ERROR", stack: reason instanceof Error ? reason.stack : "", userAction: "unhandled_promise_rejection" });
  });

  const origPushState = window.history.pushState;
  window.history.pushState = function (...args) { origPushState.apply(this, args); trackNavigation(window.location.pathname); };
  window.addEventListener("popstate", () => trackNavigation(window.location.pathname));

  getBatteryLevel().then((level) => { if (level !== null) cachedDeviceInfo = { ...deviceInfo(), batteryLevel: level }; });
}
