import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPlusCircle, FaCalendarAlt, FaPhoneAlt,
  FaComment, FaCheckCircle, FaClock, FaExclamationCircle,
  FaChevronRight, FaExclamationTriangle
} from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { complaintService } from "../services/complaintService";

const getStatusConfig = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("close") || s.includes("resolved") || s.includes("success"))
    return { label: "Closed", color: "#00C853", icon: <FaCheckCircle /> };
  if (s.includes("open") || s.includes("progress"))
    return { label: "Open", color: "#FF3B30", icon: <FaExclamationCircle /> };
  return { label: "Pending", color: "#FF9800", icon: <FaClock /> };
};

const SkeletonCard = ({ delay }) => (
  <div className="cl-card cl-skeleton" style={{ animationDelay: `${delay}ms` }}>
    <div className="cl-skeleton-row">
      <div className="cl-skeleton-bar" style={{ width: "50%", height: 14 }} />
      <div className="cl-skeleton-bar" style={{ width: 60, height: 24, borderRadius: 8 }} />
    </div>
    <div className="cl-skeleton-row" style={{ gap: 10 }}>
      <div className="cl-skeleton-circle" />
      <div style={{ flex: 1 }}>
        <div className="cl-skeleton-bar" style={{ width: "40%", marginBottom: 6 }} />
        <div className="cl-skeleton-bar" style={{ width: "55%" }} />
      </div>
    </div>
    <div className="cl-skeleton-bar" style={{ width: "70%" }} />
  </div>
);

const ComplaintListScreen = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = async (pageNum, append = false) => {
    setLoading(true);
    const res = await complaintService.getAll(pageNum, 10);
    setLoading(false);
    if (!res.success) { setError(res.message || "Failed to load."); return; }
    const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
    setRecords(append ? (prev) => [...prev, ...list] : list);
    setTotalRecords(res.data?.totalRecords || list.length);
    setHasMore(list.length >= 10);
  };

  useEffect(() => { fetchData(0); }, []);

  const loadMore = () => { const next = page + 1; setPage(next); fetchData(next, true); };

  return (
    <div className="cl-page">
      {/* Header */}
      <div className="cl-header">
        <button className="cl-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="cl-header-text">
          <h1 className="cl-title">Complaints</h1>
          {totalRecords > 0 && <span className="cl-count">{totalRecords} complaint{totalRecords > 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="cl-actions">
        <button className="cl-action-btn cl-action-btn--primary" type="button" onClick={() => navigate("/customer/app/file-complaint")}>
          <FaPlusCircle /> File Complaint
        </button>
        <button className="cl-action-btn cl-action-btn--outline" type="button" onClick={() => navigate("/customer/app/track-complaint")}>
          Track <FaChevronRight />
        </button>
      </div>

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="cl-list">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} delay={i * 100} />)}
        </div>
      ) : error ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap md-empty-icon-wrap--error">
            <FaExclamationTriangle />
          </div>
          <h3 className="md-empty-title">Something went wrong</h3>
          <p className="md-empty-desc">{error}</p>
          <button className="md-btn-primary" type="button" onClick={() => fetchData(0)}>Try Again</button>
        </div>
      ) : records.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap">
            <FiInbox />
            <div className="md-empty-ring" />
          </div>
          <h3 className="md-empty-title">No Complaints Found</h3>
          <p className="md-empty-desc">You haven't raised any complaints yet.</p>
          <button className="md-btn-primary" type="button" onClick={() => navigate("/customer/app/file-complaint")}>
            <FaPlusCircle /> File a Complaint
          </button>
        </div>
      ) : (
        <div className="cl-list">
          {records.map((item, i) => {
            const st = getStatusConfig(item.status);
            const isExpanded = expandedId === (item.id || i);

            return (
              <div
                key={item.id || i}
                className="cl-card"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setExpandedId(isExpanded ? null : (item.id || i))}
              >
                {/* Accent */}
                <div className="cl-card-accent" style={{ background: st.color }} />

                <div className="cl-card-body">
                  {/* Top row: txn ID + status */}
                  <div className="cl-card-top">
                    <div className="cl-txn-id">
                      <span className="cl-txn-label">Transaction ID</span>
                      <span className="cl-txn-value">{item.txnId || `#${item.id}`}</span>
                    </div>
                    <div className="cl-status" style={{ "--st-color": st.color }}>
                      {st.icon} {st.label}
                    </div>
                  </div>

                  {/* User info */}
                  <div className="cl-user">
                    <div className="cl-avatar">{(item.name || "U")[0].toUpperCase()}</div>
                    <div className="cl-user-info">
                      <div className="cl-user-name">{item.name || "User"}</div>
                      <div className="cl-user-mobile"><FaPhoneAlt /> {item.mobile || "—"}</div>
                    </div>
                  </div>

                  {/* Date */}
                  {(item.date || item.time) && (
                    <div className="cl-date"><FaCalendarAlt /> {item.date} {item.time}</div>
                  )}

                  {/* Expandable section */}
                  {isExpanded && (
                    <div className="cl-expanded">
                      {item.description && (
                        <div className="cl-detail-block">
                          <span className="cl-detail-label">Complaint Description</span>
                          <p className="cl-detail-text">{item.description}</p>
                        </div>
                      )}

                      {item.reply && (
                        <div className="cl-reply">
                          <div className="cl-reply-header"><FaComment /> Admin Reply</div>
                          <p className="cl-detail-text">{item.reply}</p>
                          {item.replyDate && (
                            <span className="cl-reply-date">{item.replyDate} {item.replyTime}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expand hint */}
                  <div className="cl-expand-hint">
                    {isExpanded ? "Tap to collapse" : "Tap for details"}
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

export default ComplaintListScreen;
