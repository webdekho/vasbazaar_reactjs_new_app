import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaClock, FaHome, FaHistory, FaUniversity } from "react-icons/fa";
import { isSuccessStatus, isPendingStatus } from "../../shared/constants/juspay";
import juspayService from "../services/juspayService";
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

const HOME_ROUTE = "/customer/app/services";

// Time-based re-check cadence, measured from when the transaction was initiated:
//   0–40s : just show a loader, don't hit the gateway yet (it hasn't settled; an
//           early check can even flip a not-yet-paid order to FAILED)
//   40s–2m: re-check every 10s
//   2m–3m : re-check every 20s
//   3m–5m : re-check every 30s
//   >5m   : stop auto-polling, leave the manual "Check Status" button
const INITIAL_CHECK_DELAY_MS = 40 * 1000;
const POLL_STOP_MS = 5 * 60 * 1000;

// Given elapsed time since initiation, return the delay until the next auto check,
// or null once we've passed the 5-minute window and should stop polling.
const nextPollDelay = (elapsedMs) => {
  if (elapsedMs >= POLL_STOP_MS) return null;
  if (elapsedMs < 2 * 60 * 1000) return 10 * 1000;
  if (elapsedMs < 3 * 60 * 1000) return 20 * 1000;
  return 30 * 1000;
};

const JuspayCallbackScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState("verifying"); // verifying | success | pending | failed
  const [message, setMessage] = useState("Verifying your payment...");
  const [txnId, setTxnId] = useState("");
  const [paymentCtx, setPaymentCtx] = useState(null);
  const [isPaid, setIsPaid] = useState(true); // Default to true for backward compatibility
  const [checking, setChecking] = useState(false); // manual "Check Status" re-verify in flight
  const [autoPolling, setAutoPolling] = useState(true); // auto re-check loop still running
  const [pollTick, setPollTick] = useState(0); // bumps to schedule the next auto poll
  const initiatedAtRef = useRef(null); // epoch ms when the transaction was initiated

  const isLight = theme === "light";

  // Apply a status-check response to the UI: update state, cache the result,
  // and navigate to the success screen when the gateway reports the payment charged.
  // Returns the resolved state ("success" | "pending" | "failed") so callers can react.
  const applyStatusResponse = (response, ctx, orderId) => {
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
      setVerifiedOrder(orderId, { state: "success", message: "Payment successful!", successState });
      setTimeout(() => {
        navigate("/customer/app/success", { replace: true, state: successState });
      }, 1500);
      return "success";
    }

    if (isPendingStatus(status)) {
      setState("pending");
      const pendingMsg = "Your payment is being processed. Please check your transaction history for the latest status.";
      setMessage(pendingMsg);
      setVerifiedOrder(orderId, { state: "pending", message: pendingMsg });
      return "pending";
    }

    setState("failed");
    // Check if payment was actually made (is_paid flag from API)
    const paidStatus = response?.data?.is_paid ?? response?.data?.isPaid ?? false;
    setIsPaid(paidStatus);
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
      ? (paidStatus ? "Payment could not be completed. Please choose a refund option below." : "Payment was not completed. No amount was deducted from your account.")
      : rawReason;
    setMessage(failReason);
    setVerifiedOrder(orderId, { state: "failed", message: failReason, isPaid: paidStatus });
    return "failed";
  };

  // Re-query the gateway on demand when the user taps "Check Status" on a pending
  // transaction. Bypasses the sessionStorage cache so a genuinely-updated status
  // (charged / failed) is picked up instead of the stale "pending" snapshot.
  const handleRecheck = async () => {
    if (!txnId || checking) return;
    setChecking(true);
    setState("verifying");
    setMessage("Checking your payment status...");
    try {
      const response = await juspayService.checkOrderStatus(txnId);
      const result = applyStatusResponse(response, paymentCtx, txnId);
      if (result === "pending") {
        setMessage("Still processing. This can take a few minutes — your transaction history will update automatically once the bank confirms it.");
      }
    } catch {
      setState("pending");
      setMessage("Couldn't check right now. Please try again in a moment or view your transaction history.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Use module-level flag to prevent duplicate verification
    if (_verificationInProgress || _verificationDone) {
      console.log("Verification already in progress or done, skipping");
      return;
    }
    _verificationInProgress = true;
    let initialTimer;

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
          if (cachedResult.isPaid !== undefined) setIsPaid(cachedResult.isPaid);

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

      // Anchor all polling timing to when the payment was initiated (falls back to
      // now if we have no saved context), then defer the FIRST status check until
      // INITIAL_CHECK_DELAY_MS has passed. Until then we just show the loader.
      const initiatedAt = ctx?.timestamp || Date.now();
      initiatedAtRef.current = initiatedAt;
      const waitMs = Math.max(0, INITIAL_CHECK_DELAY_MS - (Date.now() - initiatedAt));

      setState("verifying");
      setMessage("Confirming your payment. This can take up to a minute…");
      _verificationDone = true;

      initialTimer = setTimeout(async () => {
        try {
          // 2. First status check with backend
          const response = await juspayService.checkOrderStatus(orderId);
          applyStatusResponse(response, ctx, orderId);
        } catch (err) {
          // Network/exception (not a failed payment) — drop to pending so the
          // time-based auto-poll loop keeps retrying instead of failing the txn.
          setState("pending");
          setMessage("Your payment is being processed. Please check your transaction history for the latest status.");
        }
      }, waitMs);
    };

    verify();
    return () => { if (initialTimer) clearTimeout(initialTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto re-check loop: while the transaction is pending, silently re-query the
  // gateway at the nextPollDelay() cadence so a status update (charged/failed) —
  // whether from the user finishing the payment or a backend callback landing — is
  // reflected without any tap. Stops on a terminal status or past the 5-min window,
  // leaving the manual "Check Status" button.
  useEffect(() => {
    if (state !== "pending" || !txnId) return undefined;

    const initiatedAt = initiatedAtRef.current || Date.now();
    const delay = nextPollDelay(Date.now() - initiatedAt);
    if (delay === null) {
      setAutoPolling(false); // past the 5-min window — hand off to manual re-check
      return undefined;
    }

    const id = setTimeout(async () => {
      let result = "pending";
      try {
        const response = await juspayService.checkOrderStatus(txnId);
        result = applyStatusResponse(response, paymentCtx, txnId);
      } catch {
        result = "pending"; // transient error — keep waiting and retry next tick
      }
      // Still pending → schedule the next poll at the current cadence, or stop.
      if (result === "pending") {
        if (nextPollDelay(Date.now() - initiatedAt) === null) setAutoPolling(false);
        else setPollTick((t) => t + 1);
      }
    }, delay);

    return () => clearTimeout(id);
  }, [state, txnId, paymentCtx, pollTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block browser "back" from landing on this payment-status page.
  // The Juspay gateway redirect leaves this callback URL in history, so without
  // this guard pressing Back (after moving forward) brings the user back here.
  // Instead, send them to Home.
  useEffect(() => {
    // Push a sentinel entry so the first Back press triggers popstate here.
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      navigate(HOME_ROUTE, { replace: true });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  const goHome = () => navigate(HOME_ROUTE, { replace: true });

  const statusConfig = {
    verifying: { color: "#00BBF9", glow: "0,187,249" },
    success: { icon: <FaCheckCircle />, color: "#00E676", glow: "0,230,118" },
    pending: { icon: <FaClock />, color: "#FFB300", glow: "255,179,0" },
    failed: { icon: <FaTimesCircle />, color: "#FF4757", glow: "255,71,87" },
  };

  const cfg = statusConfig[state];

  const detailRow = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"}` }}>
      <span style={{ fontSize: "0.82rem", color: isLight ? "#8A90A2" : "#6B7394", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: isLight ? "#1A1A2E" : "#F0F0FF", letterSpacing: 0.2 }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "max(28px, env(safe-area-inset-top)) 20px 32px",
      position: "relative",
      overflow: "hidden",
      background: isLight
        ? "radial-gradient(1200px 600px at 50% -10%, #EAF4FF 0%, #F5F7FA 55%)"
        : "radial-gradient(1200px 600px at 50% -10%, #14142B 0%, #0B0B10 55%)",
      color: isLight ? "#1A1A2E" : "#F0F0FF",
    }}>
      {/* Ambient gradient blob */}
      <div style={{
        position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)",
        width: 360, height: 360, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${cfg.glow},0.18) 0%, transparent 70%)`,
        filter: "blur(20px)", pointerEvents: "none", transition: "background 0.5s ease",
      }} />

      {/* Status icon with pulse ring */}
      <div style={{ position: "relative", marginTop: 8, marginBottom: 22 }}>
        <div style={{
          position: "absolute", inset: -10, borderRadius: "50%",
          border: `2px solid rgba(${cfg.glow},0.35)`,
          animation: state === "verifying" ? "none" : "jcb-pulse 2s ease-out infinite",
        }} />
        <div style={{
          width: 92, height: 92, borderRadius: "50%",
          background: isLight ? "#fff" : "rgba(255,255,255,0.04)",
          boxShadow: `0 10px 40px rgba(${cfg.glow},0.35), inset 0 0 0 1px rgba(${cfg.glow},0.25)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, color: cfg.color,
          animation: "jcb-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {state === "verifying" ? (
            <div style={{
              width: 34, height: 34, border: `3px solid ${cfg.color}`,
              borderTopColor: "transparent", borderRadius: "50%",
              animation: "jcb-spin 0.8s linear infinite",
            }} />
          ) : cfg.icon}
        </div>
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: "1.5rem", fontWeight: 800, marginBottom: 8, letterSpacing: -0.4,
        color: cfg.color, textAlign: "center",
      }}>
        {state === "verifying" ? "Verifying Payment" :
         state === "success" ? "Payment Successful" :
         state === "pending" ? "Payment Pending" : "Transaction Failed"}
      </h2>

      {/* Message */}
      <p style={{
        fontSize: "0.92rem", color: isLight ? "#6B7280" : "#9CA3C0", textAlign: "center",
        maxWidth: 340, lineHeight: 1.6, marginBottom: 22,
      }}>
        {message}
      </p>

      {/* Transaction details card */}
      {(txnId || paymentCtx) && (
        <div style={{
          width: "100%", maxWidth: 380,
          background: isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.04)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: "6px 18px 14px",
          boxShadow: isLight ? "0 12px 40px rgba(20,40,80,0.08)" : "0 12px 40px rgba(0,0,0,0.4)",
          marginBottom: 24,
        }}>
          {paymentCtx?.mobile && detailRow("Mobile", paymentCtx.mobile)}
          {paymentCtx?.operatorName && detailRow("Operator", paymentCtx.operatorName)}
          {paymentCtx?.amount && detailRow("Amount", `₹${paymentCtx.amount}`)}
          {txnId && detailRow("Order ID", txnId)}
        </div>
      )}

      {/* Refund notice for failed + paid transactions.
          UPI-funded recharge failures are auto-refunded to the original payment source
          by the backend, so we no longer offer a wallet/source choice here (it would be
          rejected as "already refunded"). Just inform the customer. */}
      {state === "failed" && isPaid && (
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderRadius: 14,
            background: isLight ? "rgba(76,111,255,0.08)" : "rgba(76,111,255,0.12)",
            border: isLight ? "1px solid rgba(76,111,255,0.18)" : "1px solid rgba(76,111,255,0.28)",
          }}>
            <FaUniversity style={{ fontSize: 20, color: "#4C6FFF", flexShrink: 0 }} />
            <span style={{ fontSize: "0.85rem", lineHeight: 1.5, color: isLight ? "#3A4A7A" : "#AEB9E8" }}>
              The amount will be refunded to your original payment source within 3 working days.
            </span>
          </div>
        </div>
      )}

      {/* Action buttons for pending transactions */}
      {state === "pending" && (
        <>
          {autoPolling && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginBottom: 18, fontSize: "0.82rem", fontWeight: 600,
              color: isLight ? "#8A6D00" : "#FFB300",
            }}>
              <div style={{
                width: 16, height: 16, border: "2px solid #FFB300",
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "jcb-spin 0.8s linear infinite",
              }} />
              Checking status automatically…
            </div>
          )}
          <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 380, marginTop: 8 }}>
            <button onClick={goHome} style={secondaryBtnStyle(isLight)}>
              <FaHome /> Go To Home
            </button>
            <button
              onClick={handleRecheck}
              disabled={checking}
              style={{
                flex: 1, padding: "14px 20px", borderRadius: 14,
                background: "linear-gradient(135deg, #007BFF 0%, #00BFFF 100%)",
                border: "none", color: "#fff",
                boxShadow: "0 8px 24px rgba(0,123,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontSize: "0.95rem", fontWeight: 700,
                cursor: checking ? "not-allowed" : "pointer", opacity: checking ? 0.7 : 1,
              }}
            >
              <FaHistory /> {checking ? "Checking..." : "Check Status"}
            </button>
          </div>
          <button
            onClick={() => navigate("/customer/app/history", { replace: true })}
            style={{
              background: "none", border: "none", marginTop: 14, cursor: "pointer",
              color: isLight ? "#6B7280" : "#9CA3C0", fontSize: "0.82rem", textDecoration: "underline",
            }}
          >
            View transaction history
          </button>
        </>
      )}

      {/* Go To Home for failed transactions */}
      {state === "failed" && (
        <button onClick={goHome} style={{ ...secondaryBtnStyle(isLight), flex: "none", maxWidth: 380, marginTop: 20 }}>
          <FaHome /> Go To Home
        </button>
      )}

      <style>{`
        @keyframes jcb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes jcb-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes jcb-pulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.45); opacity: 0; } }
        @keyframes jcb-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes jcb-modal { 0% { transform: scale(0.85) translateY(12px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes jcb-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
      `}</style>
    </div>
  );
};

const secondaryBtnStyle = (isLight) => ({
  flex: 1, padding: "14px 20px", borderRadius: 14, width: "100%",
  background: isLight ? "#fff" : "rgba(255,255,255,0.06)",
  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.12)",
  color: isLight ? "#1A1A2E" : "#F0F0FF",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
});

export default JuspayCallbackScreen;
