import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaClock } from "react-icons/fa";
import { getPaymentContext } from "../../services/juspayService";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATE = { VERIFYING: "verifying", SUCCESS: "success", FAILED: "failed", PENDING: "pending" };

const MarketplacePaymentCallbackScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState(STATE.VERIFYING);
  const [orderId, setOrderId] = useState(null);
  const [message, setMessage] = useState("Verifying your payment…");
  const polledRef = useRef(false);

  useEffect(() => {
    if (polledRef.current) return;
    polledRef.current = true;

    const verify = async () => {
      const urlOrderId = searchParams.get("order_id") || searchParams.get("orderId");
      const ctx = await getPaymentContext();
      // Saved context wins because it carries our internal numeric orderId.
      const localOrderId = ctx?.orderId;

      if (!localOrderId && !urlOrderId) {
        setState(STATE.FAILED);
        setMessage("Could not identify your order. Please check My Orders.");
        return;
      }
      if (localOrderId) setOrderId(localOrderId);

      // Poll up to ~30s — backend reconciles with HDFC on each call.
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const res = await marketplaceService.checkOrderPayment(localOrderId);
          const status = String(res?.data?.paymentStatus || "").toUpperCase();
          if (status === "PAID") {
            setState(STATE.SUCCESS);
            setMessage("Payment successful");
            setTimeout(() => navigate(`/customer/app/marketplace/orders/${localOrderId}`, { replace: true }), 1200);
            return;
          }
          if (status === "FAILED") {
            setState(STATE.FAILED);
            setMessage("Payment failed. You can retry from order details.");
            return;
          }
        } catch { /* ignore — keep polling */ }
        await new Promise((r) => setTimeout(r, 3000));
      }
      // Still pending after polling window — let user check later
      setState(STATE.PENDING);
      setMessage("Payment is still processing. We'll update your order once confirmed.");
    };

    verify();
  }, [navigate, searchParams]);

  const Icon = state === STATE.SUCCESS ? FaCheckCircle : state === STATE.FAILED ? FaTimesCircle : FaClock;
  const tone = state === STATE.SUCCESS ? "#34d399" : state === STATE.FAILED ? "#f87171" : "#fbbf24";

  return (
    <div className="mkt">
      <div className="mkt-empty" style={{ padding: "120px 20px" }}>
        <div className="mkt-empty-icon" style={{ color: tone }}>
          <Icon />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 6 }}>
          {state === STATE.VERIFYING ? "Verifying payment…" :
            state === STATE.SUCCESS ? "Payment successful" :
            state === STATE.FAILED ? "Payment failed" : "Payment pending"}
        </div>
        <div style={{ fontSize: 13 }}>{message}</div>
        {state !== STATE.VERIFYING && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
            {orderId && (
              <button
                className="mkt-btn mkt-btn--primary"
                style={{ width: "auto", padding: "10px 24px" }}
                onClick={() => navigate(`/customer/app/marketplace/orders/${orderId}`, { replace: true })}
              >
                View order
              </button>
            )}
            <button
              className="mkt-btn mkt-btn--secondary"
              style={{ width: "auto", padding: "10px 24px" }}
              onClick={() => navigate("/customer/app/marketplace", { replace: true })}
            >
              Back to Marketplace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePaymentCallbackScreen;
