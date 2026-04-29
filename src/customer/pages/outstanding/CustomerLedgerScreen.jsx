import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaArrowDown,
  FaArrowUp,
  FaBell,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaEdit,
  FaReceipt,
  FaWhatsapp,
} from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import AddTxnSheet from "./components/AddTxnSheet";
import ReminderSettingsSheet from "./components/ReminderSettingsSheet";

const PAGE_SIZE = 5;

const toDateInputValue = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 4);
  return { dateFrom: toDateInputValue(start), dateTo: toDateInputValue(end) };
};

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${Math.round(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatTxnDateTime = (txnDate, createdAt) => {
  if (!txnDate) return formatDateTime(createdAt);
  const datePart = formatDate(txnDate);
  if (!createdAt) return datePart;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return datePart;
  const timePart = created.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart}, ${timePart}`;
};

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatBalanceAfter = (value) => {
  const amount = Number(value || 0);
  if (amount > 0) {
    return { label: "Outstanding", amount: formatINR(amount), tone: "is-outstanding" };
  }
  if (amount < 0) {
    return { label: "Advance", amount: formatINR(Math.abs(amount)), tone: "is-advance" };
  }
  return { label: "Settled", amount: formatINR(0), tone: "is-settled" };
};

const formatOwedBalanceAfter = (value) => {
  const amount = Number(value || 0);
  if (amount > 0) {
    return { label: "You Owe", amount: formatINR(amount), tone: "is-outstanding" };
  }
  if (amount < 0) {
    return { label: "Advance", amount: formatINR(Math.abs(amount)), tone: "is-advance" };
  }
  return { label: "Settled", amount: formatINR(0), tone: "is-settled" };
};

const isEditedTxn = (txn) => {
  if (!txn?.createdAt || !txn?.updatedAt) return false;
  return new Date(txn.updatedAt).getTime() > new Date(txn.createdAt).getTime() + 1000;
};

const isTxnInDateRange = (txn, range) => {
  const txnDate = String(txn?.txnDate || "").slice(0, 10);
  if (!txnDate) return true;
  return (!range.dateFrom || txnDate >= range.dateFrom) && (!range.dateTo || txnDate <= range.dateTo);
};

const CustomerLedgerScreen = () => {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [searchParams] = useSearchParams();
  const isOwedView = searchParams.get("view") === "owed";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ customer: null, totalGave: 0, totalGot: 0, transactions: { records: [] } });
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [sheetType, setSheetType] = useState(null); // 'GAVE' | 'GOT'
  const [editingTxn, setEditingTxn] = useState(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [previewBill, setPreviewBill] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (pageNumber = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    const res = isOwedView
      ? await outstandingService.getOwedDetail(customerId, pageNumber, PAGE_SIZE, dateRange)
      : await outstandingService.getCustomerDetail(customerId, pageNumber, PAGE_SIZE, dateRange);
    setLoading(false);
    setLoadingMore(false);
    if (!res.success) {
      setError(res.message || "Failed to load");
      return;
    }
    const nextData = res.data || { customer: null, totalGave: 0, totalGot: 0, transactions: { records: [] } };
    if (append) {
      setData((prev) => ({
        ...nextData,
        transactions: {
          ...(nextData.transactions || {}),
          records: [
            ...(prev.transactions?.records || []),
            ...(nextData.transactions?.records || []),
          ],
        },
      }));
    } else {
      setData(nextData);
    }
    setError("");
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(0, false); }, [customerId, isOwedView, dateRange.dateFrom, dateRange.dateTo]);

  const onTxnAdded = () => {
    setSheetType(null);
    setEditingTxn(null);
    load();
  };

  const onDateRangeChange = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const onViewMore = () => {
    const nextPage = Number(data.transactions?.currentPage || 1);
    load(nextPage, true);
  };

  const onEditTxn = (txn) => {
    if (isOwedView) return;
    setEditingTxn(txn);
    setSheetType(txn.type);
  };

  const onSendReminder = async () => {
    setReminderLoading(true);
    const res = await outstandingService.sendReminder(customerId);
    setReminderLoading(false);
    if (!res.success) {
      alert(res.message || "Failed to send reminder");
      return;
    }
    if (res.data?.whatsappLink) {
      window.open(res.data.whatsappLink, "_blank");
    }
  };

  const customer = data.customer;
  const readOnly = isOwedView || data.readOnly || customer?.readOnly;
  const balance = Number(customer?.balance || 0);
  const txns = data.transactions?.records || [];
  const lastTxn = txns[0];
  const totalPages = Number(data.transactions?.totalPages || 0);
  const currentPage = Number(data.transactions?.currentPage || 0);
  const totalRecords = Number(data.transactions?.totalRecords || 0);
  const canViewMore = currentPage > 0 && currentPage < totalPages;
  const balanceLabel = readOnly
    ? (balance > 0 ? "You Owe" : balance < 0 ? "Advance Paid" : "All Settled")
    : (balance > 0 ? "Outstanding" : balance < 0 ? "Advance Paid" : "All Settled");
  const balanceHint = readOnly
    ? (balance > 0 ? "Pay this amount to the account owner" : balance < 0 ? "You have paid extra" : "No pending balance")
    : (balance > 0
      ? "Collect this amount from the customer"
      : balance < 0
        ? "Customer has paid extra"
        : "No pending balance");
  let runningBalance = balance;
  const txnsWithComputedBalance = txns.map((txn) => {
    const hasServerBalance = txn.balanceAfter !== undefined && txn.balanceAfter !== null;
    const balanceAfter = hasServerBalance ? Number(txn.balanceAfter || 0) : runningBalance;
    const amount = Number(txn.amount || 0);
    runningBalance = txn.type === "GAVE"
      ? balanceAfter - amount
      : balanceAfter + amount;
    return { ...txn, balanceAfter };
  });
  const txnsWithBalance = txnsWithComputedBalance.filter((txn) => isTxnInDateRange(txn, dateRange));
  const visibleTxns = txnsWithBalance;

  return (
    <div className="ol-page ol-ledger-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate("/customer/app/outstanding")} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name">{customer?.customerName || "Customer"}</div>
          {customer && <div className="ol-ledger-mobile">+91 {customer.customerMobile}</div>}
        </div>
        {customer && (
          <div className={`ol-ledger-status ${balance === 0 ? "is-settled" : balance > 0 ? "is-due" : "is-advance"}`}>
            {balance === 0 ? "Settled" : balance > 0 ? "Due" : "Advance"}
          </div>
        )}
      </div>

      {error && <div className="cm-empty">{error}</div>}

      {loading ? (
        <div className="ol-list">
          {[0, 1].map((i) => <div key={i} className="ol-item ol-skeleton" />)}
        </div>
      ) : !customer ? (
        <div className="cm-empty">Customer not found</div>
      ) : (
        <>
          <div className={`ol-hero ${balance > 0 ? "ol-hero-positive" : balance < 0 ? "ol-hero-negative" : "ol-hero-settled"}`}>
            <div className="ol-hero-topline">
              <div className="ol-hero-label">{balanceLabel}</div>
              <div className="ol-hero-count">{txns.length} entr{txns.length === 1 ? "y" : "ies"}</div>
            </div>
            <div className="ol-hero-amount">{formatINR(Math.abs(balance))}</div>
            <div className="ol-hero-hint">{balanceHint}</div>
            <div className="ol-hero-split">
              <div className="ol-split-cell">
                <span>{readOnly ? "You Received" : "You Gave"}</span>
                <b>{formatINR(data.totalGave)}</b>
              </div>
              <div className="ol-split-divider" />
              <div className="ol-split-cell">
                <span>{readOnly ? "You Paid" : "You Got"}</span>
                <b>{formatINR(data.totalGot)}</b>
              </div>
            </div>
          </div>

          <div className="ol-ledger-insights" aria-label="Ledger summary">
            <div className="ol-insight-tile">
              <span className="ol-insight-icon"><FaReceipt /></span>
              <span className="ol-insight-label">Activity</span>
              <strong>{txns.length || "No"} entr{txns.length === 1 ? "y" : "ies"}</strong>
            </div>
            <div className="ol-insight-tile">
              <span className="ol-insight-icon"><FaCalendarAlt /></span>
              <span className="ol-insight-label">Last update</span>
              <strong>{lastTxn ? formatDate(lastTxn.txnDate) : "No entries"}</strong>
            </div>
            <div className="ol-insight-tile">
              <span className="ol-insight-icon"><FaCheckCircle /></span>
              <span className="ol-insight-label">Status</span>
              <strong>{balanceLabel}</strong>
            </div>
          </div>

          {readOnly ? (
            <div className="ol-readonly-note">
              This ledger is shared from {customer.customerName}. You can view it, but only the account owner can edit entries.
            </div>
          ) : (
            <div className="ol-command-row">
              <button
                className="ol-command-card ol-command-reminder"
                type="button"
                onClick={onSendReminder}
                disabled={reminderLoading || balance <= 0}
              >
                <span className="ol-command-icon"><FaBell /></span>
                <span>
                  <b>{reminderLoading ? "Sending..." : "Send reminder"}</b>
                  <small>{balance > 0 ? "Create a payment nudge" : "Available when amount is due"}</small>
                </span>
              </button>
              <a
                className="ol-command-card ol-command-wa"
                href={`https://wa.me/91${customer.customerMobile}?text=${encodeURIComponent(`Hi ${customer.customerName}, regarding your outstanding amount of ${formatINR(Math.max(0, balance))}.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="ol-command-icon"><FaWhatsapp /></span>
                <span>
                  <b>WhatsApp</b>
                  <small>Open chat with customer</small>
                </span>
              </a>
              <button
                className="ol-command-card"
                type="button"
                onClick={() => setShowReminderSettings(true)}
              >
                <span className="ol-command-icon"><FaClock /></span>
                <span>
                  <b>Auto SMS reminder</b>
                  <small>Schedule daily SMS from your phone</small>
                </span>
              </button>
            </div>
          )}

          <div className="ol-section-head-row">
            <h3 className="ol-section-head">Ledger timeline</h3>
            {totalRecords > 0 && <span className="ol-section-count">{visibleTxns.length}/{totalRecords}</span>}
          </div>

          <div className="ol-date-range-card">
            <label className="ol-date-range-field">
              <span>From</span>
              <input
                type="date"
                value={dateRange.dateFrom}
                max={dateRange.dateTo}
                onChange={(e) => onDateRangeChange("dateFrom", e.target.value)}
              />
            </label>
            <label className="ol-date-range-field">
              <span>To</span>
              <input
                type="date"
                value={dateRange.dateTo}
                min={dateRange.dateFrom}
                onChange={(e) => onDateRangeChange("dateTo", e.target.value)}
              />
            </label>
          </div>

          {visibleTxns.length === 0 ? (
            <div className="ol-empty-state">
              <p>{readOnly ? "No entries in this date range." : "No entries yet. Tap a button below to add one."}</p>
            </div>
          ) : (
            <div className="ol-txn-list">
              {txnsWithBalance.map((t) => {
                const balanceAfter = readOnly ? formatOwedBalanceAfter(t.balanceAfter) : formatBalanceAfter(t.balanceAfter);
                const txnLabel = readOnly
                  ? (t.type === "GAVE" ? "You Received" : "You Paid")
                  : (t.type === "GAVE" ? "You Gave" : "You Got");
                return (
                  <div key={t.id} className={`ol-txn-row ${t.type === "GAVE" ? "ol-txn-gave" : "ol-txn-got"}`}>
                    <div className="ol-txn-line" aria-hidden="true" />
                    <div className="ol-txn-icon">
                      {readOnly
                        ? (t.type === "GAVE" ? <FaArrowDown /> : <FaArrowUp />)
                        : (t.type === "GAVE" ? <FaArrowUp /> : <FaArrowDown />)}
                    </div>
                    <div className="ol-txn-main">
                      <div className="ol-txn-label">
                        {txnLabel}
                        {t.note && <span className="ol-txn-note"> · {t.note}</span>}
                      </div>
                      <div className="ol-txn-meta">
                        <span>{formatTxnDateTime(t.txnDate, t.createdAt)}</span>
                        {isEditedTxn(t) && <span className="ol-edited-badge">Edited</span>}
                      </div>
                      {t.billImage && (
                        <button
                          type="button"
                          onClick={() => setPreviewBill(t.billImage)}
                          aria-label="View bill"
                          style={{ marginTop: 6, padding: 0, border: "1px solid #ddd", borderRadius: 6, background: "transparent", cursor: "pointer" }}
                        >
                          <img
                            src={t.billImage}
                            alt="Bill"
                            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 5, display: "block" }}
                          />
                        </button>
                      )}
                    </div>
                    <div className="ol-txn-right">
                      <div className="ol-txn-amount-line">
                        <span className="ol-txn-amt">{formatINR(t.amount)}</span>
                        {!readOnly && (
                          <button
                            className="ol-txn-edit"
                            type="button"
                            aria-label="Edit"
                            onClick={() => onEditTxn(t)}
                          >
                            <FaEdit />
                          </button>
                        )}
                      </div>
                      <span className={`ol-txn-balance-after ${balanceAfter.tone}`}>
                        {balanceAfter.label} : <b>{balanceAfter.amount}</b>
                      </span>
                    </div>
                  </div>
                );
              })}
              {canViewMore && (
                <button
                  className="ol-view-more-btn"
                  type="button"
                  onClick={onViewMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "View more"}
                </button>
              )}
            </div>
          )}

          {!readOnly && (
            <div className="ol-bottom-actions">
              <div className="ol-bottom-inner">
                <button
                  className="ol-action-btn ol-action-gave"
                  type="button"
                  onClick={() => setSheetType("GAVE")}
                >
                  <span className="ol-action-icon"><FaArrowUp /></span>
                  <span className="ol-action-copy">
                    <b>You Gave</b>
                  </span>
                </button>
                <button
                  className="ol-action-btn ol-action-got"
                  type="button"
                  onClick={() => setSheetType("GOT")}
                >
                  <span className="ol-action-icon"><FaArrowDown /></span>
                  <span className="ol-action-copy">
                    <b>You Got</b>
                  </span>
                </button>
              </div>
            </div>
          )}

          {sheetType && !readOnly && (
            <AddTxnSheet
              type={sheetType}
              customer={customer}
              transaction={editingTxn}
              onClose={() => {
                setSheetType(null);
                setEditingTxn(null);
              }}
              onAdded={onTxnAdded}
            />
          )}

          {showReminderSettings && !readOnly && customer && (
            <ReminderSettingsSheet
              customer={customer}
              onClose={() => setShowReminderSettings(false)}
              onSaved={() => setShowReminderSettings(false)}
            />
          )}

          {previewBill && (
            <div
              onClick={() => setPreviewBill("")}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.85)",
                zIndex: 1100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <img
                src={previewBill}
                alt="Bill"
                style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 6 }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerLedgerScreen;
