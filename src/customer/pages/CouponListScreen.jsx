import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCopy, FaCheckCircle, FaClock, FaTag, FaGift } from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";

const SkeletonCard = ({ delay }) => (
  <div className="cp-card cp-skeleton" style={{ animationDelay: `${delay}ms` }}>
    <div className="th-skeleton-row" style={{ padding: "16px" }}>
      <div className="th-skeleton-circle" style={{ width: 44, height: 44, borderRadius: 12 }} />
      <div className="th-skeleton-lines" style={{ flex: 1 }}>
        <div className="th-skeleton-bar" style={{ width: "50%" }} />
        <div className="th-skeleton-bar" style={{ width: "70%" }} />
        <div className="th-skeleton-bar" style={{ width: "40%" }} />
      </div>
    </div>
  </div>
);

const CouponListScreen = () => {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [copied, setCopied] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = async (pageNum, append = false) => {
    setLoading(true);
    const res = await walletService.getCoupons(pageNum, 10);
    setLoading(false);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setCoupons(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= 10);
    }
  };

  useEffect(() => { fetchData(0); }, []);

  const now = Date.now();
  const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

  // Active: validity not passed yet
  const active = coupons.filter((c) => !c.validity || new Date(c.validity).getTime() >= now);

  // Expired but still visible: validity passed, but less than 15 days ago
  const expired = coupons.filter((c) => {
    if (!c.validity) return false;
    const validityTime = new Date(c.validity).getTime();
    return validityTime < now && (now - validityTime) <= FIFTEEN_DAYS_MS;
  });

  const filtered = tab === "active" ? active : expired;

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const getDaysLeft = (validity) => {
    if (!validity) return null;
    return Math.ceil((new Date(validity).getTime() - now) / (1000 * 60 * 60 * 24));
  };

  const getDaysUntilRemoval = (validity) => {
    if (!validity) return null;
    const expiryTime = new Date(validity).getTime();
    return Math.ceil((expiryTime + FIFTEEN_DAYS_MS - now) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="cp-page">
      {/* Header */}
      <div className="cp-header">
        <button className="cp-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="cp-header-text">
          <h1 className="cp-title">My Coupons</h1>
          {coupons.length > 0 && <span className="cp-count">{coupons.length} coupon{coupons.length > 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="cp-tabs">
        <button type="button" className={`cp-tab${tab === "active" ? " is-active" : ""}`} onClick={() => setTab("active")}>
          Active ({active.length})
        </button>
        <button type="button" className={`cp-tab${tab === "expired" ? " is-active" : ""}`} onClick={() => setTab("expired")}>
          Expired ({expired.length})
        </button>
      </div>

      {/* Content */}
      {loading && coupons.length === 0 ? (
        <div className="cp-list">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} delay={i * 100} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap">
            <FiInbox />
            <div className="md-empty-ring" />
          </div>
          <h3 className="md-empty-title">No {tab === "active" ? "Active" : "Expired"} Coupons</h3>
          <p className="md-empty-desc">
            {tab === "active" ? "Complete transactions to earn coupons and rewards." : "Expired coupons are visible for 15 days after expiry."}
          </p>
        </div>
      ) : (
        <div className="cp-list">
          {filtered.map((c, i) => {
            const isExp = tab === "expired";
            const daysLeft = getDaysLeft(c.validity);
            const isCopied = copied === c.couponCode;
            const isUrgent = !isExp && daysLeft !== null && daysLeft <= 7;

            return (
              <div key={c.id || i} className={`cp-card${isExp ? " cp-card--expired" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
                {/* Left accent */}
                <div className="cp-card-accent" style={{ background: isExp ? "var(--cm-disabled)" : isUrgent ? "#FF9800" : "#00C853" }} />

                <div className="cp-card-body">
                  {/* Top: brand + status */}
                  <div className="cp-card-top">
                    <div className="cp-brand">
                      <div className={`cp-brand-icon${isExp ? " cp-brand-icon--expired" : ""}`}>
                        <FaTag />
                      </div>
                      <div>
                        <div className="cp-brand-name">{c.couponName || "Coupon"}</div>
                        {c.txnId && <div className="cp-txn-id">Txn: {c.txnId}</div>}
                      </div>
                    </div>
                    <div className={`cp-badge${isExp ? " cp-badge--expired" : isUrgent ? " cp-badge--urgent" : ""}`}>
                      {isExp ? "Expired" : "Valid"}
                    </div>
                  </div>

                  {/* Code with copy button */}
                  <div className="cp-code-row">
                    <div className="cp-code">
                      <FaGift className="cp-code-icon" />
                      <span className="cp-code-text">{c.couponCode || "—"}</span>
                    </div>
                    {!isExp && (
                      <button className={`cp-copy-btn${isCopied ? " is-copied" : ""}`} type="button" onClick={() => handleCopy(c.couponCode)}>
                        {isCopied ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy</>}
                      </button>
                    )}
                  </div>

                  {/* Validity & days */}
                  <div className="cp-meta">
                    {c.validity && (
                      <span className="cp-meta-item">
                        <FaClock />
                        {isExp ? "Expired on" : "Valid until"} {new Date(c.validity).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {!isExp && daysLeft !== null && (
                      <span className={`cp-days-left${isUrgent ? " cp-days-left--urgent" : ""}`}>
                        {daysLeft <= 0 ? "Expires today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
                      </span>
                    )}
                    {isExp && c.validity && (() => {
                      const remDays = getDaysUntilRemoval(c.validity);
                      return remDays !== null ? (
                        <span className="cp-days-left cp-days-left--removal">
                          Removes in {remDays} day{remDays !== 1 ? "s" : ""}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Description */}
                  {c.description && <p className="cp-desc">{c.description}</p>}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button className="th-load-more" type="button" onClick={() => { const next = page + 1; setPage(next); fetchData(next, true); }} disabled={loading}>
              {loading ? (<><span className="md-spinner" /> Loading...</>) : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CouponListScreen;
