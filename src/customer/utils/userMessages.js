/**
 * Centralized user-friendly error message mapping.
 * Converts raw technical errors (axios, HTTP, network) into
 * customer-facing messages suitable for toast / UI display.
 */

// HTTP status code → friendly message
const HTTP_MESSAGES = {
  400: "Something doesn't look right. Please check and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission for this action.",
  404: "We couldn't find what you're looking for.",
  408: "The request timed out. Please try again.",
  409: "This action conflicts with a recent change. Please refresh.",
  422: "Some details need correction. Please review and try again.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again shortly.",
  502: "Our servers are temporarily unavailable. Please try again.",
  503: "Service is under maintenance. We'll be back soon.",
  504: "The server took too long to respond. Please try again.",
};

// Pattern-match raw error strings → friendly messages
const ERROR_PATTERNS = [
  { pattern: /network\s*error/i, message: "Please check your internet connection and try again." },
  { pattern: /timeout|timed?\s*out/i, message: "The request timed out. Please try again." },
  { pattern: /econnrefused|econnreset|econnaborted/i, message: "Unable to reach the server. Please try again later." },
  { pattern: /failed to fetch/i, message: "Connection lost. Please check your network." },
  { pattern: /canceled|aborted/i, message: "The request was cancelled. Please try again." },
  { pattern: /html instead of json/i, message: "Server configuration error. Please try again later." },
];

// Patterns that indicate a message is too technical for customers
const TECHNICAL_PATTERNS = [
  /exception/i,
  /stack\s*trace/i,
  /null\s*pointer/i,
  /sql|mysql|postgres|mongo/i,
  /\.java:|\.js:|\.py:/,
  /at\s+\w+\.\w+\(/,
  /undefined is not/i,
  /cannot read propert/i,
  /unexpected token/i,
  /syntax\s*error/i,
  /internal server error/i,
  /ECONNREFUSED|ECONNRESET/,
];

const DEFAULT_ERROR = "Something went wrong. Please try again.";

/**
 * Convert an Error object or axios error into a user-friendly message.
 * @param {Error|Object} error - Raw error (axios error, Error object, or string)
 * @param {string} [fallback] - Custom fallback message
 * @returns {string} User-friendly message
 */
export const getUserFriendlyMessage = (error, fallback) => {
  if (!error) return fallback || DEFAULT_ERROR;

  // String input — sanitize directly
  if (typeof error === "string") return sanitizeBackendMessage(error, fallback);

  // Prefer the backend-supplied message when it's present and safe.
  // Reason: status-code mappings below are generic ("Something doesn't look
  // right" for 400) and hide specific causes like "Invalid OTP" that the
  // backend returns on /login/verifyOTP.
  const backendMsg = error?.response?.data?.message;
  if (backendMsg) {
    const sanitized = sanitizeBackendMessage(backendMsg, null);
    if (sanitized) return sanitized;
  }

  // No usable backend message — fall back to HTTP status mapping.
  const status = error?.response?.status;
  if (status && HTTP_MESSAGES[status]) return HTTP_MESSAGES[status];

  // Raw error.message — check patterns
  const rawMsg = error?.message || "";
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(rawMsg)) return message;
  }

  // If raw message exists and is safe, use it
  if (rawMsg) {
    const sanitized = sanitizeBackendMessage(rawMsg, null);
    if (sanitized) return sanitized;
  }

  return fallback || DEFAULT_ERROR;
};

/**
 * Sanitize a backend message for display.
 * Returns the message if it looks safe/readable, or a fallback if it's technical.
 * @param {string} message - Raw backend message
 * @param {string} [fallback] - Fallback if message is technical
 * @returns {string} Safe message for display
 */
export const sanitizeBackendMessage = (message, fallback) => {
  if (!message || typeof message !== "string") return fallback || DEFAULT_ERROR;

  const trimmed = message.trim();

  // Empty or too short
  if (trimmed.length < 2) return fallback || DEFAULT_ERROR;

  // Too long — probably a stack trace or debug dump
  if (trimmed.length > 200) return fallback || DEFAULT_ERROR;

  // Check for technical patterns
  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.test(trimmed)) return fallback || DEFAULT_ERROR;
  }

  // Looks safe — return as-is
  return trimmed;
};

export { DEFAULT_ERROR };
