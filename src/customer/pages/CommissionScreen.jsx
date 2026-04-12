import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaFilter, FaCheckCircle, FaClock, FaTimesCircle } from "react-icons/fa";
import { FiInbox, FiArrowDownLeft, FiArrowUpRight } from "react-icons/fi";
import { walletService } from "../services/walletService";

const tabs = ["cashback", "incentive", "bonus"];
const normalizeTab = (value) => (tabs.includes(value) ? value : "cashback");

const CommissionScreen = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => normalizeTab(searchParams.get("tab")));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [focused, setFocused] = useState("");
  const lastFetchedTab = useRef(null);

  const fetchData = useCallback(async (type, pageNum, append = false) => {
    // Prevent duplicate calls for same tab on initial load
    if (pageNum === 0 && lastFetchedTab.current === type) return;
    if (pageNum === 0) lastFetchedTab.current = type;

    setLoading(true);
    const res = await walletService.getWalletHistory(type, pageNum, 10);
    setLoading(false);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setRecords(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= 10);
    }
  }, []);

  // Single effect to handle tab sync and data fetching
  useEffect(() => {
    const urlTab = normalizeTab(searchParams.get("tab"));

    // Sync URL if needed (only on mount or if URL is invalid)
    if (searchParams.get("tab") !== urlTab) {
      setSearchParams({ tab: urlTab }, { replace: true });
    }

    // Only fetch if tab changed
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
      setPage(0);
      setRecords([]);
      lastFetchedTab.current = null; // Reset to allow fetch
      fetchData(urlTab, 0);
    } else if (lastFetchedTab.current !== activeTab) {
      // Initial fetch
      fetchData(activeTab, 0);
    }
  }, [searchParams, activeTab, setSearchParams, fetchData]);

  const loadMore = () => { const next = page + 1; setPage(next); fetchData(activeTab, next, true); };

  // Date filter (client-side)
  const filtered = records.filter((item) => {
    if (!fromDate && !toDate) return true;
    const itemDate = new Date(item.date);
    if (fromDate && itemDate < new Date(fromDate)) return false;
    if (toDate && itemDate > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  const clearDates = () => { setFromDate(""); setToDate(""); };

  const getStatusCfg = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("success")) return { color: "#00C853", icon: <FaCheckCircle /> };
    if (s.includes("pending")) return { color: "#FF9800", icon: <FaClock /> };
    return { color: "#FF3B30", icon: <FaTimesCircle /> };
  };

  return (
    <div className="rw-page">
      {/* Header */}
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text">
          <h1 className="th-title">Rewards Report</h1>
          <span className="th-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <button className={`rw-filter-btn${showFilter ? " is-active" : ""}`} type="button" onClick={() => setShowFilter(!showFilter)}>
          <FaFilter /> Filter
        </button>
      </div>

      {/* Tabs */}
      <div className="cp-tabs">
        {tabs.map((t) => (
          <button key={t} type="button" className={`cp-tab${activeTab === t ? " is-active" : ""}`}
            onClick={() => {
              if (t === activeTab) return; // Already on this tab
              lastFetchedTab.current = null; // Reset to allow fetch
              setSearchParams({ tab: t }); // This will trigger the useEffect
            }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Date filter */}
      {showFilter && (
        <div className="rw-date-filter">
          <div className="fc-date-row">
            <div className={`fc-field${focused === "from" ? " is-focused" : ""}`}>
              <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> From</label>
              <input className="fc-input" type="date" value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onFocus={() => setFocused("from")} onBlur={() => setFocused("")} />
            </div>
            <div className={`fc-field${focused === "to" ? " is-focused" : ""}`}>
              <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> To</label>
              <input className="fc-input" type="date" value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onFocus={() => setFocused("to")} onBlur={() => setFocused("")} />
            </div>
          </div>
          {(fromDate || toDate) && (
            <button className="rw-clear-btn" type="button" onClick={clearDates}>Clear Dates</button>
          )}
        </div>
      )}

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="th-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="th-card" style={{ animationDelay: `${i * 80}ms`, pointerEvents: "none" }}>
              <div style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                <div className="th-skeleton-circle" />
                <div className="th-skeleton-lines" style={{ flex: 1 }}>
                  <div className="th-skeleton-bar" style={{ width: "50%" }} />
                  <div className="th-skeleton-bar" style={{ width: "70%" }} />
                </div>
                <div className="th-skeleton-bar" style={{ width: 60, height: 20 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap"><FiInbox /><div className="md-empty-ring" /></div>
          <h3 className="md-empty-title">No {activeTab} records</h3>
          <p className="md-empty-desc">
            {fromDate || toDate ? "No records found for the selected date range." : "Transactions will appear here once available."}
          </p>
          {(fromDate || toDate) && <button className="md-btn-primary" type="button" onClick={clearDates}>Clear Filter</button>}
        </div>
      ) : (
        <div className="th-list">
          {filtered.map((item, i) => {
            const isCredit = item.txnMode === 0 || (item.message || "").toLowerCase().includes("credit");
            const st = getStatusCfg(item.status);
            const operatorName = item.operatorId?.operatorName || "";
            const displayName = item.userName || item.customerName || "Transaction";
            const displayDesc = operatorName
              ? `${operatorName}${item.operatorNo ? ` • ${item.operatorNo}` : ""}`
              : (item.message || item.description || item.txnId || "—");
            return (
              <div key={item.txnId || i} className="th-card" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="th-card-row">
                  <div className={`th-dir-icon th-dir-icon--${isCredit ? "credit" : "debit"}`}>
                    {isCredit ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                  </div>
                  <div className="th-info">
                    <div className="th-info-name">{displayName}</div>
                    <div className="th-info-desc">{displayDesc}</div>
                    <div className="th-info-date">{item.date} {item.time}</div>
                  </div>
                  <div className="th-right">
                    <div className={`th-amount th-amount--${isCredit ? "credit" : "debit"}`}>
                      {isCredit ? "+" : "-"}&#8377;{item.txnAmt || item.amount || 0}
                    </div>
                    <div className="th-status" style={{ "--st-color": st.color }}>{st.icon} {item.status || (isCredit ? "Credit" : "Debit")}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button className="th-load-more" type="button" onClick={loadMore} disabled={loading}>
              {loading ? (<><span className="md-spinner" /> Loading...</>) : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommissionScreen;
