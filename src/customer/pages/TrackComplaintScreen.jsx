import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaSearch, FaCheckCircle, FaClock,
  FaExclamationTriangle, FaTimes, FaChevronRight
} from "react-icons/fa";
import { complaintService } from "../services/complaintService";

const TrackComplaintScreen = () => {
  const navigate = useNavigate();
  const [complaintId, setComplaintId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [focused, setFocused] = useState(false);

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!complaintId.trim()) { setError("Please enter a Complaint ID."); return; }
    setError("");
    setLoading(true);
    setResult(null);

    // Fetch all complaints and find the matching one
    const res = await complaintService.getAll(0, 100);
    setLoading(false);

    if (res.success) {
      const records = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      const match = records.find((r) =>
        (r.txnId || "").toLowerCase() === complaintId.trim().toLowerCase() ||
        (r.id || "").toString() === complaintId.trim() ||
        (r.ticketNumber || "").toLowerCase() === complaintId.trim().toLowerCase()
      );
      if (match) {
        setResult(match);
      } else {
        setError("No complaint found with this ID. Please check and try again.");
      }
    } else {
      setError(res.message || "Failed to track complaint.");
    }
  };

  const getStatusConfig = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("close") || s.includes("success") || s.includes("resolved")) {
      return { label: "Resolved", color: "#00C853", icon: <FaCheckCircle /> };
    }
    if (s.includes("open") || s.includes("progress")) {
      return { label: "In Progress", color: "#FF9800", icon: <FaClock /> };
    }
    return { label: "Pending", color: "#FF9800", icon: <FaClock /> };
  };

  return (
    <div className="tc-page">
      {/* Header */}
      <div className="tc-header">
        <button className="tc-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="tc-header-text">
          <h1 className="tc-title">Track Complaint</h1>
          <p className="tc-subtitle">Bharat Connect Grievance</p>
        </div>
        <img src="/images/bbps.svg" alt="Bharat Connect" className="tc-bbps-logo" />
      </div>

      {/* Search form */}
      <form className="tc-form" onSubmit={handleTrack}>
        <div className={`tc-field${focused ? " is-focused" : ""}`}>
          <label className="tc-label">Complaint ID</label>
          <div className="tc-input-row">
            <FaSearch className="tc-input-icon" />
            <input
              className="tc-input"
              placeholder="Enter Complaint ID or Transaction ID"
              value={complaintId}
              onChange={(e) => { setComplaintId(e.target.value.toUpperCase()); if (error) setError(""); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="fc-error">
            <FaExclamationTriangle /> {error}
          </div>
        )}

        <button className="tc-submit" type="submit" disabled={loading}>
          {loading ? (
            <span className="fc-submit-loading"><span className="md-spinner" /> Tracking...</span>
          ) : (
            "Track"
          )}
        </button>
      </form>

      {/* View all complaints link */}
      <button className="tc-view-all" type="button" onClick={() => navigate("/customer/app/complaints")}>
        View All Complaints <FaChevronRight />
      </button>

      {/* Result modal */}
      {result && (
        <div className="tc-modal-overlay" onClick={() => setResult(null)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="tc-modal-close" type="button" onClick={() => setResult(null)}>
              <FaTimes />
            </button>

            {/* Status icon */}
            <div className="tc-modal-status-wrap" style={{ "--tc-color": getStatusConfig(result.status).color }}>
              {getStatusConfig(result.status).icon}
            </div>

            <h3 className="tc-modal-title">Complaint Status</h3>

            {/* Details */}
            <div className="tc-modal-details">
              <div className="tc-modal-row">
                <span className="tc-modal-label">Complaint ID</span>
                <span className="tc-modal-value">{result.txnId || result.id}</span>
              </div>
              <div className="tc-modal-row">
                <span className="tc-modal-label">Status</span>
                <span className="tc-modal-status-badge" style={{ "--tc-color": getStatusConfig(result.status).color }}>
                  {getStatusConfig(result.status).icon} {getStatusConfig(result.status).label}
                </span>
              </div>
              {result.name && (
                <div className="tc-modal-row">
                  <span className="tc-modal-label">Name</span>
                  <span className="tc-modal-value">{result.name}</span>
                </div>
              )}
              {result.mobile && (
                <div className="tc-modal-row">
                  <span className="tc-modal-label">Mobile</span>
                  <span className="tc-modal-value">{result.mobile}</span>
                </div>
              )}
              {(result.date || result.time) && (
                <div className="tc-modal-row">
                  <span className="tc-modal-label">Filed On</span>
                  <span className="tc-modal-value">{result.date} {result.time}</span>
                </div>
              )}
              {result.description && (
                <div className="tc-modal-row tc-modal-row--full">
                  <span className="tc-modal-label">Description</span>
                  <p className="tc-modal-desc">{result.description}</p>
                </div>
              )}
              {result.reply && (
                <div className="tc-modal-reply">
                  <span className="tc-modal-label">Admin Reply</span>
                  <p className="tc-modal-desc">{result.reply}</p>
                  {result.replyDate && <span className="tc-modal-reply-date">{result.replyDate} {result.replyTime}</span>}
                </div>
              )}
            </div>

            <button className="fc-btn-primary" type="button" onClick={() => setResult(null)} style={{ width: "100%", marginTop: 16 }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackComplaintScreen;
