/**
 * Single source of truth for how dates and times are shown to users.
 *
 * House format (project-wide, 2026-07-21):
 *   date      → "20-July-2026"
 *   time      → "03:53:30 PM"
 *   date+time → "20-July-2026 03:53:30 PM"
 *
 * Every helper is defensive: the backend hands us LocalDate/LocalTime as Jackson
 * number arrays in some endpoints, ISO strings in others, and already-formatted
 * strings in a few legacy ones. Anything unparseable is returned untouched so a
 * screen never renders "Invalid Date".
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n) => String(n).padStart(2, '0');

/** "20-July-2026" from y/m/d numbers (month is 1-based). */
const buildDate = (y, m, d) => `${pad(d)}-${MONTHS[m - 1] ?? m}-${y}`;

/** "03:53:30 PM" from h/m/s numbers (hour is 24h). */
const buildTime = (h, mi, s) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${pad(h12)}:${pad(mi)}:${pad(s)} ${ampm}`;
};

/** Parse anything the backend sends into a Date, or null. */
const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (Array.isArray(value)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = value;
    if (y === undefined || mo === undefined || d === undefined) return null;
    return new Date(y, mo - 1, d, h, mi, s);
  }
  if (typeof value === 'number') {
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const str = String(value).trim();
  // "YYYY-MM-DD" alone parses as UTC midnight, which can shift a day in IST — build it locally.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(str);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const dt = new Date(str.includes('T') || str.includes(' ') ? str.replace(' ', 'T') : str);
  return isNaN(dt.getTime()) ? null : dt;
};

/** "20-July-2026". Falls back to the raw value when it cannot be parsed. */
export const formatDisplayDate = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  const dt = toDate(value);
  if (!dt) return String(value);
  return buildDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
};

/**
 * "03:53:30 PM". Accepts a bare time ("15:53:30.161", [15, 53, 30, 0]) as well as
 * a full timestamp.
 */
export const formatDisplayTime = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) {
    // A LocalTime array is [h, mi, s?, nano?]; a LocalDateTime array is [y, mo, d, ...].
    if (value.length <= 4 && value[0] <= 23 && (value[1] ?? 0) <= 59) {
      return buildTime(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
    }
    const [, , , h = 0, mi = 0, s = 0] = value;
    return buildTime(h, mi, s);
  }
  if (typeof value === 'string') {
    const hms = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
    if (hms && !value.includes('-') && !value.includes('/')) {
      return buildTime(Number(hms[1]), Number(hms[2]), Number(hms[3] ?? 0));
    }
  }
  const dt = toDate(value);
  if (!dt) return String(value);
  return buildTime(dt.getHours(), dt.getMinutes(), dt.getSeconds());
};

/** "20-July-2026 03:53:30 PM" from a single timestamp value. */
export const formatDisplayDateTime = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  const dt = toDate(value);
  if (!dt) return String(value);
  return `${buildDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())} ${buildTime(dt.getHours(), dt.getMinutes(), dt.getSeconds())}`;
};

/** "20-July-2026 03:53:30 PM" from separate date and time values (the common table shape). */
export const formatDisplayDateAndTime = (dateValue, timeValue, fallback = '-') => {
  const d = formatDisplayDate(dateValue, '');
  const t = formatDisplayTime(timeValue, '');
  const joined = [d, t].filter(Boolean).join(' ');
  return joined || fallback;
};

/** "2026-07-20" — for `<input type="date">` values and API query params. Never for display. */
export const toInputDate = (value) => {
  const dt = toDate(value);
  if (!dt) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
