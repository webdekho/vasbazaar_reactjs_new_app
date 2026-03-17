import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaWallet, FaShieldAlt, FaLock, FaCheckCircle } from "react-icons/fa";
import { FiZap, FiCreditCard } from "react-icons/fi";
import { userService } from "../services/userService";
import { rechargeService } from "../services/rechargeService";

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
  const paymentState = location.state || {};
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [ready, setReady] = useState(false);

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
  }, []);

  if (!paymentState.amount) return <Navigate to="/customer/app/services" replace />;

  const amount = Number(paymentState.amount);
  const discount = Number(paymentState.discountValue || 0);
  const finalAmount = Math.max(0, amount - discount);
  const canPayWallet = walletBalance >= finalAmount;

  const proceed = async (payType) => {
    setLoading(true); setStatus("");
    const payload = paymentState.type === "bill"
      ? { amount, operatorId: Number(paymentState.operatorId), validity: 30, payType, mobile: paymentState.field1, name: "Customer", field1: paymentState.field1, field2: paymentState.field2, viewBillResponse: paymentState.viewBillResponse || {} }
      : { amount, operatorId: Number(paymentState.operatorId), validity: Number.parseInt(String(paymentState.validity).replace(/\D/g, ""), 10) || 30, payType, mobile: paymentState.mobile, name: "Customer", field1: paymentState.mobile, field2: null, viewBillResponse: {} };

    if (paymentState.couponId) payload.couponId = paymentState.couponId;
    if (paymentState.couponCode) payload.couponCode = paymentState.couponCode;

    const response = await rechargeService.recharge(payload);
    if (!response.success) { setLoading(false); setStatus(response.message || "Payment could not be processed."); return; }
    const txnId = response.data?.txnId || response.data?.txnid || response.data?.transactionId || response.raw?.data?.txnId || `VB${Date.now()}`;
    const statusResponse = await rechargeService.checkRechargeStatus({ txnId, field1: payload.field1, field2: payload.field2, validity: payload.validity, recharge: true, viewBillResponse: payload.viewBillResponse });
    setLoading(false);
    navigate("/customer/app/success", { state: {
      type: paymentState.type, amount: paymentState.amount, label: paymentState.label,
      txnId, statusPayload: statusResponse.data || response.data, paymentType: payType,
      couponCode: paymentState.couponCode || null,
      couponName: paymentState.couponName || null,
      discountValue: paymentState.discountValue || 0,
      cashbackValue: paymentState.cashbackValue || 0,
      offerType: paymentState.offerType || null,
    } });
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
            <span className="xpay-hero-save">You save ₹{discount.toFixed(0)}</span>
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
      {status && <div className="xpay-error xpay-in">{status}</div>}

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
    </div>
  );
};

export default PaymentScreen;
