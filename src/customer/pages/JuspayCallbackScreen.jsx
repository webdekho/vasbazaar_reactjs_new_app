import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaClock } from "react-icons/fa";
import { isSuccessStatus, isPendingStatus } from "../../shared/constants/juspay";
import juspayService from "../services/juspayService";
import { authPost } from "../services/apiClient";
import { useTheme } from "../context/ThemeContext";

// Helper to get/set verified order cache in sessionStorage
const VERIFIED_ORDERS_KEY = "juspay_verified_orders";

// Module-level flag to prevent duplicate verification calls
let _verificationInProgress = false;
let _verificationDone = false;

const getVerifiedOrder = (orderId) => {
  try {
    const cache = JSON.parse(sessionStorage.getItem(VERIFIED_ORDERS_KEY) || "{}");
    return cache[orderId] || null;
  } catch {
    return null;
  }
};

const setVerifiedOrder = (orderId, result) => {
  try {
    const cache = JSON.parse(sessionStorage.getItem(VERIFIED_ORDERS_KEY) || "{}");
    cache[orderId] = { ...result, verifiedAt: Date.now() };
    sessionStorage.setItem(VERIFIED_ORDERS_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
};

const JuspayCallbackScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState("verifying"); // verifying | success | pending | failed
  const [message, setMessage] = useState("Verifying your payment...");
  const [txnId, setTxnId] = useState("");
  const [paymentCtx, setPaymentCtx] = useState(null);
  const [refundLoadingType, setRefundLoadingType] = useState("");
  const [refundMessage, setRefundMessage] = useState("");
  const [refundMessageType, setRefundMessageType] = useState("");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const isLight = theme === "light";

  useEffect(() => {
    // Use module-level flag to prevent duplicate verification
    if (_verificationInProgress || _verificationDone) {
      console.log("Verification already in progress or done, skipping");
      return;
    }
    _verificationInProgress = true;

    const verify = async () => {
      // 1. Get order ID from URL params or saved context
      const urlOrderId = searchParams.get("order_id") || searchParams.get("orderId");
      const ctx = await juspayService.getPaymentContext();
      const orderId = urlOrderId || ctx?.orderId;

      if (ctx) setPaymentCtx(ctx);

      // Check if this order was already verified (prevents duplicate calls on refresh)
      if (orderId) {
        const cachedResult = getVerifiedOrder(orderId);
        if (cachedResult) {
          _verificationDone = true;
          setState(cachedResult.state);
          setMessage(cachedResult.message);
          setTxnId(orderId);

          // If it was successful, navigate to success screen
          if (cachedResult.state === "success" && cachedResult.successState) {
            setTimeout(() => {
              navigate("/customer/app/success", {
                replace: true,
                state: cachedResult.successState,
              });
            }, 1500);
          }
          return;
        }
      }

      // If no orderId, DON'T show failed - keep verifying state and wait
      if (!orderId) {
        console.log("No orderId found, waiting for status check to complete elsewhere");
        // Don't show failed - let the user see verifying state
        // The PaymentScreen or another component will handle the navigation
        return;
      }

      setTxnId(orderId);

      try {
        // 2. Verify order status with backend (single API call only)
        _verificationDone = true;
        const response = await juspayService.checkOrderStatus(orderId);
        const status = (
          response?.data?.status ||
          response?.data?.txnStatus ||
          response?.data?.Status ||
          ""
        ).toUpperCase();

        if (isSuccessStatus(status)) {
          setState("success");
          setMessage("Payment successful!");

          const successState = {
            type: ctx?.type || "recharge",
            amount: ctx?.amount,
            label: ctx?.label,
            txnId: orderId,
            statusPayload: response.data,
            paymentType: "upi",
            couponCode: ctx?.couponCode || null,
            couponName: ctx?.couponName || null,
            discountValue: ctx?.discountValue || 0,
            cashbackValue: ctx?.cashbackValue || 0,
            offerType: ctx?.offerType || null,
            mobile: ctx?.mobile || ctx?.field1 || "",
            field1: ctx?.field1 || ctx?.mobile || "",
            field2: ctx?.field2 || null,
            operatorId: ctx?.operatorId || null,
            operatorName: ctx?.operatorName || ctx?.label || "",
            logo: ctx?.logo || "",
            validity: ctx?.validity || null,
            viewBillResponse: ctx?.viewBillResponse || {},
            serviceId: ctx?.serviceId || null,
          };

          // Cache the result
          setVerifiedOrder(orderId, { state: "success", message: "Payment successful!", successState });

          // Navigate to success screen with context
          setTimeout(() => {
            navigate("/customer/app/success", {
              replace: true,
              state: successState,
            });
          }, 1500);
        } else if (isPendingStatus(status)) {
          setState("pending");
          const pendingMsg = "Your payment is being processed. Please check your transaction history for the latest status.";
          setMessage(pendingMsg);
          // Cache pending result
          setVerifiedOrder(orderId, { state: "pending", message: pendingMsg });
        } else {
          setState("failed");
          const rawReason =
            response?.data?.failureReason ||
            response?.data?.failure_reason ||
            response?.data?.errorMessage ||
            response?.data?.error_message ||
            response?.data?.reason ||
            response?.data?.message ||
            response?.message ||
            "";
          // Hide technical/internal messages from the user
          const isTechnical = /login failed|ip \d|automatic refund|internal server|exception|stacktrace|null pointer/i.test(rawReason);
          const failReason = isTechnical || !rawReason
            ? "Payment could not be completed. Please choose a refund option below."
            : rawReason;
          setMessage(failReason);
          // Cache failed result
          setVerifiedOrder(orderId, { state: "failed", message: failReason });
        }
      } catch (err) {
        setState("failed");
        const errorMsg = "Unable to verify payment status. Please check your transaction history.";
        setMessage(errorMsg);
        // Cache error result
        setVerifiedOrder(orderId, { state: "failed", message: errorMsg });
      }
    };

    verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefundRequest = async (refundType) => {
    if (!txnId) {
      setRefundMessageType("error");
      setRefundMessage("Order ID not found. Please try again from transaction history.");
      setRefundModalOpen(true);
      return;
    }

    setRefundLoadingType(refundType);
    setRefundMessage("");
    setRefundMessageType("");

    try {
      const response = await authPost("/api/customer/plan_recharge/request-refund", {
        txnId,
        refundType,
      });

      if (response.success) {
        setRefundMessageType("success");
        setRefundMessage(
          refundType === "wallet"
            ? "Amount has been credited to your wallet."
            : "Refund request submitted. Amount will be refunded to your original payment source within 3 working days."
        );
      } else {
        setRefundMessageType("error");
        setRefundMessage(response.message || "Unable to submit refund request. Please try again.");
      }
      setRefundModalOpen(true);
    } catch {
      setRefundMessageType("error");
      setRefundMessage("Unable to submit refund request. Please try again.");
      setRefundModalOpen(true);
    } finally {
      setRefundLoadingType("");
    }
  };

  const statusConfig = {
    verifying: { icon: null, color: "#00BBF9", bg: "rgba(0,187,249,0.1)" },
    success: { icon: <FaCheckCircle />, color: "#00E676", bg: "rgba(0,230,118,0.1)" },
    pending: { icon: <FaClock />, color: "#FFB300", bg: "rgba(255,179,0,0.1)" },
    failed: { icon: <FaTimesCircle />, color: "#FF4757", bg: "rgba(255,71,87,0.1)" },
  };

  const cfg = statusConfig[state];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "16px 24px 24px",
      background: isLight ? "#F5F7FA" : "#0B0B10",
      color: isLight ? "#1A1A2E" : "#F0F0FF",
    }}>
      {/* Status icon */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: cfg.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, color: cfg.color,
        marginBottom: 24,
      }}>
        {state === "verifying" ? (
          <div style={{
            width: 32, height: 32, border: `3px solid ${cfg.color}`,
            borderTopColor: "transparent", borderRadius: "50%",
            animation: "jcb-spin 0.8s linear infinite",
          }} />
        ) : cfg.icon}
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: "1.3rem", fontWeight: 700, marginBottom: 8,
        color: cfg.color, textAlign: "center",
      }}>
        {state === "verifying" ? "Verifying Payment" :
         state === "success" ? "Payment Successful" :
         state === "pending" ? "Payment Pending" : "Transaction Failed"}
      </h2>

      {/* Failure reason message */}
      <p style={{
        fontSize: "0.9rem", color: isLight ? "#6B7280" : "#9CA3C0", textAlign: "center",
        maxWidth: 360, lineHeight: 1.6, marginBottom: 8,
      }}>
        {message}
      </p>

      {/* Transaction details */}
      {(txnId || paymentCtx) && (
        <div style={{
          width: "100%",
          maxWidth: 360,
          background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
          border: isLight ? "1px solid #E5E7EB" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 24,
        }}>
          {paymentCtx?.mobile && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.82rem", color: isLight ? "#6B7280" : "#6B7394" }}>Mobile</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: isLight ? "#1A1A2E" : "#F0F0FF" }}>{paymentCtx.mobile}</span>
            </div>
          )}
          {paymentCtx?.operatorName && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.82rem", color: isLight ? "#6B7280" : "#6B7394" }}>Operator</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: isLight ? "#1A1A2E" : "#F0F0FF" }}>{paymentCtx.operatorName}</span>
            </div>
          )}
          {paymentCtx?.amount && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.82rem", color: isLight ? "#6B7280" : "#6B7394" }}>Amount</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: isLight ? "#1A1A2E" : "#F0F0FF" }}>{"\u20B9"}{paymentCtx.amount}</span>
            </div>
          )}
          {txnId && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", color: isLight ? "#6B7280" : "#6B7394" }}>Order ID</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: isLight ? "#1A1A2E" : "#F0F0FF" }}>{txnId}</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons for failed transactions */}
      {state === "failed" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, width: "100%", maxWidth: 460 }}>
          <button
            onClick={() => handleRefundRequest("wallet")}
            disabled={Boolean(refundLoadingType)}
            style={{
              padding: "12px 18px", borderRadius: 10, width: "100%",
              background: "linear-gradient(135deg, #00B894 0%, #00D2A0 100%)",
              border: "none",
              color: "#fff",
              cursor: refundLoadingType ? "not-allowed" : "pointer",
              opacity: refundLoadingType ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontSize: "0.9rem", fontWeight: 700,
            }}
          >
            {refundLoadingType === "wallet" ? "Processing..." : "Refund to Wallet (Immediate)"}
          </button>

          <button
            onClick={() => handleRefundRequest("bank")}
            disabled={Boolean(refundLoadingType)}
            style={{
              padding: "12px 18px", borderRadius: 10, width: "100%",
              background: "linear-gradient(135deg, #4C6FFF 0%, #6C8BFF 100%)",
              border: "none",
              color: "#fff",
              cursor: refundLoadingType ? "not-allowed" : "pointer",
              opacity: refundLoadingType ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontSize: "0.9rem", fontWeight: 700,
            }}
          >
            {refundLoadingType === "bank" ? "Processing..." : "Refund to Original Source (Upto 3 Days)"}
          </button>
        </div>
      )}

      {refundModalOpen && (
        <div
          onClick={() => setRefundModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              background: isLight ? "#FFFFFF" : "#161822",
              border: `1px solid ${refundMessageType === "success" ? "rgba(56,211,159,0.35)" : "rgba(255,107,107,0.35)"}`,
              borderRadius: 14,
              padding: 18,
              textAlign: "center",
            }}
          >
            <h3 style={{
              margin: "0 0 8px",
              fontSize: "1rem",
              color: refundMessageType === "success" ? "#38D39F" : "#FF6B6B",
            }}>
              {refundMessageType === "success" ? "Refund Request Submitted" : "Refund Request Failed"}
            </h3>
            <p style={{ margin: 0, color: isLight ? "#4B5563" : "#C8CEE8", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {refundMessage}
            </p>
            <button
              type="button"
              onClick={() => setRefundModalOpen(false)}
              style={{
                marginTop: 14,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #00F5D4, #00BBF9)",
                color: "#061018",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes jcb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default JuspayCallbackScreen;
