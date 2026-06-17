import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaHashtag, FaPhoneAlt, FaCalendarAlt, FaCheckCircle, FaClock, FaTimesCircle, FaPauseCircle, FaShieldAlt } from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";
import { transactionSearchService } from "../services/transactionSearchService";
import { formatCurrency, matchesTransactionSearch, normalizeTransaction } from "../utils/transactionHistory";

const statusCfg = (s) => {
  const v = (s || "").toLowerCase();
  if (v.includes("success")) return { color: "#00C853", label: "Success", icon: <FaCheckCircle /> };
  if (v.includes("hold")) return { color: "#FFFFFF", label: "Hold", icon: <FaPauseCircle /> };
  if (v.includes("pending")) return { color: "#FACC15", label: "Pending", icon: <FaClock /> };
  return { color: "#FF3B30", label: "Failed", icon: <FaTimesCircle /> };
};

const TransactionMetaItem = ({ label, value, valueClassName = "" }) => (
  <div className="th-meta-item">
    <span className="th-meta-label">{label}</span>
    <span className={`th-meta-value${valueClassName ? ` ${valueClassName}` : ""}`}>{value || "—"}</span>
  </div>
);

const toInputDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getDefaultDateRange = () => {
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  return { from: toInputDate(sevenDaysAgo), to: toInputDate(today) };
};

// Maps a raw transaction record to the NPCI-mandated Bharat Connect response fields.
const toBharatConnectFields = (t) => {
  const txn = normalizeTransaction(t);
  return {
    agentId: t.agentId || t.operatorId?.operatorCode || t.operatorId?.operatorId || "—",
    amount: formatCurrency(txn.amount ?? t.txnAmt ?? t.amount ?? 0),
    billerName: txn.operator,
    txnDate: `${t.date || ""} ${t.time || ""}`.trim() || "—",
    txnReferenceId: t.refId || t.txnReferenceId || t.txnId || "—",
    txnStatus: t.status || "—",
  };
};

