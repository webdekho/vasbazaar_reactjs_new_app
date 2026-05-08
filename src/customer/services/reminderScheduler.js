import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { outstandingService } from "./outstandingService";
import { sendSmsBackground, openSmsComposer, ensureSmsPermission } from "./smsService";

const CHANNEL_ID = "outstanding-reminders";
const NOTIFICATION_PREFIX = 70000;
const SMS_BATCH_DELAY_MS = 1000; // 1 second between SMS to avoid carrier throttling

const isNative = () => Capacitor.isNativePlatform();
const isAndroid = () => Capacitor.getPlatform() === "android";

const ensurePermission = async () => {
  if (!isNative()) return false;
  const status = await LocalNotifications.checkPermissions();
  if (status.display === "granted") return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
};

const ensureChannel = async () => {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Outstanding Reminders",
      description: "Daily reminders to send SMS to customers with outstanding balance",
      importance: 4,
      visibility: 1,
    });
  } catch (e) {
    // channel may already exist
  }
};

const nextFireDate = (timeStr, frequency) => {
  const [hh = "10", mm = "00"] = String(timeStr || "10:00").split(":");
  const now = new Date();
  const fire = new Date();
  fire.setHours(Number(hh), Number(mm), 0, 0);
  if (fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 1);
  }
  if (frequency === "WEEKLY") {
    // align to next Monday >= fire
    const day = fire.getDay();
    const offset = day === 1 ? 0 : (8 - day) % 7 || 7;
    if (offset > 0) fire.setDate(fire.getDate() + offset);
  }
  return fire;
};

const cancelAllReminders = async () => {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ids = (pending.notifications || [])
      .filter((n) => Number(n.id) >= NOTIFICATION_PREFIX && Number(n.id) < NOTIFICATION_PREFIX + 100000)
      .map((n) => ({ id: Number(n.id) }));
    if (ids.length) await LocalNotifications.cancel({ notifications: ids });
  } catch (e) {
    // ignore
  }
};

