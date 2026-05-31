import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { resibotService } from "./resibotService";

/**
 * Resibot 360 — fully in-app reminder notification engine.
 * It reads the user's own reminder data and fires notifications from the
 * device itself (no backend scheduler / push needed):
 *   • Native: schedules HIGH-importance local notifications that pop up as
 *     heads-up notifications (with sound) even when the app is closed.
 *   • Web/PWA: shows an in-app toast + Web Notification when reminders are due.
 * A localStorage "seen" map prevents the same alert firing twice in a day.
 */

const CHANNEL_ID = "resibot-reminders";
const ID_BASE = 80000; // dedicated id range for resibot local notifications
const ID_MAX = ID_BASE + 100000;
const SEEN_KEY = "resibot_alert_seen";
const REMIND_HOUR = 9; // fire scheduled alerts at 09:00 local

const isNative = () => Capacitor.isNativePlatform();

// ---------- date helpers ----------
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const daysLeft = (due) => Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);

const parseOffsets = (csv) => {
  if (!csv) return [0];
  const arr = String(csv).split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
  return arr.length ? arr : [0];
};

const isAlertable = (r) =>
  r && r.dueDate && r.isActive !== false &&
  !["PAID", "COMPLETED", "CANCELLED"].includes(r.status);

const label = (r) => r.title || r.category || r.module || "Reminder";

const bodyFor = (r) => {
  const n = daysLeft(r.dueDate);
  const name = label(r);
  if (n < 0) return `${name} is overdue (was due ${ymd(r.dueDate)}).`;
  if (n === 0) return `${name} is due today.`;
  if (n === 1) return `${name} is due tomorrow.`;
  return `${name} is due in ${n} day(s).`;
};

// ---------- seen-map dedupe ----------
const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; } };
const saveSeen = (m) => {
  try {
    // prune entries older than 35 days
    const cutoff = Date.now() - 35 * 86400000;
    const pruned = {};
    Object.entries(m).forEach(([k, v]) => { if (v > cutoff) pruned[k] = v; });
    localStorage.setItem(SEEN_KEY, JSON.stringify(pruned));
  } catch { /* ignore quota */ }
};

// ---------- core: which alerts are due right now ----------
export const computeDueAlerts = (reminders = []) => {
  const out = [];
  for (const r of reminders) {
    if (!isAlertable(r)) continue;
    if (r.snoozeUntil && startOfDay(r.snoozeUntil) > startOfDay(new Date())) continue;
    const dl = daysLeft(r.dueDate);
    const offsets = parseOffsets(r.alertOffsetsDays);
    if (offsets.includes(dl) || dl < 0) {
      out.push({ reminder: r, daysLeft: dl, offsetKey: dl < 0 ? "overdue" : dl });
    }
  }
  // soonest first (overdue first)
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
};

const fetchReminders = async () => {
  try {
    const res = await resibotService.listReminders();
    if (res?.success && Array.isArray(res.data)) return res.data;
  } catch { /* ignore */ }
  return [];
};

// ---------- native permission + channel ----------
const ensurePermission = async () => {
  if (!isNative()) return false;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch { return false; }
};

const ensureChannel = async () => {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Resibot Reminders",
      description: "Bill, recharge, insurance, warranty and family reminders",
      importance: 5,        // MAX → heads-up pop-up
      visibility: 1,        // public on lock screen
      sound: "default",
      vibration: true,
      lights: true,
    });
  } catch { /* channel may already exist */ }
};

const cancelExisting = async () => {
  try {
    const pending = await LocalNotifications.getPending();
    const ids = (pending.notifications || [])
      .filter((n) => Number(n.id) >= ID_BASE && Number(n.id) < ID_MAX)
      .map((n) => ({ id: Number(n.id) }));
    if (ids.length) await LocalNotifications.cancel({ notifications: ids });
  } catch { /* ignore */ }
};

/**
 * Schedule device-level (native) local notifications for every upcoming
 * reminder alert, computed from internal data. They pop up like any critical
 * app notification even when VasBazaar is closed.
 */
