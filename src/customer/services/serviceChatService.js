/**
 * Service Bazaar Chat & Communication — customer <-> provider messaging.
 * Backend: /api/customer/service-chat (see CustServiceChatController).
 *
 * Every call returns the standard { success, message, data, raw } envelope from apiClient.
 * The caller's role inside a thread (customer vs provider) is resolved server-side.
 */
import { authGet, authPost } from "./apiClient";

const BASE = "/api/customer/service-chat";

export const serviceChatService = {
  // Customer opens (or reuses) a conversation with a provider.
  openThreadWithProvider: (providerId) => authPost(`${BASE}/threads/provider/${providerId}`, {}),

  // Inboxes
  getMyThreads: ({ pageNumber = 0, pageSize = 20 } = {}) =>
    authGet(`${BASE}/me/threads`, { pageNumber, pageSize }),
  getMyProviderThreads: ({ pageNumber = 0, pageSize = 20 } = {}) =>
    authGet(`${BASE}/me/provider/threads`, { pageNumber, pageSize }),

  // Messages within a thread
  getMessages: (threadId) => authGet(`${BASE}/threads/${threadId}/messages`),
  sendMessage: (threadId, payload) => authPost(`${BASE}/threads/${threadId}/messages`, payload),

  // Unread badge counts (customer + provider)
  getUnreadCount: () => authGet(`${BASE}/me/unread-count`),

  // Provider CRM: message a specific customer (opens the thread if needed)
  providerMessageCustomer: (customerUserId, payload) =>
    authPost(`${BASE}/me/provider/message/${customerUserId}`, payload),
};

export default serviceChatService;
