import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import { FiArrowUpRight, FiArrowDownLeft, FiClock, FiCheckCircle, FiXCircle, FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";

const statusConfig = {
  success: { color: "#00C853", label: "Success", icon: <FiCheckCircle size={11} /> },
  pending: { color: "#FF9800", label: "Pending", icon: <FiClock size={11} /> },
  failed:  { color: "#FF3B30", label: "Failed",  icon: <FiXCircle size={11} /> },
};

const getStatusKey = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("success")) return "success";
  if (s.includes("pending")) return "pending";
  return "failed";
};

const isCredit = (item) => {
  const desc = (item.description || item.discription || item.serviceType || "").toLowerCase();
  const type = (item.txnType || item.type || "").toLowerCase();
  return type.includes("credit") || type.includes("cr") || desc.includes("credit") || desc.includes("received") || desc.includes("refund") || desc.includes("cashback");
};

const SkeletonCard = ({ delay }) => (
  <div className="th-card th-skeleton" style={{ animationDelay: `${delay}ms` }}>
    <div className="th-skeleton-row">
      <div className="th-skeleton-circle" />
      <div className="th-skeleton-lines">
        <div className="th-skeleton-bar" style={{ width: "55%" }} />
        <div className="th-skeleton-bar" style={{ width: "75%" }} />
        <div className="th-skeleton-bar" style={{ width: "35%" }} />
      </div>
      <div className="th-skeleton-bar" style={{ width: 56, height: 24 }} />
    </div>
  </div>
);

const TransactionHistoryScreen = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);

  const fetchData = async (pageNum, append = false) => {
    setLoading(true);
    const res = await walletService.getTransactionHistory(pageNum);
    setLoading(false);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setRecords(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= 10);
    }
  };

  useEffect(() => { fetchData(0); }, []);

  const loadMore = () => { const next = page + 1; setPage(next); fetchData(next, true); };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? records.filter((item) =>
        (item.txnId || "").toLowerCase().includes(query) ||
        (item.operatorNo || "").includes(query) ||
        (item.description || item.discription || "").toLowerCase().includes(query)
      )
    : records;

  return (
    <div className="th-page">
      {/* Header */}
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="th-header-text">
          <h1 className="th-title">Transaction History</h1>
          {records.length > 0 && (
            <span className="th-count">{records.length} transactions</span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className={`th-search${searchFocused ? " is-focused" : ""}`}>
        <FaSearch className="th-search-icon" />
        <input
          className="th-search-input"
          placeholder="Search by mobile or transaction ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {search && (
          <button className="th-search-clear" type="button" onClick={() => setSearch("")}>&times;</button>
        )}
      </div>

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="th-list">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} delay={i * 80} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap">
            <FiInbox size={28} />
            <div className="md-empty-ring" />
          </div>
          <h3 className="md-empty-title">No transactions found</h3>
          <p className="md-empty-desc">
            {query ? "Try a different search term." : "Your transaction history will appear here once you make a payment."}
          </p>
        </div>
      ) : (
        <div className="th-list">
          {filtered.map((item, i) => {
            const sk = getStatusKey(item.status);
            const cfg = statusConfig[sk];
            const credit = isCredit(item);

            return (
              <div key={item.txnId || i} className="th-card" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="th-card-row">
                  {/* Direction icon */}
                  <div className={`th-dir-icon th-dir-icon--${credit ? "credit" : "debit"}`}>
                    {credit ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                  </div>

                  {/* Info */}
                  <div className="th-info">
                    <div className="th-info-name">{item.operatorNo || item.customerName || "Transaction"}</div>
                    <div className="th-info-desc">{item.description || item.discription || item.serviceType || "—"}</div>
                    <div className="th-info-date">{item.date} {item.time}</div>
                  </div>

                  {/* Amount + status */}
                  <div className="th-right">
                    <div className={`th-amount th-amount--${credit ? "credit" : "debit"}`}>
                      {credit ? "+" : "-"}&#8377;{item.txnAmt || item.amount || 0}
                    </div>
                    <div className="th-status" style={{ "--st-color": cfg.color }}>
                      {cfg.icon} {item.status || cfg.label}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && !query && (
            <button className="th-load-more" type="button" onClick={loadMore} disabled={loading}>
              {loading ? (
                <><span className="md-spinner" /> Loading...</>
              ) : "Load More Transactions"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryScreen;
