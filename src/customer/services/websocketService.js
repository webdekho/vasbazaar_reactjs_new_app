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
 * @param {function} onOpen - Callback when connection opens
 * @param {function} onReconnect - Callback when reconnected (for status API check)
 * @param {function} onStatusPoll - Callback for periodic status polling (every 5s, max 60s)
 * @returns {object} WebSocket wrapper with close() method
 */
export const createPaymentWebSocket = (txnId, token, onMessage, onError, onClose, onOpen, onReconnect, onStatusPoll) => {
  if (!txnId || !token) {
    console.error("[WS] Missing txnId or token");
    return null;
  }

  // Convert HTTP URL to WebSocket URL
  const baseUrl = server_api().replace(/^http/, "ws");
  const wsUrl = `${baseUrl}/ws/message/${txnId}?access_token=${token}`;

  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  let isTerminated = false;
  let wasConnectedBefore = false;

  // Polling state
  let pollIntervalId = null;
  let pollCount = 0;
  const POLL_INTERVAL = 5000; // 5 seconds
  // 36 polls = 3 minutes. Raised from 12 (60s) on 2026-07-20: a UPI Intent payment routinely
  // takes longer than a minute — the customer leaves our app, picks a UPI app, waits for it to
  // load, enters their PIN, then returns. If the first app fails to open they start over in a
  // second one. At 60s we gave up mid-payment and routed to the failure screen, so customers
  // who had in fact paid retried and were debited twice. 3 minutes comfortably covers the
  // slow-but-legitimate path while still bounding the wait.
  const MAX_POLL_COUNT = 36;

  // Clear polling interval
  const clearPolling = () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  };

  // Start periodic status polling
  const startPolling = () => {
    clearPolling();
    pollCount = 0;

    console.log("[WS] Starting status polling every 5 seconds");

    pollIntervalId = setInterval(() => {
      pollCount++;
      console.log(`[WS] Polling status... attempt ${pollCount}/${MAX_POLL_COUNT}`);

      if (isTerminated) {
        console.log("[WS] Terminated, stopping polling");
        clearPolling();
        return;
      }

      // Skip the very first tick (5s): the customer is usually still entering
      // their UPI PIN — checking that early is never conclusive. First real
      // status check happens at 10s; WebSocket push still wins if it's faster.
      if (pollCount === 1) {
        console.log("[WS] Skipping first poll tick (customer likely still paying)");
        return;
      }

      if (pollCount >= MAX_POLL_COUNT) {
        console.log("[WS] Max poll attempts reached (60s), stopping polling");
        clearPolling();
        // Final poll attempt
        if (onStatusPoll && !isTerminated) {
          onStatusPoll(true); // true = final attempt
        }
        return;
      }

      if (onStatusPoll && !isTerminated) {
        onStatusPoll(false); // false = not final
      }
    }, POLL_INTERVAL);
  };

  const connect = () => {
    console.log("[WS] Connecting to:", wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[WS] Connected for txnId:", txnId);

      // Start polling when connected
      startPolling();

      // If this is a RECONNECT (not first connection), immediately check status
      if (wasConnectedBefore && onReconnect) {
        console.log("[WS] Reconnected - checking status via API");
        onReconnect();
      }

      wasConnectedBefore = true;
      reconnectAttempts = 0; // Reset on successful connection

      if (onOpen) {
        onOpen();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Message received:", data);

        // Stop polling when message received
        clearPolling();

        if (onMessage) {
          onMessage(data);
        }

        // Auto-close on terminal status
        const terminalStatuses = ["SUCCESS", "FAILED", "ERROR", "REFUND_INITIATED", "PENDING"];
        if (terminalStatuses.includes(data.status)) {
          console.log("[WS] Terminal status received, closing connection");
          isTerminated = true;
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

      // Auto-reconnect if not terminated and under max attempts
      if (!isTerminated && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`[WS] Reconnecting... attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
        setTimeout(connect, reconnectDelay);
      }
    };
  };

  connect();

  // Return object with close method
  return {
    close: () => {
      console.log("[WS] Manual close called");
      isTerminated = true;
      clearPolling();
      if (ws) ws.close();
    },
    getState: () => ws?.readyState,
    // Allow external termination flag check
    isTerminated: () => isTerminated,
    // Force stop everything
    terminate: () => {
      isTerminated = true;
      clearPolling();
      if (ws) ws.close();
    }
  };
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
