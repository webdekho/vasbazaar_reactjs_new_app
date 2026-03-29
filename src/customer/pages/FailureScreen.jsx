import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaTimesCircle, FaClock, FaHome, FaRedo, FaHistory } from "react-icons/fa";
import { authPost } from "../services/apiClient";

const FailureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");
  const [refundMessageType, setRefundMessageType] = useState("");

  const isPending = state.status === "pending";
  const txnId = state.txnId || state.orderId || "";
  const message = state.message || (isPending
    ? "Your payment is being processed. Please check your transaction history for the latest status."
    : "Payment could not be completed. If money was deducted, it will be refunded within 24-48 hours.");

  const config = isPending
    ? { icon: <FaClock />, color: "#FFB300", bg: "rgba(255,179,0,0.1)", title: "Payment Pending" }
    : { icon: <FaTimesCircle />, color: "#FF4757", bg: "rgba(255,71,87,0.1)", title: "Payment Failed" };

  const handleRefundRequest = async (refundType) => {
    if (!txnId) {
      setRefundMessageType("error");
      setRefundMessage("Transaction ID not found. Please contact support.");
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
            ? "Your wallet refund request has been submitted successfully."
            : "Your bank refund request has been submitted successfully. It may take up to 3 working days."
        );
      } else {
        setRefundMessageType("error");
        setRefundMessage(response.message || "Unable to submit refund request. Please try again.");
      }
    } catch {
      setRefundMessageType("error");
      setRefundMessage("Unable to submit refund request. Please try again.");
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div className="failure-screen">
      {/* Status Icon */}
      <div className="failure-icon" style={{ background: config.bg, color: config.color }}>
        {config.icon}
      </div>

      {/* Title */}
      <h1 className="failure-title" style={{ color: config.color }}>{config.title}</h1>

      {/* Amount if available */}
      {state.amount && (
        <div className="failure-amount">
          <span className="failure-amount-label">Amount</span>
          <span className="failure-amount-value">₹{state.amount}</span>
        </div>
      )}

      {/* Message */}
      <p className="failure-message">{message}</p>

      {!isPending && (
        <div className="refund-section">
          <p className="refund-message">
            If payment was deducted, choose where you want the refund:
            wallet refund is faster, while bank refund may take up to 3 working days.
          </p>
          <div className="refund-actions">
            <button
              className="failure-btn failure-btn--refund-wallet"
              onClick={() => handleRefundRequest("wallet")}
              disabled={refundLoading}
            >
              {refundLoading ? "Processing..." : "Refund to Wallet"}
            </button>
            <button
              className="failure-btn failure-btn--refund-bank"
              onClick={() => handleRefundRequest("bank")}
              disabled={refundLoading}
            >
              {refundLoading ? "Processing..." : "Refund to Bank Account"}
            </button>
          </div>
          {refundMessage && (
            <p className={`refund-status ${refundMessageType === "success" ? "is-success" : "is-error"}`}>
              {refundMessage}
            </p>
          )}
        </div>
      )}

      {/* Order ID if available */}
      {state.orderId && (
        <div className="failure-order-id">
          Order ID: {state.orderId}
        </div>
      )}

      {/* Action Buttons */}
      <div className="failure-actions">
        <button
          className="failure-btn failure-btn--secondary"
          onClick={() => navigate("/customer/app/services", { replace: true })}
        >
          <FaHome /> Go Home
        </button>

        {isPending ? (
          <button
            className="failure-btn failure-btn--primary"
            onClick={() => navigate("/customer/app/transaction-history", { replace: true })}
          >
            <FaHistory /> Check History
          </button>
        ) : (
          <button
            className="failure-btn failure-btn--primary"
            onClick={() => navigate(-2)}
          >
            <FaRedo /> Try Again
          </button>
        )}
      </div>

      <style>{`
        .failure-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #0B0B10;
          color: #F0F0FF;
          text-align: center;
        }

        .failure-icon {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          margin-bottom: 24px;
          animation: failure-bounce 0.5s ease-out;
        }

        @keyframes failure-bounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .failure-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 16px;
        }

        .failure-amount {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-bottom: 16px;
          padding: 16px 32px;
          background: rgba(255,255,255,0.04);
          border-radius: 12px;
        }

        .failure-amount-label {
          font-size: 0.75rem;
          color: #6B7394;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .failure-amount-value {
          font-size: 2rem;
          font-weight: 700;
          color: #F0F0FF;
        }

        .failure-message {
          font-size: 0.9rem;
          color: #9CA3C0;
          max-width: 320px;
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .failure-order-id {
          font-size: 0.78rem;
          color: #6B7394;
          background: rgba(255,255,255,0.04);
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 32px;
        }

        .refund-section {
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 16px;
          margin: 0 0 20px;
        }

        .refund-message {
          font-size: 0.86rem;
          color: #C8CEE8;
          line-height: 1.5;
          margin: 0 0 12px;
        }

        .refund-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .failure-btn--refund-wallet,
        .failure-btn--refund-bank {
          border: none;
          color: #fff;
          min-width: 170px;
          justify-content: center;
        }

        .failure-btn--refund-wallet {
          background: linear-gradient(135deg, #00B894 0%, #00D2A0 100%);
        }

        .failure-btn--refund-bank {
          background: linear-gradient(135deg, #4C6FFF 0%, #6C8BFF 100%);
        }

        .failure-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .refund-status {
          margin: 12px 0 0;
          font-size: 0.84rem;
          line-height: 1.4;
        }

        .refund-status.is-success {
          color: #38D39F;
        }

        .refund-status.is-error {
          color: #FF6B6B;
        }

        .failure-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .failure-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s, opacity 0.15s;
        }

        .failure-btn:active {
          transform: scale(0.97);
        }

        .failure-btn--secondary {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #F0F0FF;
        }

        .failure-btn--primary {
          background: linear-gradient(135deg, #007BFF 0%, #00D9FF 100%);
          border: none;
          color: #fff;
        }

        /* Light mode */
        .theme-light .failure-screen {
          background: #F5F7FA;
          color: #1A1A2E;
        }

        .theme-light .failure-amount {
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .theme-light .failure-amount-value {
          color: #1A1A2E;
        }

        .theme-light .failure-message {
          color: #6B7280;
        }

        .theme-light .failure-order-id {
          background: #fff;
          color: #6B7280;
        }

        .theme-light .refund-section {
          background: #fff;
          border-color: #E5E7EB;
        }

        .theme-light .refund-message {
          color: #4B5563;
        }

        .theme-light .refund-status.is-success {
          color: #059669;
        }

        .theme-light .refund-status.is-error {
          color: #DC2626;
        }

        .theme-light .failure-btn--secondary {
          background: #fff;
          border-color: #E5E7EB;
          color: #1A1A2E;
        }
      `}</style>
    </div>
  );
};

export default FailureScreen;
