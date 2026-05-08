import { useState, useEffect, useCallback } from "react";
import {
  FaTimes,
  FaTruck,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSpinner,
  FaExclamationCircle,
  FaRupeeSign,
} from "react-icons/fa";
import { savedVehicleService } from "../services/savedVehicleService";
import { sanitizeBackendMessage } from "../utils/userMessages";

const STATUS_STYLES = {
  success: { icon: FaCheckCircle, color: "#22c55e", label: "Success" },
  completed: { icon: FaCheckCircle, color: "#22c55e", label: "Success" },
  failed: { icon: FaTimesCircle, color: "#ef4444", label: "Failed" },
  failure: { icon: FaTimesCircle, color: "#ef4444", label: "Failed" },
  pending: { icon: FaClock, color: "#f59e0b", label: "Pending" },
  processing: { icon: FaClock, color: "#3b82f6", label: "Processing" },
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatAmount = (amount) => {
  if (!amount && amount !== 0) return "";
  return new Intl.NumberFormat("en-IN").format(amount);
};

/**
 * VehicleHistorySheet - Bottom sheet showing recharge history for a vehicle
 *
 * Props:
 * - isOpen: boolean - Whether the sheet is visible
 * - vehicle: object - The saved vehicle object
 * - onClose: () => void - Called to close the sheet
 */
export default function VehicleHistorySheet({ isOpen, vehicle, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchHistory = useCallback(async (pageNum = 0, append = false) => {
    if (!vehicle?.id) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");

    const res = await savedVehicleService.getVehicleHistory(vehicle.id, pageNum, 10);

    if (append) {
      setLoadingMore(false);
    } else {
      setLoading(false);
    }

    if (res.success) {
      const records = res.data?.records || res.data?.content || (Array.isArray(res.data) ? res.data : []);
      const total = res.data?.totalElements || res.data?.total || 0;

      if (append) {
        setHistory((prev) => [...prev, ...records]);
      } else {
        setHistory(records);
      }

      setPage(pageNum);
      setHasMore(records.length > 0 && history.length + records.length < total);
    } else {
      setError(sanitizeBackendMessage(res.message, "Failed to load history"));
    }
  }, [vehicle?.id, history.length]);

  useEffect(() => {
    if (isOpen && vehicle?.id) {
      setHistory([]);
      setPage(0);
      fetchHistory(0, false);
    }
  }, [isOpen, vehicle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchHistory(page + 1, true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cm-sheet-overlay" onClick={onClose}>
      <div className="cm-sheet cm-sheet--history" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cm-sheet-header">
          <div className="cm-sheet-drag-handle" />
          <div className="cm-sheet-title-row">
            <h3 className="cm-sheet-title">Recharge History</h3>
            <button type="button" className="cm-sheet-close" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="cm-vehicle-history-info">
          <FaTruck className="cm-vehicle-history-icon" />
          <div>
            <div className="cm-vehicle-history-number">{vehicle?.vehicleNumber}</div>
            {vehicle?.nickname && (
              <div className="cm-vehicle-history-nickname">"{vehicle.nickname}"</div>
            )}
          </div>
        </div>

        {/* History List */}
        <div className="cm-sheet-body">
          {loading ? (
            <div className="cm-history-loading">
              <FaSpinner className="cm-spin" style={{ fontSize: 24 }} />
              <p>Loading history...</p>
            </div>
          ) : error ? (
            <div className="cm-history-error">
              <FaExclamationCircle style={{ fontSize: 32, color: "#ef4444" }} />
              <p>{error}</p>
              <button
                type="button"
                className="cm-button"
                onClick={() => fetchHistory(0, false)}
                style={{ marginTop: 12 }}
              >
                Retry
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="cm-history-empty">
              <FaClock style={{ fontSize: 40, color: "var(--cm-muted)" }} />
              <p>No recharge history</p>
              <p className="cm-history-empty-sub">
                Recharge this vehicle to see history here
              </p>
            </div>
          ) : (
            <>
              <div className="cm-history-list">
                {history.map((txn, i) => {
                  const status = (txn.status || "pending").toLowerCase();
                  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
                  const StatusIcon = statusStyle.icon;

                  return (
                    <div key={txn.id || i} className="cm-history-item">
                      <div className="cm-history-item-left">
                        <div className="cm-history-amount">
                          <FaRupeeSign className="cm-history-rupee" />
                          {formatAmount(txn.amount || txn.txnAmt)}
                        </div>
                        <div className="cm-history-date">
                          {formatDate(txn.date || txn.createdDate || txn.txnDate)}
                        </div>
                        {txn.refId && (
                          <div className="cm-history-ref">Ref: {txn.refId}</div>
                        )}
                      </div>
                      <div className="cm-history-item-right">
                        <StatusIcon style={{ color: statusStyle.color, fontSize: 18 }} />
                        <span
                          className="cm-history-status"
                          style={{ color: statusStyle.color }}
                        >
                          {statusStyle.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <button
                  type="button"
                  className="cm-history-load-more"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <FaSpinner className="cm-spin" /> Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
