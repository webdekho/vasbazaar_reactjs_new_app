import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaSyncAlt, FaCheckCircle, FaClock, FaTimesCircle,
  FaPauseCircle, FaBan, FaChevronDown, FaCalendarAlt, FaExclamationTriangle
} from "react-icons/fa";
import { FiInbox } from "react-icons/fi";
import { walletService } from "../services/walletService";

const statusConfig = {
  active: { label: "Active", color: "#00C853", icon: <FaCheckCircle /> },
  pending: { label: "Pending", color: "#FF9800", icon: <FaClock /> },
  stopped: { label: "Stopped", color: "#FF9800", icon: <FaPauseCircle /> },
  revoked: { label: "Revoked", color: "#FF3B30", icon: <FaBan /> },
};

const getStatus = (s) => {
  const v = (s || "").toLowerCase();
  if (v.includes("active") || v.includes("created") || v.includes("success")) return statusConfig.active;
  if (v.includes("stop") || v.includes("pause")) return statusConfig.stopped;
  if (v.includes("revoke") || v.includes("cancel") || v.includes("fail") || v.includes("reject") || v.includes("expire")) return statusConfig.revoked;
  return statusConfig.pending;
};

const SkeletonCard = ({ delay }) => (
  <div className="th-card" style={{ animationDelay: `${delay}ms`, pointerEvents: "none" }}>
    <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
      <div className="th-skeleton-circle" style={{ width: 42, height: 42 }} />
      <div className="th-skeleton-lines" style={{ flex: 1 }}><div className="th-skeleton-bar" style={{ width: "50%" }} /><div className="th-skeleton-bar" style={{ width: "70%" }} /></div>
      <div className="th-skeleton-bar" style={{ width: 60, height: 24 }} />
    </div>
  </div>
);

