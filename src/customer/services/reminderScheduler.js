import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { outstandingService } from "./outstandingService";
import { openSmsComposer } from "./smsService";

const CHANNEL_ID = "outstanding-reminders";
const NOTIFICATION_PREFIX = 70000;

const isNative = () => Capacitor.isNativePlatform();

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
      description: "Reminders to send SMS to customers with outstanding balance",
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

/**
 * Open SMS composer with pre-filled message
 * This is the only SMS sending method now - user manually taps Send
 */
export const triggerNativeSms = (mobile, message) => {
  if (!mobile) return false;
  return openSmsComposer(mobile, message);
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
 * Prepare SMS reminders for manual sending
 * Returns a list of messages ready to be sent one by one via SMS composer
 * @param {Array} reminders - List of reminder configs with customer data
 * @param {string} ownerName - Business owner name for template
 * @returns {{total: number, messages: Array}}
 */
export const prepareSmsReminders = (reminders, ownerName) => {
  if (!reminders?.length) {
    return { total: 0, messages: [] };
  }

  const messages = reminders
    .map((reminder) => {
      const message = buildSmsMessage(
        reminder.reminderTemplate,
        { customerName: reminder.customerName, balance: reminder.balance },
        ownerName
      );

      if (!message || !reminder.mobile) {
        return null;
      }

      return {
        customerId: reminder.customerId,
        customerName: reminder.customerName,
        mobile: reminder.mobile,
        message: message,
      };
    })
    .filter(Boolean);

  return { total: messages.length, messages };
};

/**
 * Send SMS via composer (opens SMS app with pre-filled message)
 * User needs to tap Send in their SMS app
 * @param {string} mobile - Phone number
 * @param {string} message - Message to send
 * @returns {{success: boolean, method: string}}
 */
export const sendSmsViaComposer = (mobile, message) => {
  const result = openSmsComposer(mobile, message);
  return {
    success: result.success,
    method: "composer",
    info: "SMS app opened. Please tap Send.",
  };
};

// Legacy function - now just prepares messages for manual sending
export const sendAutoSmsReminders = async (reminders, ownerName, options = {}) => {
  const prepared = prepareSmsReminders(reminders, ownerName);
  return {
    total: prepared.total,
    sent: 0,
    failed: 0,
    requiresManualSend: true,
    messages: prepared.messages,
    info: "SMS composer will open for each message. User needs to tap Send."
  };
};

// Legacy function
export const processAndSendDueReminders = async (ownerName) => {
  if (!isNative()) return { total: 0, sent: 0, failed: 0, skipped: "not-native" };

  try {
    const res = await outstandingService.listDueReminders();
    if (!res?.success || !Array.isArray(res.data) || !res.data.length) {
      return { total: 0, sent: 0, failed: 0 };
    }

    const prepared = prepareSmsReminders(res.data, ownerName);
    return {
      total: prepared.total,
      sent: 0,
      failed: 0,
      requiresManualSend: true,
      messages: prepared.messages,
    };
  } catch (err) {
    console.error("Error processing due reminders:", err);
    return { total: 0, sent: 0, failed: 0, error: err?.message };
  }
};
