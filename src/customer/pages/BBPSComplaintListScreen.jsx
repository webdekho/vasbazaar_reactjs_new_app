import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaArrowLeft,
  FaSearch,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaSyncAlt,
  FaFilter,
  FaTimes,
} from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { bbpsComplaintService } from "../services/bbpsComplaintService";
import { useToast } from "../context/ToastContext";

const getStatusConfig = (status) => {
  const s = (status || "").toUpperCase();
  if (s === "SUCCESS" || s === "RESOLVED" || s === "CLOSED")
    return { label: "Success", color: "#00C853", icon: <FaCheckCircle /> };
  if (s === "FAILED" || s === "REJECTED")
    return { label: "Failed", color: "#FF3B30", icon: <FaExclamationCircle /> };
  return { label: "Pending", color: "#FF9800", icon: <FaClock /> };
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
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

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "PENDING", label: "Pending" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
];

const BBPSComplaintListScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  // Track complaint loading state
  const [trackingId, setTrackingId] = useState(null);

  // Register complaint modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [bConnectIdInput, setBConnectIdInput] = useState("");
  const [registering, setRegistering] = useState(false);

  // Check if coming from transaction with bConnectId
  useEffect(() => {
    const state = location.state;
    if (state?.bConnectId) {
      setBConnectIdInput(state.bConnectId);
      setShowRegisterModal(true);
      // Clear the state so it doesn't persist
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchData = useCallback(async (pageNum, append = false) => {
    setLoading(true);
    setError("");
    const res = await bbpsComplaintService.getMyComplaints(
      pageNum,
      10,
      searchValue,
      statusFilter
    );
    setLoading(false);

    if (!res.success) {
      setError(res.message || "Failed to load complaints.");
      return;
    }

    const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
    setRecords(append ? (prev) => [...prev, ...list] : list);
    setTotalRecords(res.data?.totalRecords || list.length);
    setHasMore(list.length >= 10);
  }, [searchValue, statusFilter]);

  useEffect(() => {
    setPage(0);
    fetchData(0);
  }, [fetchData]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchData(next, true);
  };

  const handleSearch = () => {
    setSearchValue(searchInput);
    setPage(0);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchValue("");
    setStatusFilter("");
    setPage(0);
  };

  const handleTrackComplaint = async (complaintId, e) => {
    e?.stopPropagation();
    setTrackingId(complaintId);

    const res = await bbpsComplaintService.trackComplaint(complaintId);
    setTrackingId(null);

    if (!res.success) {
      showToast(res.message || "Failed to track complaint", "error");
      return;
    }

    const trackData = res.data;
    if (trackData?.tracked) {
      showToast(
        trackData.message || `Status: ${trackData.status || trackData.apiStatus}`,
        trackData.status === "SUCCESS" ? "success" : "info"
      );
      // Refresh the list to show updated status
      fetchData(0);
      setPage(0);
    } else {
      showToast(trackData?.message || "Could not track complaint at this time", "warning");
    }
  };

  const handleRegisterComplaint = async () => {
    if (!bConnectIdInput.trim()) {
      showToast("Please enter a bConnect ID", "error");
      return;
    }

    setRegistering(true);
    const res = await bbpsComplaintService.registerComplaint(bConnectIdInput.trim());
    setRegistering(false);

    if (!res.success) {
      showToast(res.message || "Failed to register complaint", "error");
      return;
    }

    showToast(res.data?.message || "Complaint registered successfully!", "success");
    setShowRegisterModal(false);
    setBConnectIdInput("");
    // Refresh list
    fetchData(0);
    setPage(0);
  };

  return (
    <div className="cl-page">
      {/* Header */}
      <div className="cl-header">
        <button className="cl-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="cl-header-text">
          <h1 className="cl-title">BBPS Complaints</h1>
          {totalRecords > 0 && (
            <span className="cl-count">
              {totalRecords} complaint{totalRecords > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bbps-filter-bar">
        <div className="bbps-search-row">
          <div className="bbps-search-input-wrap">
            <FaSearch className="bbps-search-icon" />
            <input
              type="text"
              className="bbps-search-input"
              placeholder="Search by consumer no, tracking ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            {searchInput && (
              <button
                type="button"
                className="bbps-search-clear"
                onClick={() => setSearchInput("")}
              >
                <FaTimes />
              </button>
            )}
          </div>
          <button
            type="button"
            className="bbps-filter-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter />
          </button>
        </div>

        {showFilters && (
          <div className="bbps-filter-options">
            <select
              className="bbps-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" className="bbps-search-btn" onClick={handleSearch}>
              Search
            </button>
            {(searchValue || statusFilter) && (
              <button type="button" className="bbps-clear-btn" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="cl-actions">
        <button
          className="cl-action-btn cl-action-btn--primary"
          type="button"
          onClick={() => setShowRegisterModal(true)}
        >
          + Register Complaint
        </button>
      </div>

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="cl-list">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} delay={i * 100} />
          ))}
        </div>
      ) : error ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap md-empty-icon-wrap--error">
            <FaExclamationTriangle />
          </div>
          <h3 className="md-empty-title">Something went wrong</h3>
          <p className="md-empty-desc">{error}</p>
          <button className="md-btn-primary" type="button" onClick={() => fetchData(0)}>
            Try Again
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap">
            <FiInbox />
            <div className="md-empty-ring" />
          </div>
          <h3 className="md-empty-title">No BBPS Complaints Found</h3>
          <p className="md-empty-desc">
            {searchValue || statusFilter
              ? "No complaints match your search criteria."
              : "You haven't raised any BBPS complaints yet."}
          </p>
          {(searchValue || statusFilter) && (
            <button className="md-btn-secondary" type="button" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="cl-list">
          {records.map((item, i) => {
            const st = getStatusConfig(item.status);
            const isExpanded = expandedId === item.id;
            const isTracking = trackingId === item.id;

            return (
              <div
                key={item.id}
                className="cl-card"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {/* Accent */}
                <div className="cl-card-accent" style={{ background: st.color }} />

                <div className="cl-card-body">
                  {/* Top row: Tracking ID + status */}
                  <div className="cl-card-top">
                    <div className="cl-txn-id">
                      <span className="cl-txn-label">Tracking ID</span>
                      <span className="cl-txn-value">{item.trackingId || `#${item.id}`}</span>
                    </div>
                    <div className="cl-status" style={{ "--st-color": st.color }}>
                      {st.icon} {st.label}
                    </div>
                  </div>

                  {/* Consumer info */}
                  <div className="bbps-complaint-info">
                    <div className="bbps-info-row">
                      <span className="bbps-info-label">Consumer No:</span>
                      <span className="bbps-info-value">{item.consumerNo || "-"}</span>
                    </div>
                    <div className="bbps-info-row">
                      <span className="bbps-info-label">Amount:</span>
                      <span className="bbps-info-value bbps-amount">
                        {item.amount != null ? `Rs. ${item.amount}` : "-"}
                      </span>
                    </div>
                    {item.operatorId?.operatorName && (
                      <div className="bbps-info-row">
                        <span className="bbps-info-label">Operator:</span>
                        <span className="bbps-info-value">{item.operatorId.operatorName}</span>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  {item.createdAt && (
                    <div className="cl-date">
                      <FaClock style={{ marginRight: 6 }} />
                      {formatDate(item.createdAt)}
                    </div>
                  )}

                  {/* Expandable section */}
                  {isExpanded && (
                    <div className="cl-expanded">
                      <div className="bbps-detail-grid">
                        <div className="bbps-detail-item">
                          <span className="bbps-detail-label">bConnect ID</span>
                          <span className="bbps-detail-value">{item.bConnectId || "-"}</span>
                        </div>
                        {item.userId?.name && (
                          <div className="bbps-detail-item">
                            <span className="bbps-detail-label">User</span>
                            <span className="bbps-detail-value">
                              {item.userId.name} ({item.userId.mobileNumber})
                            </span>
                          </div>
                        )}
                        {item.reason && (
                          <div className="bbps-detail-item bbps-detail-full">
                            <span className="bbps-detail-label">Reason</span>
                            <span className="bbps-detail-value">{item.reason}</span>
                          </div>
                        )}
                        {item.updatedAt && (
                          <div className="bbps-detail-item">
                            <span className="bbps-detail-label">Last Updated</span>
                            <span className="bbps-detail-value">{formatDate(item.updatedAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Track button */}
                      {item.status === "PENDING" && (
                        <button
                          type="button"
                          className="bbps-track-btn"
                          onClick={(e) => handleTrackComplaint(item.id, e)}
                          disabled={isTracking}
                        >
                          {isTracking ? (
                            <>
                              <span className="md-spinner md-spinner--sm" /> Tracking...
                            </>
                          ) : (
                            <>
                              <FaSyncAlt /> Track Status
                            </>
                          )}
                        </button>
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
            <button
              className="th-load-more"
              type="button"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="md-spinner" /> Loading...
                </>
              ) : (
                "Load More"
              )}
            </button>
          )}
        </div>
      )}

      {/* Register Complaint Modal */}
      {showRegisterModal && (
        <div className="bf-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="bf-modal bbps-register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bbps-modal-header">
              <h3>Register BBPS Complaint</h3>
              <button
                type="button"
                className="bf-modal-close"
                onClick={() => setShowRegisterModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="bbps-modal-body">
              <p className="bbps-modal-desc">
                Enter the bConnect Transaction ID to register a complaint for your BBPS transaction.
              </p>
              <div className="bbps-modal-field">
                <label className="bbps-modal-label">bConnect ID</label>
                <input
                  type="text"
                  className="bbps-modal-input"
                  placeholder="e.g., CC014110BAAE00054718"
                  value={bConnectIdInput}
                  onChange={(e) => setBConnectIdInput(e.target.value)}
                />
              </div>
            </div>
            <div className="bbps-modal-actions">
              <button
                type="button"
                className="bbps-modal-cancel"
                onClick={() => setShowRegisterModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bbps-modal-submit"
                onClick={handleRegisterComplaint}
                disabled={registering || !bConnectIdInput.trim()}
              >
                {registering ? (
                  <>
                    <span className="md-spinner md-spinner--sm" /> Registering...
                  </>
                ) : (
                  "Register Complaint"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BBPSComplaintListScreen;
