import { server_api } from "../../utils/constants";

/**
 * WebSocket service for UPI Collect/Intent payment status updates.
 * Endpoint: ws://{{base_url}}/ws/message/{{txn_id}}?access_token={{token}}
 *
 * Used ONLY for new UPI flows (Collect + Intent).
 * Existing payment-page flow continues to use polling.
 */

/**
 * Create a WebSocket connection for payment status updates.
 * @param {string} txnId - Transaction/Order ID from recharge response
 * @param {string} token - Customer session token
 * @param {function} onMessage - Callback for incoming messages
 * @param {function} onError - Callback for errors
 * @param {function} onClose - Callback when connection closes
 * @returns {WebSocket} WebSocket instance
 */
export const createPaymentWebSocket = (txnId, token, onMessage, onError, onClose) => {
  if (!txnId || !token) {
    console.error("[WS] Missing txnId or token");
    return null;
  }

  // Convert HTTP URL to WebSocket URL
  const baseUrl = server_api().replace(/^http/, "ws");
  const wsUrl = `${baseUrl}/ws/message/${txnId}?access_token=${token}`;

  console.log("[WS] Connecting to:", wsUrl);

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("[WS] Connected for txnId:", txnId);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("[WS] Message received:", data);

      if (onMessage) {
        onMessage(data);
      }

      // Auto-close on terminal status
      const terminalStatuses = ["SUCCESS", "FAILED", "ERROR", "REFUND_INITIATED"];
      if (terminalStatuses.includes(data.status)) {
        console.log("[WS] Terminal status received, closing connection");
        ws.close();
      }
    } catch (e) {
      console.error("[WS] Failed to parse message:", e);
    }
  };

  ws.onerror = (error) => {
    console.error("[WS] Error:", error);
    if (onError) {
      onError(error);
    }
  };

  ws.onclose = (event) => {
    console.log("[WS] Connection closed:", event.code, event.reason);
    if (onClose) {
      onClose(event);
    }
  };

  return ws;
};

/**
 * WebSocket message structure (from backend):
 * {
 *   "status": "SUCCESS" | "FAILED" | "PENDING" | "REFUND_INITIATED" | "ERROR",
 *   "message": "Recharge successful" | "UPI Transaction Failed" | ...,
 *   "requestId": "ORD123456789",
 *   "referenceId": "REF123456",
 *   "vendorRefId": "VENDOR_REF_123",
 *   "commission": "2.50",
 *   "categoryId": "prepaid",
 *   "is_paid": true | false
 * }
 */

const websocketService = { createPaymentWebSocket };
export default websocketService;
