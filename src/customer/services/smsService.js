import { Capacitor } from "@capacitor/core";

/**
 * SMS Service - Opens SMS composer with pre-filled message
 * User manually taps "Send" in their SMS app
 *
 * This approach is Google Play compliant (no SEND_SMS permission needed)
 */

const isNative = () => Capacitor.isNativePlatform();
const getPlatform = () => Capacitor.getPlatform();

/**
 * Format phone number with country code
 * @param {string} phoneNumber - Phone number
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return "";
  const number = String(phoneNumber).replace(/[^0-9+]/g, "");
  return number.startsWith("+") ? number : `+91${number}`;
};

/**
 * Open SMS composer with pre-filled message
 * Works on both Android and iOS
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Pre-filled message
 * @returns {{success: boolean, method: string, error?: string}}
 */
export const openSmsComposer = (phoneNumber, message = "") => {
  if (!phoneNumber) {
    return { success: false, method: "composer", error: "Phone number is required" };
  }

  const formattedNumber = formatPhoneNumber(phoneNumber);
  const body = encodeURIComponent(message);

  // iOS uses & separator, Android uses ?
  const platform = getPlatform();
  const href = platform === "ios"
    ? `sms:${formattedNumber}&body=${body}`
    : `sms:${formattedNumber}?body=${body}`;

  try {
    window.location.href = href;
    return { success: true, method: "composer" };
  } catch (err) {
    console.error("Failed to open SMS composer:", err);
    return { success: false, method: "composer", error: "Failed to open SMS app" };
  }
};

/**
 * Send SMS - Opens SMS composer with pre-filled message
 * User must manually tap send
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, method: string, error?: string}>}
 */
export const sendSms = async (phoneNumber, message) => {
  if (!isNative()) {
    return { success: false, method: "none", error: "Not running on native platform" };
  }

  return openSmsComposer(phoneNumber, message);
};

/**
 * Open SMS composer for multiple recipients (one at a time)
 * Returns info for UI to handle sequential sending
 * @param {Array<{phoneNumber: string, message: string, customerName?: string}>} messages
 * @returns {{total: number, messages: Array}}
 */
export const prepareBatchSms = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { total: 0, messages: [] };
  }

  return {
    total: messages.length,
    messages: messages.map((m, index) => ({
      index,
      phoneNumber: formatPhoneNumber(m.phoneNumber),
      message: m.message,
      customerName: m.customerName || `Customer ${index + 1}`,
    })),
  };
};

/**
 * Send next SMS in batch (opens composer for one message)
 * @param {string} phoneNumber
 * @param {string} message
 * @returns {{success: boolean, method: string}}
 */
export const sendNextSms = (phoneNumber, message) => {
  return openSmsComposer(phoneNumber, message);
};

// Legacy function stubs for backward compatibility
// These now just return appropriate responses

export const checkSmsPermission = async () => {
  // No permission needed for SMS composer
  return true;
};

export const requestSmsPermission = async () => {
  // No permission needed for SMS composer
  return true;
};

export const ensureSmsPermission = async () => {
  // No permission needed for SMS composer
  return true;
};

// Background SMS functions - now disabled, return appropriate messages
export const sendSmsBackground = async (phoneNumber, message) => {
  // Redirect to composer since background SMS is not available
  return openSmsComposer(phoneNumber, message);
};

export const sendBatchSms = async (messages, options = {}) => {
  // Return prepared batch for UI to handle sequentially
  const batch = prepareBatchSms(messages);
  return {
    total: batch.total,
    sent: 0,
    failed: 0,
    requiresManualSend: true,
    messages: batch.messages,
    info: "SMS composer will open for each message. User needs to tap Send."
  };
};

// Scheduling functions - disabled (need server-side implementation)
export const scheduleReminder = async () => {
  return {
    success: false,
    error: "Scheduled reminders require server-side SMS. Please use immediate SMS composer."
  };
};

export const scheduleBatchReminders = async (reminders) => {
  return {
    total: reminders?.length || 0,
    scheduled: 0,
    failed: reminders?.length || 0,
    error: "Scheduled reminders require server-side SMS."
  };
};

export const cancelReminder = async () => {
  return { success: true };
};

export const cancelAllReminders = async () => {
  return { success: true };
};

const smsService = {
  openSmsComposer,
  sendSms,
  prepareBatchSms,
  sendNextSms,
  // Legacy compatibility
  checkSmsPermission,
  requestSmsPermission,
  ensureSmsPermission,
  sendSmsBackground,
  sendBatchSms,
  scheduleReminder,
  scheduleBatchReminders,
  cancelReminder,
  cancelAllReminders,
};

export default smsService;
