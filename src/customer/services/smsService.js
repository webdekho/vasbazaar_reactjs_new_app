import { Capacitor, registerPlugin } from "@capacitor/core";

// Register our custom SmsSender plugin (native Android)
const SmsSender = registerPlugin("SmsSender");

/**
 * SMS Service for sending SMS from user's device
 *
 * Android: Sends SMS in background using native SmsManager (requires SEND_SMS permission)
 * iOS: Opens SMS composer (Apple doesn't allow background SMS sending)
 */

const isAndroid = () => Capacitor.getPlatform() === "android";
const isIOS = () => Capacitor.getPlatform() === "ios";
const isNative = () => Capacitor.isNativePlatform();

/**
 * Check if SMS permission is granted (Android only)
 * @returns {Promise<boolean>}
 */
export const checkSmsPermission = async () => {
  if (!isAndroid()) return false;

  try {
    const result = await SmsSender.checkPermission();
    return result?.granted === true;
  } catch (err) {
    console.error("Error checking SMS permission:", err);
    return false;
  }
};

/**
 * Request SMS permission (Android only)
 * This will trigger the native permission dialog
 * @returns {Promise<boolean>}
 */
export const requestSmsPermission = async () => {
  if (!isAndroid()) return false;

  try {
    const result = await SmsSender.requestPermission();
    return result?.granted === true;
  } catch (err) {
    console.error("Error requesting SMS permission:", err);
    return false;
  }
};

/**
 * Ensure SMS permission is granted, request if needed
 * @returns {Promise<boolean>}
 */
export const ensureSmsPermission = async () => {
  if (!isAndroid()) return false;

  // First check if already granted
  const hasPermission = await checkSmsPermission();
  if (hasPermission) return true;

  // Request permission
  return await requestSmsPermission();
};

/**
 * Send SMS in background (Android only)
 * @param {string} phoneNumber - Phone number with or without country code
 * @param {string} message - SMS message content
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendSmsBackground = async (phoneNumber, message) => {
  if (!phoneNumber || !message) {
    return { success: false, error: "Phone number and message are required" };
  }

  // Clean and format phone number
  let number = String(phoneNumber).replace(/[^0-9+]/g, "");
  if (!number.startsWith("+")) {
    number = "+91" + number; // Default to India
  }

  if (!isAndroid()) {
    return { success: false, error: "Background SMS only supported on Android" };
  }

  try {
    // Ensure permission first
    const hasPermission = await ensureSmsPermission();
    if (!hasPermission) {
      return { success: false, error: "SMS permission denied. Please grant SMS permission in settings." };
    }

    const result = await SmsSender.sendSms({
      phoneNumber: number,
      message: message,
    });

    if (result?.success === true) {
      return { success: true };
    }
    return { success: false, error: "SMS sending failed" };
  } catch (err) {
    console.error("SMS send error:", err);

    // Check for permission denied
    if (err?.message?.includes("permission")) {
      return { success: false, error: "SMS permission denied. Please grant SMS permission in settings." };
    }

    return { success: false, error: err?.message || "Failed to send SMS" };
  }
};

/**
 * Open SMS composer with pre-filled message (works on both Android and iOS)
 * User must manually tap send
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Pre-filled message
 * @returns {boolean}
 */
export const openSmsComposer = (phoneNumber, message) => {
  if (!phoneNumber) return false;

  const number = String(phoneNumber).replace(/[^0-9+]/g, "");
  const formattedNumber = number.startsWith("+") ? number : `+91${number}`;
  const body = encodeURIComponent(message || "");

  const platform = Capacitor.getPlatform();
  const href = platform === "ios"
    ? `sms:${formattedNumber}&body=${body}`
    : `sms:${formattedNumber}?body=${body}`;

  window.location.href = href;
  return true;
};

/**
 * Send SMS - uses background sending on Android, opens composer on iOS
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Message content
 * @param {Object} options - Options
 * @param {boolean} options.preferBackground - If true, prefer background sending on Android (default: true)
 * @returns {Promise<{success: boolean, method: 'background'|'composer', error?: string}>}
 */
export const sendSms = async (phoneNumber, message, options = {}) => {
  const { preferBackground = true } = options;

  if (!isNative()) {
    return { success: false, method: "none", error: "Not running on native platform" };
  }

  // iOS: Always use composer (no other option)
  if (isIOS()) {
    const opened = openSmsComposer(phoneNumber, message);
    return {
      success: opened,
      method: "composer",
      error: opened ? undefined : "Failed to open SMS composer"
    };
  }

  // Android: Try background sending first if preferred
  if (isAndroid() && preferBackground) {
    const result = await sendSmsBackground(phoneNumber, message);
    if (result.success) {
      return { success: true, method: "background" };
    }

    // If background failed due to permission, fall back to composer
    if (result.error?.includes("permission")) {
      console.log("Background SMS failed, falling back to composer");
      const opened = openSmsComposer(phoneNumber, message);
      return {
        success: opened,
        method: "composer",
        error: opened ? undefined : "Failed to open SMS composer"
      };
    }

    return { success: false, method: "background", error: result.error };
  }

  // Fallback: Use composer
  const opened = openSmsComposer(phoneNumber, message);
  return {
    success: opened,
    method: "composer",
    error: opened ? undefined : "Failed to open SMS composer"
  };
};

/**
 * Send multiple SMS in batch (Android background only)
 * @param {Array<{phoneNumber: string, message: string}>} messages - Array of messages to send
 * @param {Object} options - Options
 * @param {number} options.delayMs - Delay between messages in ms (default: 1000)
 * @param {Function} options.onProgress - Callback for progress updates
 * @returns {Promise<{total: number, sent: number, failed: number, results: Array}>}
 */
