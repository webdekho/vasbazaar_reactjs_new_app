/**
 * Shared API Client — thin wrapper re-exporting from customer services.
 * All API logic lives in customer/services/apiClient.js; this module
 * provides a stable import path from the shared layer.
 */
export {
  guestPost,
  guestGet,
  authGet,
  authPost,
  authPut,
  apiClient,
  parseApiResponse,
  getErrorMessage,
  CUSTOMER_STORAGE_KEYS,
} from '../../customer/services/apiClient';
