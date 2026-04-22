import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaCalendarAlt, FaClock, FaExclamationCircle,
  FaExclamationTriangle, FaChevronRight, FaReceipt, FaTrashAlt
} from "react-icons/fa";
import { walletService } from "../services/walletService";
import { rechargeService } from "../services/rechargeService";
import { invalidate } from "../services/apiCache";

const statusConfig = {
  pending: { label: "Pending", icon: <FaClock />, color: "#FF9800" },
  due: { label: "Due Soon", icon: <FaExclamationCircle />, color: "#007BFF" },
  overdue: { label: "Overdue", icon: <FaExclamationTriangle />, color: "#FF3B30" },
};

const maskNumber = (num) => {
  if (!num || num.length < 6) return num || "—";
  return num.slice(0, 4) + "xxxx" + num.slice(-2);
};

const formatDueDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const getStatus = (item) => {
  if (!item.fromDate) return statusConfig.pending;
  const dueDate = new Date(item.fromDate);
  const now = new Date();
  if (dueDate < now) return statusConfig.overdue;
  const diff = (dueDate - now) / (1000 * 60 * 60 * 24);
  return diff <= 3 ? statusConfig.due : statusConfig.pending;
};

const getDaysText = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `${diff} days left`;
};

/* ─── Skeleton loader ─── */
const SkeletonCard = ({ delay }) => (
  <div className="md-card md-skeleton" style={{ animationDelay: `${delay}ms` }}>
    <div className="md-skeleton-row">
      <div className="md-skeleton-circle" />
      <div className="md-skeleton-lines">
        <div className="md-skeleton-bar" style={{ width: "60%" }} />
        <div className="md-skeleton-bar" style={{ width: "40%" }} />
      </div>
      <div className="md-skeleton-bar" style={{ width: 60, height: 28 }} />
    </div>
  </div>
);

/* ─── Empty state ─── */
const EmptyState = ({ onExplore }) => (
  <div className="md-empty">
    <div className="md-empty-icon-wrap">
      <FaClock />
      <div className="md-empty-ring" />
    </div>
    <h3 className="md-empty-title">No Upcoming Dues</h3>
    <p className="md-empty-desc">
      Set up scheduled payments from Services to see your upcoming dues here.
    </p>
    <button className="md-btn-primary" type="button" onClick={onExplore}>
      Explore Services <FaChevronRight />
    </button>
  </div>
);

