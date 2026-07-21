import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore, FaFileExcel, FaMotorcycle, FaCamera, FaUndoAlt, FaChartLine, FaBolt, FaSnowflake } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { marketplaceLogisticsAiService } from "../../services/marketplaceLogisticsAiService";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

// DELIVERY-order statuses during which a rider can be (re)assigned.
const RIDER_STATUSES = ["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"];

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

  // ===== Logistics v1: rider assignment + POD + failed delivery =====
  const [riderByOrder, setRiderByOrder] = useState({}); // { [orderId]: { name, mobile } }
  // Bottom-sheet: { order, riders, loading, newName, newMobile, adding, assigningId, error }
  const [riderSheet, setRiderSheet] = useState(null);
  const [podUploading, setPodUploading] = useState({}); // { [orderId]: bool }
  const podInputRef = useRef(null);
  const podOrderRef = useRef(null); // order awaiting the chosen POD file

  // ===== Logistics v2 (Wave 5): auto-assign engine =====
  const [autoAssign, setAutoAssign] = useState(null);   // store toggle state
  const [autoAssigning, setAutoAssigning] = useState({}); // { [orderId]: bool }

  // Rider assignments live in a side table — fetch them for the delivery
  // orders that can carry one (active statuses only, capped to stay light).
  const loadRiderAssignments = useCallback(async (list) => {
    const targets = (list || [])
      .filter((o) => !isPickup(o) && RIDER_STATUSES.includes(o.orderStatus))
      .slice(0, 25);
    if (targets.length === 0) return;
    const entries = await Promise.all(targets.map(async (o) => {
      try {
        const res = await marketplaceLogisticsAiService.getOrderLogistics(o.id);
        return [o.id, res.success ? res.data?.rider || null : null];
      } catch { return [o.id, null]; }
    }));
    setRiderByOrder((prev) => {
      const next = { ...prev };
      entries.forEach(([id, rider]) => { if (rider) next[id] = rider; });
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyStoreOrders({
      orderStatus: filter === "All" ? undefined : filter,
      pageSize: 200,
    });
    setLoading(false);
    if (res.success) {
      const records = res.data?.records || [];
      setOrders(records);
      loadRiderAssignments(records);
    } else {
      setError(res.message);
    }
  }, [filter, loadRiderAssignments]);

  useEffect(() => { load(); }, [load]);

  // Auto-assign toggle state — loaded once; drives the status pill and the hint.
  useEffect(() => {
    (async () => {
      try {
        const res = await marketplaceLogisticsAiService.getAutoAssign();
        if (res?.success) setAutoAssign(res.data?.autoAssignRiders === true);
      } catch { /* non-fatal — pill just stays hidden */ }
    })();
  }, []);

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
      formatDisplayDateTime(o.placedAt || o.date, ""),
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

  // Close a delivery order that carries no OTP (store turned the OTP off).
  const markDelivered = async (order) => {
    setVerifying((v) => ({ ...v, [order.id]: true }));
    const res = await marketplaceService.updateOrderStatus(order.id, "DELIVERED");
    setVerifying((v) => ({ ...v, [order.id]: false }));
    if (res.success) load();
    else setError(res.message);
  };

  const cancel = async (order) => {
    // Reason is required — it reaches the customer's cancellation notification,
    // and the backend auto-refunds any prepaid amount when the store cancels.
    const reason = window.prompt(
      "Why are you cancelling this order? The customer will see this and any payment will be auto-refunded."
    );
    if (reason === null) return; // seller backed out
    if (!reason.trim()) { setError("A cancellation reason is required"); return; }
    const res = await marketplaceService.updateOrderStatus(order.id, "CANCELLED", reason.trim());
    if (res.success) load();
    else setError(res.message);
  };

  const accept = async (order) => {
    const res = await marketplaceService.acceptOrder(order.id);
    if (res.success) load();
    else setError(res.message);
  };

  // Partial availability — mark selected lines out of stock; backend
  // auto-refunds those lines (or cancels the order when nothing is left).
  const [itemsModal, setItemsModal] = useState(null); // { order, items, selected:Set, submitting }
  const openItemsModal = async (order) => {
    const res = await marketplaceService.getMyOrder(order.id);
    if (!res.success) { setError(res.message || "Could not load order items"); return; }
    const active = (res.data?.orderItems || []).filter(
      (it) => !it.lineStatus || it.lineStatus === "ACTIVE"
    );
    if (active.length === 0) { setError("No active items on this order"); return; }
    setItemsModal({ order, items: active, selected: new Set(), submitting: false });
  };
  const submitUnavailable = async () => {
    if (!itemsModal || itemsModal.selected.size === 0) return;
    const all = itemsModal.selected.size >= itemsModal.items.length;
    if (!window.confirm(all
      ? "ALL items are out of stock — the whole order will be cancelled and the customer fully refunded. Continue?"
      : `Mark ${itemsModal.selected.size} item(s) out of stock? The customer will be auto-refunded for them.`)) return;
    setItemsModal((m) => ({ ...m, submitting: true }));
    const res = await marketplaceService.markItemsUnavailable(itemsModal.order.id, [...itemsModal.selected]);
    if (res.success) {
      setItemsModal(null);
      load();
    } else {
      setItemsModal((m) => ({ ...m, submitting: false }));
      setError(res.message || "Could not update items");
    }
  };

  const reject = async (order) => {
    const reason = window.prompt("Reason for rejecting this order? (optional)") || "";
    if (reason === null) return; // user cancelled
    const res = await marketplaceService.rejectOrder(order.id, reason.trim());
    if (res.success) load();
    else setError(res.message);
  };

  // ===== Logistics v1 handlers =====

  const openRiderSheet = async (order) => {
    setRiderSheet({ order, riders: [], loading: true, newName: "", newMobile: "", adding: false, assigningId: null, error: "" });
    const res = await marketplaceLogisticsAiService.getMyRiders();
    setRiderSheet((s) => (s && s.order.id === order.id
      ? { ...s, loading: false, riders: res.success ? (res.data || []) : [], error: res.success ? "" : (res.message || "Could not load riders") }
      : s));
  };

  const assignRiderTo = async (rider) => {
    if (!riderSheet) return;
    setRiderSheet((s) => ({ ...s, assigningId: rider.id, error: "" }));
    const res = await marketplaceLogisticsAiService.assignRider(riderSheet.order.id, rider.id);
    if (res.success) {
      setRiderByOrder((m) => ({ ...m, [riderSheet.order.id]: { name: rider.name, mobile: rider.mobile } }));
      setRiderSheet(null);
    } else {
      setRiderSheet((s) => ({ ...s, assigningId: null, error: res.message || "Could not assign the rider" }));
    }
  };

  // "Assign best rider now" — runs the least-loaded engine on demand. Ignores
  // the store toggle since the seller explicitly asked. Manual assign still wins.
  const autoAssignNow = async (order) => {
    setAutoAssigning((m) => ({ ...m, [order.id]: true }));
    const res = await marketplaceLogisticsAiService.autoAssignOrder(order.id);
    setAutoAssigning((m) => ({ ...m, [order.id]: false }));
    if (res.success && res.data) {
      const name = res.data.name || res.data.rider?.name;
      const mobile = res.data.mobile || res.data.rider?.mobile;
      if (name) setRiderByOrder((m) => ({ ...m, [order.id]: { name, mobile } }));
    } else {
      window.alert(res.message || "Could not auto-assign a rider — add active riders first.");
    }
  };

  const addRiderInline = async () => {
    if (!riderSheet) return;
    const name = riderSheet.newName.trim();
    const mobile = riderSheet.newMobile.trim();
    if (!name || !/^\d{10}$/.test(mobile)) {
      setRiderSheet((s) => ({ ...s, error: "Enter the rider's name and a 10-digit mobile number" }));
      return;
    }
    setRiderSheet((s) => ({ ...s, adding: true, error: "" }));
    const res = await marketplaceLogisticsAiService.addRider(name, mobile);
    if (res.success && res.data) {
      setRiderSheet((s) => ({ ...s, adding: false, newName: "", newMobile: "", riders: [res.data, ...s.riders] }));
    } else {
      setRiderSheet((s) => ({ ...s, adding: false, error: res.message || "Could not add the rider" }));
    }
  };

  const deliveryFailed = async (order) => {
    const reason = window.prompt(
      "Why did this delivery fail? The customer will see this reason and the order goes back to Accepted so you can retry."
    );
    if (reason === null) return;
    if (!reason.trim()) { setError("A failure reason is required"); return; }
    const res = await marketplaceLogisticsAiService.reportDeliveryFailed(order.id, reason.trim());
    if (res.success) {
      if (res.data?.suggestCancel) {
        window.alert("This order has failed delivery 3 or more times. Consider cancelling it — the customer will be auto-refunded.");
      }
      load();
    } else {
      setError(res.message || "Could not record the failed delivery");
    }
  };

  const pickPodPhoto = (order) => {
    podOrderRef.current = order;
    if (podInputRef.current) {
      podInputRef.current.value = "";
      podInputRef.current.click();
    }
  };

  const onPodFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    const order = podOrderRef.current;
    if (!file || !order) return;
    setPodUploading((m) => ({ ...m, [order.id]: true }));
    const up = await marketplaceService.uploadImage(file, "item");
    if (!up.success || !up.data?.url) {
      setPodUploading((m) => ({ ...m, [order.id]: false }));
      setError(up.message || "Could not upload the photo");
      return;
    }
    const res = await marketplaceLogisticsAiService.submitPod(order.id, up.data.url);
    setPodUploading((m) => ({ ...m, [order.id]: false }));
    if (res.success) load();
    else setError(res.message || "Could not save the delivery photo");
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Store Orders</h1>
        <button
          type="button"
          onClick={() => navigate("/customer/app/marketplace/my-store/returns")}
          title="Returns & replacements"
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 10, border: "1px solid var(--cm-line)",
            background: "var(--cm-card)", color: "var(--cm-ink)", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          <FaUndoAlt size={12} /> Returns
        </button>
        <button
          type="button"
          onClick={() => navigate("/customer/app/marketplace/my-store/riders")}
          title="Manage delivery riders"
          style={{
            marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 10, border: "1px solid var(--cm-line)",
            background: "var(--cm-card)", color: "var(--cm-ink)", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          <FaMotorcycle size={12} /> Riders
        </button>
        <button
          type="button"
          onClick={() => navigate("/customer/app/marketplace/my-store/rider-performance")}
          title="Rider performance"
          style={{
            marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 10, border: "1px solid var(--cm-line)",
            background: "var(--cm-card)", color: "var(--cm-ink)", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          <FaChartLine size={12} /> Performance
        </button>
      </div>

      {/* Auto-assign status + cold-chain ordering hint (Wave 5) */}
      {autoAssign != null && (
        <div style={{ padding: "10px 14px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
              padding: "4px 10px", borderRadius: 8,
              background: autoAssign ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.15)",
              color: autoAssign ? "#10b981" : "var(--cm-muted)",
            }}
          >
            <FaBolt size={11} /> Auto-assign {autoAssign ? "ON" : "OFF"}
          </span>
          <span style={{ fontSize: 11, color: "var(--cm-muted)" }}>
            {autoAssign
              ? "New delivery orders get the least-loaded rider automatically — cold-chain & express first."
              : "Turn on auto-assign in Store settings to route riders automatically."}
          </span>
        </div>
      )}

      {/* Hidden picker for proof-of-delivery photos */}
      <input
        ref={podInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={onPodFileChosen}
      />

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
                    <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{o.contactMobile} · {formatDisplayDateTime(o.placedAt || o.date, "")}</div>
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
                {!pickup && o.hasColdChain && !["DELIVERED", "CANCELLED", "REJECTED", "PICKED_UP"].includes(o.orderStatus) && (
                  <div style={{ marginTop: 6, marginRight: 6, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", padding: "3px 10px", borderRadius: 6 }}>
                    <FaSnowflake size={11} /> Cold-chain · priority
                  </div>
                )}
                {!pickup && riderByOrder[o.id] && (
                  <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#8b5cf6", background: "rgba(139, 92, 246, 0.12)", padding: "3px 10px", borderRadius: 6 }}>
                    <FaMotorcycle size={11} /> Rider: {riderByOrder[o.id].name} · {riderByOrder[o.id].mobile}
                  </div>
                )}
                {!pickup && Number(o.deliveryAttempts) > 0 && o.orderStatus !== "DELIVERED" && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#f59e0b" }}>
                    Failed delivery attempt{Number(o.deliveryAttempts) > 1 ? "s" : ""}: {o.deliveryAttempts}
                    {o.deliveryFailedReason ? ` — last reason: ${o.deliveryFailedReason}` : ""}
                    {Number(o.deliveryAttempts) >= 3 ? " · Consider cancelling — customer will be auto-refunded" : ""}
                  </div>
                )}
                {!pickup && o.podImageUrl && (
                  <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                    <FaCamera size={11} /> POD photo added
                    <a href={o.podImageUrl} target="_blank" rel="noreferrer" style={{ color: "#10b981" }}>view</a>
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
                    {["PLACED", "ACCEPTED", "PREPARING"].includes(o.orderStatus) && (
                      <button onClick={() => openItemsModal(o)} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>Items out of stock</button>
                    )}
                    {!pickup && RIDER_STATUSES.includes(o.orderStatus) && (
                      <button onClick={() => openRiderSheet(o)} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
                        {riderByOrder[o.id] ? "Change rider" : "Assign rider"}
                      </button>
                    )}
                    {!pickup && RIDER_STATUSES.includes(o.orderStatus) && !riderByOrder[o.id] && (
                      <button
                        onClick={() => autoAssignNow(o)}
                        disabled={autoAssigning[o.id]}
                        className="mkt-btn mkt-btn--secondary"
                        title="Assign the least-loaded rider automatically"
                        style={{ width: "auto", padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, opacity: autoAssigning[o.id] ? 0.7 : 1 }}
                      >
                        <FaBolt size={11} /> {autoAssigning[o.id] ? "Assigning…" : "Auto-assign"}
                      </button>
                    )}
                    {!pickup && o.orderStatus === "OUT_FOR_DELIVERY" && (
                      <button onClick={() => deliveryFailed(o)} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12, color: "#ef4444" }}>
                        Delivery failed
                      </button>
                    )}
                    {!pickup && (o.orderStatus === "OUT_FOR_DELIVERY" || o.orderStatus === "DELIVERED") && !o.podImageUrl && (
                      <button onClick={() => pickPodPhoto(o)} disabled={podUploading[o.id]} className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 12, opacity: podUploading[o.id] ? 0.7 : 1 }}>
                        {podUploading[o.id] ? "Uploading…" : "Add POD photo"}
                      </button>
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

                {!pickup && o.orderStatus === "OUT_FOR_DELIVERY" && o.deliveryOtp && (
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

                {/* OTP not required for this delivery — close it directly. */}
                {!pickup && o.orderStatus === "OUT_FOR_DELIVERY" && !o.deliveryOtp && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--cm-line)" }}>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 6 }}>
                      No delivery OTP is required for this order. Mark it delivered once handed over.
                    </div>
                    <button
                      onClick={() => markDelivered(o)}
                      disabled={verifying[o.id]}
                      className="mkt-btn mkt-btn--primary"
                      style={{ width: "auto", padding: "8px 14px", fontSize: 12, opacity: verifying[o.id] ? 0.7 : 1 }}
                    >
                      {verifying[o.id] ? "Marking…" : "Mark delivered"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Partial availability — pick the lines that are out of stock */}
      {itemsModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => !itemsModal.submitting && setItemsModal(null)}
        >
          <div
            style={{ background: "var(--cm-card)", width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 16, maxHeight: "75vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>Items out of stock</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
              Order {itemsModal.order.orderNo} — selected items will be removed and the customer auto-refunded for them.
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {itemsModal.items.map((it) => (
                <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--cm-ink)", cursor: "pointer", padding: "6px 0", borderBottom: "1px solid var(--cm-line)" }}>
                  <input
                    type="checkbox"
                    checked={itemsModal.selected.has(it.id)}
                    onChange={(e) => setItemsModal((m) => {
                      const sel = new Set(m.selected);
                      if (e.target.checked) sel.add(it.id); else sel.delete(it.id);
                      return { ...m, selected: sel };
                    })}
                  />
                  <span style={{ flex: 1 }}>{it.itemName} × {it.quantity}</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(it.total || 0).toFixed(0)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => setItemsModal(null)}
                disabled={itemsModal.submitting}
                className="mkt-btn mkt-btn--secondary"
                style={{ flex: 1, padding: "10px", fontSize: 13 }}
              >
                Back
              </button>
              <button
                onClick={submitUnavailable}
                disabled={itemsModal.submitting || itemsModal.selected.size === 0}
                className="mkt-btn mkt-btn--primary"
                style={{ flex: 2, padding: "10px", fontSize: 13, opacity: itemsModal.submitting || itemsModal.selected.size === 0 ? 0.6 : 1 }}
              >
                {itemsModal.submitting ? "Updating…" : `Mark ${itemsModal.selected.size || ""} unavailable`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign rider — bottom sheet with the store's rider list + inline add */}
      {riderSheet && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => !riderSheet.adding && riderSheet.assigningId == null && setRiderSheet(null)}
        >
          <div
            style={{ background: "var(--cm-card)", width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 16, maxHeight: "75vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <FaMotorcycle /> Assign rider
            </div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
              Order {riderSheet.order.orderNo} — the customer is notified with the rider's name and number.
            </div>

            {riderSheet.loading ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: "var(--cm-muted)", fontSize: 13 }}>Loading riders…</div>
            ) : riderSheet.riders.length === 0 ? (
              <div style={{ padding: "14px 0", color: "var(--cm-muted)", fontSize: 13 }}>
                No riders yet — add your first rider below.
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {riderSheet.riders.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--cm-line)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{r.mobile}</div>
                    </div>
                    <button
                      onClick={() => assignRiderTo(r)}
                      disabled={riderSheet.assigningId != null}
                      className="mkt-btn mkt-btn--primary"
                      style={{ width: "auto", padding: "6px 14px", fontSize: 12, opacity: riderSheet.assigningId != null ? 0.7 : 1 }}
                    >
                      {riderSheet.assigningId === r.id ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline add rider */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--cm-line)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 8 }}>Add a rider</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  className="mkt-input"
                  placeholder="Rider name"
                  value={riderSheet.newName}
                  onChange={(e) => setRiderSheet((s) => ({ ...s, newName: e.target.value }))}
                  style={{ flex: "1 1 140px", minWidth: 0 }}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="mkt-input"
                  placeholder="10-digit mobile"
                  value={riderSheet.newMobile}
                  onChange={(e) => setRiderSheet((s) => ({ ...s, newMobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  style={{ flex: "1 1 120px", minWidth: 0 }}
                />
                <button
                  onClick={addRiderInline}
                  disabled={riderSheet.adding}
                  className="mkt-btn mkt-btn--secondary"
                  style={{ width: "auto", padding: "8px 14px", fontSize: 12, opacity: riderSheet.adding ? 0.7 : 1 }}
                >
                  {riderSheet.adding ? "Adding…" : "Add"}
                </button>
              </div>
            </div>

            {riderSheet.error && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444" }}>{riderSheet.error}</div>
            )}

            <button
              onClick={() => setRiderSheet(null)}
              className="mkt-btn mkt-btn--secondary"
              style={{ width: "100%", marginTop: 14, padding: "10px", fontSize: 13 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreOrdersScreen;
