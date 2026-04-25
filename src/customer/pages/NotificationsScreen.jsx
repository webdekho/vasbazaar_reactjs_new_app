import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBell, FaUser, FaInfoCircle, FaTimes, FaTrashAlt } from "react-icons/fa";
import { FiBell } from "react-icons/fi";
import { notificationService } from "../services/notificationService";

const iconMap = { push_notification: <FaBell />, customer: <FaUser />, general: <FaInfoCircle /> };

const typeColorMap = {
  push_notification: { border: "#40E0D0", bg: "rgba(64, 224, 208, 0.06)", iconBg: "linear-gradient(135deg, rgba(64, 224, 208, 0.12), rgba(0, 123, 255, 0.12))", color: "#40E0D0" },
  customer:          { border: "#00C853", bg: "rgba(0, 200, 83, 0.06)", iconBg: "linear-gradient(135deg, rgba(0, 200, 83, 0.12), rgba(0, 200, 83, 0.06))", color: "#00C853" },
  general:           { border: "#FF9800", bg: "rgba(255, 152, 0, 0.06)", iconBg: "linear-gradient(135deg, rgba(255, 152, 0, 0.12), rgba(255, 152, 0, 0.06))", color: "#FF9800" },
};

const defaultTypeColor = { border: "#40E0D0", bg: "rgba(64, 224, 208, 0.04)", iconBg: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))", color: "#40E0D0" };

const timeAgo = (timestamp) => {
  if (!timestamp) return "";
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const SkeletonCard = ({ delay = 0 }) => (
  <div className="nt-skeleton-card" style={{ animationDelay: `${delay}s` }}>
    <div className="nt-skeleton-icon cm-skeleton-pulse" />
    <div className="nt-skeleton-body">
      <div className="cm-skeleton-pulse" style={{ width: "55%", height: 14, borderRadius: 7 }} />
      <div className="cm-skeleton-pulse" style={{ width: "90%", height: 10, borderRadius: 5, marginTop: 8 }} />
      <div className="cm-skeleton-pulse" style={{ width: "30%", height: 10, borderRadius: 5, marginTop: 6 }} />
    </div>
  </div>
);

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await notificationService.getNotifications(0);
      if (cancelled) return;
      setLoading(false);
      setRecords(res.data?.records || (Array.isArray(res.data) ? res.data : []));
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (index, id) => {
    if (!id) {
      setRecords((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setDismissing(index);
    const res = await notificationService.dismissNotification(id);
    if (res.success) {
      setRecords((prev) => prev.filter((_, i) => i !== index));
    }
    setDismissing(null);
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all notifications?")) return;
    const res = await notificationService.clearAllNotifications();
    if (res.success) setRecords([]);
  };

  return (
    <div className="cm-page-animate nt-page">
      {/* Header */}
      <div className="nt-header">
        <div className="nt-header-bar" />
        <div className="cm-flow-title-row" style={{ background: "none", borderBottom: "none", position: "static" }}>
          <button className="cm-back-icon" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1>
            Notifications
            {records.length > 0 && <span className="nt-count-badge">{records.length}</span>}
          </h1>
          {records.length > 0 && (
            <button type="button" className="nt-clear-btn" onClick={handleClearAll}>
              <FaTrashAlt size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="nt-content">
        {loading ? (
          <div><SkeletonCard delay={0} /><SkeletonCard delay={0.15} /><SkeletonCard delay={0.3} /></div>
        ) : records.length === 0 ? (
          <div className="nt-empty">
            <div className="nt-empty-icon"><FiBell size={40} /></div>
            <p className="nt-empty-title">No notifications</p>
            <p className="nt-empty-desc">You'll see your notifications here when they arrive.</p>
          </div>
        ) : (
          <div className="nt-list">
            {records.map((item, i) => {
              const tc = typeColorMap[item.type] || defaultTypeColor;
              const isDismissing = dismissing === i;
              return (
                <div key={item.id || i} className={`nt-card${isDismissing ? " nt-card--dismiss" : ""}`} style={{ borderLeftColor: tc.border, animationDelay: `${i * 0.04}s` }}>
                  <div className="nt-card-icon" style={{ background: tc.iconBg, color: tc.color }}>
                    {iconMap[item.type] || <FaBell />}
                  </div>
                  <div className="nt-card-body">
                    <div className="nt-card-top">
                      <div className="nt-card-title">{item.title || "Notification"}</div>
                      <span className="nt-card-time">{timeAgo(item.timestamp || item.time || item.date)}</span>
                    </div>
                    <div className="nt-card-msg">{item.message || item.body || "New update"}</div>
                    {item.cnf?.name && <div className="nt-card-from"><FaUser size={9} /> {item.cnf.name}</div>}
                  </div>
                  <button type="button" className="nt-card-delete" onClick={() => handleDelete(i, item.id)} disabled={isDismissing}>
                    <FaTimes size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsScreen;
