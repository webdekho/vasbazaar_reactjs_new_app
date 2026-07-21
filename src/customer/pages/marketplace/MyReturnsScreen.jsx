import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUndoAlt, FaExchangeAlt, FaBoxOpen } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const STATUS_LABEL = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PICKED_UP: "Picked up",
  REFUNDED: "Refunded",
  REPLACED: "Replaced",
  CLOSED: "Closed",
};
const FLOW = ["REQUESTED", "APPROVED", "PICKED_UP", "REFUNDED"];
const FLOW_REPLACE = ["REQUESTED", "APPROVED", "PICKED_UP", "REPLACED"];

const inr = (n) => `₹${Number(n || 0).toFixed(2)}`;

const StatusBadge = ({ status }) => {
  const rejected = status === "REJECTED";
  const done = status === "REFUNDED" || status === "REPLACED" || status === "CLOSED";
  const tone = rejected ? "#f87171" : done ? "#34d399" : "#f59e0b";
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: `${tone}22`, color: tone }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
};

const MyReturnsScreen = () => {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    marketplaceService.getMyReturns({ pageSize: 100 }).then((res) => {
      setLoading(false);
      if (res.success) {
        const data = res.data || {};
        const rows = Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []);
        setReturns(rows);
      } else {
        setError(res.message || "Couldn't load your returns. Please try again.");
      }
    });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Returns</h1>
      </div>

      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : error ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaBoxOpen /></div>
          <div>{error}</div>
          <button
            onClick={load}
            style={{ marginTop: 14, background: "var(--cm-primary, #14b8a6)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      ) : returns.length === 0 ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaUndoAlt /></div>
          <div>No return or replacement requests yet</div>
        </div>
      ) : (
        <div style={{ padding: "8px 14px 24px" }}>
          {returns.map((r) => {
            const store = r.storeId || {};
            const order = r.orderId || {};
            const flow = r.type === "REPLACEMENT" ? FLOW_REPLACE : FLOW;
            const isRejected = r.status === "REJECTED";
            const idx = flow.indexOf(r.status === "CLOSED" ? flow[flow.length - 1] : r.status);
            const orderId = order?.id ?? r.orderId;
            return (
              <div
                key={r.id}
                onClick={() => orderId && navigate(`/customer/app/marketplace/orders/${orderId}`)}
                style={{ background: "var(--cm-card)", border: "1px solid var(--cm-line)", borderRadius: 14, padding: 14, marginBottom: 10, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14 }}>
                      {r.type === "REPLACEMENT" ? <FaExchangeAlt size={12} /> : <FaUndoAlt size={12} />}
                      {r.type === "REPLACEMENT" ? "Replacement" : "Return"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>
                      {store.businessName || "Store"}{order.orderNo ? ` · ${order.orderNo}` : ""} · {formatDisplayDateTime(r.createdAt, "")}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                {r.reason && (
                  <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 8 }}>{r.reason}</div>
                )}

                {isRejected ? (
                  r.resolutionNote && (
                    <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{r.resolutionNote}</div>
                  )
                ) : (
                  <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
                    {flow.map((s, i) => (
                      <div key={s} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ height: 4, borderRadius: 4, background: i <= idx ? "linear-gradient(135deg, #14b8a6, #10b981)" : "var(--cm-line)" }} />
                        <div style={{ fontSize: 9, marginTop: 3, color: i <= idx ? "var(--cm-ink)" : "var(--cm-muted)", fontWeight: i === idx ? 700 : 500 }}>
                          {STATUS_LABEL[s]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* SELLER_CASH_DUE is called out separately, and in amber rather than
                    green: on a Cash on Delivery order the money never reached
                    VasBazaar, so no electronic refund is coming and the buyer must
                    know to collect cash from the store. Falling through to the
                    generic line below would say "processing" and leave them waiting
                    for a transfer that will never arrive. */}
                {Number(r.refundAmount) > 0 && r.refundStatus === "SELLER_CASH_DUE" && (
                  <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, marginTop: 10 }}>
                    {inr(r.refundAmount)} to be returned to you in cash by the store
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginTop: 2 }}>
                      This was a Cash on Delivery order, so the store refunds it directly.
                    </div>
                  </div>
                )}

                {Number(r.refundAmount) > 0 && r.refundStatus !== "SELLER_CASH_DUE" && (
                  <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700, marginTop: 10 }}>
                    {inr(r.refundAmount)} refund {r.refundStatus === "WALLET_REFUNDED" ? "credited to wallet" : (r.refundStatus === "SOURCE_INITIATED" || r.refundStatus === "SOURCE_REFUNDED") ? "to original payment (3–7 days)" : "processing"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyReturnsScreen;
