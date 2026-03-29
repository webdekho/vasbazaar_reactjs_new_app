import { useEffect, useState, useMemo } from "react";
import { FaWallet, FaSearch, FaTimes, FaSyncAlt, FaCheckCircle, FaClock, FaTimesCircle, FaChevronDown } from "react-icons/fa";
import { FiArrowDownLeft, FiArrowUpRight, FiGift, FiDollarSign, FiInbox } from "react-icons/fi";
import { userService } from "../services/userService";
import { walletService } from "../services/walletService";
import BankDetailsTab from "../components/BankDetailsTab";

const getStatusConfig = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("success")) return { icon: <FaCheckCircle />, color: "#00C853", label: "Success" };
  if (s.includes("pending")) return { icon: <FaClock />, color: "#FF9800", label: "Pending" };
  return { icon: <FaTimesCircle />, color: "#FF3B30", label: "Failed" };
};

const formatMonth = (dateStr) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return "Other";
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch { return "Other"; }
};

const SkeletonCard = ({ delay }) => (
  <div className="wt-card wt-skeleton" style={{ animationDelay: `${delay}ms` }}>
    <div className="wt-skeleton-row">
      <div className="th-skeleton-circle" />
      <div className="th-skeleton-lines" style={{ flex: 1 }}>
        <div className="th-skeleton-bar" style={{ width: "55%" }} />
        <div className="th-skeleton-bar" style={{ width: "75%" }} />
      </div>
      <div className="th-skeleton-bar" style={{ width: 60, height: 20 }} />
    </div>
  </div>
);

