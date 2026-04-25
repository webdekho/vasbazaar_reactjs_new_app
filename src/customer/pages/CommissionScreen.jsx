import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaFilter, FaCheckCircle, FaClock, FaTimesCircle, FaChevronDown } from "react-icons/fa";
import { FiInbox, FiArrowDownLeft, FiArrowUpRight } from "react-icons/fi";
import { walletService } from "../services/walletService";

// Shared helper used inside the expandable card footer.
const MetaItem = ({ label, value }) => (
  <div className="th-meta-item">
    <span className="th-meta-label">{label}</span>
    <span className="th-meta-value">{value || "—"}</span>
  </div>
);

// Friendly label for a record's direction. The backend uses txnMode=0 for
// credit (money in) and non-zero for debit (money out); some older records
// only have a "credit" keyword in the `message` field.
const directionOf = (item) =>
  item?.txnMode === 0 || (item?.message || "").toLowerCase().includes("credit")
    ? "credit"
    : "debit";

// Tabs shown in the UI. The "rewards" tab fans out into both `bonus` + `incentive`
// fetches server-side and merges the two streams so the user sees one feed.
const tabs = ["cashback", "rewards"];
const tabLabels = { cashback: "Cashback", rewards: "Rewards" };

// Legacy alias handling — older wallet cards used `?tab=bonus` / `?tab=incentive`
// to deep-link into the old 3-tab layout; collapse both into the new "rewards" tab.
const normalizeTab = (value) => {
  if (value === "bonus" || value === "incentive") return "rewards";
  return tabs.includes(value) ? value : "cashback";
};

