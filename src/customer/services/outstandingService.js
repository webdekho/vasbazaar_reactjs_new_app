import { authDelete, authGet, authPost, authPut } from "./apiClient";

const BASE = "/api/customer/outstanding";

const updateTransaction = async (txnId, payload) => {
  const postRes = await authPost(`${BASE}/txns/${txnId}/update`, payload);
  if (postRes.success) return postRes;

  const message = String(postRes.message || "");
  const routeMissing = /No static resource|not found|404/i.test(message);
  if (!routeMissing) return postRes;

  const putRes = await authPut(`${BASE}/txns/${txnId}`, payload);
  if (putRes.success) return putRes;

  const putMessage = String(putRes.message || "");
  if (/not supported|No static resource|not found|404/i.test(putMessage)) {
    return {
      ...putRes,
      message: "Backend restart required. Please restart the API server so transaction editing routes are loaded.",
    };
  }
  return putRes;
};

export const outstandingService = {
  getSummary: () => authGet(`${BASE}/summary`),

  listCustomers: (pageNumber = 0, pageSize = 50, sort = "latest") =>
    authGet(`${BASE}/customers`, { pageNumber, pageSize, sort }),

  addCustomer: (payload) => authPost(`${BASE}/customers`, payload),

  updateCustomer: (id, payload) => authPut(`${BASE}/customers/${id}`, payload),

  deleteCustomer: (id) => authDelete(`${BASE}/customers/${id}`),

  getCustomerDetail: (id, pageNumber = 0, pageSize = 5, filters = {}) =>
    authGet(`${BASE}/customers/${id}`, { pageNumber, pageSize, ...filters }),

  getOwedDetail: (id, pageNumber = 0, pageSize = 5, filters = {}) =>
    authGet(`${BASE}/owed-by-me/${id}`, { pageNumber, pageSize, ...filters }),

  addTransaction: (customerId, payload) =>
    authPost(`${BASE}/customers/${customerId}/txns`, payload),

  updateTransaction,

  deleteTransaction: (txnId) => authDelete(`${BASE}/txns/${txnId}`),

  sendReminder: (customerId) => authPost(`${BASE}/customers/${customerId}/notify`, {}),

  getOwedByMe: () => authGet(`${BASE}/owed-by-me`),

  getReminderConfig: (customerId) => authGet(`${BASE}/customers/${customerId}/reminder`),

  updateReminderConfig: (customerId, payload) =>
    authPut(`${BASE}/customers/${customerId}/reminder`, payload),

  listDueReminders: () => authGet(`${BASE}/reminders/due`),

  logReminderTriggered: (customerId, payload = {}) =>
    authPost(`${BASE}/customers/${customerId}/reminder/log`, payload),

  getSubscription: () => authGet(`${BASE}/subscription`),

  renewSubscription: () => authPost(`${BASE}/subscription/renew`, {}),

  updateSubscriptionAutoRenew: (payload) => authPut(`${BASE}/subscription/auto-renew`, payload),

  // Invoices
  createInvoice: (payload) => authPost(`${BASE}/invoices`, payload),

  listInvoices: (customerId) =>
    authGet(`${BASE}/invoices`, customerId ? { customerId } : {}),

  getInvoice: (id) => authGet(`${BASE}/invoices/${id}`),

  updateInvoiceStatus: (id, status) => authPut(`${BASE}/invoices/${id}/status`, { status }),

  deleteInvoice: (id) => authDelete(`${BASE}/invoices/${id}`),

  // Online "Pay & settle": debtor clears a ledger via HDFC gateway; creditor's
  // wallet is credited and the ledger settles. Returns { orderId, paymentUrl }.
  initiateSettlement: ({ customerId, amount, note, returnUrl }) =>
    authPost(`${BASE}/settlement/initiate`, { customerId, amount, note, returnUrl }),

  // Reconcile after returning from the gateway. Returns { status, payeeName, amount }.
  confirmSettlement: (orderId) =>
    authPost(`${BASE}/settlement/confirm?orderId=${encodeURIComponent(orderId)}`, {}),

  // "Record manually instead": notify the creditor to confirm an offline payment.
  claimManualPayment: ({ customerId, amount, note }) =>
    authPost(`${BASE}/settlement/manual`, { customerId, amount, note }),
};
