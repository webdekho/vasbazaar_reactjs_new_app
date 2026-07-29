import { useState, useEffect, useCallback } from "react";
import { FaPlus, FaCreditCard, FaArrowRight, FaPen, FaTimes, FaCheck, FaSpinner, FaExclamationCircle, FaUniversity } from "react-icons/fa";
import { walletService } from "../services/walletService";
import { userService } from "../services/userService";
import { sanitizeBackendMessage } from "../utils/userMessages";

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

// Backend rejects anything below this (Helper.processWalletDeductionForFundTransfer).
const MIN_TRANSFER_AMOUNT = 100;

const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BankDetailsTab() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [balance, setBalance] = useState(null);

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
      setError(sanitizeBackendMessage(res.message, "Failed to load bank accounts"));
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  // Wallet balance is needed to pre-empt the backend's "Insufficient wallet
  // balance" rejection. Served from the cached profile, so this is cheap.
  const refreshBalance = useCallback(async (force = false) => {
    // The profile (and therefore the balance) is cached for 2 min — after a
    // transfer that cache is stale by definition, so drop it first.
    if (force) userService.invalidateProfile();
    const res = await walletService.getWalletBalance();
    if (res.success) setBalance(Number(res.data?.balance ?? 0));
  }, []);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const modalOpen = showAddModal || showTransferModal;

  // While a modal is up, lock the page behind it and let Escape dismiss it —
  // otherwise the list scrolls under the overlay and there is no keyboard exit.
  useEffect(() => {
    if (!modalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showAddModal) { if (!submitting) closeAddModal(); }
      else if (!transferring) setShowTransferModal(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, showAddModal, submitting, transferring]);

  const validateForm = () => {
    const errs = {};
    if (!form.accountNumber.trim()) errs.accountNumber = "Account number is required";
    else if (form.accountNumber.length < 8) errs.accountNumber = "Invalid account number";
    if (!form.ifscCode.trim()) errs.ifscCode = "IFSC code is required";
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) errs.ifscCode = "Format: AAAA0NNNNNN (4 letters + 0 + 6 alphanumeric)";
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

    if (!res.success) {
      setFormErrors({ submit: sanitizeBackendMessage(res.message, "Failed to save bank account") });
      return;
    }

    // The backend always answers 201/200 here — even when penny-drop
    // verification did NOT pass. The account then lands in `pending` instead of
    // `active`, and the reason ("name mismatch", "could not be completed") is
    // returned as the response *data*, not the message. Without surfacing it the
    // user is bounced back to an Active tab that still looks empty, as if the
    // save silently failed.
    const outcome = typeof res.data === "string" ? res.data : "";
    const verified = outcome.toLowerCase().includes("verified successfully");

    closeAddModal();
    setNotice({
      type: verified ? "success" : "warn",
      text: outcome || (verified ? "Bank account verified successfully" : "Bank account saved, pending approval"),
    });

    // Land the user on the tab the account actually went to.
    if (verified) {
      if (statusFilter === "active") fetchBanks(); else setStatusFilter("active");
    } else if (statusFilter === "pending") {
      fetchBanks();
    } else {
      setStatusFilter("pending");
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
    refreshBalance();
  };

  const handleTransfer = async () => {
    const errs = {};
    const amount = parseFloat(transferData.amount);
    // Mirror the backend's own limits so the user is told before a round trip
    // that debits nothing but still fails.
    if (!transferData.amount.trim() || isNaN(amount) || amount <= 0) {
      errs.amount = "Enter a valid amount";
    } else if (amount < MIN_TRANSFER_AMOUNT) {
      errs.amount = `Minimum transfer amount is ${formatAmount(MIN_TRANSFER_AMOUNT)}`;
    } else if (balance !== null && amount > balance) {
      errs.amount = `Insufficient wallet balance (available ${formatAmount(balance)})`;
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
      refreshBalance(true);
    } else {
      setTransferResult({ status: "error", message: sanitizeBackendMessage(res.message, "Transfer failed") });
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

      {/* Outcome of the last add/update — a saved-but-unverified account lands in
          Pending, which is otherwise invisible from the Active tab. */}
      {notice && (
        <div className={`cm-bank-notice cm-bank-notice--${notice.type}`} role="status">
          {notice.type === "success" ? <FaCheck /> : <FaExclamationCircle />}
          <span>{notice.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><FaTimes /></button>
        </div>
      )}

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
        <div className="cm-modal-overlay" onClick={submitting ? undefined : closeAddModal}>
          <div className="cm-modal-content" role="dialog" aria-modal="true" aria-labelledby="cm-bank-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <h4 id="cm-bank-modal-title">{editingBank ? "Edit Bank Account" : "Add Bank Account"}</h4>
              <button type="button" className="cm-modal-close" aria-label="Close" onClick={closeAddModal} disabled={submitting}><FaTimes /></button>
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
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18) })} disabled={submitting}
                  inputMode="numeric" autoComplete="off" maxLength={18}
                  className={formErrors.accountNumber ? "cm-input-error" : ""} />
                {formErrors.accountNumber && <span className="cm-form-error">{formErrors.accountNumber}</span>}
              </div>
              <div className="cm-form-group">
                <label>IFSC Code *</label>
                {/* No text-transform here: it would uppercase the placeholder too ("E.G., SBIN…").
                    The onChange already upper-cases what the user types. */}
                <input type="text" placeholder="e.g., SBIN0001234" value={form.ifscCode} maxLength={11}
                  onChange={(e) => setForm({ ...form, ifscCode: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 11) })} disabled={submitting}
                  autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  className={formErrors.ifscCode ? "cm-input-error" : ""} />
                {formErrors.ifscCode
                  ? <span className="cm-form-error">{formErrors.ifscCode}</span>
                  : <span className="cm-form-hint">11 characters — 4 letters, then 0, then 6 more</span>}
              </div>
              {formErrors.submit && <p className="cm-form-error" style={{ marginTop: 8 }}>{formErrors.submit}</p>}
              <p className="cm-form-hint" style={{ marginTop: 4 }}>
                We verify the account against your registered name. If it does not match, the account is
                saved for admin approval and cannot receive transfers until approved.
              </p>
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
        <div className="cm-modal-overlay" onClick={transferring ? undefined : () => setShowTransferModal(false)}>
          <div className="cm-modal-content" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {transferResult?.status === "success" ? (
              <div style={{ padding: 24, textAlign: "center", overflowY: "auto" }}>
                <FaCheck style={{ fontSize: 48, color: "#4CAF50", marginBottom: 12 }} />
                <h4 style={{ margin: "0 0 4px", fontSize: 18 }}>Transfer Successful!</h4>
                <p style={{ color: "var(--cm-muted, #666)", fontSize: 13, margin: "0 0 16px" }}>Your transfer has been processed</p>
                {(transferResult.reqId || transferResult.apiRefId) && (
                  <div style={{ background: "var(--cm-bg-secondary, #f9f9f9)", borderRadius: 12, padding: 12, marginBottom: 16, textAlign: "left" }}>
                    {transferResult.reqId && <div className="cm-bank-detail-row"><span>Request ID:</span><strong>{transferResult.reqId}</strong></div>}
                    {transferResult.apiRefId && <div className="cm-bank-detail-row"><span>Reference ID:</span><strong>{transferResult.apiRefId}</strong></div>}
                  </div>
                )}
                <button type="button" className="cm-button" onClick={() => setShowTransferModal(false)}>Close</button>
              </div>
            ) : transferResult?.status === "error" ? (
              <div style={{ padding: 24, textAlign: "center", overflowY: "auto" }}>
                <FaExclamationCircle style={{ fontSize: 48, color: "#F44336", marginBottom: 12 }} />
                <h4 style={{ margin: "0 0 4px", fontSize: 18, color: "#F44336" }}>Transfer Failed</h4>
                <p style={{ color: "var(--cm-muted, #666)", fontSize: 13, margin: "0 0 16px" }}>{transferResult.message}</p>
                <button type="button" className="cm-button" onClick={() => setTransferResult(null)}>Retry</button>
                <button type="button" className="cm-button-ghost" onClick={() => setShowTransferModal(false)} style={{ marginTop: 8 }}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="cm-modal-header">
                  <h4>Fund Transfer</h4>
                  <button type="button" className="cm-modal-close" aria-label="Close" onClick={() => setShowTransferModal(false)} disabled={transferring}><FaTimes /></button>
                </div>
                <div className="cm-modal-body">
                  <div className="cm-bank-select-card">
                    <FaCreditCard style={{ color: "#1976D2", fontSize: 20, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 10, color: "var(--cm-muted, #999)", textTransform: "uppercase", fontWeight: 600 }}>To Bank Account</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedBank?.bankName}</div>
                      <div style={{ fontSize: 12, color: "#1976D2" }}>{maskAccount(selectedBank?.accountNumber)}</div>
                    </div>
                  </div>
                  <div className="cm-form-group">
                    <label>Amount (₹) *</label>
                    <input type="text" placeholder={`Minimum ${MIN_TRANSFER_AMOUNT}`} value={transferData.amount}
                      onChange={(e) => setTransferData({ ...transferData, amount: e.target.value.replace(/[^\d.]/g, "") })}
                      disabled={transferring} inputMode="decimal"
                      className={transferErrors.amount ? "cm-input-error" : ""} />
                    {transferErrors.amount
                      ? <span className="cm-form-error">{transferErrors.amount}</span>
                      : <span className="cm-form-hint">
                          Minimum {formatAmount(MIN_TRANSFER_AMOUNT)}
                          {balance !== null && ` · Wallet balance ${formatAmount(balance)}`}
                        </span>}
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