/* ─── Due card ─── */
const DueCard = ({ item, index, onPay, onDelete, processing, deleting }) => {
  const st = getStatus(item);
  const operatorName = item.operatorId?.operatorName || item.operator?.name || item.name || "Service Provider";
  const serviceName = item.operatorId?.serviceId?.serviceName || item.service?.serviceName || "Bill Payment";
  const logo = item.operatorId?.logo || item.operator?.logo;
  const number = item.mobile || item.param;
  const amount = item.amount || item.txnAmt;
  const daysText = getDaysText(item.fromDate);

  return (
    <div className="md-card" style={{ animationDelay: `${index * 60}ms` }}>
      {/* Status accent bar */}
      <div className="md-card-accent" style={{ background: st.color }} />

      <div className="md-card-body">
        {/* Top: logo + info + amount */}
        <div className="md-card-top">
          <div className="md-card-logo-wrap">
            {logo ? (
              <img src={logo} alt="" className="md-card-logo" />
            ) : (
              <div className="md-card-logo-fallback" style={{ color: st.color }}>
                <FaReceipt />
              </div>
            )}
          </div>
          <div className="md-card-info">
            <div className="md-card-provider">{operatorName}</div>
            <div className="md-card-service">{serviceName}</div>
          </div>
          <div className="md-card-right-col">
            {amount && <div className="md-card-amount">&#8377;{parseFloat(amount).toFixed(0)}</div>}
            <div className="md-card-status" style={{ "--st-color": st.color }}>
              {st.icon} {st.label}
            </div>
          </div>
        </div>

        {/* Middle: details row */}
        <div className="md-card-details">
          <div className="md-detail-item">
            <span className="md-detail-label">Account</span>
            <span className="md-detail-value">{maskNumber(number)}</span>
          </div>
          {item.fromDate && (
            <div className="md-detail-item">
              <span className="md-detail-label">Due Date</span>
              <span className="md-detail-value md-detail-date">
                <FaCalendarAlt /> {formatDueDate(item.fromDate)}
              </span>
            </div>
          )}
          {daysText && (
            <div className="md-detail-item">
              <span className="md-detail-label">Status</span>
              <span className="md-detail-countdown" style={{ color: st.color }}>{daysText}</span>
            </div>
          )}
        </div>

        {/* Bottom: transact button + delete */}
        <div className="md-card-actions">
          <button
            className="md-pay-btn"
            type="button"
            disabled={processing || deleting}
            onClick={() => onPay(item)}
          >
            {processing ? (
              <span className="md-pay-loading"><span className="md-spinner" /> Processing...</span>
            ) : (
              <>Transact Now <FaChevronRight /></>
            )}
          </button>
          <button
            className="md-delete-btn"
            type="button"
            disabled={processing || deleting}
            onClick={() => onDelete(item)}
            title="Delete this due"
          >
            {deleting ? <span className="md-spinner" /> : <FaTrashAlt />}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main screen ─── */
const MyDuesScreen = () => {
  const navigate = useNavigate();
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await walletService.getUpcomingDues();
      setLoading(false);
      if (!res.success) { setError(res.message || "Failed to load dues."); return; }
      const data = Array.isArray(res.data) ? res.data : (res.data?.records || []);
      setDues(data);
    })();
  }, []);

  const handlePay = async (item) => {
    const mobile = item.mobile || item.param;
    if (!mobile) return;
    setProcessingId(item.id);
    const serviceName = item.operatorId?.serviceId?.serviceName || item.service?.serviceName || "prepaid";
    const slug = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const isPrepaid = slug === "prepaid" || slug === "postpaid";

    if (isPrepaid) {
      // For mobile recharge: detect operator and skip to plans/amount page
      const res = await rechargeService.fetchOperatorCircle(mobile);
      setProcessingId(null);
      navigate(`/customer/app/services/${slug}`, {
        state: {
          service: item.operatorId?.serviceId || item.service,
          prefill: {
            mobile,
            contactName: item.name || "",
            operatorData: res.success ? res.data : null,
            operatorId: item.operatorId?.id,
          }
        }
      });
    } else {
      // For bill payments: pass operator info to skip biller selection
      setProcessingId(null);
      navigate(`/customer/app/services/${slug}`, {
        state: {
          service: item.operatorId?.serviceId || item.service,
          prefill: {
            mobile,
            operatorId: item.operatorId?.id,
            operatorName: item.operatorId?.operatorName,
            operatorCode: item.operatorId?.operatorCode,
            amount: item.amount,
          }
        }
      });
    }
  };

  const handleDelete = async (item) => {
    const id = item.id;
    if (!id) return;

    // Confirm before delete
    if (!window.confirm("Are you sure you want to delete this due?")) return;

    setDeletingId(id);
    const res = await walletService.deleteReminder(id);
    setDeletingId(null);

    if (res.success) {
      // Remove from list
      setDues((prev) => prev.filter((d) => d.id !== id));
      // Clear cache so next visit fetches fresh data
      invalidate("upcomingDues");
    } else {
      alert(res.message || "Failed to delete. Please try again.");
    }
  };

  const totalDues = dues.length;
  const overdueDues = dues.filter((d) => getStatus(d) === statusConfig.overdue).length;

  return (
    <div className="md-page">
      {/* Header */}
      <div className="md-header">
        <button className="md-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div>
          <h1 className="md-title">My Dues</h1>
          {totalDues > 0 && (
            <div className="md-subtitle">
              {totalDues} due{totalDues > 1 ? "s" : ""} found
              {overdueDues > 0 && <span className="md-overdue-count"> &middot; {overdueDues} overdue</span>}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="md-list">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} delay={i * 100} />)}
        </div>
      ) : error ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap md-empty-icon-wrap--error">
            <FaExclamationTriangle />
          </div>
          <h3 className="md-empty-title">Something went wrong</h3>
          <p className="md-empty-desc">{error}</p>
          <button className="md-btn-primary" type="button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      ) : dues.length === 0 ? (
        <EmptyState onExplore={() => navigate("/customer/app/services")} />
      ) : (
        <div className="md-list">
          {dues.map((item, i) => (
            <DueCard
              key={item.id || i}
              item={item}
              index={i}
              onPay={handlePay}
              onDelete={handleDelete}
              processing={processingId === item.id}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyDuesScreen;
