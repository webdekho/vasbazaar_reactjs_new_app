import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaCheckCircle, FaChevronRight, FaExclamationTriangle,
  FaPhoneAlt, FaCalendarAlt, FaListAlt, FaFileAlt, FaIdCard
} from "react-icons/fa";
import { complaintService } from "../services/complaintService";
import { useCustomerModern } from "../context/CustomerModernContext";

const dispositionOptions = [
  "Transaction Successful, Amount Debited but services not received",
  "Transaction Successful, Amount Debited but Service Disconnected or Service Stopped",
  "Transaction Successful, Amount Debited but Late Payment Surcharge Charges add in next bill",
  "Erroneously paid in wrong account",
  "Duplicate Payment",
  "Erroneously paid the wrong amount",
  "Bill Paid but Amount not adjusted or still showing due amount",
  "Payment information not received from Biller or Delay in receiving payment information",
];

const ComplaintScreen = () => {
  const navigate = useNavigate();
  const { userData } = useCustomerModern();
  const [form, setForm] = useState({
    transactionId: "",
    mobile: userData?.mobile || userData?.mobileNumber || "",
    fromDate: "",
    toDate: "",
    disposition: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState("");

  const update = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.transactionId.trim()) { setError("Transaction ID is required."); return; }
    if (!form.mobile || form.mobile.length < 10) { setError("Valid 10-digit mobile number is required."); return; }
    if (!form.disposition) { setError("Please select a complaint disposition."); return; }
    setError("");
    setLoading(true);
    const ticket = `CMP${Date.now().toString().slice(-8)}`;
    const res = await complaintService.create({
      transactionReferenceId: form.transactionId,
      transactionId: form.transactionId,
      mobileNumber: form.mobile,
      fromDate: form.fromDate,
      toDate: form.toDate,
      complaintDisposition: form.disposition,
      disposition: form.disposition,
      complaintDescription: form.description,
      description: form.description,
      complaintType: "Transaction",
      ticketNumber: ticket,
    });
    setLoading(false);
    if (res.success) {
      setSuccess(ticket);
    } else {
      setError(res.message || "Failed to submit complaint.");
    }
  };

  /* ─── Success Screen ─── */
  if (success) {
    return (
      <div className="fc-page">
        <div className="fc-success">
          <div className="fc-success-icon-wrap">
            <FaCheckCircle />
            <div className="fc-success-ring" />
            <div className="fc-success-ring fc-success-ring--2" />
          </div>
          <h2 className="fc-success-title">Complaint Registered</h2>
          <div className="fc-success-ticket">
            <span className="fc-success-ticket-label">Ticket Number</span>
            <span className="fc-success-ticket-id">{success}</span>
          </div>
          <div className="fc-success-info">
            <p>Your complaint has been registered with <strong>Bharat Bill Payment System (BBPS)</strong>.</p>
            <p>Updates will be sent to your registered mobile number.</p>
            <p>Expected resolution: <strong>5-7 working days</strong>.</p>
          </div>
          <div className="fc-success-actions">
            <button className="fc-btn-primary" type="button" onClick={() => navigate("/customer/app/track-complaint")}>
              Track Complaint <FaChevronRight />
            </button>
            <button className="fc-btn-secondary" type="button" onClick={() => navigate("/customer/app/services")}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Form ─── */
  return (
    <div className="fc-page">
      {/* Header */}
      <div className="fc-header">
        <button className="fc-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="fc-header-text">
          <h1 className="fc-title">File Complaint</h1>
          <p className="fc-subtitle">Bharat Connect Grievance</p>
        </div>
        <button className="fc-track-btn" type="button" onClick={() => navigate("/customer/app/track-complaint")}>
          Track <FaChevronRight />
        </button>
      </div>

      {/* Complaint type indicator */}
      <div className="fc-type-bar">
        <div className="fc-type-dot" />
        <span className="fc-type-label">Type of Complaint</span>
        <span className="fc-type-value">Transaction</span>
      </div>

      <form className="fc-form" onSubmit={handleSubmit}>
        {/* Transaction ID */}
        <div className={`fc-field${focusedField === "txn" ? " is-focused" : ""}`}>
          <label className="fc-label">
            <FaIdCard className="fc-label-icon" />
            B-Connect Transaction ID
          </label>
          <input
            className="fc-input"
            placeholder="Enter B-Connect Transaction ID"
            value={form.transactionId}
            onChange={(e) => update("transactionId", e.target.value)}
            onFocus={() => setFocusedField("txn")}
            onBlur={() => setFocusedField("")}
          />
        </div>

        {/* Mobile Number */}
        <div className={`fc-field${focusedField === "mobile" ? " is-focused" : ""}`}>
          <label className="fc-label">
            <FaPhoneAlt className="fc-label-icon" />
            Mobile Number
          </label>
          <input
            className="fc-input"
            inputMode="numeric"
            maxLength={10}
            placeholder="Enter 10-digit mobile number"
            value={form.mobile}
            onChange={(e) => update("mobile", e.target.value.replace(/\D/g, ""))}
            onFocus={() => setFocusedField("mobile")}
            onBlur={() => setFocusedField("")}
          />
        </div>

        {/* Date range */}
        <div className="fc-date-row">
          <div className={`fc-field${focusedField === "from" ? " is-focused" : ""}`}>
            <label className="fc-label">
              <FaCalendarAlt className="fc-label-icon" />
              From Date
            </label>
            <input
              className="fc-input"
              type="date"
              value={form.fromDate}
              onChange={(e) => update("fromDate", e.target.value)}
              onFocus={() => setFocusedField("from")}
              onBlur={() => setFocusedField("")}
            />
          </div>
          <div className={`fc-field${focusedField === "to" ? " is-focused" : ""}`}>
            <label className="fc-label">
              <FaCalendarAlt className="fc-label-icon" />
              To Date
            </label>
            <input
              className="fc-input"
              type="date"
              value={form.toDate}
              onChange={(e) => update("toDate", e.target.value)}
              onFocus={() => setFocusedField("to")}
              onBlur={() => setFocusedField("")}
            />
          </div>
        </div>

        {/* Disposition */}
        <div className={`fc-field${focusedField === "disp" ? " is-focused" : ""}`}>
          <label className="fc-label">
            <FaListAlt className="fc-label-icon" />
            Complaint Disposition
          </label>
          <select
            className="fc-select"
            value={form.disposition}
            onChange={(e) => update("disposition", e.target.value)}
            onFocus={() => setFocusedField("disp")}
            onBlur={() => setFocusedField("")}
          >
            <option value="">-- Select Disposition --</option>
            {dispositionOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className={`fc-field${focusedField === "desc" ? " is-focused" : ""}`}>
          <label className="fc-label">
            <FaFileAlt className="fc-label-icon" />
            Complaint Description
          </label>
          <textarea
            className="fc-textarea"
            rows={4}
            placeholder="Describe your complaint in detail..."
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            onFocus={() => setFocusedField("desc")}
            onBlur={() => setFocusedField("")}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="fc-error">
            <FaExclamationTriangle /> {error}
          </div>
        )}

        {/* Submit */}
        <button className="fc-submit" type="submit" disabled={loading}>
          {loading ? (
            <span className="fc-submit-loading"><span className="md-spinner" /> Submitting...</span>
          ) : (
            "File Complaint"
          )}
        </button>

        <p className="fc-disclaimer">
          Complaints are processed through the Bharat Bill Payment System (BBPS) grievance mechanism. Resolution typically takes 5-7 working days.
        </p>
      </form>
    </div>
  );
};

export default ComplaintScreen;