// Rough timestamp parser used for merge-sort. Accepts either a combined ISO string
// or the backend's split `date` + `time` fields; returns 0 on unparseable input
// so records with no date land at the bottom rather than throwing.
const toMillis = (item) => {
  if (!item) return 0;
  const combined = item.date && item.time ? `${item.date} ${item.time}` : item.date || "";
  const t = Date.parse(combined);
  return Number.isFinite(t) ? t : 0;
};

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
  const [expandedTxn, setExpandedTxn] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const lastFetchedTab = useRef(null);

  // 5 records per network round-trip; "View More" fetches the next page of 5.
  const PAGE_SIZE = 5;

  const fetchData = useCallback(async (type, pageNum, append = false) => {
    // Prevent duplicate calls for same tab on initial load
    if (pageNum === 0 && lastFetchedTab.current === type) return;
    if (pageNum === 0) lastFetchedTab.current = type;

    setLoading(true);

    if (type === "rewards") {
      // Fan out: bonus + incentive in parallel, then merge-sort by date desc.
      const [bonusRes, incentiveRes] = await Promise.all([
        walletService.getWalletHistory("bonus", pageNum, PAGE_SIZE),
        walletService.getWalletHistory("incentive", pageNum, PAGE_SIZE),
      ]);
      setLoading(false);
      const bonusList = bonusRes.success ? (bonusRes.data?.records || (Array.isArray(bonusRes.data) ? bonusRes.data : [])) : [];
      const incList = incentiveRes.success ? (incentiveRes.data?.records || (Array.isArray(incentiveRes.data) ? incentiveRes.data : [])) : [];
      const merged = [...bonusList, ...incList].sort((a, b) => toMillis(b) - toMillis(a));
      setRecords(append ? (prev) => [...prev, ...merged] : merged);
      // Either stream having a full page means more could still be available.
      setHasMore(bonusList.length >= PAGE_SIZE || incList.length >= PAGE_SIZE);
      if (pageNum === 0) {
        const bonusTotal = Number(bonusRes?.data?.totalAmount || 0);
        const incTotal = Number(incentiveRes?.data?.totalAmount || 0);
        setTotalAmount(bonusTotal + incTotal);
      }
      return;
    }

    const res = await walletService.getWalletHistory(type, pageNum, PAGE_SIZE);
    setLoading(false);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setRecords(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= PAGE_SIZE);
      if (pageNum === 0) setTotalAmount(Number(res.data?.totalAmount || 0));
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

  // Commission / cashback / rewards rows are ledger entries — if the backend did
  // not attach an explicit status we treat them as settled ("Success"), not failed.
  // Only an explicit "failed" / "reversed" status should turn the badge red.
  const getStatusCfg = (status) => {
    const s = (status || "").toLowerCase();
    if (!s || s.includes("success") || s.includes("credit")) {
      return { color: "#00C853", icon: <FaCheckCircle />, label: "Success" };
    }
    if (s.includes("pending") || s.includes("hold")) {
      return { color: "#FF9800", icon: <FaClock />, label: "Pending" };
    }
    if (s.includes("fail") || s.includes("revers") || s.includes("reject")) {
      return { color: "#FF3B30", icon: <FaTimesCircle />, label: "Failed" };
    }
    return { color: "#00C853", icon: <FaCheckCircle />, label: status || "Success" };
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
            {tabLabels[t] || t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Total earned — lifetime sum for the active tab, driven by the
          backend aggregate so it stays accurate across pages. */}
      <div className="cm-rewards-total">
        <div className="cm-rewards-total-label">Total {tabLabels[activeTab] || activeTab} earned</div>
        <div className="cm-rewards-total-value">&#8377;{totalAmount.toFixed(2)}</div>
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
          <h3 className="md-empty-title">No {tabLabels[activeTab]?.toLowerCase() || activeTab} records</h3>
          <p className="md-empty-desc">
            {fromDate || toDate ? "No records found for the selected date range." : "Transactions will appear here once available."}
          </p>
          {(fromDate || toDate) && <button className="md-btn-primary" type="button" onClick={clearDates}>Clear Filter</button>}
        </div>
      ) : (
        <div className="th-list">
          {filtered.map((item, i) => {
            const isCredit = directionOf(item) === "credit";
            const st = getStatusCfg(item.status);
            const parent = item.parentTxn || null;
            // Service name / operator — prefer the parent transaction (which is
            // authoritative — it's the actual recharge/bill that earned the reward).
            const operatorName =
              parent?.operatorName ||
              item.operatorId?.operatorName ||
              item.operatorName ||
              "";
            const serviceName =
              parent?.serviceName ||
              item.operatorId?.serviceId?.serviceName ||
              item.operatorId?.service?.serviceName ||
              item.serviceProvider ||
              parent?.serviceType ||
              "";
            // For rewards (referral bonuses), the customer/referred user is the
            // person whose activity generated this reward. Putting them first makes
            // the "who did I earn from?" answer obvious at a glance.
            const isRewardsTab = activeTab === "rewards";
            const referredUser = parent?.userName || item.customerName || item.userName || "";
            const referredMobile = parent?.userMobile || item.userMobile || parent?.operatorNo || "";
            const parentAmount = parent?.amount || parent?.txnAmt;
            const primaryName = isRewardsTab
              ? (referredUser || "Referral reward")
              : (operatorName ? operatorName : (referredUser || "Transaction"));
            // One-line context about WHY this credit arrived. Message is authored
            // backend-side so we prefer it; otherwise synthesise from the facts.
            let contextLine = item.message || "";
            if (!contextLine) {
              if (isRewardsTab) {
                const txnBit = serviceName ? ` • ${serviceName}` : "";
                const amtBit = parentAmount ? ` of ₹${parentAmount}` : "";
                contextLine = referredUser
                  ? `From ${referredUser}${referredMobile ? ` (${referredMobile})` : ""}${txnBit}${amtBit}`
                  : "Referral / bonus credit";
              } else if (serviceName || operatorName) {
                // Cashback: "on Prepaid · Vi • 9271431483 · ₹199" — the final
                // amount is the recharge that earned this cashback.
                const parts = [serviceName, operatorName].filter(Boolean);
                const numBit = (parent?.operatorNo || item.operatorNo) ? ` • ${parent?.operatorNo || item.operatorNo}` : "";
                const amtBit = parentAmount ? ` · ₹${parentAmount}` : "";
                contextLine = `Cashback on ${parts.join(" · ")}${numBit}${amtBit}`;
              } else {
                contextLine = item.description || item.txnId || "—";
              }
            }

            // Cashback %: what fraction of the parent recharge came back as cashback.
            // Helpful to eyeball the offer/rate; hidden when we can't compute it.
            const rewardAmt = Number(item.txnAmt || item.amount || 0);
            const parentAmt = Number(parentAmount || 0);
            const cashbackPct = !isRewardsTab && parentAmt > 0 && rewardAmt > 0
              ? ((rewardAmt / parentAmt) * 100).toFixed(2)
              : null;
            const rowKey = item.txnId || `${item.date || ""}-${item.time || ""}-${i}`;
            const isExpanded = expandedTxn === rowKey;

            return (
              <div
                key={rowKey}
                className={`th-card th-card--collapsible${isExpanded ? " is-expanded" : ""}`}
                style={{ animationDelay: `${i * 40}ms`, cursor: "pointer" }}
                onClick={() => setExpandedTxn(isExpanded ? null : rowKey)}
              >
                <div className="th-card-row">
                  <div className={`th-dir-icon th-dir-icon--${isCredit ? "credit" : "debit"}`}>
                    {isCredit ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                  </div>
                  <div className="th-info">
                    <div className="th-info-name">{primaryName}</div>
                    <div className="th-info-desc">{contextLine}</div>
                    <div className="th-info-date">{item.date} {item.time}</div>
                  </div>
                  <div className="th-right">
                    <div className={`th-amount th-amount--${isCredit ? "credit" : "debit"}`}>
                      {isCredit ? "+" : "-"}&#8377;{item.txnAmt || item.amount || 0}
                    </div>
                    <div className="th-status" style={{ "--st-color": st.color }}>
                      {st.icon} {st.label}
                    </div>
                    <button
                      type="button"
                      className={`th-expand-toggle${isExpanded ? " is-expanded" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setExpandedTxn(isExpanded ? null : rowKey); }}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <FaChevronDown />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="th-meta-grid">
                    {/* Reward row details — what I got */}
                    <MetaItem label="Transaction ID" value={item.txnId} />
                    <MetaItem label={isRewardsTab ? "Reward type" : "Earned as"} value={tabLabels[activeTab] || activeTab} />
                    {item.serviceType && <MetaItem label="Sub-type" value={item.serviceType} />}
                    <MetaItem label={isRewardsTab ? "Reward amount" : "Cashback amount"} value={`₹${item.txnAmt || item.amount || 0}`} />
                    {cashbackPct && <MetaItem label="Cashback %" value={`${cashbackPct}%`} />}
                    <MetaItem label="Direction" value={isCredit ? "Credit (money in)" : "Debit (money out)"} />
                    <MetaItem label="Date" value={item.date} />
                    <MetaItem label="Time" value={item.time} />
                    {item.openingBal != null && <MetaItem label="Opening balance" value={`₹${item.openingBal}`} />}
                    {item.closingBal != null && <MetaItem label="Closing balance" value={`₹${item.closingBal}`} />}

                    {/* Source transaction — which referral / which recharge earned this */}
                    {(parent || isRewardsTab) && (
                      <div className="cm-meta-divider">
                        <span>{isRewardsTab ? "Source transaction (referral)" : "Source recharge / bill"}</span>
                      </div>
                    )}
                    {isRewardsTab && (
                      <>
                        <MetaItem label="Referred user" value={referredUser} />
                        {referredMobile && <MetaItem label="Referred mobile" value={referredMobile} />}
                      </>
                    )}
                    {parent ? (
                      <>
                        <MetaItem label="Transaction type" value={parent.serviceName || parent.serviceType || "—"} />
                        <MetaItem label="Operator" value={parent.operatorName || "—"} />
                        <MetaItem label="Recharged / billed to" value={parent.operatorNo} />
                        <MetaItem label="Amount transacted" value={parent.amount != null ? `₹${parent.amount}` : (parent.txnAmt != null ? `₹${parent.txnAmt}` : "—")} />
                        <MetaItem label="Transaction status" value={parent.status} />
                        <MetaItem label="Transaction date" value={parent.date ? `${parent.date}${parent.time ? " " + parent.time : ""}` : "—"} />
                        {parent.customerName && <MetaItem label="Customer name" value={parent.customerName} />}
                        <MetaItem label="Parent Txn ID" value={parent.txnId || item.refId} />
                      </>
                    ) : !isRewardsTab && (
                      <>
                        <MetaItem label="Service" value={serviceName || "—"} />
                        <MetaItem label="Operator" value={operatorName || (item.operatorId?.id ? `ID ${item.operatorId.id}` : null)} />
                        <MetaItem label="Recharged number" value={item.operatorNo} />
                        <MetaItem label="Paid by" value={item.customerName} />
                        {item.refId && <MetaItem label="Parent Txn Ref" value={item.refId} />}
                      </>
                    )}
                    {item.paymentBy && <MetaItem label="Payment source" value={item.paymentBy} />}
                    {item.message && <MetaItem label="Note" value={item.message} />}
                  </div>
                )}
              </div>
            );
          })}

          {hasMore && (
            <button className="th-load-more" type="button" onClick={loadMore} disabled={loading}>
              {loading ? (<><span className="md-spinner" /> Loading...</>) : `View ${PAGE_SIZE} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommissionScreen;
