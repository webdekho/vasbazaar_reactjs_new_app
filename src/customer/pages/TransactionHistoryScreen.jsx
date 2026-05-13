import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaExclamationCircle, FaChevronDown } from "react-icons/fa";
import { FiArrowUpRight, FiArrowDownLeft, FiClock, FiCheckCircle, FiXCircle, FiInbox, FiPauseCircle } from "react-icons/fi";
import { walletService } from "../services/walletService";
import { transactionService } from "../services/transactionService";
import { formatCurrency, matchesTransactionSearch, normalizeTransaction } from "../utils/transactionHistory";

const statusConfig = {
  success: { color: "#00C853", label: "Success", icon: <FiCheckCircle size={11} /> },
  pending: { color: "#FACC15", label: "Pending", icon: <FiClock size={11} /> },
  failed:  { color: "#FF3B30", label: "Failed",  icon: <FiXCircle size={11} /> },
  hold:    { color: "#FFFFFF", label: "Hold",    icon: <FiPauseCircle size={11} /> },
  not_collected: { color: "#F59E0B", label: "Payment Not Collected", icon: <FiXCircle size={11} /> },
  initiate: { color: "#0EA5E9", label: "Payment Initiated", icon: <FiClock size={11} /> },
  refund: { color: "#A855F7", label: "Refunded", icon: <FiCheckCircle size={11} /> },
};

const getStatusKey = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("success")) return "success";
  if (s.includes("hold")) return "hold";
  if (s.includes("payment_not_collected") || s.includes("not_collected")) return "not_collected";
  if (s.includes("payment_initiate") || s.includes("initiate")) return "initiate";
  if (s.includes("refund")) return "refund";
  if (s.includes("pending")) return "pending";
  return "failed";
};

const isCredit = (item) => {
  if (item.txnMode === 0 || item.txnMode === "0") return true;
  if (item.txnMode === 1 || item.txnMode === "1") return false;
  const desc = (item.message || item.description || item.discription || item.serviceType || "").toLowerCase();
  const type = (item.txnType || item.type || "").toLowerCase();
  return type.includes("credit") || type.includes("cr") || desc.includes("credit") || desc.includes("received") || desc.includes("refund") || desc.includes("cashback");
};

const SkeletonCard = ({ delay }) => (
  <div className="th-card th-skeleton" style={{ animationDelay: `${delay}ms` }}>
    <div className="th-skeleton-row">
      <div className="th-skeleton-circle" />
      <div className="th-skeleton-lines">
        <div className="th-skeleton-bar" style={{ width: "55%" }} />
        <div className="th-skeleton-bar" style={{ width: "75%" }} />
        <div className="th-skeleton-bar" style={{ width: "35%" }} />
      </div>
      <div className="th-skeleton-bar" style={{ width: 56, height: 24 }} />
    </div>
  </div>
);

const TransactionMetaItem = ({ label, value, valueClassName = "" }) => (
  <div className="th-meta-item">
    <span className="th-meta-label">{label}</span>
    <span className={`th-meta-value${valueClassName ? ` ${valueClassName}` : ""}`}>{value || "—"}</span>
  </div>
);

const getComplaintStatusTone = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("success")) {
    return {
      bg: "rgba(0, 200, 83, 0.14)",
      border: "rgba(0, 200, 83, 0.32)",
      color: "#00C853",
    };
  }

  if (normalized.includes("pending") || normalized.includes("hold") || normalized.includes("processing")) {
    return {
      bg: "rgba(255, 152, 0, 0.14)",
      border: "rgba(255, 152, 0, 0.32)",
      color: "#FF9800",
    };
  }

  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("refund")) {
    return {
      bg: "rgba(255, 59, 48, 0.14)",
      border: "rgba(255, 59, 48, 0.32)",
      color: "#FF6B6B",
    };
  }

  return {
    bg: "rgba(76, 111, 255, 0.14)",
    border: "rgba(76, 111, 255, 0.32)",
    color: "#6C8BFF",
  };
};

