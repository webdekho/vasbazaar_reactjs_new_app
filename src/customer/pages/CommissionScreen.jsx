import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { walletService } from "../services/walletService";

const tabs = ["cashback", "commission", "incentive", "bonus"];

const CommissionScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "cashback";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = async (type, pageNum, append = false) => {
    setLoading(true);
    const res = await walletService.getWalletHistory(type, pageNum, 10);
    setLoading(false);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setRecords(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= 10);
    }
  };

  useEffect(() => { setPage(0); setRecords([]); fetchData(activeTab, 0); }, [activeTab]);

  const loadMore = () => { const next = page + 1; setPage(next); fetchData(activeTab, next, true); };

  return (
    <div className="cm-screen-page">
      <div className="cm-flow-title-row"><button className="cm-back-icon" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button><h1>Rewards Report</h1></div>

      <div className="cm-plan-tabs">
        {tabs.map((t) => (
          <button key={t} type="button" className={`cm-plan-tab${activeTab === t ? " is-active" : ""}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading && records.length === 0 ? (
        <div className="cm-contact-empty"><span className="cm-contact-loading" /><p>Loading...</p></div>
      ) : records.length === 0 ? (
        <div className="cm-contact-empty"><p className="cm-contact-empty-title">No {activeTab} records</p><p className="cm-contact-empty-desc">Transactions will appear here once available.</p></div>
      ) : (
        <div className="cm-txn-list">
          {records.map((item, i) => (
            <div key={item.txnId || i} className="cm-txn-card">
              <div className="cm-txn-row">
                <div className="cm-txn-info">
                  <span className="cm-txn-id">{item.txnId || "—"}</span>
                  <span className="cm-txn-msg">{item.message || item.description || "Transaction"}</span>
                  <span className="cm-txn-date">{item.date} {item.time}</span>
                </div>
                <div className={`cm-txn-amount ${item.txnMode === 1 ? "cm-txn-debit" : "cm-txn-credit"}`}>
                  {item.txnMode === 1 ? "−" : "+"}₹{item.txnAmt || item.amount || 0}
                </div>
              </div>
            </div>
          ))}
          {hasMore && <button className="cm-button-ghost" type="button" onClick={loadMore} disabled={loading}>{loading ? "Loading..." : "Load More"}</button>}
        </div>
      )}
    </div>
  );
};

export default CommissionScreen;
