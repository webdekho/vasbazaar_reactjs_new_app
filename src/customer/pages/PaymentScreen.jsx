import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaWallet, FaShieldAlt, FaLock, FaCheckCircle, FaTimes, FaSpinner } from "react-icons/fa";
import { FiCreditCard } from "react-icons/fi";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { QRCodeSVG } from "qrcode.react";
import { userService } from "../services/userService";
import { rechargeService } from "../services/rechargeService";
import juspayService, { isPwaStandalone } from "../services/juspayService";
import { createPaymentWebSocket } from "../services/websocketService";
import { openUpiUrlIOS } from "../services/upiIntentPlugin";

const FALLBACK_LOGO = "/assets/images/Brand_favicon.png";
const handleLogoError = (e) => { e.target.onerror = null; e.target.src = FALLBACK_LOGO; };

// Module-level flags to prevent duplicate calls (persists across component remounts)
let _statusCheckCalled = false; // Track if status check API was called
let _navigationDone = false; // Prevent multiple navigations

// Reset all flags for new payment
const resetPaymentFlags = () => {
  _statusCheckCalled = false;
  _navigationDone = false;
};

/**
 * Detect if user is on a mobile device (Android/iOS) via web browser.
 * Returns true for mobile web browsers, false for desktop browsers.
 * Note: Capacitor.isNativePlatform() handles native app detection separately.
 */
const isMobileWebBrowser = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const numberToWords = (num) => {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };
  const whole = Math.floor(num);
  const paise = Math.round((num - whole) * 100);
  let result = convert(whole);
  if (paise > 0) result += " and " + convert(paise) + " Paise";
  return result + " Only";
};

const PaymentScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentState = useMemo(() => location.state || {}, [location.state]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [ready, setReady] = useState(false);
  const [nativePaymentPending, setNativePaymentPending] = useState(false);
  const paymentContextRef = useRef(null);

  // UPI Collect/Intent flow state
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiError, setUpiError] = useState("");
  // Check if there's a pending UPI payment that needs status check
  const [checkingPendingPayment, setCheckingPendingPayment] = useState(() => {
    try {
      const pending = localStorage.getItem("upiPaymentPending");
      if (pending) {
        const parsed = JSON.parse(pending);
        // If pending payment exists and not expired, we need to check status first
        if (parsed.txnId && Date.now() - parsed.startTime < 10 * 60 * 1000) {
          return true;
        }
      }
    } catch (e) {
      // Ignore
    }
    return false;
  });
  const [upiFlowActive, setUpiFlowActive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false); // WebSocket connection indicator
  const wsRef = useRef(null);
  const currentTxnIdRef = useRef(null); // Track current UPI txnId for status check

  // QR Code state for web UPI flow
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrTxnId, setQrTxnId] = useState("");
  const amount = Math.round(Number(paymentState.amount) * 100) / 100;
  const discount = Math.round(Number(paymentState.discountValue || 0) * 100) / 100;
  const finalAmount = Math.round(Math.max(0, amount - discount) * 100) / 100;
  const canPayWallet = walletBalance >= finalAmount;

  const buildSuccessState = useCallback((statusPayload, payType, txnIdValue, context = paymentState) => ({
    type: context.type,
    amount: context.amount,
    label: context.label,
    txnId: txnIdValue,
    statusPayload,
    paymentType: payType,
    couponCode: context.couponCode || null,
    couponName: context.couponName || null,
    couponDesc: context.couponDesc || null,
    discountValue: context.discountValue || 0,
    cashbackValue: context.cashbackValue || 0,
    offerType: context.offerType || null,
    mobile: context.mobile || context.field1 || "",
    field1: context.field1 || context.mobile || "",
    field2: context.field2 || null,
    operatorId: context.operatorId || null,
    operatorName: context.operatorName || context.contactName || context.label || "",
    logo: context.logo || "",
    validity: context.validity || null,
    viewBillResponse: context.viewBillResponse || {},
    serviceId: context.serviceId || null,
  }), [paymentState]);

  // Validate UPI ID format (xxx@yyy)
  const validateUpiId = (id) => {
    if (!id || !id.trim()) return false;
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return upiRegex.test(id.trim());
  };

  // Status-only API check handler (for reconnect/timeout)
  // NOTE: Do NOT call setUpiFlowActive(false) before navigate - keep overlay visible until navigation completes
  const checkStatusOnlyAndNavigate = useCallback(async (txnId) => {
    if (_navigationDone) return;
    try {
      console.log("[UPI] Checking status-only API for txnId:", txnId);
      const statusResponse = await rechargeService.checkStatusOnly(txnId);
      if (_navigationDone) return;

      const status = (statusResponse?.data?.status || "").toUpperCase();
      const data = statusResponse?.data || {};

      console.log("[UPI] Status-only response:", status, data);

      // Terminal statuses - navigate (keep overlay visible until navigation completes)
      if (status === "SUCCESS") {
        localStorage.removeItem("upiPaymentPending");
        _navigationDone = true;
        navigate("/customer/app/success", {
          state: buildSuccessState(data, "upi", txnId),
          replace: true,
        });
      } else if (status === "FAILED") {
        localStorage.removeItem("upiPaymentPending");
        _navigationDone = true;
        navigate("/customer/app/failure", {
          state: { status: "failed", message: data.message || "Payment failed", orderId: txnId, amount: paymentState.amount, isPaid: data.is_paid ?? false },
          replace: true,
        });
      } else if (status === "PENDING") {
        localStorage.removeItem("upiPaymentPending");
        _navigationDone = true;
        navigate("/customer/app/failure", {
          state: { status: "pending", message: data.message || "Payment is being processed.", orderId: txnId, amount: paymentState.amount },
          replace: true,
        });
      } else if (status === "REFUNDED") {
        localStorage.removeItem("upiPaymentPending");
        _navigationDone = true;
        navigate("/customer/app/failure", {
          state: { status: "failed", message: data.message, orderId: txnId, amount: paymentState.amount, isPaid: true, isRefund: true },
          replace: true,
        });
      }
      // INITIATE/PAYMENT_INITIATE/NOT_FOUND - keep waiting for WebSocket
    } catch (e) {
      console.error("[UPI] Status-only check failed:", e);
    }
  }, [navigate, buildSuccessState, paymentState]);

  // Connect WebSocket for UPI Collect/Intent status updates
  const connectPaymentWebSocket = useCallback((txnId) => {
    const token = localStorage.getItem("customerSessionToken");
    if (!token || !txnId) return;

    // Cleanup existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    currentTxnIdRef.current = txnId;
    setUpiFlowActive(true);
    setWsConnected(false);

    wsRef.current = createPaymentWebSocket(
      txnId,
      token,
      // onMessage
      // NOTE: Do NOT call setUpiFlowActive(false) before navigate - keep overlay visible until navigation completes
      (data) => {
        if (data.status === "SUCCESS" && data.is_paid) {
          localStorage.removeItem("upiPaymentPending");
          if (!_navigationDone) {
            _navigationDone = true;
            navigate("/customer/app/success", {
              state: buildSuccessState(data, "upi", txnId),
              replace: true,
            });
          }
        } else if (["FAILED", "ERROR"].includes(data.status)) {
          localStorage.removeItem("upiPaymentPending");
          if (!_navigationDone) {
            _navigationDone = true;
            navigate("/customer/app/failure", {
              state: {
                status: "failed",
                message: data.message || "Payment failed",
                orderId: txnId,
                amount: paymentState.amount,
                type: paymentState.type,
                payType: "upi",
                isPaid: data.is_paid ?? false,
              },
              replace: true,
            });
          }
        } else if (data.status === "REFUND_INITIATED") {
          localStorage.removeItem("upiPaymentPending");
          if (!_navigationDone) {
            _navigationDone = true;
            navigate("/customer/app/failure", {
              state: {
                status: "failed",
                message: data.message || "Payment refund initiated",
                orderId: txnId,
                amount: paymentState.amount,
                type: paymentState.type,
                payType: "upi",
                isPaid: true,
                isRefund: true,
              },
              replace: true,
            });
          }
        } else if (data.status === "PENDING") {
          // Navigate to pending page
          localStorage.removeItem("upiPaymentPending");
          if (!_navigationDone) {
            _navigationDone = true;
            navigate("/customer/app/failure", {
              state: {
                status: "pending",
                message: data.message || "Payment is being processed. Please wait.",
                orderId: txnId,
                amount: paymentState.amount,
                type: paymentState.type,
                payType: "upi",
                isPaid: data.is_paid ?? false,
              },
              replace: true,
            });
          }
        }
      },
      // onError
      (error) => {
        console.error("WebSocket error:", error);
        setWsConnected(false);
      },
      // onClose
      () => {
        console.log("WebSocket closed");
        setWsConnected(false);
      },
      // onOpen
      () => {
        console.log("WebSocket connected");
        setWsConnected(true);
      },
      // onReconnect - check status via API when reconnected
      () => {
        console.log("[WS] Reconnected - checking status");
        checkStatusOnlyAndNavigate(txnId);
      },
      // onStatusPoll - called every 5s for continuous status polling (up to 60s)
      // NOTE: Do NOT call setUpiFlowActive(false) before navigate - keep overlay visible
      async (isFinal) => {
        console.log(`[WS] Status poll (final: ${isFinal}) - checking status`);
        await checkStatusOnlyAndNavigate(txnId);

        // If final poll (60s timeout) and still no navigation, show pending page
        if (isFinal && !_navigationDone) {
          console.log("[WS] 60s timeout reached - navigating to pending page");
          localStorage.removeItem("upiPaymentPending");
          _navigationDone = true;
          if (wsRef.current) {
            wsRef.current.terminate();
            wsRef.current = null;
          }
          navigate("/customer/app/failure", {
            state: {
              status: "pending",
              message: "Payment status could not be verified. Please check your transaction history.",
              orderId: txnId,
              amount: paymentState.amount,
              type: paymentState.type,
              payType: "upi",
            },
            replace: true,
          });
        }
      }
    );
  }, [navigate, buildSuccessState, paymentState, checkStatusOnlyAndNavigate]);

  // Open UPI deep link for native intent flow
  const openUpiIntent = async (upiUrl) => {
    const platform = Capacitor.getPlatform();

    // Method 1: Use Android native JavaScript interface
    if (platform === "android" && window.AndroidUpiIntent && typeof window.AndroidUpiIntent.openUpiUrl === "function") {
      try {
        const result = window.AndroidUpiIntent.openUpiUrl(upiUrl);
        console.log("UPI intent via Android native:", result);
        return result;
      } catch (e) {
        console.error("Android native UPI failed:", e);
      }
    }

    // Method 2: Use iOS Capacitor plugin
    if (platform === "ios") {
      try {
        const result = await openUpiUrlIOS(upiUrl);
        console.log("UPI intent via iOS native:", result);
        return result?.success ?? true;
      } catch (e) {
        console.error("iOS native UPI failed:", e);
        setStatus("No UPI app found. Please install a UPI app.");
        return false;
      }
    }

    // Method 3: Fallback to window.location.href (for mobile web browsers)
    try {
      window.location.href = upiUrl;
      console.log("UPI intent via location.href:", upiUrl);
      return true;
    } catch (e) {
      console.error("UPI intent failed:", e);
      setStatus("Could not open UPI app. Please try again.");
      return false;
    }
  };

  // Shared resolver for a UPI check-status response.
  // Returns true if it reached a terminal state and navigated; false if it left the
  // payment as still-in-progress (used by the auto-poll to keep waiting).
  // `auto` = true means this came from the background poll, so non-terminal statuses
  // (PENDING / not-yet-paid / transient) must NOT navigate away.
  const finalizePaymentStatus = useCallback((statusResponse, context, { auto = false } = {}) => {
    if (_navigationDone) return true;

    const payStatus = (statusResponse?.data?.status || "").toUpperCase();
    const isPaidVal = statusResponse?.data?.is_paid ?? statusResponse?.data?.isPaid ?? false;
    const failBase = {
      orderId: context.orderId,
      amount: context.amount,
      type: context.type,
      payType: "upi",
      mobile: context.mobile || context.field1,
      operatorName: context.operatorName,
      isPaid: isPaidVal,
    };

    const go = (path, state) => {
      localStorage.removeItem("upiPaymentPending"); // Clear UPI Intent pending state
      _navigationDone = true;
      setNativePaymentPending(false);
      paymentContextRef.current = null;
      navigate(path, { state });
    };

    // SUCCESS
    if (statusResponse?.success && (payStatus === "CHARGED" || payStatus === "SUCCESS" || payStatus === "COMPLETED")) {
      go("/customer/app/success", buildSuccessState(statusResponse.data, "upi", context.orderId, context));
      return true;
    }

    // REFUNDED — payment was collected then returned (terminal). The backend tells us
    // the actual destination (wallet vs original bank/UPI) in the message, so trust it
    // rather than assuming wallet here.
    if (payStatus === "REFUNDED" || payStatus === "REFUND" || payStatus === "REVERSAL" || payStatus === "CANCELLED") {
      go("/customer/app/failure", {
        ...failBase,
        status: "failed",
        isPaid: true,
        message: statusResponse?.data?.message || "This payment did not go through and the amount has been refunded.",
      });
      return true;
    }

    // FAILED (terminal)
    if (payStatus === "FAILED" || payStatus === "FAILURE") {
      go("/customer/app/failure", {
        ...failBase,
        status: "failed",
        message: "Payment could not be completed. If money was deducted, it will be refunded within 24-48 hours.",
      });
      return true;
    }

    // Non-terminal (PENDING / STARTED / not-yet-paid / transient): the background
    // poll keeps waiting; only an explicit user verify resolves it below.
    if (auto) return false;

    if (payStatus === "PENDING" || payStatus === "PENDING_VBG" || payStatus === "STARTED" || payStatus === "AUTHORIZING") {
      go("/customer/app/failure", {
        ...failBase,
        status: "pending",
        message: "Your payment is being processed. Please check your transaction history for the latest status.",
      });
      return true;
    }

    go("/customer/app/failure", {
      ...failBase,
      status: "failed",
      message: "Payment could not be completed. If money was deducted, it will be refunded within 24-48 hours.",
    });
    return true;
  }, [buildSuccessState, navigate]);

  // Handle payment callback from deep link (native apps)
  const handlePaymentCallback = useCallback(async (url) => {
    console.log("Payment callback received:", url);

    // Prevent multiple status checks
    if (_statusCheckCalled) {
      console.log("Status check already called, skipping...");
      return;
    }
    _statusCheckCalled = true;

    // Close the browser
    try {
      await Browser.close();
    } catch (e) {
      console.log("Browser close error (may already be closed):", e);
    }

    setNativePaymentPending(false);
    setLoading(true);

    // Get the payment context
    const context = await juspayService.getPaymentContext();
    if (!context) {
      setLoading(false);
      setStatus("Payment session expired. Please try again.");
      return;
    }

    // Extract order_id from URL if present
    let orderId = context.orderId;
    try {
      const urlObj = new URL(url.replace("vasbazaar://", "https://dummy.com/"));
      orderId = urlObj.searchParams.get("order_id") || urlObj.searchParams.get("orderId") || orderId;
    } catch (e) {
      console.log("URL parse error:", e);
    }

    // Check payment status
    try {
      const statusResponse = await juspayService.checkOrderStatus(orderId);
      setLoading(false);

      // Prevent multiple navigations
      if (_navigationDone) {
        console.log("Navigation already done, skipping");
        return;
      }

      finalizePaymentStatus(statusResponse, { ...context, orderId }, { auto: false });
    } catch (e) {
      setLoading(false);
      // Prevent multiple navigations
      if (_navigationDone) {
        console.log("Navigation already done, skipping");
        return;
      }
      _navigationDone = true;
      // Navigate to failure page on error
      navigate("/customer/app/failure", {
        state: {
          status: "failed",
          message: "Unable to verify payment status. Please check your transaction history.",
          orderId: context?.orderId,
          amount: context?.amount,
          type: context?.type,
          isPaid: false,
        },
      });
    }
  }, [finalizePaymentStatus, navigate]);

  useEffect(() => {
    const load = async () => {
      const profile = await userService.getUserProfile();
      if (profile.success) {
        const raw = profile.data;
        const bal = parseFloat(raw?.balance ?? raw?.walletBalance ?? 0);
        setWalletBalance(isNaN(bal) ? 0 : bal);
      }

      // Check for pending UPI payment on app resume (UPI Intent flow only)
      // CRITICAL: If pending payment exists, immediately check status and navigate
      // DO NOT show payment selection screen at all
      const pendingPayment = localStorage.getItem("upiPaymentPending");
      if (pendingPayment) {
        try {
          const parsed = JSON.parse(pendingPayment);

          // Check if not expired (10 minutes)
          if (parsed.txnId && Date.now() - parsed.startTime < 10 * 60 * 1000) {
            console.log("[UPI] Found pending payment, checking status immediately:", parsed.txnId);

            // Immediately check status and navigate - don't show payment screen
            try {
              const statusResponse = await rechargeService.checkStatusOnly(parsed.txnId);
              const status = (statusResponse?.data?.status || "").toUpperCase();
              const data = statusResponse?.data || {};

              console.log("[UPI] Pending payment status:", status);
              localStorage.removeItem("upiPaymentPending");

              if (status === "SUCCESS") {
                _navigationDone = true;
                navigate("/customer/app/success", {
                  state: buildSuccessState(data, "upi", parsed.txnId),
                  replace: true,
                });
                return;
              } else if (status === "FAILED") {
                _navigationDone = true;
                navigate("/customer/app/failure", {
                  state: { status: "failed", message: data.message || "Payment failed", orderId: parsed.txnId, amount: parsed.amount, isPaid: data.is_paid ?? false },
                  replace: true,
                });
                return;
              } else if (status === "PENDING") {
                _navigationDone = true;
                navigate("/customer/app/failure", {
                  state: { status: "pending", message: data.message || "Payment is being processed.", orderId: parsed.txnId, amount: parsed.amount },
                  replace: true,
                });
                return;
              } else if (status === "REFUNDED") {
                _navigationDone = true;
                navigate("/customer/app/failure", {
                  state: { status: "failed", message: data.message, orderId: parsed.txnId, amount: parsed.amount, isPaid: true, isRefund: true },
                  replace: true,
                });
                return;
              }
              // INITIATE/PAYMENT_INITIATE - payment still in progress, connect WebSocket
              console.log("[UPI] Payment still in progress, connecting WebSocket");
              setCheckingPendingPayment(false);
              setUpiFlowActive(true);
              setReady(true);
              connectPaymentWebSocket(parsed.txnId);
              return;
            } catch (e) {
              console.error("[UPI] Status check failed, connecting WebSocket:", e);
              // On error, still try WebSocket
              setCheckingPendingPayment(false);
              setUpiFlowActive(true);
              setReady(true);
              connectPaymentWebSocket(parsed.txnId);
              return;
            }
          } else {
            // Expired, clear it
            console.log("[UPI] Pending payment expired, clearing");
            localStorage.removeItem("upiPaymentPending");
            setCheckingPendingPayment(false);
          }
        } catch (e) {
          console.error("[UPI] Failed to parse pending payment:", e);
          localStorage.removeItem("upiPaymentPending");
          setCheckingPendingPayment(false);
        }
      }

      setReady(true);
    };
    load();

    // Listen for deep link callback on native platforms
    let appUrlListener = null;
    if (Capacitor.isNativePlatform()) {
      appUrlListener = App.addListener("appUrlOpen", (event) => {
        console.log("App URL opened:", event.url);
        if (event.url && event.url.startsWith("vasbazaar://payment-callback")) {
          handlePaymentCallback(event.url);
        }
      });
    }

    return () => {
      if (appUrlListener) {
        appUrlListener.remove();
      }
      // Cleanup WebSocket on unmount
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [handlePaymentCallback, connectPaymentWebSocket]);

  // While the "Payment In Progress" overlay is shown, poll the backend so the screen
  // resolves itself (success / refunded / failed) even if the user never taps verify —
  // e.g. when the payment was already settled or refunded to the wallet out-of-band.
  useEffect(() => {
    if (!nativePaymentPending) return undefined;
    let cancelled = false;
    const tick = async () => {
      const context = paymentContextRef.current;
      if (!context || _navigationDone) return;
      try {
        const statusResponse = await juspayService.checkOrderStatus(context.orderId);
        if (cancelled || _navigationDone) return;
        finalizePaymentStatus(statusResponse, context, { auto: true });
      } catch (e) {
        // Transient error — the next tick retries.
      }
    };
    const intervalId = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [nativePaymentPending, finalizePaymentStatus]);

  if (!paymentState.amount) return <Navigate to="/customer/app/services" replace />;

  // Show loading screen while checking pending UPI payment status
  // This prevents the payment selection screen from showing briefly
  if (checkingPendingPayment) {
    return (
      <div className="xpay" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <FaSpinner className="spin" style={{ fontSize: "32px", color: "#4CAF50", marginBottom: "16px" }} />
          <p style={{ color: "#fff", fontSize: "14px" }}>Checking payment status...</p>
        </div>
      </div>
    );
  }

  const proceed = async (payType) => {
    // Reset flags for new payment
    resetPaymentFlags();

    setLoading(true); setStatus("");

    // Pre-open window synchronously for PWA standalone (Safari blocks async window.open as popup)
    let pwaWindow = null;
    if (payType === "upi" && !Capacitor.isNativePlatform() && isPwaStandalone()) {
      pwaWindow = window.open("about:blank", "_blank");
    }

    const payload = paymentState.type === "bill"
      ? { amount, operatorId: Number(paymentState.operatorId), validity: 30, payType, mobile: paymentState.field1, name: "Customer", field1: paymentState.field1, field2: paymentState.field2, viewBillResponse: paymentState.viewBillResponse || {} }
      : { amount, operatorId: Number(paymentState.operatorId), validity: Number.parseInt(String(paymentState.validity).replace(/\D/g, ""), 10) || 30, payType, mobile: paymentState.mobile, name: "Customer", field1: paymentState.mobile, field2: null, viewBillResponse: {} };

    if (paymentState.couponId) {
      payload.couponId = paymentState.couponId;
      payload.couponId1 = paymentState.couponId;
    }
    if (paymentState.couponCode) {
      payload.couponCode = paymentState.couponCode;
      payload.couponId2 = paymentState.couponCode;
    }
    if (paymentState.couponName) {
      payload.couponName = paymentState.couponName;
    }
    if (paymentState.couponDesc) {
      payload.couponDesc = paymentState.couponDesc;
    }

    // Gateway is chosen backend-side from `platform` (set inside rechargeWithJuspay):
    //   native app → HDFC UPI Intent (upi:// deep link) ; web → HDFC SmartGateway page.
    // No UPI Collect params are sent — the SmartGateway hosted page handles UPI itself.
    const isNative = Capacitor.isNativePlatform();
    const isMobileWeb = !isNative && isMobileWebBrowser();

    // For UPI, use Juspay/HDFC gateway; for wallet, use direct recharge
    const rechargeCall = payType === "upi"
      ? juspayService.rechargeWithJuspay(payload)
      : rechargeService.recharge(payload);

    const response = await rechargeCall;
    if (!response.success) { if (pwaWindow) pwaWindow.close(); setLoading(false); setStatus(response.message || "Payment could not be processed."); return; }

    // Handle UPI response patterns
    if (payType === "upi") {
      const txnId = juspayService.extractOrderId(response) || response.data?.requestId;
      const hash = response.data?.hash;
      const paymentUrl = juspayService.extractPaymentUrl(response);

      // === PATTERN 3: UPI Intent/QR (hash = upi://...) ===
      if (hash && hash.startsWith("upi://")) {
        setLoading(false);

        if (isNative) {
          // Save UPI payment context for app resume (SEPARATE from SmartGateway context)
          const upiPaymentState = {
            txnId,
            amount: paymentState.amount,
            type: paymentState.type,
            label: paymentState.label,
            operatorName: paymentState.operatorName,
            serviceId: paymentState.serviceId,
            startTime: Date.now(),
          };
          localStorage.setItem("upiPaymentPending", JSON.stringify(upiPaymentState));
          console.log("[UPI] Saved payment state to localStorage:", txnId);

          // Native app: Open UPI deep link via Capacitor
          const opened = await openUpiIntent(hash);
          if (opened) {
            connectPaymentWebSocket(txnId);
          } else {
            // Intent failed to open, clear localStorage
            localStorage.removeItem("upiPaymentPending");
          }
        } else if (isMobileWeb) {
          // Mobile web browser: Open UPI URL directly (browser shows app chooser)
          connectPaymentWebSocket(txnId);
          setUpiFlowActive(true);
          window.location.href = hash;
        } else {
          // Desktop web: Show QR code for user to scan
          setQrCodeUrl(hash);
          setQrTxnId(txnId);
          setShowQrCode(true);
          connectPaymentWebSocket(txnId);
        }
        return;
      }

      // === PATTERN 1: SmartGateway hosted page (web) / redirect flow ===
      if (paymentUrl) {
        const orderId = juspayService.extractOrderId(response);
        const paymentContext = {
          orderId,
          amount: paymentState.amount,
          type: paymentState.type,
          label: paymentState.label,
          mobile: paymentState.mobile || paymentState.field1,
          operatorName: paymentState.operatorName,
          operatorId: paymentState.operatorId,
          logo: paymentState.logo,
          couponCode: paymentState.couponCode || null,
          couponName: paymentState.couponName || null,
          couponDesc: paymentState.couponDesc || null,
          discountValue: paymentState.discountValue || 0,
          cashbackValue: paymentState.cashbackValue || 0,
          offerType: paymentState.offerType || null,
          field1: paymentState.field1 || paymentState.mobile || "",
          field2: paymentState.field2 || null,
          validity: paymentState.validity || null,
          viewBillResponse: paymentState.viewBillResponse || {},
          serviceId: paymentState.serviceId || null,
        };
        await juspayService.savePaymentContext(paymentContext);

        // For native apps, open payment URL in in-app browser (Chrome Custom Tabs / Safari ViewController)
        if (Capacitor.isNativePlatform()) {
          if (!paymentUrl) {
            setLoading(false);
            setStatus("Payment URL not received. Please try again.");
            return;
          }

          setLoading(false);
          setNativePaymentPending(true);
          paymentContextRef.current = paymentContext;

          try {
            // Open in Chrome Custom Tabs (Android) / Safari ViewController (iOS)
            await Browser.open({
              url: paymentUrl,
              presentationStyle: "fullscreen",
              toolbarColor: "#1A1A1A",
            });
          } catch (e) {
            console.error("Browser open error:", e);
            setNativePaymentPending(false);
            setStatus("Could not open payment page. Please try again.");
          }
          return;
        }

        // PWA standalone: navigate the pre-opened window to payment URL
        if (isPwaStandalone()) {
          setLoading(false);
          setNativePaymentPending(true);
          paymentContextRef.current = paymentContext;

          if (pwaWindow && !pwaWindow.closed) {
            pwaWindow.location.href = paymentUrl;
          } else {
            // Fallback: redirect in same window if pre-opened window was blocked
            window.location.href = paymentUrl;
          }
          return;
        }

        // Regular browser: redirect to payment URL
        window.location.href = paymentUrl;
        return;
      }
    }

    // Direct flow (wallet or UPI without redirect)
    // Backend returns requestId as the txnId in RechargeResult_DTO
    const txnId = response.data?.requestId || response.data?.txnId || response.data?.txnid || response.data?.transactionId || response.raw?.data?.requestId || response.raw?.data?.txnId || `VB${Date.now()}`;

    // Prevent multiple status checks - CRITICAL: only ONE call allowed
    if (_statusCheckCalled) {
      console.log("Status check already called, skipping");
      return;
    }
    _statusCheckCalled = true;

    // ALWAYS wait for status check to complete before showing any result
    const statusResponse = await rechargeService.checkRechargeStatus({ txnId, field1: payload.field1, field2: payload.field2, validity: payload.validity, recharge: true, viewBillResponse: payload.viewBillResponse });
    setLoading(false);

    // CRITICAL: Only navigate AFTER status check completes, and only ONCE
    if (_navigationDone) {
      console.log("Navigation already done, skipping");
      return;
    }
    _navigationDone = true;

    const rechargeStatus = (statusResponse.data?.status || statusResponse.raw?.Status || "").toUpperCase();

    if (rechargeStatus === "SUCCESS") {
      navigate("/customer/app/success", {
        state: buildSuccessState(statusResponse.data || response.data, payType, txnId),
      });
    } else if (rechargeStatus === "PENDING" || rechargeStatus === "PROCESSING" || rechargeStatus === "INITIATED") {
      navigate("/customer/app/failure", {
        state: {
          status: "pending",
          message: statusResponse.data?.message || "Your recharge is being processed. Please check your transaction history for the latest status.",
          txnId,
          orderId: txnId,
          amount: payload.amount,
          type: paymentState.type,
          payType,
          mobile: paymentState.mobile || paymentState.field1,
          operatorName: paymentState.operatorName || paymentState.label,
          isPaid: statusResponse.data?.is_paid ?? statusResponse.data?.isPaid ?? false,
        },
      });
    } else {
      navigate("/customer/app/failure", {
        state: {
          status: "failed",
          message: statusResponse.data?.message || statusResponse.message || "Recharge could not be completed. If money was deducted from your wallet, it will be refunded.",
          txnId,
          orderId: txnId,
          amount: payload.amount,
          type: paymentState.type,
          payType,
          mobile: paymentState.mobile || paymentState.field1,
          operatorName: paymentState.operatorName || paymentState.label,
          isPaid: statusResponse.data?.is_paid ?? statusResponse.data?.isPaid ?? false,
        },
      });
    }
  };

  // Handle manual check of payment status (for native apps when user returns)
  const handleCheckPaymentStatus = async () => {
    if (!paymentContextRef.current) {
      setStatus("No pending payment found.");
      return;
    }

    // Prevent multiple status checks
    if (_statusCheckCalled) {
      console.log("Status check already called, skipping...");
      return;
    }
    _statusCheckCalled = true;

    setLoading(true);
    try {
      const context = paymentContextRef.current;
      const statusResponse = await juspayService.checkOrderStatus(context.orderId);
      setLoading(false);

      // CRITICAL: Only navigate AFTER status check completes, and only ONCE
      if (_navigationDone) {
        console.log("Navigation already done, skipping");
        return;
      }

      finalizePaymentStatus(statusResponse, context, { auto: false });
    } catch (e) {
      setLoading(false);
      // Prevent multiple navigations
      if (_navigationDone) {
        console.log("Navigation already done, skipping");
        return;
      }
      _navigationDone = true;
      navigate("/customer/app/failure", {
        state: {
          status: "failed",
          message: "Unable to verify payment status. Please check your transaction history.",
          isPaid: false,
        },
      });
    }
  };

  const mobile = paymentState.mobile || paymentState.field1 || "";
  const label = paymentState.label || "Recharge";
  const opName = paymentState.operatorName || paymentState.contactName || label;
  const logo = paymentState.logo || "";

  return (
    <div className="xpay">
      {/* Background elements */}
      <div className="xpay-bg">
        <div className="xpay-orb xpay-orb--1" />
        <div className="xpay-orb xpay-orb--2" />
      </div>

      {/* Header */}
      <div className="xpay-header">
        <button className="xpay-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="xpay-title">Payment</h1>
        <img src="/images/bbps.svg" alt="Bharat Connect" className="xpay-bc-logo" />
      </div>

      {/* Operator info */}
      <div className={`xpay-op${ready ? " xpay-in" : ""}`}>
        <img src={logo || FALLBACK_LOGO} alt="" className="xpay-op-logo" onError={handleLogoError} />
        <div className="xpay-op-info">
          <div className="xpay-op-name">{opName}</div>
          <div className="xpay-op-detail">{mobile || ""}{mobile && label ? " · " : ""}{label}</div>
        </div>
      </div>

      {/* Amount section */}
      <div className={`xpay-hero${ready ? " xpay-in xpay-d1" : ""}`}>
        <div className="xpay-hero-glow" />
        <h2 className="xpay-hero-label">Transaction Amount</h2>
        <div className="xpay-hero-amount">₹{amount}</div>
        <div className="xpay-hero-words">{numberToWords(amount)}</div>
      </div>

      {/* Payment methods */}
      <div className={`xpay-methods${ready ? " xpay-in xpay-d2" : ""}`}>

        {/* UPI */}
        <div className={`xpay-method${selectedMethod === "upi" ? " is-active" : ""}`} onClick={() => setSelectedMethod("upi")}>
          <div className="xpay-method-radio">{selectedMethod === "upi" && <FaCheckCircle />}</div>
          <div className="xpay-method-icon xpay-method-icon--upi"><FiCreditCard /></div>
          <div className="xpay-method-body">
            <div className="xpay-method-name">UPI</div>
            <div className="xpay-method-sub">Pay instantly via any UPI app</div>
          </div>
          {selectedMethod === "upi" && <span className="xpay-tag">Recommended</span>}
        </div>

        {/* Wallet */}
        <div className={`xpay-method${selectedMethod === "wallet" ? " is-active" : ""}${!canPayWallet ? " is-disabled" : ""}`} onClick={() => canPayWallet && setSelectedMethod("wallet")}>
          <div className="xpay-method-radio">{selectedMethod === "wallet" && <FaCheckCircle />}</div>
          <div className="xpay-method-icon xpay-method-icon--wallet"><FaWallet /></div>
          <div className="xpay-method-body">
            <div className="xpay-method-name">Wallet</div>
            <div className="xpay-method-sub">Balance: ₹{walletBalance.toFixed(2)}</div>
          </div>
          {!canPayWallet && <span className="xpay-tag xpay-tag--low">Low Balance</span>}
        </div>
      </div>

      {/* Error */}
      {status && (
        <div className="xpay-error xpay-in" style={status.toLowerCase().includes("kyc") ? { display: "flex", alignItems: "center", justifyContent: "space-between" } : {}}>
          {status.toLowerCase().includes("kyc") ? "KYC verification required." : status}
          {status.toLowerCase().includes("kyc") && (
            <button
              type="button"
              className="xpay-kyc-btn"
              onClick={() => navigate("/customer/app/kyc")}
            >
              Complete KYC
            </button>
          )}
        </div>
      )}

      {/* Pay button */}
      <div className={`xpay-footer${ready ? " xpay-in xpay-d3" : ""}`}>
        <button
          type="button"
          className="xpay-pay-btn"
          disabled={loading || upiFlowActive}
          onClick={() => {
            // Payment surface decides the gateway (wired backend-side by `platform`):
            // - Native app (Android/iOS) → HDFC UPI Intent (upi:// deep link → app chooser)
            // - Web / browser (mobile or desktop) → HDFC SmartGateway hosted page (redirect)
            // Wallet always pays directly. In every case we just proceed — no UPI-ID
            // collect modal, since the SmartGateway page collects UPI/card itself.
            proceed(selectedMethod);
          }}
        >
          {loading ? (
            <span className="xpay-pay-loading"><span className="xpay-spinner" /> Processing...</span>
          ) : (
            <>
              <FaLock className="xpay-pay-lock" />
              Pay via {selectedMethod === "upi" ? "UPI" : "Wallet"}
            </>
          )}
        </button>
        <div className="xpay-secure">
          <FaShieldAlt /> Secured & encrypted by VasBazaar
        </div>
      </div>

      {/* Native payment pending overlay */}
      {nativePaymentPending && (
        <div className="xpay-webview-overlay">
          <div className="xpay-webview-header">
            <button type="button" className="xpay-webview-close" onClick={() => { setNativePaymentPending(false); paymentContextRef.current = null; }} disabled={loading}>
              <FaTimes />
            </button>
            <span className="xpay-webview-title">Payment In Progress</span>
            <div className="xpay-webview-amount">₹{paymentContextRef.current?.amount || finalAmount}</div>
          </div>
          <div className="xpay-native-pending">
            <div className="xpay-native-pending-icon">
              <FiCreditCard />
            </div>
            <h3>Complete your payment</h3>
            <p>A payment window has been opened. Complete your payment there and tap the button below to verify.</p>
            {status && <div className="xpay-native-pending-status">{status}</div>}
          </div>
          <div className="xpay-webview-footer">
            <button type="button" className="xpay-webview-done" onClick={handleCheckPaymentStatus} disabled={loading}>
              {loading ? "Checking payment status..." : "I've completed the payment"}
            </button>
          </div>
        </div>
      )}

      {/* UPI ID Modal for Web (UPI Collect flow) */}
      {showUpiModal && (
        <div className="upi-modal-overlay" onClick={() => setShowUpiModal(false)}>
          <div className="upi-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="upi-modal-title">Enter UPI ID</h3>
            <p className="upi-modal-subtitle">Pay using your UPI ID</p>

            <input
              type="text"
              className="upi-modal-input"
              placeholder="yourname@upi"
              value={upiId}
              onChange={(e) => {
                setUpiId(e.target.value);
                setUpiError("");
              }}
              autoFocus
            />

            {upiError && <p className="upi-modal-error">{upiError}</p>}

            <div className="upi-modal-actions">
              <button
                type="button"
                className="upi-modal-btn upi-modal-btn--cancel"
                onClick={() => {
                  setShowUpiModal(false);
                  setUpiId("");
                  setUpiError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="upi-modal-btn upi-modal-btn--pay"
                onClick={() => {
                  if (!validateUpiId(upiId)) {
                    setUpiError("Enter valid UPI ID (e.g. name@bank)");
                    return;
                  }
                  setShowUpiModal(false);
                  proceed("upi");
                }}
              >
                Pay ₹{amount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Overlay for Web UPI */}
      {showQrCode && qrCodeUrl && (
        <div className="upi-qr-overlay">
          <div className="upi-qr-modal">
            <button
              type="button"
              className="upi-qr-close"
              onClick={() => {
                setShowQrCode(false);
                setQrCodeUrl("");
                setQrTxnId("");
                setUpiFlowActive(false);
                if (wsRef.current) {
                  wsRef.current.close();
                  wsRef.current = null;
                }
              }}
            >
              <FaTimes />
            </button>

            <h3 className="upi-qr-title">Scan to Pay</h3>
            <p className="upi-qr-amount">₹{amount}</p>

            <div className="upi-qr-code-wrapper">
              <QRCodeSVG
                value={qrCodeUrl}
                size={200}
                level="M"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>

            <p className="upi-qr-instruction">
              Open any UPI app on your phone and scan this QR code to pay
            </p>

            <div className="upi-qr-status">
              <FaSpinner className="spin" />
              <span>Waiting for payment...</span>
            </div>

            <p className="upi-qr-txn">Order ID: {qrTxnId}</p>
          </div>
        </div>
      )}

      {/* UPI Flow Waiting Overlay (WebSocket status) */}
      {upiFlowActive && (
        <div className="xpay-webview-overlay">
          <div className="xpay-webview-header">
            <button
              type="button"
              className="xpay-webview-close"
              onClick={() => {
                console.log("[UPI] User cancelled waiting overlay");
                localStorage.removeItem("upiPaymentPending");
                setUpiFlowActive(false);
                setWsConnected(false);
                if (wsRef.current) {
                  wsRef.current.terminate();
                  wsRef.current = null;
                }
              }}
            >
              <FaTimes />
            </button>
            <span className="xpay-webview-title">UPI Payment</span>
            <div className="xpay-webview-amount">₹{paymentState.amount || finalAmount}</div>
          </div>
          <div className="xpay-native-pending">
            {/* WebSocket connection indicator */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginBottom: "12px",
              fontSize: "12px",
              color: wsConnected ? "#4CAF50" : "#f44336"
            }}>
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: wsConnected ? "#4CAF50" : "#f44336"
              }} />
              {wsConnected ? "Connected" : "Connecting..."}
            </div>

            <div className="xpay-native-pending-icon">
              <FaSpinner className="spin" />
            </div>
            <h3>Waiting for payment...</h3>
            <p>Complete payment in your UPI app</p>
            {status && <div className="xpay-native-pending-status">{status}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentScreen;