const WalletScreen = () => {
  const [activeTab, setActiveTab] = useState("wallet");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [cashback, setCashback] = useState(0);
  const [incentive, setIncentive] = useState(0);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const fetchData = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    setError("");
    const [balRes, txnRes] = await Promise.all([
      pageNum === 1 ? userService.getUserProfile() : Promise.resolve({ success: true }),
      walletService.getWalletTransactions(pageNum - 1, 10),
    ]);
    if (pageNum === 1) setLoading(false); else setLoadingMore(false);
    if (balRes.success && balRes.data) {
      setBalance(Number(balRes.data.balance || 0));
      setCashback(Number(balRes.data.cashback || 0));
      setIncentive(Number(balRes.data.incentive || 0));
    }
    if (txnRes.success) {
      const list = txnRes.data?.records || txnRes.data?.content || (Array.isArray(txnRes.data) ? txnRes.data : []);
      setTransactions(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= 10);
      setLastUpdated(new Date());
    } else {
      setError(txnRes.message || "Failed to load transactions.");
    }
  };

  useEffect(() => { fetchData(1); }, []);

  const handleRefresh = async () => { setRefreshing(true); setPage(1); await fetchData(1); setRefreshing(false); };
  const handleLoadMore = () => { if (loadingMore || !hasMore) return; const next = page + 1; setPage(next); fetchData(next, true); };

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.trim().toLowerCase();
    return transactions.filter((t) =>
      (t.txnId || "").toLowerCase().includes(q) || (t.operatorNo || t.mobile || "").includes(q) || (t.message || t.description || "").toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((t) => {
      const month = formatMonth(t.date || t.created_at);
      if (!groups[month]) groups[month] = [];
      groups[month].push(t);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="wl-page">
      {/* Tabs */}
      <div className="wl-tabs">
        {[{ key: "wallet", label: "Wallet" }, { key: "bank", label: "Bank Details" }].map((tab) => (
          <button key={tab.key} type="button"
            className={`wl-tab${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >{tab.label}</button>
        ))}
      </div>

      {activeTab === "wallet" ? (
        <>
          {/* Balance card */}
          <div className="wl-balance-card">
            <div className="cmc-bg-mesh" />
            <div className="cmc-bg-orb cmc-bg-orb--1" />
            <div className="cmc-bg-orb cmc-bg-orb--2" />
            <div className="cmc-bg-line" />

            <div className="wl-balance-content">
              <div className="wl-balance-top">
                <div>
                  <div className="wl-balance-label"><FaWallet /> Wallet Balance</div>
                  <div className="wl-balance-amount">&#8377;{balance.toFixed(2)}</div>
                  <div className="wl-balance-subs">
                    {cashback > 0 && <span><FiGift /> Cashback: &#8377;{cashback.toFixed(2)}</span>}
                    {incentive > 0 && <span><FiDollarSign /> Incentive: &#8377;{incentive.toFixed(2)}</span>}
                  </div>
                </div>
                <button className="wl-refresh" type="button" onClick={handleRefresh} disabled={refreshing}>
                  <FaSyncAlt className={refreshing ? "wl-spinning" : ""} />
                </button>
              </div>

              {lastUpdated && <div className="wl-last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</div>}
            </div>
          </div>

          {/* Search */}
          <div className={`th-search${searchFocused ? " is-focused" : ""}`}>
            <FaSearch className="th-search-icon" />
            <input className="th-search-input" placeholder="Search by Mobile or Txn ID..." value={search}
              onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
            {search && <button className="th-search-clear" type="button" onClick={() => setSearch("")}>&times;</button>}
          </div>

          {/* Transactions */}
          {loading ? (
            <div className="th-list">{[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} delay={i * 80} />)}</div>
          ) : error ? (
            <div className="md-empty">
              <div className="md-empty-icon-wrap md-empty-icon-wrap--error"><FaTimesCircle /></div>
              <h3 className="md-empty-title">Failed to Load</h3>
              <p className="md-empty-desc">{error}</p>
              <button className="md-btn-primary" type="button" onClick={() => fetchData(1)}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="md-empty">
              <div className="md-empty-icon-wrap"><FiInbox /><div className="md-empty-ring" /></div>
              <h3 className="md-empty-title">No Transactions</h3>
              <p className="md-empty-desc">{search ? "No matching transactions found" : "Your wallet transactions will appear here"}</p>
            </div>
          ) : (
            <div className="th-list">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <div className="wl-month-label">{month}</div>
                  {items.map((txn, i) => {
                    const st = getStatusConfig(txn.status);
                    const isExpanded = expanded === (txn.txnId || txn.id || i);
                    const isCredit = txn.txnMode === 0 || (txn.message || "").toLowerCase().includes("credit");
                    return (
                      <div key={txn.txnId || txn.id || i} className="wt-card"
                        onClick={() => setExpanded(isExpanded ? null : (txn.txnId || txn.id || i))}>
                        <div className="th-card-row">
                          <div className={`th-dir-icon th-dir-icon--${isCredit ? "credit" : "debit"}`}>
                            {isCredit ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                          </div>
                          <div className="th-info">
                            <div className="th-info-name">{txn.operatorNo || txn.mobile || txn.operatorId?.operatorName || "Transaction"}</div>
                            <div className="th-info-desc">{txn.message || txn.description || txn.serviceType || "—"}</div>
                          </div>
                          <div className="th-right">
                            <div className={`th-amount th-amount--${isCredit ? "credit" : "debit"}`}>
                              {isCredit ? "+" : "−"}&#8377;{Number(txn.txnAmt || txn.amount || 0).toFixed(2)}
                            </div>
                            <div className="th-status" style={{ "--st-color": st.color }}>{st.icon} {st.label}</div>
                          </div>
                          <FaChevronDown className={`wt-chevron${isExpanded ? " is-open" : ""}`} />
                        </div>

                        {isExpanded && (
                          <div className="wt-expanded">
                            {[
                              ["Transaction ID", txn.txnId || "—"],
                              ["Date & Time", `${txn.date || ""} ${txn.time || ""}`],
                              ...((txn.referenceId || txn.refId) ? [["Reference ID", txn.referenceId || txn.refId]] : []),
                              ...(txn.openingBal != null ? [["Opening Balance", `₹${Number(txn.openingBal).toFixed(2)}`]] : []),
                              ...(txn.closingBal != null ? [["Closing Balance", `₹${Number(txn.closingBal).toFixed(2)}`]] : []),
                            ].map(([label, value]) => (
                              <div key={label} className="wt-detail-row">
                                <span className="wt-detail-label">{label}</span>
                                <span className="wt-detail-value">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {hasMore && !search && (
                <button className="th-load-more" type="button" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? (<><span className="md-spinner" /> Loading...</>) : "Load More Transactions"}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <BankDetailsTab />
      )}
    </div>
  );
};

export default WalletScreen;
