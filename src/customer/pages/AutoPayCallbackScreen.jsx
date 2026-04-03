import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaClock, FaSyncAlt, FaTimesCircle } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";
import {
  getMandateOrderStatus,
  getPendingMandateContext,
  isMandateActive,
  isMandatePending,
} from "../services/mandateService";

const AutoPayCallbackScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState("verifying");
  const [message, setMessage] = useState("Verifying your AutoPay setup...");
  const [orderId, setOrderId] = useState("");
  const verifiedRef = useRef(false);
  const isLight = theme === "light";

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const verify = async () => {
      const pendingCtx = getPendingMandateContext();
      const callbackOrderId = searchParams.get("order_id") || searchParams.get("orderId");
      const mandateOrderId = callbackOrderId || pendingCtx?.orderId || pendingCtx?.mandateCustomerId;

      if (!mandateOrderId) {
        setState("failed");
        setMessage("AutoPay setup session expired. Please try again from the success page.");
        return;
      }

      setOrderId(String(mandateOrderId));

      try {
        const response = await getMandateOrderStatus(mandateOrderId);
        const mandateStatus = (
          response?.data?.mandateStatus ||
          response?.data?.status ||
          response?.raw?.data?.status ||
          ""
        ).toUpperCase();
        const apiMessage = response?.data?.message || response?.message || "";

        if (response.success && isMandateActive(mandateStatus)) {
          setState("success");
          setMessage(apiMessage || "AutoPay mandate activated successfully.");
          setTimeout(() => {
            navigate("/customer/app/autopay", {
              replace: true,
              state: {
                autopayType: "success",
                autopayMessage: apiMessage || "AutoPay activated successfully. Your mandate is now ready.",
              },
            });
          }, 1400);
          return;
        }

        if (response.success && isMandatePending(mandateStatus)) {
          setState("pending");
          setMessage(apiMessage || "AutoPay setup is pending. Please check your mandates shortly.");
          setTimeout(() => {
            navigate("/customer/app/autopay", {
              replace: true,
              state: {
                autopayType: "pending",
                autopayMessage: apiMessage || "AutoPay setup is pending. Please check back in a bit.",
              },
            });
          }, 1800);
          return;
        }

        setState("failed");
        setMessage(apiMessage || "AutoPay setup failed. Please try again.");
      } catch {
        setState("failed");
        setMessage("Unable to verify AutoPay status right now. Please check your mandates.");
      }
    };

    verify();
  }, [navigate, searchParams]);

  const config = {
    verifying: { icon: <FaSyncAlt />, color: "#00BBF9", bg: "rgba(0,187,249,0.12)", spin: true, title: "Verifying AutoPay" },
    success: { icon: <FaCheckCircle />, color: "#00C853", bg: "rgba(0,200,83,0.12)", title: "AutoPay Activated" },
    pending: { icon: <FaClock />, color: "#FF9800", bg: "rgba(255,152,0,0.12)", title: "AutoPay Pending" },
    failed: { icon: <FaTimesCircle />, color: "#FF4757", bg: "rgba(255,71,87,0.12)", title: "AutoPay Failed" },
  };

  const current = config[state];

  return (
    <div style={{
      minHeight: "calc(100vh - 120px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: isLight ? "#F5F7FA" : "#0B0B10",
      color: isLight ? "#1A1A2E" : "#F0F0FF",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        borderRadius: 24,
        padding: 28,
        background: isLight ? "#FFFFFF" : "#14141C",
        border: `1px solid ${isLight ? "#E5E7EB" : "#2A2A2A"}`,
        boxShadow: isLight ? "0 18px 40px rgba(15, 23, 42, 0.08)" : "0 18px 40px rgba(0, 0, 0, 0.28)",
        textAlign: "center",
      }}>
        <div style={{
          width: 84,
          height: 84,
          borderRadius: "50%",
          margin: "0 auto 18px",
          background: current.bg,
          color: current.color,
          display: "grid",
          placeItems: "center",
          fontSize: 36,
          animation: current.spin ? "jcb-spin 1s linear infinite" : "none",
        }}>
          {current.icon}
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900, color: current.color }}>{current.title}</h1>
        <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.6, color: isLight ? "#4B5563" : "#9CA3AF" }}>{message}</p>
        {orderId && (
          <div style={{
            borderRadius: 16,
            padding: "12px 14px",
            background: isLight ? "#F8FAFC" : "#101017",
            border: `1px solid ${isLight ? "#E2E8F0" : "#2A2A2A"}`,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, color: isLight ? "#64748B" : "#6B7280", marginBottom: 4 }}>Order ID</div>
            <div style={{ fontSize: 14, fontWeight: 800, wordBreak: "break-all" }}>{orderId}</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate("/customer/app/autopay", { replace: true })}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 16,
            padding: "14px 18px",
            background: "linear-gradient(135deg, #40E0D0, #007BFF)",
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Open AutoPay Mandates
        </button>
        <button
          type="button"
          onClick={() => navigate("/customer/app/services", { replace: true })}
          style={{
            width: "100%",
            border: `1px solid ${isLight ? "#E5E7EB" : "#2A2A2A"}`,
            borderRadius: 16,
            padding: "14px 18px",
            background: "transparent",
            color: isLight ? "#1A1A2E" : "#F0F0FF",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 10,
          }}
        >
          Go to Home
        </button>
      </div>
      <style>{`
        @keyframes jcb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AutoPayCallbackScreen;
