import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaWallet, FaShieldAlt, FaLock, FaCheckCircle, FaTimes } from "react-icons/fa";
import { FiCreditCard } from "react-icons/fi";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { userService } from "../services/userService";
import { rechargeService } from "../services/rechargeService";
import juspayService, { isPwaStandalone } from "../services/juspayService";

const FALLBACK_LOGO = "/assets/images/Brand_favicon.png";
const handleLogoError = (e) => { e.target.onerror = null; e.target.src = FALLBACK_LOGO; };

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

  // Handle payment callback from deep link (native apps)
  const handlePaymentCallback = useCallback(async (url) => {
    console.log("Payment callback received:", url);

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

      const payStatus = (statusResponse.data?.status || "").toUpperCase();
      if (statusResponse.success && (payStatus === "CHARGED" || payStatus === "SUCCESS" || payStatus === "COMPLETED")) {
        // Payment successful
        navigate("/customer/app/success", {
          state: buildSuccessState(statusResponse.data, "upi", orderId, context),
        });
      } else if (payStatus === "PENDING" || payStatus === "PENDING_VBG" || payStatus === "STARTED" || payStatus === "AUTHORIZING") {
        // Navigate to failure page with pending status
        navigate("/customer/app/failure", {
          state: {
            status: "pending",
            message: "Your payment is being processed. Please check your transaction history for the latest status.",
            orderId,
            amount: context.amount,
            type: context.type,
            payType: "upi",
          },
        });
      } else {
        // Navigate to failure page
        navigate("/customer/app/failure", {
          state: {
            status: "failed",
            message: "Payment could not be completed. If money was deducted, it will be refunded within 24-48 hours.",
            orderId,
            amount: context.amount,
            type: context.type,
            payType: "upi",
          },
        });
      }
    } catch (e) {
      setLoading(false);
      // Navigate to failure page on error
      navigate("/customer/app/failure", {
        state: {
          status: "failed",
          message: "Unable to verify payment status. Please check your transaction history.",
          orderId: context?.orderId,
          amount: context?.amount,
          type: context?.type,
        },
      });
    }
  }, [buildSuccessState, navigate]);

  useEffect(() => {
    const load = async () => {
      const profile = await userService.getUserProfile();
      if (profile.success) {
        const raw = profile.data;
        const bal = parseFloat(raw?.balance ?? raw?.walletBalance ?? 0);
        setWalletBalance(isNaN(bal) ? 0 : bal);
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
    };
  }, [handlePaymentCallback]);

  if (!paymentState.amount) return <Navigate to="/customer/app/services" replace />;

  const proceed = async (payType) => {
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

    // For UPI, use Juspay redirect flow
    const rechargeCall = payType === "upi"
      ? juspayService.rechargeWithJuspay(payload)
      : rechargeService.recharge(payload);

    const response = await rechargeCall;
    if (!response.success) { if (pwaWindow) pwaWindow.close(); setLoading(false); setStatus(response.message || "Payment could not be processed."); return; }

    // Check if Juspay returned a payment URL (UPI redirect flow)
    if (payType === "upi") {
      const paymentUrl = juspayService.extractPaymentUrl(response);
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

    // First check the recharge response itself — backend returns data.status with actual result
    const initialStatus = (response.data?.status || "").toUpperCase();
    const isInitialFailed = ["FAILED", "FAILURE", "REFUND", "REFUNDED", "ERROR"].includes(initialStatus);
    const isInitialPending = ["PENDING", "PROCESSING", "INITIATED"].includes(initialStatus);

    if (isInitialFailed) {
      setLoading(false);
      navigate("/customer/app/failure", {
        state: {
          status: "failed",
          message: response.data?.message || "Recharge could not be completed. If money was deducted from your wallet, it will be refunded.",
          txnId,
          orderId: txnId,
          amount: payload.amount,
          type: paymentState.type,
          payType,
        },
      });
      return;
    }

    if (isInitialPending) {
      setLoading(false);
      navigate("/customer/app/failure", {
        state: {
          status: "pending",
          message: response.data?.message || "Your recharge is being processed. Please check your transaction history for the latest status.",
          txnId,
          orderId: txnId,
          amount: payload.amount,
          type: paymentState.type,
          payType,
        },
      });
      return;
    }

    // If initial status looks successful, verify with check-status
    const statusResponse = await rechargeService.checkRechargeStatus({ txnId, field1: payload.field1, field2: payload.field2, validity: payload.validity, recharge: true, viewBillResponse: payload.viewBillResponse });
    setLoading(false);

    const rechargeStatus = (statusResponse.data?.status || statusResponse.raw?.Status || "").toUpperCase();
    const isSuccess = rechargeStatus === "SUCCESS" || (rechargeStatus === "" && initialStatus === "SUCCESS");

    if (isSuccess) {
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

    setLoading(true);
    try {
      const context = paymentContextRef.current;
      const statusResponse = await juspayService.checkOrderStatus(context.orderId);
      setLoading(false);

      const payStatus = (statusResponse.data?.status || "").toUpperCase();
      if (statusResponse.success && (payStatus === "CHARGED" || payStatus === "SUCCESS" || payStatus === "COMPLETED")) {
        setNativePaymentPending(false);
        navigate("/customer/app/success", {
          state: buildSuccessState(statusResponse.data, "upi", context.orderId, context),
        });
      } else if (payStatus === "PENDING" || payStatus === "PENDING_VBG" || payStatus === "STARTED" || payStatus === "AUTHORIZING") {
        setNativePaymentPending(false);
        navigate("/customer/app/failure", {
          state: {
            status: "pending",
            message: "Your payment is being processed. Please check your transaction history for the latest status.",
            orderId: context.orderId,
            amount: context.amount,
            type: context.type,
            payType: "upi",
          },
        });
      } else {
        setNativePaymentPending(false);
        paymentContextRef.current = null;
        navigate("/customer/app/failure", {
          state: {
            status: "failed",
            message: "Payment could not be completed. If money was deducted, it will be refunded within 24-48 hours.",
            orderId: context.orderId,
            amount: context.amount,
            type: context.type,
            payType: "upi",
          },
        });
      }
    } catch (e) {
      setLoading(false);
      navigate("/customer/app/failure", {
        state: {
          status: "failed",
          message: "Unable to verify payment status. Please check your transaction history.",
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
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="xpay-bc-logo" />
      </div>

      {/* Amount hero */}
      <div className={`xpay-hero${ready ? " xpay-in" : ""}`}>
        <div className="xpay-hero-glow" />
        <div className="xpay-hero-amount">₹{finalAmount}</div>
        <div className="xpay-hero-words">{numberToWords(finalAmount)}</div>
        {discount > 0 && (
          <div className="xpay-hero-discount">
            <span className="xpay-hero-original">₹{amount}</span>
          </div>
        )}
      </div>

      {/* Operator info */}
      <div className={`xpay-op${ready ? " xpay-in xpay-d1" : ""}`}>
        <img src={logo || FALLBACK_LOGO} alt="" className="xpay-op-logo" onError={handleLogoError} />
        <div className="xpay-op-info">
          <div className="xpay-op-name">{opName}</div>
          <div className="xpay-op-detail">{mobile ? `+91 ${mobile}` : ""}{mobile && label ? " · " : ""}{label}</div>
        </div>
        {/* Coupon badge removed — coupon eligibility confirmed only after success */}
      </div>

      {/* Payment methods */}
      <div className={`xpay-methods${ready ? " xpay-in xpay-d2" : ""}`}>
        <h2 className="xpay-methods-label">Select Payment Method</h2>

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
          disabled={loading}
          onClick={() => proceed(selectedMethod)}
        >
          {loading ? (
            <span className="xpay-pay-loading"><span className="xpay-spinner" /> Processing...</span>
          ) : (
            <>
              <FaLock className="xpay-pay-lock" />
              Pay ₹{finalAmount} via {selectedMethod === "upi" ? "UPI" : "Wallet"}
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
    </div>
  );
};

export default PaymentScreen;
