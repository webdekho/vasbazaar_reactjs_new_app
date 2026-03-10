import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { userService } from "../services/userService";
import { rechargeService } from "../services/rechargeService";

const PaymentScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentState = location.state || {};
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    const load = async () => {
      const profile = await userService.getUserProfile();
      if (profile.success) setWalletBalance(Number(profile.data?.balance || 0));
    };
    load();
  }, []);

  if (!paymentState.amount) return <Navigate to="/customer/app/home" replace />;

  const proceed = async (payType) => {
    setLoading(true); setStatus("");
    const payload = paymentState.type === "bill"
      ? { amount: Number(paymentState.amount), operatorId: Number(paymentState.operatorId), validity: 30, payType, mobile: paymentState.field1, name: "Customer", field1: paymentState.field1, field2: paymentState.field2, viewBillResponse: paymentState.viewBillResponse }
      : { amount: Number(paymentState.amount), operatorId: Number(paymentState.operatorId), validity: Number.parseInt(String(paymentState.validity).replace(/\D/g, ""), 10) || 30, payType, mobile: paymentState.mobile, name: "Customer", field1: paymentState.mobile, field2: null, viewBillResponse: {} };

    const response = await rechargeService.recharge(payload);
    if (!response.success) { setLoading(false); setStatus(response.message || "Payment could not be processed."); return; }
    const txnId = response.data?.txnId || response.data?.txnid || response.data?.transactionId || response.raw?.data?.txnId || `VB${Date.now()}`;
    const statusResponse = await rechargeService.checkRechargeStatus({ txnId, field1: payload.field1, field2: payload.field2, validity: payload.validity, recharge: true, viewBillResponse: payload.viewBillResponse });
    setLoading(false);
    navigate("/customer/app/success", { state: { type: paymentState.type, amount: paymentState.amount, label: paymentState.label, txnId, statusPayload: statusResponse.data || response.data, paymentType: payType } });
  };

  return (
    <div className="cm-stack">
      <div className="cm-card">
        <div className="cm-section-head">
          <div><h1>Payment</h1><p className="cm-page-subtitle">Same payment workflow, upgraded for touch and desktop clarity.</p></div>
          <button className="cm-button-ghost" type="button" onClick={() => navigate(-1)}><FaArrowLeft /> Back</button>
        </div>
      </div>
      <div className="cm-two-col">
        <div className="cm-payment-card">
          <div className="cm-muted">Selected service</div>
          <h2 style={{ margin: "10px 0 4px" }}>{paymentState.label}</h2>
          <div className="cm-amount">₹{Number(paymentState.amount).toFixed(2)}</div>
          <div className="cm-chip-row" style={{ marginTop: 14 }}>
            {paymentState.mobile ? <span className="cm-chip">{paymentState.mobile}</span> : null}
            {paymentState.validity ? <span className="cm-chip">{paymentState.validity}</span> : null}
          </div>
        </div>
        <div className="cm-payment-card">
          <div className="cm-section-head"><h2>Select payment method</h2><span className="cm-muted">Capacitor-safe interaction pattern</span></div>
          <div className="cm-stack">
            <div className="cm-card"><div className="cm-list-item"><div><div className="cm-list-title">Wallet balance</div><div className="cm-muted">Available ₹{walletBalance.toFixed(2)}</div></div><button className="cm-button" type="button" disabled={loading || walletBalance < Number(paymentState.amount)} onClick={() => proceed("wallet")}>{loading ? "Processing..." : "Pay with wallet"}</button></div></div>
            <div className="cm-card"><div className="cm-list-item"><div><div className="cm-list-title">UPI</div><div className="cm-muted">Preferred for mobile and app shell checkout</div></div><button className="cm-button-secondary" type="button" disabled={loading} onClick={() => proceed("upi")}>Continue</button></div></div>
            {status ? <div className="cm-status cm-status-error">{status}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentScreen;
