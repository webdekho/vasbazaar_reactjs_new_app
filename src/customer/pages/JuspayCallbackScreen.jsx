import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaClock, FaHome, FaRedo } from "react-icons/fa";
import { isSuccessStatus, isPendingStatus } from "../../shared/constants/juspay";
import juspayService from "../services/juspayService";

const JuspayCallbackScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState("verifying"); // verifying | success | pending | failed
  const [message, setMessage] = useState("Verifying your payment...");
  const [txnId, setTxnId] = useState("");

  useEffect(() => {
    const verify = async () => {
      // 1. Get order ID from URL params or saved context
      const urlOrderId = searchParams.get("order_id") || searchParams.get("orderId");
      const ctx = juspayService.getPaymentContext();
      const orderId = urlOrderId || ctx?.orderId;

      if (!orderId) {
        setState("failed");
        setMessage("Payment session expired or invalid. Please check your transaction history.");
        return;
      }

      setTxnId(orderId);

      try {
        // 2. Verify order status with backend (retries for pending)
        const response = await juspayService.checkOrderStatus(orderId, 3);
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
      justifyContent: "center",
      padding: "24px",
      background: "#0B0B10",
      color: "#F0F0FF",
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
        fontSize: "0.9rem", color: "#9CA3C0", textAlign: "center",
        maxWidth: 360, lineHeight: 1.6, marginBottom: 8,
      }}>
        {message}
      </p>

      {/* Transaction ID */}
      {txnId && (
        <p style={{
          fontSize: "0.78rem", color: "#6B7394",
          background: "rgba(255,255,255,0.04)", padding: "6px 16px",
          borderRadius: 8, marginBottom: 32,
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
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#F0F0FF", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              fontSize: "0.9rem", fontWeight: 600,
            }}
          >
            <FaHome /> Go Home
          </button>
          {state === "failed" && (
            <button
              onClick={() => navigate(-2)}
              style={{
                padding: "12px 24px", borderRadius: 10,
                background: "linear-gradient(135deg, #00F5D4, #00BBF9)", border: "none",
                color: "#060610", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                fontSize: "0.9rem", fontWeight: 700,
              }}
            >
              <FaRedo /> Try Again
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes jcb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default JuspayCallbackScreen;