const TransactionHistoryScreen = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedTxn, setExpandedTxn] = useState(null);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [selectedComplaintTxn, setSelectedComplaintTxn] = useState(null);
  const [complaintChecking, setComplaintChecking] = useState(false);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintResult, setComplaintResult] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  // Prevent double API calls (React StrictMode in dev)
  const hasFetchedRef = useRef(false);

  const fetchData = async (pageNum, append = false) => {
    setLoading(true);
    const res = await walletService.getTransactionHistory(pageNum);
    setLoading(false);
    if (res.success) {
      const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
      setRecords(append ? (prev) => [...prev, ...list] : list);
      setHasMore(list.length >= 10);
    }
  };

  // Initial fetch - only once
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchData(0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      if (!mobile) {
        setExpandedTxn(null);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (complaintModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [complaintModalOpen]);

  const loadMore = () => { const next = page + 1; setPage(next); fetchData(next, true); };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? records.filter((item) => matchesTransactionSearch(item, query))
    : records;

  const canRaiseComplaint = (item) => {
    const sk = getStatusKey(item.status);
    const complaintStatus = String(item.complaintStatus || "").trim();
    return (sk === "success" || sk === "pending") && !complaintStatus;
  };

  const closeComplaintModal = () => {
    if (complaintChecking || complaintSubmitting) return;
    setComplaintModalOpen(false);
    setSelectedComplaintTxn(null);
    setComplaintDescription("");
    setComplaintResult(null);
  };

  const handleComplaintCheck = async (item) => {
    setComplaintChecking(true);
    setComplaintResult(null);

    try {
      const response = await transactionService.submitComplaint({
        txnId: item.txnId,
        description: "",
        action: "check",
      });

      const data = response?.data || {};
      const txnStatusFromApi = String(data.status || "").toUpperCase();
      const complaintStatusFromApi = String(data.complaintStatus || "").toUpperCase();
      const resolvedStatus = complaintStatusFromApi || txnStatusFromApi || String(item.status || "").toUpperCase();
      const alreadyProcessing = resolvedStatus === "PROCESSING";
      const isTerminal = ["SUCCESS", "FAILED", "FAILURE", "REFUNDED", "CANCELLED", "HOLD"].includes(txnStatusFromApi);

      setComplaintResult({
        status: resolvedStatus || "UNKNOWN",
        message: data.message || response.message || "Status checked successfully.",
        canEscalate: !alreadyProcessing && !isTerminal,
        isSubmitted: false,
      });

      // Update the affected row in-place so the badge reflects the latest status
      // Local state update is sufficient - no need to refetch entire list
      if (txnStatusFromApi || complaintStatusFromApi) {
        setRecords((prev) =>
          prev.map((record) =>
            record.txnId === item.txnId
              ? {
                  ...record,
                  ...(txnStatusFromApi ? { status: txnStatusFromApi } : {}),
                  ...(complaintStatusFromApi ? { complaintStatus: complaintStatusFromApi } : {}),
                }
              : record
          )
        );
      }
    } catch (error) {
      setComplaintResult({
        status: "ERROR",
        message: error?.message || "Unable to check provider status right now. You can still escalate your complaint.",
        canEscalate: true,
        isSubmitted: false,
      });
    } finally {
      setComplaintChecking(false);
    }
  };

  const openComplaintModal = (item) => {
    setSelectedComplaintTxn(item);
    setComplaintDescription("");
    setComplaintResult(null);
    setComplaintModalOpen(true);
    handleComplaintCheck(item);
  };

  const handleComplaintSubmit = async () => {
    if (!selectedComplaintTxn?.txnId) return;

    setComplaintSubmitting(true);
    try {
      const response = await transactionService.submitComplaint({
        txnId: selectedComplaintTxn.txnId,
        description: complaintDescription.trim(),
        action: "add",
      });

      const data = response?.data || {};
      const resolvedStatus = String(data.complaintStatus || "PENDING").toUpperCase();

      setComplaintResult({
        status: resolvedStatus,
        message: data.message || response.message || "Complaint registered successfully.",
        canEscalate: false,
        isSubmitted: true,
      });

      // Update the affected row in-place - no need to refetch entire list
      setRecords((prev) =>
        prev.map((record) =>
          record.txnId === selectedComplaintTxn.txnId
            ? { ...record, complaintStatus: resolvedStatus }
            : record
        )
      );
    } catch (error) {
      setComplaintResult((prev) => ({
        status: prev?.status || "ERROR",
        message: error?.message || "Unable to submit complaint right now. Please try again.",
        canEscalate: true,
        isSubmitted: false,
      }));
    } finally {
      setComplaintSubmitting(false);
    }
  };

  return (
    <div className="th-page">
      {/* Header */}
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="th-header-text">
          <h1 className="th-title">Transaction History</h1>
          {records.length > 0 && (
            <span className="th-count">{records.length} transactions</span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className={`th-search${searchFocused ? " is-focused" : ""}`}>
        <FaSearch className="th-search-icon" />
        <input
          className="th-search-input"
          placeholder="Search by mobile, service, operator, amount or transaction ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {search && (
          <button className="th-search-clear" type="button" onClick={() => setSearch("")}>&times;</button>
        )}
      </div>

      {/* Content */}
      {loading && records.length === 0 ? (
        <div className="th-list">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} delay={i * 80} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap">
            <FiInbox size={28} />
            <div className="md-empty-ring" />
          </div>
          <h3 className="md-empty-title">No transactions found</h3>
          <p className="md-empty-desc">
            {query ? "Try a different search term." : "Your transaction history will appear here once you make a payment."}
          </p>
        </div>
      ) : (
        <div className="th-list">
          {filtered.map((item, i) => {
            const sk = getStatusKey(item.status);
            const cfg = statusConfig[sk];
            const credit = isCredit(item);
            const showComplaintAction = canRaiseComplaint(item);
            const isExpanded = expandedTxn === item.txnId;
            const detailsVisible = !isMobileView || isExpanded;
            const txn = normalizeTransaction(item);
            const complaintTone = getComplaintStatusTone(item.complaintStatus);
            const showOfferDetails = sk === "success" && txn.offerMethod !== "none";
            const metaContent = (
              <>
                <TransactionMetaItem label="Transaction ID" value={item.txnId} />
                <TransactionMetaItem label="Service" value={txn.service} />
                <TransactionMetaItem label="Operator" value={txn.operator} />
                <TransactionMetaItem label="Payment Mode" value={txn.paymentMode} />
                {showOfferDetails && (
                  <>
                    <TransactionMetaItem
                      label="Offer Method"
                      value={txn.offerMethodLabel}
                      valueClassName={`th-meta-value--offer th-meta-value--offer-${txn.offerMethod}`}
                    />
                    {txn.offerMethod === "discount" && (
                      <>
                        <TransactionMetaItem label="Discount" value={formatCurrency(txn.discountAmount)} />
                        <TransactionMetaItem label="Paid Amount" value={formatCurrency(txn.paidAmount ?? txn.amount)} />
                      </>
                    )}
                    {txn.offerMethod === "cashback" && (
                      <TransactionMetaItem label="Cashback Amount" value={formatCurrency(txn.cashbackAmount)} />
                    )}
                    {txn.offerMethod === "coupon" && (
                      <>
                        <TransactionMetaItem label="Coupon Name" value={txn.couponName} />
                        <TransactionMetaItem label="Coupon Code" value={txn.couponCode} />
                        <TransactionMetaItem label="Coupon Validity" value={txn.couponValidity} />
                      </>
                    )}
                  </>
                )}
              </>
            );

            return (
              <div
                key={item.txnId || i}
                className={`th-card${isMobileView ? " th-card--collapsible" : ""}${detailsVisible ? " is-expanded" : ""}`}
                style={{ animationDelay: `${i * 40}ms`, cursor: isMobileView ? "pointer" : "default" }}
                onClick={() => {
                  if (isMobileView) {
                    setExpandedTxn(isExpanded ? null : item.txnId);
                  }
                }}
              >
                <div className="th-card-row">
                  {/* Direction icon */}
                  <div className={`th-dir-icon th-dir-icon--${credit ? "credit" : "debit"}`}>
                    {credit ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                  </div>

                  {/* Info */}
                  <div className="th-info">
                    <div className="th-info-name">{txn.mobile || item.customerName || "Transaction"}</div>
                    <div className="th-info-desc">{item.message || item.description || item.discription || txn.service || "—"}</div>
                    <div className="th-info-date">{item.date} {item.time}</div>
                    {!isMobileView && (
                      <div className="th-meta-grid th-meta-grid--compact">
                        {metaContent}
                      </div>
                    )}
                  </div>

                  {/* Amount + status */}
                  <div className="th-right">
                    <div className={`th-amount th-amount--${sk === "success" ? "credit" : "debit"}`}>
                      {formatCurrency(txn.amount ?? item.txnAmt ?? item.amount ?? 0)}
                    </div>
                    <div className="th-status" style={{ "--st-color": cfg.color }}>
                      {cfg.icon} {item.status || cfg.label}
                    </div>
                    {isMobileView && (
                      <button
                        type="button"
                        className={`th-expand-toggle${detailsVisible ? " is-expanded" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTxn(isExpanded ? null : item.txnId);
                        }}
                        aria-label={detailsVisible ? "Collapse transaction" : "Expand transaction"}
                      >
                        <FaChevronDown />
                      </button>
                    )}
                  </div>
                </div>

                {detailsVisible && (
                  <>
                    {isMobileView && <div className="th-meta-grid">{metaContent}</div>}

                    {item.complaintStatus && (
                      <div
                        style={{
                          padding: "0 16px 12px",
                          display: "flex",
                          justifyContent: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: 999,
                            background: complaintTone.bg,
                            border: `1px solid ${complaintTone.border}`,
                            color: complaintTone.color,
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          <FaExclamationCircle size={12} />
                          Complaint Status: {String(item.complaintStatus).toUpperCase()}
                        </div>
                      </div>
                    )}

                    {item.refundType && (
                      <div
                        style={{
                          padding: "0 16px 12px",
                          display: "flex",
                          justifyContent: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: 999,
                            background: item.refundType === "WALLET"
                              ? "rgba(16,185,129,0.12)"
                              : "rgba(59,130,246,0.12)",
                            border: item.refundType === "WALLET"
                              ? "1px solid rgba(16,185,129,0.35)"
                              : "1px solid rgba(59,130,246,0.35)",
                            color: item.refundType === "WALLET" ? "#10b981" : "#3b82f6",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          {item.refundType === "WALLET" ? (
                            <>💰 Refunded to Wallet — check your wallet for the credit entry</>
                          ) : (
                            <>🏦 Refunded to your original payment source — will reflect in 1-3 working days</>
                          )}
                        </div>
                      </div>
                    )}

                    {showComplaintAction && (
                      <div
                        style={{
                          padding: "0 16px 14px",
                          display: "flex",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          paddingTop: 12,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openComplaintModal(item);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #FF8A00 0%, #FF5A3D 100%)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <FaExclamationCircle size={12} /> Complaint
                        </button>
                      </div>
                    )}

                  </>
                )}
              </div>
            );
          })}

          {hasMore && !query && (
            <button className="th-load-more" type="button" onClick={loadMore} disabled={loading}>
              {loading ? (
                <><span className="md-spinner" /> Loading...</>
              ) : "Load More Transactions"}
            </button>
          )}
        </div>
      )}


      {complaintModalOpen && (
        <div
          onClick={closeComplaintModal}
          onTouchMove={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "transparent",
            zIndex: 9999,
            padding: "12px 12px 90px",
            overflowY: "auto",
            touchAction: "none",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 400,
              margin: "0 auto",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              background: "var(--cm-card, #161822)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 14,
              padding: 14,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--cm-ink)", fontSize: "0.92rem" }}>Complaint Support</h3>
                <p style={{ margin: "2px 0 0", color: "var(--cm-muted)", fontSize: "0.72rem" }}>
                  Check status and escalate if needed
                </p>
              </div>
              <button
                type="button"
                onClick={closeComplaintModal}
                disabled={complaintChecking || complaintSubmitting}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--cm-muted)",
                  fontSize: "1.1rem",
                  cursor: complaintChecking || complaintSubmitting ? "not-allowed" : "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "var(--cm-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Txn ID</span>
                <span style={{ color: "var(--cm-ink)", fontWeight: 700, fontSize: "0.8rem" }}>{selectedComplaintTxn?.txnId || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "var(--cm-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mobile</span>
                <span style={{ color: "var(--cm-ink)", fontWeight: 700, fontSize: "0.8rem" }}>{normalizeTransaction(selectedComplaintTxn || {}).mobile || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "var(--cm-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</span>
                <span style={{ color: "var(--cm-ink)", fontWeight: 700, fontSize: "0.8rem" }}>
                  {formatCurrency(normalizeTransaction(selectedComplaintTxn || {}).amount ?? selectedComplaintTxn?.txnAmt ?? selectedComplaintTxn?.amount)}
                </span>
              </div>
            </div>

            {complaintChecking ? (
              <div style={{ marginTop: 14, textAlign: "center", color: "var(--cm-muted)", fontSize: "0.82rem" }}>
                <span className="md-spinner" style={{ marginRight: 8, verticalAlign: "middle" }} />
                Checking status...
              </div>
            ) : (
              <>
                {complaintResult && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: getComplaintStatusTone(complaintResult.status).bg,
                      border: `1px solid ${getComplaintStatusTone(complaintResult.status).border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 7px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.5)",
                        color: getComplaintStatusTone(complaintResult.status).color,
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Status: {complaintResult.status}
                    </div>
                    <p style={{ margin: "6px 0 0", color: "var(--cm-ink)", fontSize: "0.8rem", lineHeight: 1.35 }}>
                      {complaintResult.message}
                    </p>
                  </div>
                )}

                {complaintResult?.canEscalate && (
                  <>
                    <label
                      htmlFor="txn-complaint-description"
                      style={{
                        display: "block",
                        marginTop: 12,
                        marginBottom: 6,
                        color: "var(--cm-muted)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Escalation details
                    </label>
                    <textarea
                      id="txn-complaint-description"
                      value={complaintDescription}
                      onChange={(e) => setComplaintDescription(e.target.value)}
                      placeholder="Describe issue here (optional)"
                      rows={2}
                      style={{
                        width: "100%",
                        resize: "none",
                        minHeight: 60,
                        borderRadius: 10,
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--cm-ink)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={closeComplaintModal}
                disabled={complaintSubmitting}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: "var(--cm-ink)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: complaintSubmitting ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
              {complaintResult?.canEscalate && !complaintChecking && (
                <button
                  type="button"
                  onClick={handleComplaintSubmit}
                  disabled={complaintSubmitting}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #FF8A00 0%, #FF5A3D 100%)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: complaintSubmitting ? "not-allowed" : "pointer",
                    opacity: complaintSubmitting ? 0.8 : 1,
                  }}
                >
                  {complaintSubmitting ? "Submitting..." : "Escalate"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryScreen;
