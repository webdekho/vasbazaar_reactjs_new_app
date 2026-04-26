import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaHashtag, FaPhoneAlt, FaCalendarAlt, FaCheckCircle, FaClock, FaTimesCircle, FaPauseCircle } from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";
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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (mode === "txn" && txnId.trim().length < 4) { setError("Enter a valid Transaction ID."); return; }
    if (mode === "mobile" && mobile.length < 10) { setError("Enter a valid 10-digit mobile number."); return; }
    setError("");
    setLoading(true);
    const res = await walletService.getTransactionHistory(0);
    setLoading(false);
    if (!res.success) { setError(res.message || "Failed to search."); return; }
    const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
    const q = mode === "txn" ? txnId.trim().toLowerCase() : mobile.trim();
    const filtered = list.filter((t) => {
      if (mode === "txn") return matchesTransactionSearch(t, q);
      const matchMobile = matchesTransactionSearch(t, q) || (t.operatorNo || t.mobile || "").includes(q);
      if (!matchMobile) return false;
      if (fromDate) { const d = new Date(t.date); if (d < new Date(fromDate)) return false; }
      if (toDate) { const d = new Date(t.date); if (d > new Date(toDate + "T23:59:59")) return false; }
      return true;
    });
    setResults(filtered);
  };

  return (
    <div className="st-page">
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text"><h1 className="th-title">Search Transaction</h1><span className="th-count">Find your payments</span></div>
      </div>

      <div className="cp-tabs">
        <button type="button" className={`cp-tab${mode === "txn" ? " is-active" : ""}`} onClick={() => { setMode("txn"); setResults(null); }}>By Transaction ID</button>
        <button type="button" className={`cp-tab${mode === "mobile" ? " is-active" : ""}`} onClick={() => { setMode("mobile"); setResults(null); }}>By Mobile & Date</button>
      </div>

      <form className="fc-form" onSubmit={handleSearch}>
        {mode === "txn" ? (
          <div className={`fc-field${focused === "txn" ? " is-focused" : ""}`}>
            <label className="fc-label"><FaHashtag className="fc-label-icon" /> Transaction ID</label>
            <input className="fc-input" placeholder="Enter transaction ID" value={txnId}
              onChange={(e) => { setTxnId(e.target.value); setError(""); }} onFocus={() => setFocused("txn")} onBlur={() => setFocused("")} />
          </div>
        ) : (
          <>
            <div className={`fc-field${focused === "mob" ? " is-focused" : ""}`}>
              <label className="fc-label"><FaPhoneAlt className="fc-label-icon" /> Mobile Number</label>
              <input className="fc-input" inputMode="numeric" maxLength={10} placeholder="10-digit mobile"
                value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "")); setError(""); }}
                onFocus={() => setFocused("mob")} onBlur={() => setFocused("")} />
            </div>
            <div className="fc-date-row">
              <div className={`fc-field${focused === "fd" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> From</label>
                <input className="fc-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  onFocus={() => setFocused("fd")} onBlur={() => setFocused("")} />
              </div>
              <div className={`fc-field${focused === "td" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> To</label>
                <input className="fc-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  onFocus={() => setFocused("td")} onBlur={() => setFocused("")} />
              </div>
            </div>
          </>
        )}
        {error && <div className="fc-error"><FaTimesCircle /> {error}</div>}
        <button className="fc-submit" type="submit" disabled={loading}>
          {loading ? <span className="fc-submit-loading"><span className="md-spinner" /> Searching...</span> : <><FaSearch /> Search</>}
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
                const txn = normalizeTransaction(t);
                return (
                  <div key={t.txnId || i} className="th-card" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="th-card-row">
                      <div className="th-info">
                        <div className="th-info-name">{txn.mobile || t.customerName || "Transaction"}</div>
                        <div className="th-info-desc">ID: {t.txnId || "—"}</div>
                        <div className="th-info-date">{t.date} {t.time}</div>
                      </div>
                      <div className="th-right">
                        <div className="th-amount">{formatCurrency(txn.amount ?? t.txnAmt ?? t.amount ?? 0)}</div>
                        <div className="th-status" style={{ "--st-color": st.color }}>{st.icon} {t.status || st.label}</div>
                      </div>
                    </div>
                    <div className="th-meta-grid">
                      <TransactionMetaItem label="Service" value={txn.service} />
                      <TransactionMetaItem label="Operator" value={txn.operator} />
                      <TransactionMetaItem label="Payment Mode" value={txn.paymentMode} />
                      <TransactionMetaItem
                        label="Offer Method"
                        value={txn.offerMethodLabel}
                        valueClassName={`th-meta-value--offer th-meta-value--offer-${txn.offerMethod}`}
                      />
                      {txn.offerMethod === "discount" && (
                        <>
                          <TransactionMetaItem label="Discount" value={formatCurrency(txn.discountAmount)} />
                          <TransactionMetaItem label="Paid Amount" value={formatCurrency(txn.paidAmount ?? txn.amount)} />
                        </>
                      )}
                      {txn.offerMethod === "cashback" && (
                        <TransactionMetaItem label="Cashback Amount" value={formatCurrency(txn.cashbackAmount)} />
                      )}
                      {txn.offerMethod === "coupon" && (
                        <>
                          <TransactionMetaItem label="Coupon Name" value={txn.couponName} />
                          <TransactionMetaItem label="Coupon Code" value={txn.couponCode} />
                          <TransactionMetaItem label="Coupon Validity" value={txn.couponValidity} />
                        </>
                      )}
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