const AutoPayScreen = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("active");
  const [mandates, setMandates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchData = async (pageNum = 1, statusFilter = tab, append = false) => {
    if (!append) setLoading(true);
    setError("");
    const res = await walletService.getMandateList(pageNum, 10, statusFilter);
    setLoading(false);
    if (!res.success) { setError(res.message || "Failed to load."); return; }
    const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
    setMandates(append ? (prev) => [...prev, ...list] : list);
    setHasMore(list.length >= 10);
  };

  useEffect(() => { setPage(1); fetchData(1, tab); }, [tab]);

  const handleRevoke = async (id) => {
    setActionLoading(id);
    const res = await walletService.revokeMandate(id);
    setActionLoading(null);
    setConfirmAction(null);
    if (res.success) { fetchData(1, tab); } else { alert(res.message || "Failed to cancel mandate."); }
  };

  const handlePause = async (id, orderId) => {
    setActionLoading(id);
    const res = await walletService.stopMandateExecution(id, orderId);
    setActionLoading(null);
    setConfirmAction(null);
    if (res.success) { fetchData(1, tab); } else { alert(res.message || "Failed to pause mandate."); }
  };

  const tabs = ["active", "pending", "stopped", "revoked"];

  return (
    <div className="ap-page">
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text"><h1 className="th-title">AutoPay Mandates</h1><span className="th-count">Manage recurring payments</span></div>
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        {tabs.map((t) => {
          const cfg = statusConfig[t];
          return (
            <button key={t} type="button" className={`ap-tab${tab === t ? " is-active" : ""}`}
              style={{ "--ap-color": cfg.color }} onClick={() => setTab(t)}>
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="th-list">{[0, 1, 2].map((i) => <SkeletonCard key={i} delay={i * 80} />)}</div>
      ) : error ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap md-empty-icon-wrap--error"><FaExclamationTriangle /></div>
          <h3 className="md-empty-title">Something went wrong</h3>
          <p className="md-empty-desc">{error}</p>
          <button className="md-btn-primary" type="button" onClick={() => fetchData(1, tab)}>Retry</button>
        </div>
      ) : mandates.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon-wrap"><FiInbox /><div className="md-empty-ring" /></div>
          <h3 className="md-empty-title">No {statusConfig[tab].label} Mandates</h3>
          <p className="md-empty-desc">Your {tab} AutoPay mandates will appear here.</p>
        </div>
      ) : (
        <div className="th-list">
          {mandates.map((m, i) => {
            const st = getStatus(m.status || tab);
            const isExp = expandedId === (m.mandateId || m.id || i);
            return (
              <div key={m.mandateId || m.id || i} className="ap-card" style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setExpandedId(isExp ? null : (m.mandateId || m.id || i))}>
                <div className="ap-card-accent" style={{ background: st.color }} />
                <div className="ap-card-body">
                  <div className="ap-card-top">
                    <div className="ap-card-icon" style={{ "--st-color": st.color }}><FaSyncAlt /></div>
                    <div className="ap-card-info">
                      <div className="ap-card-id">Mandate: {m.mandateId || m.id || "—"}</div>
                      <div className="ap-card-sub">
                        {m.amount && <span>&#8377;{m.amount}</span>}
                        {m.executionDay && <span>Day {m.executionDay}</span>}
                      </div>
                    </div>
                    <div className="ap-card-right">
                      <div className="th-status" style={{ "--st-color": st.color }}>{st.icon} {st.label}</div>
                      <FaChevronDown className={`wt-chevron${isExp ? " is-open" : ""}`} />
                    </div>
                  </div>

                  {isExp && (
                    <div className="wt-expanded">
                      {[
                        ["Mandate ID", m.mandateId || "—"],
                        ["Order ID", m.orderId || "—"],
                        ["Bill No", m.billNo || "—"],
                        ["Amount", m.amount ? `₹${m.amount}` : "—"],
                        ["Validity", m.validity ? `${m.validity} days` : "—"],
                        ["Execution Day", m.executionDay || "—"],
                        ["Status", (m.status || tab).toUpperCase()],
                      ].map(([l, v]) => (
                        <div key={l} className="wt-detail-row"><span className="wt-detail-label">{l}</span><span className="wt-detail-value">{v}</span></div>
                      ))}

                      {tab === "active" && (
                        <div className="ap-actions">
                          <button className="ap-action-btn ap-action-btn--danger" type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "revoke", id: m.mandateId || m.id }); }}>
                            <FaBan /> Cancel
                          </button>
                          <button className="ap-action-btn ap-action-btn--warn" type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "pause", id: m.mandateId || m.id, orderId: m.orderId }); }}>
                            <FaPauseCircle /> Pause
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button className="th-load-more" type="button" onClick={() => { const n = page + 1; setPage(n); fetchData(n, tab, true); }} disabled={loading}>
              {loading ? <><span className="md-spinner" /> Loading...</> : "Load More"}
            </button>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <div className="tc-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-status-wrap" style={{ "--tc-color": confirmAction.type === "revoke" ? "#FF3B30" : "#FF9800" }}>
              {confirmAction.type === "revoke" ? <FaBan /> : <FaPauseCircle />}
            </div>
            <h3 className="tc-modal-title">{confirmAction.type === "revoke" ? "Cancel Mandate?" : "Pause Mandate?"}</h3>
            <p className="md-empty-desc" style={{ marginBottom: 16 }}>
              {confirmAction.type === "revoke" ? "This will permanently cancel this AutoPay mandate." : "This will temporarily pause the next execution."}
            </p>
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button className="pf-crop-cancel" type="button" onClick={() => setConfirmAction(null)}>No, Keep</button>
              <button className="pf-crop-confirm" type="button" style={{ background: confirmAction.type === "revoke" ? "#FF3B30" : "#FF9800", boxShadow: "none" }}
                disabled={!!actionLoading}
                onClick={() => confirmAction.type === "revoke" ? handleRevoke(confirmAction.id) : handlePause(confirmAction.id, confirmAction.orderId)}>
                {actionLoading ? <span className="md-spinner" /> : confirmAction.type === "revoke" ? "Yes, Cancel" : "Yes, Pause"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoPayScreen;
