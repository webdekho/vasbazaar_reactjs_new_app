import { useEffect, useState } from "react";
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaSyncAlt } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const RenewSubscriptionSheet = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null); // { type: 'success'|'error', title, message }

  const loadStatus = async () => {
    setLoading(true);
    const res = await outstandingService.getSubscription();
    setLoading(false);
    if (res?.success) setInfo(res.data || {});
    else setInfo({ error: res?.message || "Failed to load subscription status" });
  };

  useEffect(() => { loadStatus(); }, []);

  const onRenew = async () => {
    setSubmitting(true);
    const res = await outstandingService.renewSubscription();
    setSubmitting(false);
    if (res?.success) {
      setResult({
        type: "success",
        title: "Subscription renewed!",
        message: `₹${Number(res.data?.amountCharged || 0).toFixed(2)} deducted from wallet. Valid till ${formatDate(res.data?.validTill)}.`,
      });
      setInfo(res.data);
    } else {
      setResult({
        type: "error",
        title: "Renewal failed",
        message: res?.message || "Please try again.",
      });
    }
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className="cm-sheet is-open ol-sheet">
        <div className="cm-sheet-header">
          <h2>ReBill Subscription</h2>
          <button className="cm-sheet-close" type="button" onClick={onClose}><FaTimes /></button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center" }}>Loading…</div>
        ) : result ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%",
                margin: "0 auto 14px",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: result.type === "success" ? "rgba(34,197,94,0.14)" : "rgba(255,59,48,0.12)",
                color: result.type === "success" ? "#16a34a" : "#FF3B30",
                fontSize: 30,
              }}
            >
              {result.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>{result.title}</h3>
            <p style={{ margin: "0 0 18px", color: "#4b5563", fontSize: "0.9rem", lineHeight: 1.45 }}>
              {result.message}
            </p>
            <button type="button" className="ol-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            <div
              style={{
                background: info?.isActive
                  ? "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))"
                  : "linear-gradient(135deg, rgba(255,122,0,0.12), rgba(255,122,0,0.04))",
                border: `1px solid ${info?.isActive ? "rgba(34,197,94,0.25)" : "rgba(255,122,0,0.25)"}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ color: info?.isActive ? "#16a34a" : "#FF7A00" }}>
                  {info?.isActive ? "Active" : "Expired"}
                </strong>
                {info?.isActive && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {info?.daysLeft || 0} day{info?.daysLeft === 1 ? "" : "s"} left
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#4b5563" }}>
                {info?.isActive
                  ? `Valid till ${formatDate(info?.validTill)}`
                  : "Your ReBill subscription has expired or never started."}
              </div>
            </div>

            <div className="ol-renew-cards">
              <div className="ol-renew-card">
                <small className="ol-renew-label">SUBSCRIPTION FEE</small>
                <div className="ol-renew-value">{formatINR(info?.charge)}</div>
                <small className="ol-renew-label">per {info?.cycleDays || 30} days</small>
              </div>
              <div className="ol-renew-card">
                <small className="ol-renew-label">WALLET BALANCE</small>
                <div className="ol-renew-value">{formatINR(info?.walletBalance)}</div>
                <small className={Number(info?.walletBalance || 0) >= Number(info?.charge || 0) ? "ol-renew-sufficient" : "ol-renew-insufficient"}>
                  {Number(info?.walletBalance || 0) >= Number(info?.charge || 0) ? "Sufficient" : "Insufficient"}
                </small>
              </div>
            </div>

            {info?.error && (
              <div className="ol-error" style={{ marginBottom: 12 }}>{info.error}</div>
            )}

            <button
              type="button"
              className="ol-submit"
              disabled={submitting || !info || info.error || Number(info?.walletBalance || 0) < Number(info?.charge || 0)}
              onClick={onRenew}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <FaSyncAlt /> {submitting ? "Processing…" : info?.isActive ? "Extend by 30 days" : "Renew now"}
            </button>

            <p style={{ marginTop: 12, color: "#6b7280", fontSize: 12, textAlign: "center" }}>
              Amount will be deducted from your VasBazaar wallet.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default RenewSubscriptionSheet;