const SearchTransactionScreen = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("txn");
  const [txnId, setTxnId] = useState("");
  const [mobile, setMobile] = useState("");
  const [fromDate, setFromDate] = useState(() => getDefaultDateRange().from);
  const [toDate, setToDate] = useState(() => getDefaultDateRange().to);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState("");
  // OTP gate for mobile-based search
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState("");

  const switchMode = (m) => {
    setMode(m);
    setResults(null);
    setOtpStage(false);
    setOtp("");
    setError("");
  };

  const runSearch = async (filterFn) => {
    setLoading(true);
    const res = await walletService.getTransactionHistory(0);
    setLoading(false);
    if (!res.success) { setError(res.message || "Failed to search."); return; }
    const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
    setResults(list.filter(filterFn));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "txn") {
      if (txnId.trim().length < 4) { setError("Enter a valid B-Connect TXN ID."); return; }
      const q = txnId.trim().toLowerCase();
      await runSearch((t) => matchesTransactionSearch(t, q));
      return;
    }

    // mode === "mobile" — requires OTP authentication first
    if (mobile.length < 10) { setError("Enter a valid 10-digit mobile number."); return; }

    if (!otpStage) {
      setLoading(true);
      const res = await transactionSearchService.sendOtp(mobile);
      setLoading(false);
      if (!res.success) { setError(res.message || "Could not send OTP. Please try again."); return; }
      setOtpStage(true);
      return;
    }

    // verify OTP, then fetch + filter by mobile and date range
    if (otp.trim().length < 4) { setError("Enter the OTP sent to your mobile."); return; }
    setLoading(true);
    const verify = await transactionSearchService.verifyOtp({ mobileNumber: mobile, otp: otp.trim(), fromDate, toDate });
    setLoading(false);
    if (!verify.success) { setError(verify.message || "Invalid OTP. Please try again."); return; }

    const q = mobile.trim();
    await runSearch((t) => {
      const matchMobile = matchesTransactionSearch(t, q) || (t.operatorNo || t.mobile || "").includes(q);
      if (!matchMobile) return false;
      if (fromDate) { const d = new Date(t.date); if (d < new Date(fromDate)) return false; }
      if (toDate) { const d = new Date(t.date); if (d > new Date(toDate + "T23:59:59")) return false; }
      return true;
    });
  };

  return (
    <div className="st-page">
      {/* Header with Bharat Connect logo top-right */}
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text"><h1 className="th-title">Search Transaction</h1><span className="th-count">Transaction History</span></div>
        <img src="/images/bbps.svg" alt="Bharat Connect" className="fc-bbps-logo" />
      </div>

      <div className="cp-tabs">
        <button type="button" className={`cp-tab${mode === "txn" ? " is-active" : ""}`} onClick={() => switchMode("txn")}>By B-Connect TXN ID</button>
        <button type="button" className={`cp-tab${mode === "mobile" ? " is-active" : ""}`} onClick={() => switchMode("mobile")}>By Mobile & Date</button>
      </div>

      <form className="fc-form" onSubmit={handleSearch}>
        {mode === "txn" ? (
          <div className={`fc-field${focused === "txn" ? " is-focused" : ""}`}>
            <label className="fc-label"><FaHashtag className="fc-label-icon" /> B-Connect TXN ID</label>
            <input className="fc-input" placeholder="Enter B-Connect TXN ID (received in Pay Response)" value={txnId}
              onChange={(e) => { setTxnId(e.target.value); setError(""); }} onFocus={() => setFocused("txn")} onBlur={() => setFocused("")} />
          </div>
        ) : (
          <>
            <div className={`fc-field${focused === "mob" ? " is-focused" : ""}`}>
              <label className="fc-label"><FaPhoneAlt className="fc-label-icon" /> Mobile Number</label>
              <input className="fc-input" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" disabled={otpStage}
                value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "")); setError(""); }}
                onFocus={() => setFocused("mob")} onBlur={() => setFocused("")} />
            </div>
            <div className="fc-date-row">
              <div className={`fc-field${focused === "fd" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> From</label>
                <input className="fc-input" type="date" value={fromDate} disabled={otpStage} onChange={(e) => setFromDate(e.target.value)}
                  onFocus={() => setFocused("fd")} onBlur={() => setFocused("")} />
              </div>
              <div className={`fc-field${focused === "td" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> To</label>
                <input className="fc-input" type="date" value={toDate} disabled={otpStage} onChange={(e) => setToDate(e.target.value)}
                  onFocus={() => setFocused("td")} onBlur={() => setFocused("")} />
              </div>
            </div>
            {otpStage && (
              <div className={`fc-field${focused === "otp" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaShieldAlt className="fc-label-icon" /> Enter OTP</label>
                <input className="fc-input" inputMode="numeric" maxLength={6} placeholder="OTP sent to your mobile"
                  value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                  onFocus={() => setFocused("otp")} onBlur={() => setFocused("")} autoFocus />
                <p className="st-otp-hint">An OTP was sent to {mobile} for authentication.</p>
              </div>
            )}
          </>
        )}
        {error && <div className="fc-error"><FaTimesCircle /> {error}</div>}
        <button className="fc-submit" type="submit" disabled={loading}>
          {loading
            ? <span className="fc-submit-loading"><span className="md-spinner" /> {mode === "mobile" && !otpStage ? "Sending OTP..." : "Searching..."}</span>
            : <><FaSearch /> {mode === "mobile" && !otpStage ? "Send OTP" : mode === "mobile" && otpStage ? "Verify & Search" : "Search"}</>}
        </button>
      </form>

      {results !== null && (
        <div style={{ marginTop: 8 }}>
          <div className="wl-month-label">{results.length} result{results.length !== 1 ? "s" : ""} found</div>
          {results.length === 0 ? (
            <div className="md-empty" style={{ padding: "32px 20px" }}>
              <div className="md-empty-icon-wrap"><FiInbox /><div className="md-empty-ring" /></div>
              <h3 className="md-empty-title">No Transactions Found</h3>
              <p className="md-empty-desc">Try different search criteria.</p>
            </div>
          ) : (
            <div className="th-list">
              {results.map((t, i) => {
                const st = statusCfg(t.status);
                const bc = toBharatConnectFields(t);
                return (
                  <div key={t.txnId || i} className="th-card" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="th-card-row">
                      <div className="th-info">
                        <div className="th-info-name">{bc.billerName}</div>
                        <div className="th-info-desc">B-Connect TXN ID: {bc.txnReferenceId}</div>
                        <div className="th-info-date">{bc.txnDate}</div>
                      </div>
                      <div className="th-right">
                        <div className="th-amount">{bc.amount}</div>
                        <div className="th-status" style={{ "--st-color": st.color }}>{st.icon} {bc.txnStatus}</div>
                      </div>
                    </div>
                    {/* NPCI-mandated Bharat Connect response fields */}
                    <div className="th-meta-grid">
                      <TransactionMetaItem label="Agent ID" value={bc.agentId} />
                      <TransactionMetaItem label="Amount" value={bc.amount} />
                      <TransactionMetaItem label="Biller Name" value={bc.billerName} />
                      <TransactionMetaItem label="Txn Date" value={bc.txnDate} />
                      <TransactionMetaItem label="Txn Reference ID" value={bc.txnReferenceId} />
                      <TransactionMetaItem label="Txn Status" value={bc.txnStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchTransactionScreen;
