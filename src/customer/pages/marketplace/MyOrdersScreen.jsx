import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore, FaChevronRight } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATUS_COLOR = {
  PLACED: "#fbbf24",
  ACCEPTED: "#60a5fa",
  PREPARING: "#60a5fa",
  OUT_FOR_DELIVERY: "#a78bfa",
  DELIVERED: "#34d399",
  CANCELLED: "#f87171",
};

const formatDate = (s) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const MyOrdersScreen = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    marketplaceService.getMyOrders({ pageSize: 50 }).then((res) => {
      setLoading(false);
      if (res.success) {
        const data = res.data || {};
        setOrders(Array.isArray(data.records) ? data.records : []);
      }
    });
  }, []);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Orders</h1>
      </div>

      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaStore /></div>
          <div>No orders yet</div>
        </div>
      ) : (
        <div style={{ padding: "8px 14px 24px" }}>
          {orders.map((o) => (
            <div
              key={o.id}
              onClick={() => navigate(`/customer/app/marketplace/orders/${o.id}`)}
              style={{
                background: "var(--cm-card)",
                border: "1px solid var(--cm-line)",
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{o.storeId?.businessName || "Order"}</div>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>
                    {o.orderNo} · {formatDate(o.placedAt || o.date)}
                  </div>
                </div>
                <FaChevronRight size={12} style={{ color: "var(--cm-muted)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: `${STATUS_COLOR[o.orderStatus] || "#888"}22`,
                  color: STATUS_COLOR[o.orderStatus] || "#888",
                }}>
                  {String(o.orderStatus || "PLACED").replace(/_/g, " ")}
                </span>
                <strong>₹{Number(o.totalAmount || 0).toFixed(0)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrdersScreen;
