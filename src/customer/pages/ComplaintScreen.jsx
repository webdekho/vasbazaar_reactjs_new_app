import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaCheckCircle, FaChevronRight, FaExclamationTriangle,
  FaPhoneAlt, FaCalendarAlt, FaListAlt, FaFileAlt, FaIdCard
} from "react-icons/fa";
import { complaintService } from "../services/complaintService";
import { useCustomerModern } from "../context/CustomerModernContext";

// NPCI predefined dispositions for a Transaction-type Bharat Connect complaint.
// Order and wording follow the NPCI guideline exactly.
const dispositionOptions = [
  "Transaction Successful, Amount Debited but services not received",
  "Transaction Successful, Amount Debited but Service Disconnected or Service Stopped",
  "Transaction Successful, Amount Debited but Late Payment Surcharge Charges add in next bill",
  "Erroneously paid in wrong account",
  "Duplicate Payment",
  "Erroneously paid the wrong amount",
  "Payment information not received from Biller or Delay in receiving payment information from the Biller",
  "Bill Paid but Amount not adjusted or still showing due amount",
];

const ComplaintScreen = () => {
  const navigate = useNavigate();
  const { userData } = useCustomerModern();
  // Search basis: "txn" = B-Connect TXN ID, "mobile" = Mobile Number + Date Range.
  const [basis, setBasis] = useState("txn");
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
    if (basis === "txn") {
      if (!form.transactionId.trim()) { setError("B-Connect TXN ID is required."); return; }
    } else {
      if (!form.mobile || form.mobile.length < 10) { setError("Valid 10-digit mobile number is required."); return; }
      if (!form.fromDate || !form.toDate) { setError("Please select a From and To date."); return; }
    }
    if (!form.disposition) { setError("Please select a complaint disposition."); return; }
    setError("");
    setLoading(true);
    const ticket = `CMP${Date.now().toString().slice(-8)}`;
    const res = await complaintService.create({
      complaintType: "Transaction",
      complaintBasis: basis === "txn" ? "TXN_ID" : "MOBILE_DATE",
      transactionReferenceId: basis === "txn" ? form.transactionId : "",
      transactionId: basis === "txn" ? form.transactionId : "",
      bConnectTxnId: basis === "txn" ? form.transactionId : "",
      mobileNumber: basis === "mobile" ? form.mobile : "",
      fromDate: basis === "mobile" ? form.fromDate : "",
      toDate: basis === "mobile" ? form.toDate : "",
      complaintDisposition: form.disposition,
      disposition: form.disposition,
      complaintDescription: form.description,
      description: form.description,
      ticketNumber: ticket,
    });
    setLoading(false);
    if (res.success) {
      // Prefer the gateway-issued complaint identifiers; fall back to the local ticket.
      const d = res.data || {};
      setSuccess({
        complaintId: d.complaintId || d.trackingId || d.ticketNumber || ticket,
        complaintAssigned: d.complaintAssigned || d.assignedTo || "Bharat Connect (BBPS)",
      });
    } else {
      setError(res.message || "Failed to submit complaint.");
    }
  };

  /* ─── Success / Response Screen ─── */
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
          {/* NPCI-mandated response fields: complaintAssigned and complaintId */}
          <div className="fc-success-fields">
            <div className="fc-success-field-row">
              <span className="fc-success-field-label">Complaint ID</span>
              <span className="fc-success-field-value">{success.complaintId}</span>
            </div>
            <div className="fc-success-field-row">
              <span className="fc-success-field-label">Complaint Assigned</span>
              <span className="fc-success-field-value">{success.complaintAssigned}</span>
            </div>
          </div>
          <div className="fc-success-info">
            <p>Your complaint has been registered with <strong>Bharat Connect (BBPS)</strong>.</p>
            <p>You can track the status of your complaint using your Complaint ID.</p>
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
      {/* Header with Bharat Connect logo top-right */}
      <div className="fc-header">
        <button className="fc-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="fc-header-text">
          <h1 className="fc-title">Complaint Registration</h1>
          <p className="fc-subtitle">Bharat Connect Grievance</p>
        </div>
        <img src="/images/bbps.svg" alt="Bharat Connect" className="fc-bbps-logo" />
      </div>

      <form className="fc-form" onSubmit={handleSubmit}>
        {/* a. Type of Complaint — Transaction (radio, pre-selected) */}
        <div className="fc-field">
          <label className="fc-label">
            <FaListAlt className="fc-label-icon" />
            Type of Complaint
          </label>
          <label className="fc-radio">
            <input type="radio" name="complaintType" checked readOnly />
            <span className="fc-radio-mark" />
            <span className="fc-radio-text">Transaction</span>
          </label>
        </div>

        {/* b. B-Connect TXN ID OR Mobile + Date Range */}
        <div className="fc-basis-tabs">
          <button type="button" className={`fc-basis-tab${basis === "txn" ? " is-active" : ""}`} onClick={() => { setBasis("txn"); setError(""); }}>
            B-Connect TXN ID
          </button>
          <button type="button" className={`fc-basis-tab${basis === "mobile" ? " is-active" : ""}`} onClick={() => { setBasis("mobile"); setError(""); }}>
            Mobile No. & Date
          </button>
        </div>

        {basis === "txn" ? (
          <div className={`fc-field${focusedField === "txn" ? " is-focused" : ""}`}>
            <label className="fc-label">
              <FaIdCard className="fc-label-icon" />
              B-Connect TXN ID
            </label>
            <input
              className="fc-input"
              placeholder="Enter B-Connect TXN ID (received in Pay Response)"
              value={form.transactionId}
              onChange={(e) => update("transactionId", e.target.value)}
              onFocus={() => setFocusedField("txn")}
              onBlur={() => setFocusedField("")}
            />
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* c. Complaint Disposition */}
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

        {/* d. Complaint Description */}
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

        {error && (
          <div className="fc-error">
            <FaExclamationTriangle /> {error}
          </div>
        )}

        <button className="fc-submit" type="submit" disabled={loading}>
          {loading ? (
            <span className="fc-submit-loading"><span className="md-spinner" /> Submitting...</span>
          ) : (
            "Register Complaint"
          )}
        </button>

        <button className="fc-track-link" type="button" onClick={() => navigate("/customer/app/track-complaint")}>
          Track an existing complaint <FaChevronRight />
        </button>

        <p className="fc-disclaimer">
          Complaints are processed through the Bharat Connect (BBPS) grievance mechanism.
        </p>
      </form>
    </div>
  );
};

export default ComplaintScreen;
