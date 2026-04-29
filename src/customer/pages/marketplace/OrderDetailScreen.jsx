import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { playSuccessSound } from "../../services/audioService";
import {
  FaArrowLeft,
  FaStore,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaTruck,
  FaBoxOpen,
  FaPrint,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaUser,
  FaReceipt,
  FaRupeeSign,
} from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATUS_FLOW = ["PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
const STATUS_LABEL = {
  PLACED: "Order placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};
const STATUS_ICON = {
  PLACED: FaClock,
  ACCEPTED: FaCheckCircle,
  PREPARING: FaBoxOpen,
  OUT_FOR_DELIVERY: FaTruck,
  DELIVERED: FaCheckCircle,
  CANCELLED: FaTimesCircle,
};

const inr = (n) => `₹${Number(n || 0).toFixed(2)}`;

const formatDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const pickItems = (order) =>
  order?.orderItems || order?.items || order?.lineItems || order?.products || [];

const itemName = (it) =>
  it?.itemName || it?.name || it?.itemId?.name || it?.productName || "Item";
const itemQty = (it) => Number(it?.quantity ?? it?.qty ?? 1);
const itemPrice = (it) =>
  Number(it?.price ?? it?.sellingPrice ?? it?.unitPrice ?? it?.itemId?.sellingPrice ?? 0);
const itemTotal = (it) =>
  Number(it?.total ?? it?.amount ?? itemQty(it) * itemPrice(it));

const CONFETTI_COLORS = ["#00E5A0", "#3B82F6", "#A855F7", "#FFD700", "#FF6B6B", "#06B6D4"];

const OrderDetailScreen = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  // Trigger celebration if any of: navigation state (cart→detail flow),
  // ?celebrate=1 query param (manual trigger / share-back), or first-time
  // viewing a PAID order (we mark it shown via sessionStorage so a refresh
  // doesn't re-fire).
  const initialCelebrate = Boolean(location.state?.celebrate)
    || new URLSearchParams(location.search).get("celebrate") === "1";
  const [celebrate, setCelebrate] = useState(initialCelebrate);
  const celebrateFiredRef = useRef(false);

  const load = useCallback(async () => {
    const res = await marketplaceService.getMyOrder(orderId);
    setLoading(false);
    if (res.success) {
      setOrder(res.data);
      // Auto-celebrate first-time view of a paid order this session.
      const seenKey = `mkt_celebrated_${orderId}`;
      if (res.data?.paymentStatus === "PAID" && !sessionStorage.getItem(seenKey)) {
        sessionStorage.setItem(seenKey, "1");
        setCelebrate(true);
      }
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!celebrate || celebrateFiredRef.current) return;
    celebrateFiredRef.current = true;

    let handle;
    playSuccessSound().then((h) => { handle = h; }).catch(() => {});

    // Clear navigation state so a refresh does not re-celebrate
    window.history.replaceState({}, "");

    const timer = setTimeout(() => setCelebrate(false), 4500);
    return () => {
      clearTimeout(timer);
      if (handle?.stop) handle.stop();
    };
  }, [celebrate]);

  const items = useMemo(() => pickItems(order), [order]);
  const itemsSubtotal = useMemo(
    () => items.reduce((s, it) => s + itemTotal(it), 0),
    [items]
  );

  if (loading) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h1 className="mkt-header-title">Order</h1>
        </div>
        <div className="mkt-empty">Loading…</div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h1 className="mkt-header-title">Order</h1>
        </div>
        <div className="mkt-empty">Order not found</div>
      </div>
    );
  }

  const statusIdx = STATUS_FLOW.indexOf(order.orderStatus);
  const isCancelled = order.orderStatus === "CANCELLED";
  const isRejected = order.orderStatus === "REJECTED";
  const paymentPaid = order.paymentStatus === "PAID";
  const subtotal = Number(order.subtotal ?? itemsSubtotal);
  const delivery = Number(order.deliveryCharges || 0);
  const platformCharge = Number(order.orderCharge || 0);
  const tax = Number(order.tax || order.gst || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.totalAmount || subtotal + delivery + platformCharge + tax - discount);
  const store = order.storeId || {};
  const buyer = order.userId || {};

  return (
    <div className="mkt">
      {celebrate && (
        <div className="mkt-celebrate no-print" aria-hidden>
          <div className="mkt-celebrate-glow" />
          <div className="mkt-celebrate-ring mkt-celebrate-ring--1" />
          <div className="mkt-celebrate-ring mkt-celebrate-ring--2" />
          <div className="mkt-celebrate-ring mkt-celebrate-ring--3" />
          {Array.from({ length: 120 }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / 120 + Math.random() * 0.4;
            const distance = 240 + Math.random() * 360;
            const dx = Math.cos(angle) * distance;
            // Bias upward — emit point sits near the bottom of the viewport.
            const dy = -(Math.abs(Math.sin(angle)) * distance + Math.random() * 280);
            const shapeIdx = i % 4;
            const shape =
              shapeIdx === 0 ? "mkt-conf--sq" :
              shapeIdx === 1 ? "mkt-conf--cir" :
              shapeIdx === 2 ? "mkt-conf--rib" :
              "mkt-conf--star";
            return (
              <span
                key={i}
                className={`mkt-conf ${shape}`}
                style={{
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                  "--rot": `${Math.random() * 1440 - 720}deg`,
                  "--col": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  width: `${shapeIdx === 2 ? 5 : 7 + Math.random() * 5}px`,
                  height: `${shapeIdx === 2 ? 14 + Math.random() * 8 : 7 + Math.random() * 5}px`,
                  animationDelay: `${Math.random() * 0.35}s`,
                  animationDuration: `${1.8 + Math.random() * 1.6}s`,
                }}
              />
            );
          })}
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={`sp${i}`}
              className="mkt-conf-spark"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 50}%`,
                animationDelay: `${0.3 + Math.random() * 1.8}s`,
              }}
            />
          ))}
          <div className="mkt-celebrate-badge">
            <svg viewBox="0 0 56 56" width="64" height="64">
              <circle className="mkt-cb-circle" cx="28" cy="28" r="24" fill="none" />
              <path className="mkt-cb-check" d="M16 29l8 8 16-18" fill="none" />
            </svg>
          </div>
        </div>
      )}
      <div className="mkt-header no-print">
        <button
          className="mkt-header-back"
          onClick={() => navigate("/customer/app/marketplace/my-orders")}
        >
          <FaArrowLeft />
        </button>
        <h1 className="mkt-header-title">Receipt</h1>
        <button
          className="mkt-header-back"
          style={{ marginLeft: "auto" }}
          onClick={() => window.print()}
          aria-label="Print receipt"
        >
          <FaPrint />
        </button>
      </div>

      <div className="mkt-receipt" style={{ padding: 14 }}>
        {/* Receipt header */}
        <div className="mkt-receipt-card">
          <div style={{ textAlign: "center", paddingBottom: 12, borderBottom: "1px dashed var(--cm-line)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18 }}>
              <FaStore /> {store.businessName || "Store"}
            </div>
            {store.address && (
              <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>{store.address}</div>
            )}
            {(store.city || store.state) && (
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                {[store.city, store.state, store.pincode].filter(Boolean).join(", ")}
              </div>
            )}
            {store.mobile && (
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Phone: {store.mobile}</div>
            )}
            {store.gstNumber && (
              <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>GSTIN: {store.gstNumber}</div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--cm-muted)", fontSize: 11 }}>Receipt No.</div>
              <div style={{ fontWeight: 700 }}>{order.orderNo || `#${order.id}`}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--cm-muted)", fontSize: 11 }}>Date</div>
              <div style={{ fontWeight: 700 }}>{formatDateTime(order.placedAt || order.date || order.createdAt)}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 6,
              background: (isCancelled || isRejected) ? "rgba(248,113,113,0.14)" : "rgba(20,184,166,0.14)",
              color: (isCancelled || isRejected) ? "#f87171" : "#14b8a6",
            }}
          >
            <FaReceipt size={11} />
            {String(order.orderStatus || "PLACED").replace(/_/g, " ")}
          </div>
        </div>

        {/* Customer & delivery */}
        <div className="mkt-receipt-card" style={{ marginTop: 12 }}>
          <div className="mkt-receipt-section-title">Bill To</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 6 }}>
            <FaUser size={11} style={{ color: "var(--cm-muted)" }} />
            <span style={{ fontWeight: 600 }}>{buyer.name || "Customer"}</span>
          </div>
          {order.contactMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 4 }}>
              <FaPhoneAlt size={11} style={{ color: "var(--cm-muted)" }} />
              <span>{order.contactMobile}</span>
            </div>
          )}
          {order.deliveryAddress && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginTop: 4 }}>
              <FaMapMarkerAlt size={11} style={{ color: "var(--cm-muted)", marginTop: 4 }} />
              <span>{order.deliveryAddress}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mkt-receipt-card" style={{ marginTop: 12 }}>
          <div className="mkt-receipt-section-title">Items</div>
          <table className="mkt-receipt-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Item</th>
                <th style={{ textAlign: "center", width: 40 }}>Qty</th>
                <th style={{ textAlign: "right", width: 80 }}>Price</th>
                <th style={{ textAlign: "right", width: 80 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--cm-muted)", padding: "10px 0" }}>
                    No item details
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={it.id || it.itemId?.id || idx}>
                    <td>{itemName(it)}</td>
                    <td style={{ textAlign: "center" }}>{itemQty(it)}</td>
                    <td style={{ textAlign: "right" }}>{inr(itemPrice(it))}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{inr(itemTotal(it))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bill summary */}
        <div className="mkt-receipt-card" style={{ marginTop: 12 }}>
          <div className="mkt-receipt-section-title">Bill Summary</div>
          <div className="mkt-receipt-row">
            <span>Subtotal</span>
            <span>{inr(subtotal)}</span>
          </div>
          <div className="mkt-receipt-row">
            <span>Delivery charges</span>
            <span>{delivery > 0 ? inr(delivery) : "Free"}</span>
          </div>
          {platformCharge > 0 && (
            <div className="mkt-receipt-row">
              <span>Platform charge</span>
              <span>{inr(platformCharge)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="mkt-receipt-row">
              <span>Tax / GST</span>
              <span>{inr(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="mkt-receipt-row" style={{ color: "#34d399" }}>
              <span>Discount</span>
              <span>-{inr(discount)}</span>
            </div>
          )}
          <div className="mkt-receipt-row mkt-receipt-row--total">
            <span>
              <FaRupeeSign size={11} style={{ marginRight: 4 }} />
              Grand Total
            </span>
            <span>{inr(total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="mkt-receipt-card" style={{ marginTop: 12 }}>
          <div className="mkt-receipt-section-title">Payment</div>
          <div className="mkt-receipt-row">
            <span>Status</span>
            <span
              style={{
                color: paymentPaid ? "#34d399" : order.paymentStatus === "FAILED" ? "#f87171" : "#fbbf24",
                fontWeight: 700,
              }}
            >
              {order.paymentStatus || "PENDING"}
            </span>
          </div>
          {order.paymentMethod && (
            <div className="mkt-receipt-row">
              <span>Method</span>
              <span>{order.paymentMethod}</span>
            </div>
          )}
          {order.paymentTxnId && (
            <div className="mkt-receipt-row">
              <span>Txn ID</span>
              <span style={{ fontSize: 11 }}>{order.paymentTxnId}</span>
            </div>
          )}
          {order.paidAt && (
            <div className="mkt-receipt-row">
              <span>Paid at</span>
              <span>{formatDateTime(order.paidAt)}</span>
            </div>
          )}
        </div>

        {/* Tracking timeline */}
        <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
          <div className="mkt-receipt-section-title">Order Tracking</div>
          {!(isCancelled || isRejected) ? (
            <div style={{ marginTop: 6 }}>
              {STATUS_FLOW.map((s, i) => {
                const Icon = STATUS_ICON[s];
                const done = i <= statusIdx;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: done
                          ? "linear-gradient(135deg, #14b8a6, #10b981)"
                          : "var(--cm-line)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      <Icon size={11} />
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: done ? "var(--cm-ink)" : "var(--cm-muted)",
                        fontWeight: i === statusIdx ? 700 : 500,
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mkt-status-banner mkt-status--rejected" style={{ margin: "8px 0 0" }}>
              <FaTimesCircle size={16} style={{ marginTop: 2 }} />
              <div>
                {isRejected ? "Order rejected" : "Order cancelled"}
                {(isRejected ? order.rejectionReason : order.cancellationReason)
                  ? ` — ${isRejected ? order.rejectionReason : order.cancellationReason}`
                  : ""}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mkt-receipt-footer">
          <div className="mkt-receipt-thanks">
            Thank you for shopping with {store.businessName || "us"}!
          </div>
          <div className="mkt-receipt-sysline">This is a system-generated receipt.</div>
          <div className="mkt-receipt-poweredby">
            <span>Powered by</span>
            <img
              src="/images/vasbazaar-light.png"
              alt="VasBazaar"
              className="mkt-receipt-poweredby-logo mkt-receipt-poweredby-logo--light"
            />
            <img
              src="/images/vasbazaar-dark.png"
              alt="VasBazaar"
              className="mkt-receipt-poweredby-logo mkt-receipt-poweredby-logo--dark"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailScreen;
