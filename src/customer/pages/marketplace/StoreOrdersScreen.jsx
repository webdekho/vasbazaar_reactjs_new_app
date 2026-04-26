import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATUS_FILTER = ["All", "PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const NEXT_STATUS = {
  PLACED: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

const formatDate = (s) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const StoreOrdersScreen = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyStoreOrders({
      orderStatus: filter === "All" ? undefined : filter,
      pageSize: 50,
    });
    setLoading(false);
    if (res.success) {
      setOrders(res.data?.records || []);
    } else {
      setError(res.message);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const advance = async (order) => {
    const next = NEXT_STATUS[order.orderStatus];
    if (!next) return;
    const res = await marketplaceService.updateStoreOrderStatus(order.id, next);
    if (res.success) load();
    else setError(res.message);
  };

  const cancel = async (order) => {
    if (!window.confirm("Cancel this order?")) return;
    const res = await marketplaceService.updateStoreOrderStatus(order.id, "CANCELLED");
    if (res.success) load();
    else setError(res.message);
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Store Orders</h1>
      </div>

      <div className="mkt-categories">
        {STATUS_FILTER.map((f) => (
          <button
            key={f}
            className={`mkt-cat-chip${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && <div className="mkt-error-text" style={{ padding: "0 14px" }}>{error}</div>}

      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="mkt-empty"><div className="mkt-empty-icon"><FaStore /></div>No orders</div>
      ) : (
        <div style={{ padding: "0 14px 24px" }}>
          {orders.map((o) => {
            const next = NEXT_STATUS[o.orderStatus];
            return (
              <div key={o.id} style={{ background: "var(--cm-card)", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid var(--cm-line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{o.orderNo}</div>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{o.userId?.name || "Customer"}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{o.contactMobile} · {formatDate(o.placedAt || o.date)}</div>
                  </div>
                  <strong>₹{Number(o.totalAmount || 0).toFixed(0)}</strong>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--cm-muted)" }}>{o.deliveryAddress}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" }}>
                    {String(o.orderStatus).replace(/_/g, " ")}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {o.orderStatus !== "CANCELLED" && o.orderStatus !== "DELIVERED" && (
                      <button onClick={() => cancel(o)} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>Cancel</button>
                    )}
                    {next && (
                      <button onClick={() => advance(o)} className="mkt-btn mkt-btn--primary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
                        Mark {next.replace(/_/g, " ")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreOrdersScreen;