export const syncResibotNotifications = async () => {
  if (!isNative()) return { scheduled: 0, skipped: "not-native" };
  const granted = await ensurePermission();
  if (!granted) return { scheduled: 0, skipped: "permission-denied" };
  await ensureChannel();
  await cancelExisting();

  const reminders = await fetchReminders();
  if (!reminders.length) return { scheduled: 0 };

  const now = new Date();
  const seen = loadSeen();
  const todayKey = ymd(now);
  const notifications = [];
  let counter = 0;

  for (const r of reminders) {
    if (!isAlertable(r)) continue;
    if (r.snoozeUntil && startOfDay(r.snoozeUntil) > startOfDay(now)) continue;

    const offsets = parseOffsets(r.alertOffsetsDays);
    const due = new Date(r.dueDate);
    const extra = { route: `/customer/app/resibot/reminder/${r.id}` };

    let firedToday = false;
    for (const off of offsets) {
      const fireAt = startOfDay(due);
      fireAt.setDate(fireAt.getDate() - off);
      fireAt.setHours(REMIND_HOUR, 0, 0, 0);

      if (fireAt.getTime() > now.getTime()) {
        // future alert → schedule at its real time
        notifications.push(buildNotif(ID_BASE + counter++, label(r), bodyFor(r), fireAt, extra));
      } else if (ymd(fireAt) === todayKey && !firedToday) {
        // alert time was earlier today and not yet shown → pop shortly, once/day
        const key = `${r.id}|${off}|${todayKey}`;
        if (!seen[key]) {
          seen[key] = Date.now();
          firedToday = true;
          notifications.push(buildNotif(ID_BASE + counter++, label(r), bodyFor(r), new Date(now.getTime() + 4000), extra));
        }
      }
    }

    // Overdue → remind once per day until paid.
    if (daysLeft(r.dueDate) < 0 && !firedToday) {
      const key = `${r.id}|overdue|${todayKey}`;
      if (!seen[key]) {
        seen[key] = Date.now();
        notifications.push(buildNotif(ID_BASE + counter++, `Overdue: ${label(r)}`, bodyFor(r), new Date(now.getTime() + 4000), extra));
      }
    }
  }

  saveSeen(seen);
  if (!notifications.length) return { scheduled: 0 };
  try {
    await LocalNotifications.schedule({ notifications });
    return { scheduled: notifications.length };
  } catch (e) {
    return { scheduled: 0, error: String(e?.message || e) };
  }
};

const buildNotif = (id, title, body, at, extra) => ({
  id,
  title: `Resibot 360: ${title}`,
  body,
  schedule: { at, allowWhileIdle: true },
  channelId: CHANNEL_ID,
  sound: Capacitor.getPlatform() === "android" ? undefined : "default",
  smallIcon: "ic_stat_icon_config_sample",
  largeIcon: "ic_launcher",
  extra,
});

/** Native: route to the reminder when the user taps a notification. */
export const registerResibotTapHandler = (navigate) => {
  if (!isNative()) return () => {};
  let listener;
  LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const route = event?.notification?.extra?.route;
    if (route && typeof navigate === "function") navigate(route);
  }).then((l) => { listener = l; });
  return () => { if (listener?.remove) listener.remove(); };
};

// ---------- web / in-app fallback ----------
const tryWebNotify = (alerts) => {
  if (typeof Notification === "undefined") return;
  const fire = () => alerts.slice(0, 3).forEach((a) => {
    try {
      const n = new Notification(`Resibot 360: ${label(a.reminder)}`, {
        body: bodyFor(a.reminder),
        tag: `resibot-${a.reminder.id}`,
        icon: "/favicon.png",
      });
      n.onclick = () => { window.focus(); window.location.assign(`/customer/app/resibot/reminder/${a.reminder.id}`); };
    } catch { /* ignore */ }
  });
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") Notification.requestPermission().then((p) => { if (p === "granted") fire(); });
};

/**
 * Check internal reminder data and fire whatever is due right now.
 * Used on app open / resume. Returns { due, fresh } so the caller can also
 * render an in-app banner.  `showToast` is the app's toast function.
 */
export const checkDueResibotRemindersNow = async ({ showToast, reminders } = {}) => {
  const list = Array.isArray(reminders) ? reminders : await fetchReminders();
  const due = computeDueAlerts(list);
  if (!due.length) return { due: [], fresh: [] };

  const seen = loadSeen();
  const todayKey = ymd(new Date());
  const fresh = [];
  for (const a of due) {
    const key = `web|${a.reminder.id}|${a.offsetKey}|${todayKey}`;
    if (seen[key]) continue;
    seen[key] = Date.now();
    fresh.push(a);
  }
  if (fresh.length) {
    saveSeen(seen);
    if (typeof showToast === "function") {
      const msg = fresh.length === 1
        ? bodyFor(fresh[0].reminder)
        : `${fresh.length} Resibot reminders need your attention.`;
      showToast(msg, "info");
    }
    if (!isNative()) tryWebNotify(fresh);
  }
  return { due, fresh };
};
