import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaTimesCircle, FaClock, FaHome, FaRedo, FaHistory, FaWallet } from "react-icons/fa";
import { authPost } from "../services/apiClient";

const FailureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [refundLoading, setRefundLoading] = useState(null); // "wallet" | "bank" | null
  const [refundMessage, setRefundMessage] = useState("");
  const [refundMessageType, setRefundMessageType] = useState("");

  const isPending = state.status === "pending";
  const isWalletPay = state.payType === "wallet";
  const isPaid = state.isPaid === true || state.is_paid === true;
  const txnId = state.txnId || state.orderId || "";
  const rawMessage = state.message || "";
  const isTechnical = /login failed|ip \d|automatic refund|internal server|exception|stacktrace|null pointer/i.test(rawMessage);
  const message = isTechnical || !rawMessage
    ? (isPending
      ? "Your payment is being processed. Please check your transaction history for the latest status."
      : isWalletPay
        ? "Transaction failed. The amount has been automatically refunded to your wallet."
        : isPaid
          ? "Payment could not be completed. Please choose a refund option below or retry the transaction."
          : "UPI Transaction Failed")
    : rawMessage;

  const config = isPending
    ? { icon: <FaClock />, color: "#FFB300", bg: "linear-gradient(135deg, rgba(255,179,0,0.15) 0%, rgba(255,152,0,0.08) 100%)", title: "Payment Pending" }
    : { icon: <FaTimesCircle />, color: "#FF4757", bg: "linear-gradient(135deg, rgba(255,71,87,0.15) 0%, rgba(255,71,87,0.08) 100%)", title: isWalletPay ? "Transaction Failed" : "Payment Failed" };

  const handleRefundRequest = async (refundType) => {
    if (!txnId) {
      setRefundMessageType("error");
      setRefundMessage("Transaction ID not found. Please contact support.");
      return;
    }

    setRefundLoading(refundType);
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
      setRefundLoading(null);
    }
  };

  // Build details array - check all possible field names
  const details = [];
  const mobile = state.mobile || state.field1 || state.number || "";
  const operator = state.operatorName || state.operator || state.label || "";
  const amount = state.amount || state.txnAmt || "";

  if (mobile) details.push({ label: "Mobile", value: mobile });
  if (operator) details.push({ label: "Operator", value: operator });
  if (amount) details.push({ label: "Amount", value: `₹${amount}` });
  if (txnId) details.push({ label: "Order ID", value: txnId });

  return (
    <div className="fail-page">
      {/* Background decoration */}
      <div className="fail-bg">
        <div className="fail-bg-circle fail-bg-circle--1" />
        <div className="fail-bg-circle fail-bg-circle--2" />
      </div>

      {/* Main content */}
      <div className="fail-content">
        {/* Status Icon */}
        <div className="fail-icon-wrap" style={{ background: config.bg }}>
          <div className="fail-icon" style={{ color: config.color }}>
            {config.icon}
          </div>
          <div className="fail-icon-ring" style={{ borderColor: config.color }} />
        </div>

        {/* Title */}
        <h1 className="fail-title" style={{ color: config.color }}>{config.title}</h1>

        {/* Message */}
        <p className="fail-message">{message}</p>

        {/* Transaction Details Card */}
        {details.length > 0 && (
          <div className="fail-details-card">
            {details.map((item, idx) => (
              <div key={idx} className="fail-detail-row">
                <span className="fail-detail-label">{item.label}</span>
                <span className="fail-detail-value">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Wallet auto-refund notice */}
        {!isPending && isWalletPay && (
          <div className="fail-notice fail-notice--success">
            <FaWallet className="fail-notice-icon" />
            <span>₹{state.amount || 0} has been refunded to your wallet</span>
          </div>
        )}

        {/* Refund options for UPI failures - only show if payment was deducted */}
        {!isPending && !isWalletPay && isPaid && (
          <div className="fail-refund-section">
            <p className="fail-refund-title">Request Refund</p>
            <p className="fail-refund-desc">If payment was deducted, choose your refund option:</p>
            <div className="fail-refund-btns">
              <button
                className="fail-refund-btn fail-refund-btn--wallet"
                onClick={() => handleRefundRequest("wallet")}
                disabled={refundLoading !== null}
              >
                <FaWallet />
                <span>{refundLoading === "wallet" ? "Processing..." : "Wallet (Instant)"}</span>
              </button>
              <button
                className="fail-refund-btn fail-refund-btn--bank"
                onClick={() => handleRefundRequest("bank")}
                disabled={refundLoading !== null}
              >
                <FaHistory />
                <span>{refundLoading === "bank" ? "Processing..." : "Bank (1-3 days)"}</span>
              </button>
            </div>
            {refundMessage && (
              <p className={`fail-refund-status ${refundMessageType === "success" ? "is-success" : "is-error"}`}>
                {refundMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - Fixed at bottom */}
      <div className="fail-actions">
        <button
          className="fail-btn fail-btn--secondary"
          onClick={() => navigate("/customer/app/services", { replace: true })}
        >
          <FaHome />
          <span>Back To Home</span>
        </button>

        {isPending ? (
          <button
            className="fail-btn fail-btn--primary"
            onClick={() => navigate("/customer/app/transaction-history", { replace: true })}
          >
            <FaHistory />
            <span>Check Status</span>
          </button>
        ) : (
          <button
            className="fail-btn fail-btn--primary"
            onClick={() => navigate(-2)}
          >
            <FaRedo />
            <span>Retry</span>
          </button>
        )}
      </div>

      <style>{`
        .fail-page {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0D0D12 0%, #121218 100%);
          position: relative;
          overflow: hidden;
        }

        .fail-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .fail-bg-circle {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
        }

        .fail-bg-circle--1 {
          width: 300px;
          height: 300px;
          top: -100px;
          right: -100px;
          background: ${isPending ? 'rgba(255,179,0,0.2)' : 'rgba(255,71,87,0.2)'};
        }

        .fail-bg-circle--2 {
          width: 200px;
          height: 200px;
          bottom: 100px;
          left: -80px;
          background: rgba(0,123,255,0.15);
        }

        .fail-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px 20px;
          position: relative;
          z-index: 1;
        }

        .fail-icon-wrap {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          animation: fail-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .fail-icon {
          font-size: 44px;
          z-index: 1;
        }

        .fail-icon-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid;
          opacity: 0.3;
          animation: fail-ring 2s ease-in-out infinite;
        }

        @keyframes fail-pop {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes fail-ring {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.1; }
        }

        .fail-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 10px;
          animation: fail-fade 0.4s ease-out 0.1s both;
        }

        .fail-message {
          font-size: 0.9rem;
          color: #9CA3C0;
          text-align: center;
          max-width: 320px;
          line-height: 1.6;
          margin: 0 0 24px;
          animation: fail-fade 0.4s ease-out 0.2s both;
        }

        @keyframes fail-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fail-details-card {
          width: 100%;
          max-width: 360px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 4px 0;
          margin-bottom: 20px;
          animation: fail-fade 0.4s ease-out 0.3s both;
        }

        .fail-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .fail-detail-row:last-child {
          border-bottom: none;
        }

        .fail-detail-label {
          font-size: 0.85rem;
          color: #6B7394;
        }

        .fail-detail-value {
          font-size: 0.9rem;
          font-weight: 600;
          color: #F0F0FF;
          text-align: right;
          max-width: 60%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fail-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 500;
          margin-bottom: 20px;
          animation: fail-fade 0.4s ease-out 0.4s both;
        }

        .fail-notice--success {
          background: rgba(0,200,83,0.1);
          border: 1px solid rgba(0,200,83,0.2);
          color: #00C853;
        }

        .fail-notice-icon {
          font-size: 18px;
        }

        .fail-refund-section {
          width: 100%;
          max-width: 360px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          margin-bottom: 20px;
          animation: fail-fade 0.4s ease-out 0.4s both;
        }

        .fail-refund-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #F0F0FF;
          margin: 0 0 6px;
        }

        .fail-refund-desc {
          font-size: 0.82rem;
          color: #9CA3C0;
          margin: 0 0 16px;
        }

        .fail-refund-btns {
          display: flex;
          gap: 10px;
        }

        .fail-refund-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 12px;
          border: none;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: transform 0.15s, opacity 0.15s;
        }

        .fail-refund-btn:active {
          transform: scale(0.97);
        }

        .fail-refund-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .fail-refund-btn svg {
          font-size: 18px;
        }

        .fail-refund-btn--wallet {
          background: linear-gradient(135deg, #00B894 0%, #00D9A5 100%);
        }

        .fail-refund-btn--bank {
          background: linear-gradient(135deg, #4C6FFF 0%, #6B8AFF 100%);
        }

        .fail-refund-status {
          margin: 14px 0 0;
          font-size: 0.84rem;
          line-height: 1.5;
        }

        .fail-refund-status.is-success {
          color: #00C853;
        }

        .fail-refund-status.is-error {
          color: #FF6B6B;
        }

        .fail-actions {
          display: flex;
          gap: 12px;
          padding: 16px 20px calc(90px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, transparent 0%, rgba(13,13,18,0.95) 30%);
          position: relative;
          z-index: 2;
        }

        .fail-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 20px;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .fail-btn:active {
          transform: scale(0.97);
        }

        .fail-btn svg {
          font-size: 16px;
        }

        .fail-btn--secondary {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #F0F0FF;
        }

        .fail-btn--primary {
          background: linear-gradient(135deg, #007BFF 0%, #00BFFF 100%);
          border: none;
          color: #fff;
          box-shadow: 0 4px 20px rgba(0,123,255,0.3);
        }

        /* Light theme */
        .theme-light .fail-page {
          background: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);
        }

        .theme-light .fail-bg-circle--1 {
          background: ${isPending ? 'rgba(255,179,0,0.15)' : 'rgba(255,71,87,0.15)'};
        }

        .theme-light .fail-bg-circle--2 {
          background: rgba(0,123,255,0.1);
        }

        .theme-light .fail-message {
          color: #64748B;
        }

        .theme-light .fail-details-card {
          background: #fff;
          border-color: #E2E8F0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .theme-light .fail-detail-row {
          border-color: #F1F5F9;
        }

        .theme-light .fail-detail-label {
          color: #64748B;
        }

        .theme-light .fail-detail-value {
          color: #1E293B;
        }

        .theme-light .fail-notice--success {
          background: rgba(0,200,83,0.08);
          border-color: rgba(0,200,83,0.15);
        }

        .theme-light .fail-refund-section {
          background: #fff;
          border-color: #E2E8F0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .theme-light .fail-refund-title {
          color: #1E293B;
        }

        .theme-light .fail-refund-desc {
          color: #64748B;
        }

        .theme-light .fail-actions {
          background: linear-gradient(180deg, transparent 0%, rgba(248,250,252,0.98) 30%);
        }

        .theme-light .fail-btn--secondary {
          background: #fff;
          border-color: #E2E8F0;
          color: #1E293B;
        }
      `}</style>
    </div>
  );
};

export default FailureScreen;
