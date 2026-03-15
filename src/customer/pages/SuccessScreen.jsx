import { useLocation, useNavigate } from "react-router-dom";
import { FaCheck } from "react-icons/fa";

const SuccessScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state || {};

  return (
    <div className="cm-stack">
      <div className="cm-card" style={{ textAlign: "center" }}>
        <div className="cm-checkmark"><FaCheck /></div>
        <h1 style={{ marginBottom: 8 }}>Transaction complete</h1>
        <p className="cm-page-subtitle">Your {data.type || "payment"} flow has been completed with the redesigned customer panel.</p>
        <div className="cm-amount" style={{ marginTop: 10 }}>₹{Number(data.amount || 0).toFixed(2)}</div>
        <div className="cm-chip-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <span className="cm-chip">Txn {data.txnId || "Pending sync"}</span>
          <span className="cm-chip">{data.paymentType || "UPI"}</span>
        </div>
      </div>
      <div className="cm-two-col">
        <div className="cm-card">
          <div className="cm-section-head"><h2>Transaction details</h2><span className="cm-badge">Success</span></div>
          <div className="cm-detail-grid">
            <div className="cm-detail-box"><span className="cm-muted">Service</span><strong>{data.label || "Customer service"}</strong></div>
            <div className="cm-detail-box"><span className="cm-muted">Reference</span><strong>{data.txnId || "--"}</strong></div>
            <div className="cm-detail-box"><span className="cm-muted">Amount</span><strong>₹{Number(data.amount || 0).toFixed(2)}</strong></div>
            <div className="cm-detail-box"><span className="cm-muted">Mode</span><strong>{String(data.paymentType || "upi").toUpperCase()}</strong></div>
          </div>
        </div>
        <div className="cm-card">
          <div className="cm-section-head"><h2>Next actions</h2></div>
          <div className="cm-stack">
            <button className="cm-button" type="button" onClick={() => navigate("/customer/app/services")}>Back to Services</button>
            <button className="cm-button-secondary" type="button" onClick={() => navigate("/customer/app/wallet")}>Open wallet history</button>
            <button className="cm-button-ghost" type="button" onClick={() => navigate("/customer/app/services")}>Start another payment</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;
