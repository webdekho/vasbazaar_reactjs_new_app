import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaEnvelope, FaMapMarkerAlt, FaCalendarAlt, FaPhoneAlt, FaUsers, FaChevronDown } from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";

const SkeletonCard = ({ delay }) => (
  <div className="th-card" style={{ animationDelay: `${delay}ms`, pointerEvents: "none" }}>
    <div style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
      <div className="th-skeleton-circle" style={{ width: 42, height: 42, borderRadius: 12 }} />
      <div className="th-skeleton-lines" style={{ flex: 1 }}><div className="th-skeleton-bar" style={{ width: "45%" }} /><div className="th-skeleton-bar" style={{ width: "65%" }} /></div>
    </div>
  </div>
);

const ReferralListScreen = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = async (pageNum = 0, append = false) => {
    if (!append) setLoading(true);
    const res = await walletService.getReferredUsers(pageNum, 10);
    setLoading(false);
    if (!res.success) { setError(res.message || "Failed to load."); return; }
    const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
    setUsers(append ? (prev) => [...prev, ...list] : list);
    setTotalRecords(res.data?.totalRecords || list.length);
    setHasMore(list.length >= 10);
  };

  useEffect(() => { fetchData(0); }, []);

  return (
    <div className="rf-page">
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text">
          <h1 className="th-title">Referral Users</h1>
          {totalRecords > 0 && <span className="th-count">{totalRecords} referral{totalRecords > 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* Stats card */}
      <div className="rf-stats-card">
        <div className="rf-stats-bg" />
        <div className="rf-stats-content">
          <div className="rf-stats-icon"><FaUsers /></div>
          <div>
            <div className="rf-stats-value">{totalRecords}</div>
            <div className="rf-stats-label">Total Referrals</div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && users.length === 0 ? (
        <div className="th-list">{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} delay={i * 80} />)}</div>
      ) : error ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap md-empty-icon-wrap--error"><FaUsers /></div>
          <h3 className="md-empty-title">Something went wrong</h3>
          <p className="md-empty-desc">{error}</p>
          <button className="md-btn-primary" type="button" onClick={() => fetchData(0)}>Retry</button>
        </div>
      ) : users.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap"><FiInbox /><div className="md-empty-ring" /></div>
          <h3 className="md-empty-title">No Referrals Yet</h3>
          <p className="md-empty-desc">Share your referral code to invite friends and earn rewards.</p>
          <button className="md-btn-primary" type="button" onClick={() => navigate("/customer/app/profile")}>Share Code</button>
        </div>
      ) : (
        <div className="th-list">
          {users.map((user, i) => {
            const isExp = expandedId === (user.id || i);
            return (
              <div key={user.id || i} className="rf-card" style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setExpandedId(isExp ? null : (user.id || i))}>
                <div className="rf-card-row">
                  <div className="rf-avatar">
                    {(user.name || "U")[0].toUpperCase()}
                  </div>
                  <div className="rf-info">
                    <div className="rf-name">{user.name || "User"}</div>
                    <div className="rf-phone"><FaPhoneAlt /> {user.mobileNumber || user.mobile || "—"}</div>
                  </div>
                  <div className="rf-num">#{i + 1}</div>
                  <FaChevronDown className={`wt-chevron${isExp ? " is-open" : ""}`} />
                </div>

                {isExp && (
                  <div className="wt-expanded">
                    {user.email && (
                      <div className="wt-detail-row"><span className="wt-detail-label"><FaEnvelope style={{ fontSize: "0.6rem" }} /> Email</span><span className="wt-detail-value">{user.email}</span></div>
                    )}
                    {user.city && (
                      <div className="wt-detail-row"><span className="wt-detail-label"><FaMapMarkerAlt style={{ fontSize: "0.6rem" }} /> City</span><span className="wt-detail-value">{user.city}</span></div>
                    )}
                    {user.joinedDate && (
                      <div className="wt-detail-row"><span className="wt-detail-label"><FaCalendarAlt style={{ fontSize: "0.6rem" }} /> Joined</span><span className="wt-detail-value">{user.joinedDate}</span></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {hasMore && (
            <button className="th-load-more" type="button" onClick={() => { const n = page + 1; setPage(n); fetchData(n, true); }} disabled={loading}>
              {loading ? <><span className="md-spinner" /> Loading...</> : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferralListScreen;
