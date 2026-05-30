import { authGet, authPost, authPut, authDelete } from "./apiClient";
import { cachedFetch, invalidate } from "./apiCache";

/**
 * Resibot 360 (VasBazaar Life) - reminders, health and family-member APIs.
 * Mirrors the serviceService pattern: authGet/authPost/... + cachedFetch.
 */
const RESIBOT_BASE = "/api/customer/resibot";
const DASHBOARD_KEY = "resibot_dashboard";

const bustReminderCaches = () => {
  invalidate(DASHBOARD_KEY);
};

export const resibotService = {
  // ---- Dashboard ----
  // Short 60s TTL so it stays fresh but de-dupes rapid navigation.
  getDashboard: () =>
    cachedFetch(DASHBOARD_KEY, () => authGet(`${RESIBOT_BASE}/reminder/dashboard`), 60000),

  // ---- Reminders ----
  listReminders: (module) =>
    authGet(`${RESIBOT_BASE}/reminder/all`, module ? { module } : {}),

  getReminder: (id) => authGet(`${RESIBOT_BASE}/reminder/${id}`),

  createReminder: async (payload) => {
    const res = await authPost(`${RESIBOT_BASE}/reminder/add`, payload);
    bustReminderCaches();
    return res;
  },

  updateReminder: async (payload) => {
    const res = await authPut(`${RESIBOT_BASE}/reminder/update`, payload);
    bustReminderCaches();
    return res;
  },

  deleteReminder: async (id) => {
    const res = await authDelete(`${RESIBOT_BASE}/reminder/${id}`);
    bustReminderCaches();
    return res;
  },

  markPaid: async (id) => {
    const res = await authPost(`${RESIBOT_BASE}/reminder/${id}/mark-paid`, {});
    bustReminderCaches();
    return res;
  },

  snooze: async (id, snoozeUntil) => {
    const res = await authPost(`${RESIBOT_BASE}/reminder/${id}/snooze`, { snoozeUntil });
    bustReminderCaches();
    return res;
  },

  // ---- Family members ----
  listMembers: () => authGet(`${RESIBOT_BASE}/member/all`),
  addMember: (payload) => authPost(`${RESIBOT_BASE}/member/add`, payload),
  updateMember: (payload) => authPut(`${RESIBOT_BASE}/member/update`, payload),
  deleteMember: (id) => authDelete(`${RESIBOT_BASE}/member/${id}`),

  // ---- Health ----
  getHealthProfile: (memberId) =>
    authGet(`${RESIBOT_BASE}/health/profile`, memberId ? { memberId } : {}),
  saveHealthProfile: (payload) => authPost(`${RESIBOT_BASE}/health/profile`, payload),
  logVital: (payload) => authPost(`${RESIBOT_BASE}/health/vital`, payload),
  listVitals: (type, from, to) => {
    const params = {};
    if (type) params.type = type;
    if (from) params.from = from;
    if (to) params.to = to;
    return authGet(`${RESIBOT_BASE}/health/vital`, params);
  },
  getHealthSummary: (memberId) =>
    authGet(`${RESIBOT_BASE}/health/summary`, memberId ? { memberId } : {}),

  // ---- Orders & Delivery (Phase 2) ----
  listOrders: (scope) => authGet(`${RESIBOT_BASE}/order/all`, scope ? { scope } : {}),
  getOrder: (id) => authGet(`${RESIBOT_BASE}/order/${id}`),
  createOrder: (payload) => authPost(`${RESIBOT_BASE}/order/add`, payload),
  updateOrder: (payload) => authPut(`${RESIBOT_BASE}/order/update`, payload),
  updateOrderStatus: (id, status, trackingStatus) =>
    authPost(`${RESIBOT_BASE}/order/${id}/status`, { status, trackingStatus }),
  deleteOrder: (id) => authDelete(`${RESIBOT_BASE}/order/${id}`),

  // ---- Expense Snapshot (Phase 2) ----
  listExpenses: (month, year) => {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return authGet(`${RESIBOT_BASE}/expense/all`, params);
  },
  getExpenseSummary: (month, year) => {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return authGet(`${RESIBOT_BASE}/expense/summary`, params);
  },
  addExpense: (payload) => authPost(`${RESIBOT_BASE}/expense/add`, payload),
  deleteExpense: (id) => authDelete(`${RESIBOT_BASE}/expense/${id}`),
};

export const RESIBOT_ORDER_VENDORS = ["Amazon", "Flipkart", "Myntra", "Ajio", "Blinkit", "Instamart", "Local", "Other"];
export const RESIBOT_ORDER_STATUSES = ["ORDERED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "INSTALLED"];
export const RESIBOT_ORDER_TRACKING = ["RETURN_INITIATED", "PICKUP_SCHEDULED", "REFUND_PENDING", "REFUND_COMPLETED"];
export const RESIBOT_EXPENSE_CATEGORIES = ["Utilities", "Recharge", "Travel", "Shopping", "Medical", "Education", "Entertainment", "Other"];

/**
 * Reminder module metadata used across Resibot 360 screens.
 * key = backend `module` value; slug = redirect target for Pay/Recharge Now.
 */
export const RESIBOT_MODULES = [
  {
    key: "BILL",
    label: "Smart Bills",
    accentColor: "#FFE9D6",
    highlightColor: "#FF7A00",
    categories: ["Electricity", "Water", "Gas", "Broadband", "Landline", "Mobile Postpaid", "DTH", "Credit Card", "School Fees", "Society Maintenance", "Rent", "LPG Refill"],
    action: "Pay Now",
    redirectSlug: "electricity",
  },
  {
    key: "RECHARGE",
    label: "Recharge",
    accentColor: "#D6F5EE",
    highlightColor: "#0EA5A0",
    categories: ["Mobile Recharge", "DTH Recharge", "FASTag Recharge"],
    action: "Recharge Now",
    redirectSlug: "prepaid",
  },
  {
    key: "SUBSCRIPTION",
    label: "Subscriptions",
    accentColor: "#EDE4FF",
    highlightColor: "#7C3AED",
    categories: ["Netflix", "Prime Video", "Spotify", "Disney+", "Google One", "ChatGPT", "Microsoft 365", "Apple Services", "YouTube Premium", "Custom Subscription"],
    action: null,
  },
  {
    key: "WARRANTY",
    label: "Warranty",
    accentColor: "#FFE7E0",
    highlightColor: "#E8735A",
    categories: ["Mobile", "Laptop", "TV", "Refrigerator", "Washing Machine", "AC", "Water Purifier", "Furniture", "Electronics"],
    action: null,
  },
  {
    key: "INSURANCE",
    label: "Insurance",
    accentColor: "#DDEBFF",
    highlightColor: "#2563EB",
    categories: ["Car Insurance", "Bike Insurance", "Health Insurance", "Life Insurance", "Term Insurance"],
    action: null,
  },
  {
    key: "SERVICE",
    label: "Services",
    accentColor: "#E6F7E6",
    highlightColor: "#16A34A",
    categories: ["AC Service", "RO Service", "Car Service", "Bike Service", "Washing Machine", "Refrigerator", "Water Tank Cleaning", "Pest Control"],
    action: null,
  },
  {
    key: "FAMILY",
    label: "Family",
    accentColor: "#FFE0F0",
    highlightColor: "#DB2777",
    categories: ["Birthday", "Anniversary", "School Fees", "Vaccination", "Parent Checkup"],
    action: null,
  },
];

export const RESIBOT_REPEAT_OPTIONS = [
  "NONE", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM_DAYS",
];

export const getResibotModule = (key) =>
  RESIBOT_MODULES.find((m) => m.key === key) || null;
