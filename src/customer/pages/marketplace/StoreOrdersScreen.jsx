import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore, FaFileExcel } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATUS_FILTER = ["All", "PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "REJECTED", "CANCELLED"];
// PLACED state shows accept/reject buttons separately (not in NEXT_STATUS).
const NEXT_STATUS = {
  ACCEPTED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  // DELIVERED is reached via the delivery-OTP verification, not a plain button.
};
// Pickup orders follow a different progression: no out-for-delivery/delivered.
// PICKED_UP is reached via the verify-pickup code, not a plain status button.
const NEXT_STATUS_PICKUP = {
  ACCEPTED: "PREPARING",
  PREPARING: "READY_FOR_PICKUP",
};
const isPickup = (o) => o?.fulfillmentType === "PICKUP";

const STATUS_TONE = {
  PLACED: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  ACCEPTED: { bg: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" },
  PREPARING: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" },
  OUT_FOR_DELIVERY: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" },
  READY_FOR_PICKUP: { bg: "rgba(45, 212, 191, 0.14)", color: "#2dd4bf" },
  PICKED_UP: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  DELIVERED: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444" },
  CANCELLED: { bg: "rgba(148, 163, 184, 0.18)", color: "#64748b" },
};

const formatDate = (s) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const StoreOrdersScreen = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Default range = last 30 days so the page is useful out of the box.
  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate] = useState(todayIso());
  // Verify-pickup local UI state, keyed by order id.
  const [pickupCodes, setPickupCodes] = useState({}); // { [orderId]: "123456" }
  const [verifyMsg, setVerifyMsg] = useState({});      // { [orderId]: { type, text } }
  const [verifying, setVerifying] = useState({});      // { [orderId]: bool }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyStoreOrders({
      orderStatus: filter === "All" ? undefined : filter,
      pageSize: 200,
    });
    setLoading(false);
    if (res.success) {
      setOrders(res.data?.records || []);
    } else {
      setError(res.message);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Date-range filter applied client-side over the loaded page. Good enough
  // for the order volumes we show (pageSize=200) — server-side range filter
  // can be added if a single store outgrows that.
  const filteredOrders = useMemo(() => {
    if (!fromDate && !toDate) return orders;
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
    return orders.filter((o) => {
      const ts = o.placedAt || o.date || o.createdDate;
      if (!ts) return true;
      const t = new Date(ts).getTime();
      return t >= from && t <= to;
    });
  }, [orders, fromDate, toDate]);

  const exportExcel = () => {
    if (filteredOrders.length === 0) return;
    const headers = [
      "Order No", "Order Status", "Payment Status", "Customer Name", "Mobile",
      "Total (₹)", "Subtotal (₹)", "Delivery (₹)", "Tax (₹)", "Discount (₹)",
      "Address", "Placed At", "Rejection Reason",
    ];
    const escape = (val) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/\r?\n/g, " ");
      return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredOrders.map((o) => [
      o.orderNo || `#${o.id}`,
      o.orderStatus || "",
      o.paymentStatus || "",
      o.userId?.name || "",
      o.contactMobile || o.userId?.mobileNumber || "",
      Number(o.totalAmount || 0).toFixed(2),
      Number(o.subtotal || 0).toFixed(2),
      Number(o.deliveryCharges || 0).toFixed(2),
      Number(o.tax || o.gst || 0).toFixed(2),
      Number(o.discount || 0).toFixed(2),
      o.deliveryAddress || "",
      o.placedAt || o.date || "",
      o.rejectionReason || "",
    ]);
    // BOM so Excel opens UTF-8 cleanly (₹ symbol etc.)
    const csv = "﻿" + [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-orders_${fromDate || "all"}_${toDate || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const advance = async (order) => {
    const map = isPickup(order) ? NEXT_STATUS_PICKUP : NEXT_STATUS;
    const next = map[order.orderStatus];
    if (!next) return;
    const res = await marketplaceService.updateOrderStatus(order.id, next);
    if (res.success) load();
    else setError(res.message);
  };

  const verifyPickup = async (order) => {
    const code = (pickupCodes[order.id] || "").trim();
    if (code.length < 4) {
      setVerifyMsg((m) => ({ ...m, [order.id]: { type: "error", text: "Enter the customer's pickup code" } }));
      return;
    }
    setVerifying((v) => ({ ...v, [order.id]: true }));
    const res = await marketplaceService.verifyPickup(order.id, code);
    setVerifying((v) => ({ ...v, [order.id]: false }));
    if (res.success) {
      setVerifyMsg((m) => ({ ...m, [order.id]: { type: "success", text: res.message || "Pickup verified" } }));
      setPickupCodes((c) => ({ ...c, [order.id]: "" }));
      load();
    } else {
      setVerifyMsg((m) => ({ ...m, [order.id]: { type: "error", text: res.message || "Incorrect pickup code" } }));
    }
  };

  const verifyDelivery = async (order) => {
    const code = (pickupCodes[order.id] || "").trim();
    if (code.length < 4) {
      setVerifyMsg((m) => ({ ...m, [order.id]: { type: "error", text: "Enter the customer's delivery OTP" } }));
      return;
    }
    setVerifying((v) => ({ ...v, [order.id]: true }));
    const res = await marketplaceService.verifyDelivery(order.id, code);
    setVerifying((v) => ({ ...v, [order.id]: false }));
    if (res.success) {
      setVerifyMsg((m) => ({ ...m, [order.id]: { type: "success", text: res.message || "Delivery verified" } }));
      setPickupCodes((c) => ({ ...c, [order.id]: "" }));
      load();
    } else {
      setVerifyMsg((m) => ({ ...m, [order.id]: { type: "error", text: res.message || "Incorrect delivery OTP" } }));
    }
  };

  const cancel = async (order) => {
    if (!window.confirm("Cancel this order?")) return;
    const res = await marketplaceService.updateOrderStatus(order.id, "CANCELLED");
    if (res.success) load();
    else setError(res.message);
  };

  const accept = async (order) => {
    const res = await marketplaceService.acceptOrder(order.id);
    if (res.success) load();
    else setError(res.message);
  };

  const reject = async (order) => {
    const reason = window.prompt("Reason for rejecting this order? (optional)") || "";
    if (reason === null) return; // user cancelled
    const res = await marketplaceService.rejectOrder(order.id, reason.trim());
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

      {/* Date range + export */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 8,
          padding: "4px 14px 12px",
        }}
      >
        <div style={{ flex: "1 1 120px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>From</div>
          <input
            type="date"
            className="mkt-input"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 120px", minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>To</div>
          <input
            type="date"
            className="mkt-input"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={filteredOrders.length === 0}
          title="Export filtered orders to Excel"
          style={{
            height: 40, padding: "0 14px",
            display: "inline-flex", alignItems: "center", gap: 8,
            borderRadius: 10, border: "1px solid #14b8a6",
            background: filteredOrders.length === 0 ? "var(--cm-bg-secondary)" : "linear-gradient(135deg, #14b8a6, #10b981)",
            color: filteredOrders.length === 0 ? "var(--cm-muted)" : "#fff",
            fontSize: 13, fontWeight: 600,
            cursor: filteredOrders.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          <FaFileExcel /> Export Excel
        </button>
      </div>

      {error && <div className="mkt-error-text" style={{ padding: "0 14px" }}>{error}</div>}

      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="mkt-empty"><div className="mkt-empty-icon"><FaStore /></div>No orders in this range</div>
      ) : (
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 8 }}>
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
          {filteredOrders.map((o) => {
            const pickup = isPickup(o);
            const next = (pickup ? NEXT_STATUS_PICKUP : NEXT_STATUS)[o.orderStatus];
            const discount = Number(o.discount || 0);
            const vMsg = verifyMsg[o.id];
            return (
              <div key={o.id} style={{ background: "var(--cm-card)", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid var(--cm-line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{o.orderNo}</div>
                      {pickup && (
                        <span
                          title="Store pickup — customer collects this order"
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 0.4,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(139, 92, 246, 0.14)",
                            color: "#8b5cf6",
                            border: "1px solid rgba(139, 92, 246, 0.35)",
                          }}
                        >
                          PICKUP
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{o.userId?.name || "Customer"}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{o.contactMobile} · {formatDate(o.placedAt || o.date)}</div>
                  </div>
                  <strong>₹{Number(o.totalAmount || 0).toFixed(0)}</strong>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--cm-muted)" }}>
                  {pickup ? "Store pickup" : o.deliveryAddress}
                  {discount > 0 && (
                    <span style={{ color: "#10b981", fontWeight: 600 }}>
                      {" · Coupon ₹"}{discount.toFixed(0)}{o.offerCode ? ` (${o.offerCode})` : ""}
                    </span>
                  )}
                </div>
                {o.rejectionReason && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444" }}>
                    Rejection reason: {o.rejectionReason}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: (STATUS_TONE[o.orderStatus] || STATUS_TONE.ACCEPTED).bg,
                    color: (STATUS_TONE[o.orderStatus] || STATUS_TONE.ACCEPTED).color,
                  }}>
                    {String(o.orderStatus).replace(/_/g, " ")}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {o.orderStatus === "PLACED" && (
                      <>
                        <button onClick={() => reject(o)} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>Reject</button>
                        <button onClick={() => accept(o)} className="mkt-btn mkt-btn--primary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>Accept</button>
                      </>
                    )}
                    {o.orderStatus !== "CANCELLED" && o.orderStatus !== "DELIVERED" && o.orderStatus !== "PICKED_UP" && o.orderStatus !== "REJECTED" && o.orderStatus !== "PLACED" && (
                      <button onClick={() => cancel(o)} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>Cancel</button>
                    )}
                    {next && (
                      <button onClick={() => advance(o)} className="mkt-btn mkt-btn--primary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
                        {next === "READY_FOR_PICKUP" ? "Mark ready for pickup" : `Mark ${next.replace(/_/g, " ")}`}
                      </button>
                    )}
                  </div>
                </div>

                {pickup && o.orderStatus === "READY_FOR_PICKUP" && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--cm-line)" }}>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 6 }}>
                      Ask the customer for their 6-digit pickup code to complete this order.
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Pickup code"
                        className="mkt-input"
                        value={pickupCodes[o.id] || ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setPickupCodes((c) => ({ ...c, [o.id]: v }));
                          setVerifyMsg((m) => ({ ...m, [o.id]: undefined }));
                        }}
                        style={{ width: 120, letterSpacing: 2, fontWeight: 700, textAlign: "center" }}
                      />
                      <button
                        onClick={() => verifyPickup(o)}
                        disabled={verifying[o.id]}
                        className="mkt-btn mkt-btn--primary"
                        style={{ width: "auto", padding: "8px 14px", fontSize: 12, opacity: verifying[o.id] ? 0.7 : 1 }}
                      >
                        {verifying[o.id] ? "Verifying…" : "Verify & complete pickup"}
                      </button>
                    </div>
                    {vMsg && (
                      <div style={{ marginTop: 6, fontSize: 12, color: vMsg.type === "success" ? "#10b981" : "#ef4444" }}>
                        {vMsg.text}
                      </div>
                    )}
                  </div>
                )}

                {!pickup && o.orderStatus === "OUT_FOR_DELIVERY" && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--cm-line)" }}>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 6 }}>
                      Ask the customer for their 6-digit delivery OTP to complete this order.
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Delivery OTP"
                        className="mkt-input"
                        value={pickupCodes[o.id] || ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setPickupCodes((c) => ({ ...c, [o.id]: v }));
                          setVerifyMsg((m) => ({ ...m, [o.id]: undefined }));
                        }}
                        style={{ width: 120, letterSpacing: 2, fontWeight: 700, textAlign: "center" }}
                      />
                      <button
                        onClick={() => verifyDelivery(o)}
                        disabled={verifying[o.id]}
                        className="mkt-btn mkt-btn--primary"
                        style={{ width: "auto", padding: "8px 14px", fontSize: 12, opacity: verifying[o.id] ? 0.7 : 1 }}
                      >
                        {verifying[o.id] ? "Verifying…" : "Verify & mark delivered"}
                      </button>
                    </div>
                    {vMsg && (
                      <div style={{ marginTop: 6, fontSize: 12, color: vMsg.type === "success" ? "#10b981" : "#ef4444" }}>
                        {vMsg.text}
                      </div>
                    )}
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

export default StoreOrdersScreen;