export const syncReminders = async () => {
  if (!isNative()) return { scheduled: 0, skipped: "not-native" };
  const granted = await ensurePermission();
  if (!granted) return { scheduled: 0, skipped: "permission-denied" };
  await ensureChannel();
  await cancelAllReminders();

  let dueList = [];
  try {
    const res = await outstandingService.listDueReminders();
    if (res?.success && Array.isArray(res.data)) dueList = res.data;
  } catch (e) {
    return { scheduled: 0, skipped: "api-failed" };
  }

  if (!dueList.length) return { scheduled: 0 };

  // group by reminderTime+frequency to avoid spamming user with N notifications
  // single-fire-per-time approach: one notification per unique (time, freq) at that slot
  const groups = new Map();
  for (const item of dueList) {
    const key = `${item.reminderTime || "10:00"}|${item.reminderFrequency || "DAILY"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const notifications = [];
  let counter = 0;
  for (const [key, items] of groups.entries()) {
    const [time, freq] = key.split("|");
    const fire = nextFireDate(time, freq);
    const count = items.length;
    notifications.push({
      id: NOTIFICATION_PREFIX + 90000 + counter,
      title: "Send outstanding reminders",
      body:
        count === 1
          ? `Tap to send SMS reminder to ${items[0].customerName}`
          : `Tap to send SMS reminders to ${count} customers`,
      schedule: {
        at: fire,
        allowWhileIdle: true,
        repeats: true,
        every: freq === "WEEKLY" ? "week" : "day",
      },
      channelId: CHANNEL_ID,
      smallIcon: "ic_stat_icon_config_sample",
      extra: { route: "/customer/app/outstanding/reminders" },
    });
    counter += 1;
  }

  try {
    await LocalNotifications.schedule({ notifications });
    return { scheduled: notifications.length };
  } catch (e) {
    return { scheduled: 0, error: String(e?.message || e) };
  }
};

export const registerReminderTapHandler = (navigate) => {
  if (!isNative()) return () => {};
  let listener;
  LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const route = event?.notification?.extra?.route;
    if (route && typeof navigate === "function") navigate(route);
  }).then((l) => {
    listener = l;
  });
  return () => {
    if (listener && typeof listener.remove === "function") listener.remove();
  };
};

export const triggerNativeSms = (mobile, message) => {
  if (!mobile) return false;
  const cleaned = String(mobile).replace(/[^0-9+]/g, "");
  const platform = Capacitor.getPlatform();
  const body = encodeURIComponent(message || "");
  const number = cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
  const href =
    platform === "ios"
      ? `sms:${number}&body=${body}`
      : `sms:${number}?body=${body}`;
  window.location.href = href;
  return true;
};

/**
 * Build SMS message from template and customer data
 */
const buildSmsMessage = (template, customer, ownerName) => {
  if (!template) return null;
  return template
    .replace(/\{name\}/gi, customer.customerName || "Customer")
    .replace(/\{balance\}/gi, Math.abs(customer.balance || 0).toLocaleString("en-IN"))
    .replace(/\{owner\}/gi, ownerName || "");
};

/**
 * Send SMS reminders automatically (Android only - background)
 * For iOS, this opens the SMS composer for each customer
 * @param {Array} reminders - List of reminder configs with customer data
 * @param {string} ownerName - Business owner name for template
 * @param {Object} options - Options
 * @param {Function} options.onProgress - Progress callback
 * @param {Function} options.onComplete - Completion callback
 * @returns {Promise<{total: number, sent: number, failed: number, results: Array}>}
 */
export const sendAutoSmsReminders = async (reminders, ownerName, options = {}) => {
  const { onProgress, onComplete } = options;

  if (!reminders?.length) {
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  const results = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < reminders.length; i++) {
    const reminder = reminders[i];
    const message = buildSmsMessage(
      reminder.reminderTemplate,
      { customerName: reminder.customerName, balance: reminder.balance },
      ownerName
    );

    if (!message || !reminder.mobile) {
      results.push({
        customerId: reminder.customerId,
        customerName: reminder.customerName,
        success: false,
        error: "Missing mobile or message template"
      });
      failed++;
      continue;
    }

    try {
      if (isAndroid()) {
        // Android: Send in background
        const result = await sendSmsBackground(reminder.mobile, message);
        results.push({
          customerId: reminder.customerId,
          customerName: reminder.customerName,
          success: result.success,
          error: result.error,
          method: "background"
        });
        if (result.success) sent++;
        else failed++;
      } else {
        // iOS: Open SMS composer (user must tap send)
        openSmsComposer(reminder.mobile, message);
        results.push({
          customerId: reminder.customerId,
          customerName: reminder.customerName,
          success: true,
          method: "composer"
        });
        sent++;
      }
    } catch (err) {
      results.push({
        customerId: reminder.customerId,
        customerName: reminder.customerName,
        success: false,
        error: err?.message || "Unknown error"
      });
      failed++;
    }

    if (onProgress) {
      onProgress({ current: i + 1, total: reminders.length, sent, failed });
    }

    // Add delay between SMS to avoid carrier throttling
    if (isAndroid() && i < reminders.length - 1) {
      await new Promise(resolve => setTimeout(resolve, SMS_BATCH_DELAY_MS));
    }
  }

  const result = { total: reminders.length, sent, failed, results };
  if (onComplete) onComplete(result);
  return result;
};

/**
 * Fetch due reminders and send SMS automatically
 * Called when app opens or when notification is received
 * @param {string} ownerName - Business owner name
 * @returns {Promise<{total: number, sent: number, failed: number}>}
 */
export const processAndSendDueReminders = async (ownerName) => {
  if (!isNative()) return { total: 0, sent: 0, failed: 0, skipped: "not-native" };

  try {
    const res = await outstandingService.listDueReminders();
    if (!res?.success || !Array.isArray(res.data) || !res.data.length) {
      return { total: 0, sent: 0, failed: 0 };
    }

    // Filter reminders that are due now (within 5 minutes of scheduled time)
    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const dueNow = res.data.filter(r => {
      const reminderTime = (r.reminderTime || "10:00").slice(0, 5);
      // Check if current time is within 5 minutes of reminder time
      const [rh, rm] = reminderTime.split(":").map(Number);
      const [nh, nm] = nowHHMM.split(":").map(Number);
      const rMinutes = rh * 60 + rm;
      const nMinutes = nh * 60 + nm;
      return Math.abs(nMinutes - rMinutes) <= 5;
    });

    if (!dueNow.length) {
      return { total: 0, sent: 0, failed: 0, skipped: "not-due-now" };
    }

    return await sendAutoSmsReminders(dueNow, ownerName);
  } catch (err) {
    console.error("Error processing due reminders:", err);
    return { total: 0, sent: 0, failed: 0, error: err?.message };
  }
};
