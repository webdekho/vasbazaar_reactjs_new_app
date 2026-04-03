import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaRedo, FaExclamationCircle, FaChevronDown } from "react-icons/fa";
import { FiArrowUpRight, FiArrowDownLeft, FiClock, FiCheckCircle, FiXCircle, FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";
import { authPost } from "../services/apiClient";
import { transactionService } from "../services/transactionService";
import { formatCurrency, matchesTransactionSearch, normalizeTransaction } from "../utils/transactionHistory";

const statusConfig = {
  success: { color: "#00C853", label: "Success", icon: <FiCheckCircle size={11} /> },
  pending: { color: "#FF9800", label: "Pending", icon: <FiClock size={11} /> },
  failed:  { color: "#FF3B30", label: "Failed",  icon: <FiXCircle size={11} /> },
};

const getStatusKey = (status) => {
  const s = (status || "").toLowerCase();
  if (s.includes("success")) return "success";
  if (s.includes("pending")) return "pending";
  return "failed";
};

const isCredit = (item) => {
  const desc = (item.description || item.discription || item.serviceType || "").toLowerCase();
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

const hasRefundHandled = (item) => {
  const refundStatus = Number(item.refundStatus);
  if (Number.isFinite(refundStatus) && refundStatus > 0) return true;

  const refundText = [
    item.message,
    item.remark,
    item.description,
    item.discription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "refund initiated",
    "refund request",
    "refund requested",
    "refund sent",
    "refund processed",
    "refunded",
    "credited to wallet",
    "wallet refund",
    "bank refund",
    "refund to source",
    "hdfc via email",
  ].some((phrase) => refundText.includes(phrase));
};

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
  const [actionLoading, setActionLoading] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("");
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [selectedComplaintTxn, setSelectedComplaintTxn] = useState(null);
  const [complaintChecking, setComplaintChecking] = useState(false);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintResult, setComplaintResult] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

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

  useEffect(() => { fetchData(0); }, []);

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

  const canShowActions = (item) => {
    const sk = getStatusKey(item.status);
    const txn = normalizeTransaction(item);
    const isUpiPayment = txn.paymentMode === "UPI" || item.serviceType?.toLowerCase() === "upi" || Boolean(item.upiFrom);
    return sk === "failed" && isUpiPayment && !hasRefundHandled(item);
  };

  const handleRetry = async (item) => {
    setActionLoading("retry");
    try {
      const response = await authPost("/api/customer/plan_recharge/request-refund", {
        txnId: item.txnId,
        refundType: "wallet",
      });
      if (response.success) {
        setModalType("success");
        setModalMessage("Amount credited to wallet. Redirecting to payment...");
        setModalOpen(true);
        setTimeout(() => {
          setModalOpen(false);
          navigate("/customer/app/payment", {
            replace: true,
            state: {
              type: "recharge",
              amount: item.txnAmt || item.amount,
              mobile: item.operatorNo,
            },
          });
        }, 1500);
      } else {
        setModalType("error");
        setModalMessage(response.message || "Unable to credit wallet for retry. Please try again.");
        setModalOpen(true);
      }
    } catch {
      setModalType("error");
      setModalMessage("Unable to credit wallet for retry. Please try again.");
      setModalOpen(true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundToSource = async (item) => {
    setActionLoading("refund");
    try {
      const response = await authPost("/api/customer/plan_recharge/request-refund", {
        txnId: item.txnId,
        refundType: "bank",
      });
      if (response.success) {
        setModalType("success");
        setModalMessage("Refund request submitted. Amount will be refunded to your original payment source within 3 working days.");
        setModalOpen(true);
        fetchData(0);
        setExpandedTxn(null);
      } else {
        setModalType("error");
        setModalMessage(response.message || "Unable to submit refund request. Please try again.");
        setModalOpen(true);
      }
    } catch {
      setModalType("error");
      setModalMessage("Unable to submit refund request. Please try again.");
      setModalOpen(true);
    } finally {
      setActionLoading(null);
    }
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
      const resolvedStatus = String(data.complaintStatus || data.status || item.status || "").toUpperCase();
      const alreadyProcessing = resolvedStatus === "PROCESSING";

      setComplaintResult({
        status: resolvedStatus || "UNKNOWN",
        message: data.message || response.message || "Status checked successfully.",
        canEscalate: !alreadyProcessing,
        isSubmitted: false,
      });

      fetchData(0);
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

      setRecords((prev) =>
        prev.map((record) =>
          record.txnId === selectedComplaintTxn.txnId
            ? { ...record, complaintStatus: resolvedStatus }
            : record
        )
      );
      fetchData(0);
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
            const showActions = canShowActions(item);
            const showComplaintAction = canRaiseComplaint(item);
            const isExpanded = expandedTxn === item.txnId;
            const detailsVisible = !isMobileView || isExpanded;
            const txn = normalizeTransaction(item);
            const complaintTone = getComplaintStatusTone(item.complaintStatus);
            const metaContent = (
              <>
                <TransactionMetaItem label="Transaction ID" value={item.txnId} />
                <TransactionMetaItem label="Service" value={txn.service} />
                <TransactionMetaItem label="Operator" value={txn.operator} />
                <TransactionMetaItem label="Payment Mode" value={txn.paymentMode} />
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
            );

            return (
              <div
                key={item.txnId || i}
                className={`th-card${isMobileView ? " th-card--collapsible" : ""}${detailsVisible ? " is-expanded" : ""}`}
                style={{ animationDelay: `${i * 40}ms`, cursor: isMobileView || showActions ? "pointer" : "default" }}
                onClick={() => {
                  if (isMobileView || showActions) {
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
                    <div className="th-info-desc">{item.description || item.discription || txn.service || "—"}</div>
                    <div className="th-info-date">{item.date} {item.time}</div>
                    {!isMobileView && (
                      <div className="th-meta-grid th-meta-grid--compact">
                        {metaContent}
                      </div>
                    )}
                  </div>

                  {/* Amount + status */}
                  <div className="th-right">
                    <div className={`th-amount th-amount--${credit ? "credit" : "debit"}`}>
                      {credit ? "+" : "-"}{formatCurrency(txn.amount ?? item.txnAmt ?? item.amount ?? 0)}
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

                    {showActions && (
                      <div style={{
                        padding: "0 16px 14px",
                        display: "flex",
                        gap: 10,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: 12,
                        marginTop: 2,
                      }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRetry(item); }}
                          disabled={actionLoading !== null}
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #00F5D4, #00BBF9)",
                            color: "#061018",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            cursor: actionLoading ? "not-allowed" : "pointer",
                            opacity: actionLoading ? 0.7 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <FaRedo size={11} /> {actionLoading === "retry" ? "Processing..." : "Retry Transaction"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRefundToSource(item); }}
                          disabled={actionLoading !== null}
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #4C6FFF 0%, #6C8BFF 100%)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            cursor: actionLoading ? "not-allowed" : "pointer",
                            opacity: actionLoading ? 0.7 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          {actionLoading === "refund" ? "Processing..." : "Refund to Source"}
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

      {/* Modal for action feedback */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              background: "var(--cm-card, #161822)",
              border: `1px solid ${modalType === "success" ? "rgba(56,211,159,0.35)" : "rgba(255,107,107,0.35)"}`,
              borderRadius: 14,
              padding: 18,
              textAlign: "center",
            }}
          >
            <h3 style={{
              margin: "0 0 8px",
              fontSize: "1rem",
              color: modalType === "success" ? "#38D39F" : "#FF6B6B",
            }}>
              {modalType === "success" ? "Request Successful" : "Request Failed"}
            </h3>
            <p style={{ margin: 0, color: "#C8CEE8", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {modalMessage}
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{
                marginTop: 14,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #00F5D4, #00BBF9)",
                color: "#061018",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {complaintModalOpen && (
        <div
          onClick={closeComplaintModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "var(--cm-card, #161822)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--cm-ink)", fontSize: "1rem" }}>Complaint Support</h3>
                <p style={{ margin: "4px 0 0", color: "var(--cm-muted)", fontSize: "0.82rem" }}>
                  We will check the provider status first, then you can escalate if needed.
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
                  fontSize: "1.2rem",
                  cursor: complaintChecking || complaintSubmitting ? "not-allowed" : "pointer",
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--cm-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Transaction ID</span>
                <span style={{ color: "var(--cm-ink)", fontWeight: 700, fontSize: "0.86rem" }}>{selectedComplaintTxn?.txnId || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--cm-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mobile</span>
                <span style={{ color: "var(--cm-ink)", fontWeight: 700, fontSize: "0.86rem" }}>{normalizeTransaction(selectedComplaintTxn || {}).mobile || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--cm-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Amount</span>
                <span style={{ color: "var(--cm-ink)", fontWeight: 700, fontSize: "0.86rem" }}>
                  {formatCurrency(normalizeTransaction(selectedComplaintTxn || {}).amount ?? selectedComplaintTxn?.txnAmt ?? selectedComplaintTxn?.amount)}
                </span>
              </div>
            </div>

            {complaintChecking ? (
              <div style={{ marginTop: 18, textAlign: "center", color: "var(--cm-muted)", fontSize: "0.9rem" }}>
                <span className="md-spinner" style={{ marginRight: 8, verticalAlign: "middle" }} />
                Checking latest status from provider...
              </div>
            ) : (
              <>
                {complaintResult && (
                  <div
                    style={{
                      marginTop: 18,
                      padding: 14,
                      borderRadius: 12,
                      background: getComplaintStatusTone(complaintResult.status).bg,
                      border: `1px solid ${getComplaintStatusTone(complaintResult.status).border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.45)",
                        color: getComplaintStatusTone(complaintResult.status).color,
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Updated Status: {complaintResult.status}
                    </div>
                    <p style={{ margin: "12px 0 0", color: "var(--cm-ink)", fontSize: "0.9rem", lineHeight: 1.5 }}>
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
                        marginTop: 16,
                        marginBottom: 8,
                        color: "var(--cm-muted)",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                    >
                      Escalation details
                    </label>
                    <textarea
                      id="txn-complaint-description"
                      value={complaintDescription}
                      onChange={(e) => setComplaintDescription(e.target.value)}
                      placeholder="If you still want to escalate, describe the issue here. This is optional."
                      rows={4}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        minHeight: 100,
                        borderRadius: 12,
                        padding: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--cm-ink)",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={closeComplaintModal}
                    disabled={complaintSubmitting}
                    style={{
                      flex: 1,
                      padding: "11px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "transparent",
                      color: "var(--cm-ink)",
                      fontWeight: 700,
                      cursor: complaintSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Close
                  </button>
                  {complaintResult?.canEscalate && (
                    <button
                      type="button"
                      onClick={handleComplaintSubmit}
                      disabled={complaintSubmitting}
                      style={{
                        flex: 1,
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #FF8A00 0%, #FF5A3D 100%)",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: complaintSubmitting ? "not-allowed" : "pointer",
                        opacity: complaintSubmitting ? 0.8 : 1,
                      }}
                    >
                      {complaintSubmitting ? "Submitting..." : "Escalate Complaint"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryScreen;