export const sendBatchSms = async (messages, options = {}) => {
  const { delayMs = 1000, onProgress } = options;

  if (!isAndroid()) {
    return {
      total: messages.length,
      sent: 0,
      failed: messages.length,
      error: "Batch SMS only supported on Android"
    };
  }

  // Ensure permission first
  const hasPermission = await ensureSmsPermission();
  if (!hasPermission) {
    return {
      total: messages.length,
      sent: 0,
      failed: messages.length,
      error: "SMS permission denied"
    };
  }

  // Format phone numbers
  const formattedMessages = messages.map(m => ({
    phoneNumber: String(m.phoneNumber).replace(/[^0-9+]/g, "").startsWith("+")
      ? String(m.phoneNumber).replace(/[^0-9+]/g, "")
      : "+91" + String(m.phoneNumber).replace(/[^0-9+]/g, ""),
    message: m.message
  }));

  try {
    const result = await SmsSender.sendBatchSms({
      messages: formattedMessages,
      delayMs: delayMs
    });

    return {
      total: result.total || messages.length,
      sent: result.sent || 0,
      failed: result.failed || 0,
      success: true
    };
  } catch (err) {
    console.error("Batch SMS error:", err);
    return {
      total: messages.length,
      sent: 0,
      failed: messages.length,
      error: err?.message || "Failed to send batch SMS"
    };
  }
};

/**
 * Schedule an SMS reminder to be sent at a specific time (Android only)
 * Uses WorkManager for reliable background execution even when app is closed
 * @param {Object} reminder - Reminder config
 * @param {string} reminder.customerId - Customer ID
 * @param {string} reminder.customerName - Customer name
 * @param {string} reminder.phoneNumber - Phone number
 * @param {string} reminder.message - Message to send
 * @param {string} reminder.time - Time in "HH:mm" format
 * @param {string} reminder.frequency - "DAILY" or "WEEKLY"
 * @returns {Promise<{success: boolean, scheduledIn?: number, error?: string}>}
 */
export const scheduleReminder = async (reminder) => {
  if (!isAndroid()) {
    return { success: false, error: "SMS scheduling only supported on Android" };
  }

  // Ensure permission first
  const hasPermission = await ensureSmsPermission();
  if (!hasPermission) {
    return { success: false, error: "SMS permission denied" };
  }

  try {
    const result = await SmsSender.scheduleReminder({
      customerId: String(reminder.customerId),
      customerName: reminder.customerName || "Customer",
      phoneNumber: reminder.phoneNumber,
      message: reminder.message,
      time: reminder.time || "10:00",
      frequency: reminder.frequency || "DAILY"
    });

    return {
      success: result?.success === true,
      scheduledIn: result?.scheduledIn,
      customerId: result?.customerId
    };
  } catch (err) {
    console.error("Schedule reminder error:", err);
    return { success: false, error: err?.message || "Failed to schedule reminder" };
  }
};

/**
 * Schedule multiple SMS reminders (Android only)
 * @param {Array} reminders - Array of reminder objects
 * @returns {Promise<{total: number, scheduled: number, failed: number}>}
 */
export const scheduleBatchReminders = async (reminders) => {
  if (!isAndroid()) {
    return { total: reminders.length, scheduled: 0, failed: reminders.length, error: "Android only" };
  }

  // Ensure permission first
  const hasPermission = await ensureSmsPermission();
  if (!hasPermission) {
    return { total: reminders.length, scheduled: 0, failed: reminders.length, error: "SMS permission denied" };
  }

  try {
    const result = await SmsSender.scheduleBatchReminders({
      reminders: reminders.map(r => ({
        customerId: String(r.customerId),
        customerName: r.customerName || "Customer",
        phoneNumber: r.phoneNumber,
        message: r.message,
        time: r.time || "10:00",
        frequency: r.frequency || "DAILY"
      }))
    });

    return {
      total: result?.total || reminders.length,
      scheduled: result?.scheduled || 0,
      failed: result?.failed || 0,
      success: true
    };
  } catch (err) {
    console.error("Batch schedule error:", err);
    return { total: reminders.length, scheduled: 0, failed: reminders.length, error: err?.message };
  }
};

/**
 * Cancel a scheduled reminder (Android only)
 * @param {string} customerId - Customer ID
 * @returns {Promise<{success: boolean}>}
 */
export const cancelReminder = async (customerId) => {
  if (!isAndroid()) {
    return { success: false, error: "Android only" };
  }

  try {
    const result = await SmsSender.cancelReminder({ customerId: String(customerId) });
    return { success: result?.success === true };
  } catch (err) {
    console.error("Cancel reminder error:", err);
    return { success: false, error: err?.message };
  }
};

/**
 * Cancel all scheduled reminders (Android only)
 * @returns {Promise<{success: boolean}>}
 */
export const cancelAllReminders = async () => {
  if (!isAndroid()) {
    return { success: false, error: "Android only" };
  }

  try {
    const result = await SmsSender.cancelAllReminders();
    return { success: result?.success === true };
  } catch (err) {
    console.error("Cancel all reminders error:", err);
    return { success: false, error: err?.message };
  }
};

export default {
  checkSmsPermission,
  requestSmsPermission,
  ensureSmsPermission,
  sendSmsBackground,
  openSmsComposer,
  sendSms,
  sendBatchSms,
  scheduleReminder,
  scheduleBatchReminders,
  cancelReminder,
  cancelAllReminders,
};
