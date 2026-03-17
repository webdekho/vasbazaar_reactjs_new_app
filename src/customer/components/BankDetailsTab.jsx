import { useState, useEffect, useCallback } from "react";
import { FaPlus, FaCreditCard, FaArrowRight, FaPen, FaTimes, FaCheck, FaSpinner, FaExclamationCircle, FaUniversity } from "react-icons/fa";
import { walletService } from "../services/walletService";

const maskAccount = (num) => (num ? `****${num.slice(-4)}` : "");

const STATUS_STYLES = {
  active: { bg: "#E8F5E9", color: "#2E7D32", label: "Active" },
  pending: { bg: "#FFF3E0", color: "#E65100", label: "Pending" },
  rejected: { bg: "#FFEBEE", color: "#C62828", label: "Rejected" },
};

const REJECT_REASONS = {
  name_miss: "Name mismatch with official records",
  account_mismatch: "Account number mismatch",
  ifsc_invalid: "Invalid IFSC code",
  bank_verify_fail: "Bank verification failed",
  duplicate_account: "Account already registered",
  account_inactive: "Bank account is inactive",
  other: "Verification failed",
};

export default function BankDetailsTab() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);

  const [form, setForm] = useState({ accountNumber: "", ifscCode: "", bankName: "" });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [transferData, setTransferData] = useState({ amount: "", transferMode: "IMPS" });
  const [transferErrors, setTransferErrors] = useState({});
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState(null);

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await walletService.getBankDetails(0, 50, statusFilter);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setBanks(list);
    } else {
      setError(res.message || "Failed to load bank accounts");
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  const validateForm = () => {
    const errs = {};
    if (!form.accountNumber.trim()) errs.accountNumber = "Account number is required";
    else if (form.accountNumber.length < 8) errs.accountNumber = "Invalid account number";
    if (!form.ifscCode.trim()) errs.ifscCode = "IFSC code is required";
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) errs.ifscCode = "Invalid IFSC code format";
    if (!form.bankName.trim()) errs.bankName = "Bank name is required";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitBank = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    const res = editingBank
      ? await walletService.updateBankDetails({ id: editingBank.id, ...form })
      : await walletService.addBankDetails(form);
    setSubmitting(false);
    if (res.success) {
      closeAddModal();
      fetchBanks();
    } else {
      setFormErrors({ submit: res.message || "Failed to save bank account" });
    }
  };

  const openEditBank = (bank) => {
    setEditingBank(bank);
    setForm({ accountNumber: bank.accountNumber, ifscCode: bank.ifscCode, bankName: bank.bankName || "" });
    setFormErrors({});
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setEditingBank(null);
    setForm({ accountNumber: "", ifscCode: "", bankName: "" });
    setFormErrors({});
  };

  const openTransfer = (bank) => {
    setSelectedBank(bank);
    setTransferData({ amount: "", transferMode: "IMPS" });
    setTransferErrors({});
    setTransferResult(null);
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    const errs = {};
    if (!transferData.amount.trim() || isNaN(parseFloat(transferData.amount)) || parseFloat(transferData.amount) <= 0) {
      errs.amount = "Enter a valid amount";
    }
    setTransferErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setTransferring(true);
    const res = await walletService.fundTransfer({
      bankId: selectedBank.id,
      amount: transferData.amount,
      transferMode: transferData.transferMode,
    });
    setTransferring(false);
    if (res.success) {
      setTransferResult({ status: "success", reqId: res.data?.reqId, apiRefId: res.data?.apiRefId });
    } else {
      setTransferResult({ status: "error", message: res.message || "Transfer failed" });
    }
  };

  return (
    <div className="cm-bank-tab">
      {/* Header */}
      <div className="cm-bank-header">
        <h3 className="cm-bank-title">Bank Accounts</h3>
        <button type="button" className="cm-bank-add-btn" onClick={() => { setEditingBank(null); setForm({ accountNumber: "", ifscCode: "", bankName: "" }); setFormErrors({}); setShowAddModal(true); }}>
          <FaPlus /> Add Bank
        </button>
      </div>

      {/* Status filter */}
      <div className="cm-bank-filters">
        {["active", "pending", "rejected"].map((s) => (
          <button key={s} type="button"
            className={`cm-bank-filter-chip${statusFilter === s ? " is-active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Bank list */}
      {loading ? (
        <div className="cm-contact-empty"><span className="cm-contact-loading" /><p>Loading bank accounts...</p></div>
      ) : error ? (
        <div className="cm-contact-empty"><FaExclamationCircle className="cm-contact-empty-icon" style={{ color: "#ef4444" }} /><p className="cm-contact-empty-desc">{error}</p>
          <button className="cm-button" type="button" onClick={fetchBanks} style={{ marginTop: 12, maxWidth: 140 }}>Retry</button></div>
      ) : banks.length === 0 ? (
        <div className="cm-contact-empty"><FaUniversity className="cm-contact-empty-icon" /><p className="cm-contact-empty-title">No {statusFilter} bank accounts</p>
          <p className="cm-contact-empty-desc">{statusFilter === "active" ? "Add a bank account to enable fund transfers" : `No bank accounts with ${statusFilter} status`}</p></div>
      ) : (
        <div className="cm-bank-list">
          {banks.map((bank, i) => {
            const st = STATUS_STYLES[bank.status?.toLowerCase()] || STATUS_STYLES.pending;
            return (
              <div key={bank.id || i} className="cm-bank-card">
                <div className="cm-bank-card-header">
                  <div className="cm-bank-card-info">
                    <FaCreditCard className="cm-bank-card-icon" />
                    <div>
                      <div className="cm-bank-card-name">{bank.bankName || "Bank Account"}</div>
                      <div className="cm-bank-card-number">{maskAccount(bank.accountNumber)}</div>
                    </div>
                  </div>
                  <span className="cm-bank-status-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>

                <div className="cm-bank-card-details">
                  <div className="cm-bank-detail-row"><span>IFSC Code:</span><strong>{bank.ifscCode}</strong></div>
                  <div className="cm-bank-detail-row"><span>Account Holder:</span><strong>{bank.name || "\u2014"}</strong></div>
                  {bank.reason && (
                    <div className="cm-bank-detail-row cm-bank-reject"><span>Reason:</span><strong>{REJECT_REASONS[bank.reason] || `Rejected: ${bank.reason}`}</strong></div>
                  )}
                  <div className="cm-bank-detail-row"><span>Added:</span><strong>{bank.date || "\u2014"}</strong></div>
                </div>

                <div className="cm-bank-card-actions">
                  {bank.status?.toLowerCase() === "active" && (
                    <button type="button" className="cm-bank-transfer-btn" onClick={() => openTransfer(bank)}>
                      <FaArrowRight /> Transfer
                    </button>
                  )}
                  {(bank.status?.toLowerCase() === "pending" || bank.status?.toLowerCase() === "rejected") && (
                    <button type="button" className="cm-bank-edit-btn" onClick={() => openEditBank(bank)}>
                      <FaPen /> Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="cm-modal-overlay" onClick={closeAddModal}>
          <div className="cm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <h4>{editingBank ? "Edit Bank Account" : "Add Bank Account"}</h4>
              <button type="button" className="cm-modal-close" onClick={closeAddModal}><FaTimes /></button>
            </div>
            <div className="cm-modal-body">
              <div className="cm-form-group">
                <label>Bank Name *</label>
                <input type="text" placeholder="e.g., State Bank of India" value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })} disabled={submitting}
                  className={formErrors.bankName ? "cm-input-error" : ""} />
                {formErrors.bankName && <span className="cm-form-error">{formErrors.bankName}</span>}
              </div>
              <div className="cm-form-group">
                <label>Account Number *</label>
                <input type="text" placeholder="Enter account number" value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} disabled={submitting}
                  inputMode="numeric" className={formErrors.accountNumber ? "cm-input-error" : ""} />
                {formErrors.accountNumber && <span className="cm-form-error">{formErrors.accountNumber}</span>}
              </div>
              <div className="cm-form-group">
                <label>IFSC Code *</label>
                <input type="text" placeholder="e.g., SBIN0001234" value={form.ifscCode}
                  onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} disabled={submitting}
                  style={{ textTransform: "uppercase" }} className={formErrors.ifscCode ? "cm-input-error" : ""} />
                {formErrors.ifscCode && <span className="cm-form-error">{formErrors.ifscCode}</span>}
              </div>
              {formErrors.submit && <p className="cm-form-error" style={{ marginTop: 8 }}>{formErrors.submit}</p>}
            </div>
            <div className="cm-modal-footer">
              <button type="button" className="cm-button" onClick={handleSubmitBank} disabled={submitting}>
                {submitting ? <FaSpinner className="cm-spin" /> : <FaCheck />}
                {editingBank ? "Update Account" : "Add Account"}
              </button>
              <button type="button" className="cm-button-ghost" onClick={closeAddModal} disabled={submitting}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="cm-modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="cm-modal-content" onClick={(e) => e.stopPropagation()}>
            {transferResult?.status === "success" ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <FaCheck style={{ fontSize: 48, color: "#4CAF50", marginBottom: 12 }} />
                <h4 style={{ margin: "0 0 4px", fontSize: 18 }}>Transfer Successful!</h4>
                <p style={{ color: "#666", fontSize: 13, margin: "0 0 16px" }}>Your transfer has been processed</p>
                {(transferResult.reqId || transferResult.apiRefId) && (
                  <div style={{ background: "#f9f9f9", borderRadius: 12, padding: 12, marginBottom: 16, textAlign: "left" }}>
                    {transferResult.reqId && <div className="cm-bank-detail-row"><span>Request ID:</span><strong>{transferResult.reqId}</strong></div>}
                    {transferResult.apiRefId && <div className="cm-bank-detail-row"><span>Reference ID:</span><strong>{transferResult.apiRefId}</strong></div>}
                  </div>
                )}
                <button type="button" className="cm-button" onClick={() => setShowTransferModal(false)}>Close</button>
              </div>
            ) : transferResult?.status === "error" ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <FaExclamationCircle style={{ fontSize: 48, color: "#F44336", marginBottom: 12 }} />
                <h4 style={{ margin: "0 0 4px", fontSize: 18, color: "#F44336" }}>Transfer Failed</h4>
                <p style={{ color: "#666", fontSize: 13, margin: "0 0 16px" }}>{transferResult.message}</p>
                <button type="button" className="cm-button" onClick={() => setTransferResult(null)}>Retry</button>
                <button type="button" className="cm-button-ghost" onClick={() => setShowTransferModal(false)} style={{ marginTop: 8 }}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="cm-modal-header">
                  <h4>Fund Transfer</h4>
                  <button type="button" className="cm-modal-close" onClick={() => setShowTransferModal(false)}><FaTimes /></button>
                </div>
                <div className="cm-modal-body">
                  <div className="cm-bank-select-card">
                    <FaCreditCard style={{ color: "#1976D2", fontSize: 20, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", fontWeight: 600 }}>To Bank Account</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedBank?.bankName}</div>
                      <div style={{ fontSize: 12, color: "#1976D2" }}>{maskAccount(selectedBank?.accountNumber)}</div>
                    </div>
                  </div>
                  <div className="cm-form-group">
                    <label>Amount (₹) *</label>
                    <input type="text" placeholder="Enter amount" value={transferData.amount}
                      onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                      disabled={transferring} inputMode="decimal"
                      className={transferErrors.amount ? "cm-input-error" : ""} />
                    {transferErrors.amount && <span className="cm-form-error">{transferErrors.amount}</span>}
                  </div>
                  <div className="cm-form-group">
                    <label>Transfer Mode</label>
                    <div className="cm-transfer-modes">
                      {["IMPS", "NEFT"].map((mode) => (
                        <button key={mode} type="button"
                          className={`cm-transfer-mode${transferData.transferMode === mode ? " is-active" : ""}`}
                          onClick={() => setTransferData({ ...transferData, transferMode: mode })}
                          disabled={transferring}
                        >{mode}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="cm-modal-footer">
                  <button type="button" className="cm-bank-transfer-btn" style={{ width: "100%", justifyContent: "center" }} onClick={handleTransfer} disabled={transferring}>
                    {transferring ? <FaSpinner className="cm-spin" /> : <FaArrowRight />}
                    Transfer Now
                  </button>
                  <button type="button" className="cm-button-ghost" onClick={() => setShowTransferModal(false)} disabled={transferring}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
