import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaClock, FaHome } from "react-icons/fa";
import { isSuccessStatus, isPendingStatus } from "../../shared/constants/juspay";
import juspayService from "../services/juspayService";
import { authPost } from "../services/apiClient";
import { useTheme } from "../context/ThemeContext";

const JuspayCallbackScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState("verifying"); // verifying | success | pending | failed
  const [message, setMessage] = useState("Verifying your payment...");
  const [txnId, setTxnId] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");
  const [refundMessageType, setRefundMessageType] = useState("");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const hasVerifiedRef = useRef(false);
  const isLight = theme === "light";

  useEffect(() => {
    if (hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;

    const verify = async () => {
      // 1. Get order ID from URL params or saved context
      const urlOrderId = searchParams.get("order_id") || searchParams.get("orderId");
      const ctx = await juspayService.getPaymentContext();
      const orderId = urlOrderId || ctx?.orderId;

      if (!orderId) {
        setState("failed");
        setMessage("Payment session expired or invalid. Please check your transaction history.");
        return;
      }

      setTxnId(orderId);

      try {
        // 2. Verify order status with backend (single API call only)
        const response = await juspayService.checkOrderStatus(orderId, 1);
        const status = (
          response?.data?.status ||
          response?.data?.txnStatus ||
          response?.data?.Status ||
          ""
        ).toUpperCase();

        if (isSuccessStatus(status)) {
          setState("success");
          setMessage("Payment successful!");

          // Navigate to success screen with context
          setTimeout(() => {
            navigate("/customer/app/success", {
              replace: true,
              state: {
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
              },
            });
          }, 1500);
        } else if (isPendingStatus(status)) {
          setState("pending");
          setMessage("Your payment is being processed. Please check your transaction history for the latest status.");
        } else {
          setState("failed");
          setMessage(response?.message || "Payment could not be completed. If money was deducted, it will be refunded within 24-48 hours.");
        }
      } catch (err) {
        setState("failed");
        setMessage("Unable to verify payment status. Please check your transaction history.");
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

    setRefundLoading(true);
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
            ? "Your wallet refund request has been submitted. You will receive it shortly."
            : "Your bank refund request has been submitted. It may take up to 3 working days."
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
      setRefundLoading(false);
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
         state === "pending" ? "Payment Pending" : "Payment Failed"}
      </h2>

      {/* Message */}
      <p style={{
        fontSize: "0.9rem", color: isLight ? "#6B7280" : "#9CA3C0", textAlign: "center",
        maxWidth: 360, lineHeight: 1.6, marginBottom: 8,
      }}>
        {message}
      </p>

      {/* Transaction ID */}
      {txnId && (
        <p style={{
          fontSize: "0.78rem", color: isLight ? "#6B7280" : "#6B7394",
          background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)", padding: "6px 16px",
          borderRadius: 8, marginBottom: 32,
          border: isLight ? "1px solid #E5E7EB" : "none",
        }}>
          Order ID: {txnId}
        </p>
      )}

      {/* Action buttons */}
      {state !== "verifying" && state !== "success" && (
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate("/customer/app/services", { replace: true })}
            style={{
              padding: "12px 24px", borderRadius: 10,
              background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)",
              border: isLight ? "1px solid #E5E7EB" : "1px solid rgba(255,255,255,0.1)",
              color: isLight ? "#1A1A2E" : "#F0F0FF",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              fontSize: "0.9rem", fontWeight: 600,
            }}
          >
            <FaHome /> Go Home
          </button>
        </div>
      )}

      {/* Refund options on failed callback status only */}
      {state === "failed" && (
        <div style={{
          width: "100%",
          maxWidth: 420,
          marginTop: 18,
          background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
          border: isLight ? "1px solid #E5E7EB" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          textAlign: "center",
        }}>
          <p style={{
            margin: "0 0 12px",
            color: isLight ? "#4B5563" : "#C8CEE8",
            fontSize: "0.88rem",
            lineHeight: 1.5,
          }}>
            If your amount was deducted, choose your refund option. Wallet refund is faster.
            Bank refund may take up to 3 working days.
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "nowrap" }}>
            <button
              onClick={() => handleRefundRequest("wallet")}
              disabled={refundLoading}
              style={{
                padding: "11px 16px",
                borderRadius: 10,
                border: "none",
                minWidth: 0,
                flex: 1,
                background: "linear-gradient(135deg, #00B894 0%, #00D2A0 100%)",
                color: "#fff",
                cursor: refundLoading ? "not-allowed" : "pointer",
                opacity: refundLoading ? 0.7 : 1,
                fontWeight: 700,
                fontSize: "0.88rem",
              }}
            >
              {refundLoading ? "Processing..." : "Refund to Wallet"}
            </button>
            <button
              onClick={() => handleRefundRequest("bank")}
              disabled={refundLoading}
              style={{
                padding: "11px 16px",
                borderRadius: 10,
                border: "none",
                minWidth: 0,
                flex: 1,
                background: "linear-gradient(135deg, #4C6FFF 0%, #6C8BFF 100%)",
                color: "#fff",
                cursor: refundLoading ? "not-allowed" : "pointer",
                opacity: refundLoading ? 0.7 : 1,
                fontWeight: 700,
                fontSize: "0.88rem",
              }}
            >
              {refundLoading ? "Processing..." : "Refund to Bank"}
            </button>
          </div>

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
