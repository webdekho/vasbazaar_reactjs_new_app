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
  FaStar,
  FaTag,
  FaQrcode,
  FaHandHolding,
  FaMotorcycle,
  FaCamera,
} from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { marketplaceLogisticsAiService } from "../../services/marketplaceLogisticsAiService";
import "./marketplace.css";

const DELIVERY_STATUS_FLOW = ["PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
const PICKUP_STATUS_FLOW = ["PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];
const STATUS_LABEL = {
  PLACED: "Order placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  READY_FOR_PICKUP: "Ready for pickup",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};
const STATUS_ICON = {
  PLACED: FaClock,
  ACCEPTED: FaCheckCircle,
  PREPARING: FaBoxOpen,
  OUT_FOR_DELIVERY: FaTruck,
  DELIVERED: FaCheckCircle,
  READY_FOR_PICKUP: FaStore,
  PICKED_UP: FaHandHolding,
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

// ONDC-aligned customer cancellation reasons (code → shopper-friendly label).
const CANCEL_REASONS = [
  { code: "012", label: "I don't need it anymore" },
  { code: "010", label: "I need to change the address / order details" },
  { code: "006", label: "It's taking too long" },
  { code: "000", label: "Other reason" },
];

// Where the customer's money went after a cancel/reject (refund_status → line).
const refundStatusLine = (order) => {
  const amt = `₹${Number(order?.totalAmount || 0).toFixed(2)}`;
  switch (order?.refundStatus) {
    case "WALLET_REFUNDED":
      return `${amt} refunded to your VasBazaar wallet.`;
    case "SOURCE_INITIATED":
    case "SOURCE_REFUNDED":
      return `${amt} refund to your original payment method initiated (reflects in 3–7 days).`;
    case "FAILED":
      return `Your refund of ${amt} is being processed and will reach you shortly.`;
    default:
      return null; // NOT_REQUIRED / not cancelled
  }
};

// Interactive / read-only 1-5 star selector. Pass readOnly to disable input.
const StarRating = ({ value = 0, onChange, size = 26, readOnly = false }) => (
  <div style={{ display: "inline-flex", gap: 6 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <FaStar
        key={n}
        size={size}
        onClick={readOnly ? undefined : () => onChange?.(n)}
        style={{
          cursor: readOnly ? "default" : "pointer",
          color: n <= value ? "#fbbf24" : "var(--cm-line)",
          transition: "color .15s",
        }}
        aria-label={`${n} star`}
      />
    ))}
  </div>
);

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

  // Ratings & reviews
  const [reviewState, setReviewState] = useState(null); // { canReview, alreadyReviewed, review }
  const [rating, setRating] = useState(0);
  const [productRating, setProductRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [packagingRating, setPackagingRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewThanks, setReviewThanks] = useState(false);

  // Dispute / report-an-issue
  const [showDispute, setShowDispute] = useState(false);
  const [disputeType, setDisputeType] = useState("COMPLAINT");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState("");
  const [disputeDone, setDisputeDone] = useState(false);

  // Self-serve cancellation (allowed while PLACED / ACCEPTED / PREPARING)
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState("012");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");

  // Logistics v1 — rider assignment + POD photo + failed-delivery notice
  // (side-table data fetched separately so the order endpoint stays untouched).
  const [logistics, setLogistics] = useState(null);

  // Partial (per-item) cancel — refund executes server-side before the line closes.
  const [removingLineId, setRemovingLineId] = useState(null);
  const removeItem = useCallback(async (line) => {
    if (!window.confirm(`Remove ${line.itemName || "this item"} from the order?${
      Number(line.total) > 0 ? " Any paid amount for it will be refunded." : ""}`)) return;
    setRemovingLineId(line.id);
    const res = await marketplaceService.cancelOrderItem(orderId, line.id);
    setRemovingLineId(null);
    if (res.success) {
      if (res.data?.message) window.alert(res.data.message);
      load();
    } else {
      window.alert(res.message || "Could not remove the item. Please try again.");
    }
  }, [orderId]);

  // GST invoice — fetch data and print via a dedicated window.
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const printInvoice = useCallback(async () => {
    setInvoiceLoading(true);
    const res = await marketplaceService.getOrderInvoice(orderId);
    setInvoiceLoading(false);
    if (!res.success || !res.data) { window.alert(res.message || "Could not load the invoice"); return; }
    const inv = res.data;
    const rows = (inv.lines || []).map((l) =>
      `<tr><td>${l.name || ""}</td><td>${l.hsn || "—"}</td><td style="text-align:center">${l.quantity}</td>` +
      `<td style="text-align:right">₹${Number(l.taxableValue || 0).toFixed(2)}</td>` +
      `<td style="text-align:center">${Number(l.taxRate || 0)}%</td>` +
      `<td style="text-align:right">₹${Number(l.cgst || 0).toFixed(2)}</td>` +
      `<td style="text-align:right">₹${Number(l.sgst || 0).toFixed(2)}</td>` +
      `<td style="text-align:right">₹${Number(l.lineTotal || 0).toFixed(2)}</td></tr>`).join("");
    const html = `<html><head><title>${inv.invoiceNo}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
      h2{margin:0 0 2px} .muted{color:#555} table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:6px 8px;font-size:11px} th{background:#f3f4f6;text-align:left}
      .tot{margin-top:12px;width:280px;margin-left:auto} .tot div{display:flex;justify-content:space-between;padding:2px 0}
      .grand{font-weight:bold;border-top:1px solid #111;margin-top:4px;padding-top:4px}
    </style></head><body>
      <h2>TAX INVOICE</h2>
      <div class="muted">${inv.invoiceNo} · ${inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-IN") : ""}</div>
      <div style="margin-top:10px"><b>${inv.storeName || ""}</b><br/>${inv.storeAddress || ""}<br/>
      ${inv.storeGstNumber ? "GSTIN: " + inv.storeGstNumber : "GSTIN: Unregistered"}</div>
      <div style="margin-top:8px"><b>Billed to:</b> ${inv.customerName || ""} · ${inv.customerMobile || ""}<br/>
      ${inv.deliveryAddress || ""}</div>
      <table><thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Taxable</th><th>GST%</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="tot">
        <div><span>Taxable value</span><span>₹${Number(inv.taxableTotal || 0).toFixed(2)}</span></div>
        <div><span>Total GST</span><span>₹${Number(inv.taxTotal || 0).toFixed(2)}</span></div>
        <div><span>Delivery</span><span>₹${Number(inv.deliveryCharges || 0).toFixed(2)}</span></div>
        <div><span>Platform charge</span><span>₹${Number(inv.platformCharge || 0).toFixed(2)}</span></div>
        <div><span>Discount</span><span>− ₹${Number(inv.discount || 0).toFixed(2)}</span></div>
        <div class="grand"><span>Grand total</span><span>₹${Number(inv.totalAmount || 0).toFixed(2)}</span></div>
      </div>
      <p class="muted" style="margin-top:16px">System-generated invoice · Powered by VasBazaar</p>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }, [orderId]);

  const submitCancel = useCallback(async () => {
    setCancelError("");
    setCancelSubmitting(true);
    const reasonLabel = CANCEL_REASONS.find((r) => r.code === cancelReasonCode)?.label || "";
    const reason = cancelNote.trim() ? `${reasonLabel} — ${cancelNote.trim()}` : reasonLabel;
    const res = await marketplaceService.cancelMyOrder(orderId, cancelReasonCode, reason);
    setCancelSubmitting(false);
    if (res.success) {
      setCancelMessage(res.data?.message || "Your order has been cancelled.");
      setShowCancel(false);
      setOrder((prev) => (prev ? { ...prev, ...res.data, orderStatus: "CANCELLED", cancellationReason: reason, cancelledBy: "CUSTOMER" } : prev));
    } else {
      setCancelError(res.message || "Could not cancel the order. Please try again.");
    }
  }, [orderId, cancelReasonCode, cancelNote]);

  const submitDispute = useCallback(async () => {
    if (!disputeReason.trim()) { setDisputeError("Please describe the issue"); return; }
    setDisputeError("");
    setDisputeSubmitting(true);
    const res = await marketplaceService.raiseDispute({
      orderId: Number(orderId),
      type: disputeType,
      reason: disputeReason.trim(),
    });
    setDisputeSubmitting(false);
    if (res.success) { setDisputeDone(true); setShowDispute(false); }
    else setDisputeError(res.message || "Could not submit. Please try again.");
  }, [disputeReason, disputeType, orderId]);

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
      // Delivery logistics (rider / POD / failed attempts) — non-fatal extras.
      if (res.data?.fulfillmentType !== "PICKUP") {
        try {
          const log = await marketplaceLogisticsAiService.getOrderLogistics(orderId);
          if (log?.success) setLogistics(log.data);
        } catch {
          // non-fatal — logistics extras just stay hidden
        }
      }
      // Once the order is completed, load review eligibility / existing review.
      const st = res.data?.orderStatus;
      if (st === "DELIVERED" || st === "PICKED_UP") {
        try {
          const rev = await marketplaceService.getOrderReviewState(orderId);
          if (rev?.success) setReviewState(rev.data);
        } catch {
          // non-fatal — review section just stays hidden
        }
      }
    }
  }, [orderId]);

  const submitReview = useCallback(async () => {
    if (!rating) {
      setReviewError("Please select an overall rating.");
      return;
    }
    setSubmitting(true);
    setReviewError("");
    try {
      const res = await marketplaceService.createReview({
        orderId,
        rating,
        productRating: productRating || undefined,
        deliveryRating: deliveryRating || undefined,
        packagingRating: packagingRating || undefined,
        comment: comment.trim() || undefined,
      });
      if (res?.success) {
        setReviewThanks(true);
        setReviewState((prev) => ({
          ...(prev || {}),
          canReview: false,
          alreadyReviewed: true,
          review: { rating, productRating, deliveryRating, packagingRating, comment: comment.trim() },
        }));
      } else {
        setReviewError(res?.message || "Could not submit review. Please try again.");
      }
    } catch {
      setReviewError("Could not submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [orderId, rating, productRating, deliveryRating, packagingRating, comment]);

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

  const isPickup = order.fulfillmentType === "PICKUP";
  const STATUS_FLOW = isPickup ? PICKUP_STATUS_FLOW : DELIVERY_STATUS_FLOW;
  const statusIdx = STATUS_FLOW.indexOf(order.orderStatus);
  const isCancelled = order.orderStatus === "CANCELLED";
  const isRejected = order.orderStatus === "REJECTED";
  const paymentPaid = order.paymentStatus === "PAID";
  const canRemoveItems = ["PLACED", "ACCEPTED", "PREPARING"].includes(order.orderStatus);
  const activeItemCount = items.filter(
    (it) => !it.lineStatus || it.lineStatus === "ACTIVE"
  ).length;
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

        {/* Click & Collect pickup code */}
        {isPickup && order.pickupCode &&
          ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP"].includes(order.orderStatus) && (
          <div
            className="mkt-receipt-card no-print"
            style={{
              marginTop: 12,
              textAlign: "center",
              background: "linear-gradient(135deg, rgba(20,184,166,0.16), rgba(16,185,129,0.10))",
              border: "1px solid rgba(20,184,166,0.4)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                fontSize: 14,
                color: "#14b8a6",
              }}
            >
              <FaQrcode size={14} /> Show this code at the store
            </div>
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: 6,
                color: "var(--cm-ink)",
                margin: "10px 0 4px",
              }}
            >
              {order.pickupCode}
            </div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(order.pickupCode)}`}
              alt="Pickup QR code"
              width={160}
              height={160}
              style={{ borderRadius: 10, background: "#fff", padding: 8, marginTop: 6 }}
            />
            {order.orderStatus === "READY_FOR_PICKUP" && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#14b8a6", fontWeight: 700 }}>
                Your order is ready for pickup!
              </div>
            )}
          </div>
        )}

        {/* Home delivery OTP — read out to the delivery agent at the door */}
        {!isPickup && order.deliveryOtp &&
          ["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"].includes(order.orderStatus) && (
          <div
            className="mkt-receipt-card no-print"
            style={{
              marginTop: 12,
              textAlign: "center",
              background: "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(99,102,241,0.10))",
              border: "1px solid rgba(59,130,246,0.4)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                fontSize: 14,
                color: "#3b82f6",
              }}
            >
              <FaTruck size={14} /> Delivery OTP
            </div>
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: 6,
                color: "var(--cm-ink)",
                margin: "10px 0 4px",
              }}
            >
              {order.deliveryOtp}
            </div>
            <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 700 }}>
              Share this OTP with the delivery agent only on receiving your order.
            </div>
          </div>
        )}

        {/* Delivery attempt failed — the store will retry (Logistics v1) */}
        {!isPickup && logistics?.deliveryFailedReason && order.orderStatus === "ACCEPTED" && (
          <div
            className="mkt-status-banner mkt-status--pending no-print"
            style={{ marginTop: 12 }}
          >
            <FaTruck size={16} style={{ marginTop: 2 }} />
            <div>
              Delivery attempt failed: {logistics.deliveryFailedReason} — the store will retry your delivery.
            </div>
          </div>
        )}

        {/* Assigned delivery rider (Logistics v1) */}
        {!isPickup && logistics?.rider && !isCancelled && !isRejected && (
          <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
            <div className="mkt-receipt-section-title">Your delivery rider</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                }}
              >
                <FaMotorcycle size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{logistics.rider.name}</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{logistics.rider.mobile}</div>
              </div>
              <a
                href={`tel:${logistics.rider.mobile}`}
                aria-label={`Call ${logistics.rider.name}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10, textDecoration: "none",
                  background: "linear-gradient(135deg, #14b8a6, #10b981)", color: "#fff",
                  fontWeight: 700, fontSize: 12,
                }}
              >
                <FaPhoneAlt size={11} /> Call
              </a>
            </div>
          </div>
        )}

        {/* Proof-of-delivery photo (Logistics v1) */}
        {!isPickup && logistics?.podImageUrl && (
          <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
            <div className="mkt-receipt-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FaCamera size={11} /> Proof of delivery
            </div>
            <a href={logistics.podImageUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
              <img
                src={logistics.podImageUrl}
                alt="Proof of delivery"
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--cm-line)" }}
              />
            </a>
          </div>
        )}

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
                items.map((it, idx) => {
                  const removed = it.lineStatus === "CANCELLED" || it.lineStatus === "UNAVAILABLE";
                  return (
                    <tr key={it.id || it.itemId?.id || idx} style={removed ? { opacity: 0.55 } : undefined}>
                      <td>
                        <span style={removed ? { textDecoration: "line-through" } : undefined}>{itemName(it)}</span>
                        {removed && (
                          <div style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>
                            {it.lineStatus === "UNAVAILABLE" ? "Unavailable at store" : "Removed"}
                            {Number(it.lineRefundAmount) > 0 ? ` — ${inr(it.lineRefundAmount)} refunded` : ""}
                          </div>
                        )}
                        {!removed && canRemoveItems && activeItemCount > 1 && (
                          <button
                            className="no-print"
                            onClick={() => removeItem(it)}
                            disabled={removingLineId === it.id}
                            style={{ display: "block", marginTop: 2, padding: 0, border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            {removingLineId === it.id ? "Removing…" : "Remove item"}
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>{itemQty(it)}</td>
                      <td style={{ textAlign: "right" }}>{inr(itemPrice(it))}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{inr(itemTotal(it))}</td>
                    </tr>
                  );
                })
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
            <div className="mkt-receipt-row" style={{ color: "#34d399", fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FaTag size={11} />
                Coupon{order.offerCode ? ` (${order.offerCode})` : ""}
              </span>
              <span>− {inr(discount)}</span>
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

        {/* GST invoice (available once the order is placed and money story is fixed) */}
        <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
          <button
            onClick={printInvoice}
            disabled={invoiceLoading}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "transparent", color: "var(--cm-ink)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <FaPrint size={12} />
            {invoiceLoading ? "Preparing invoice…" : "Download GST invoice"}
          </button>
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
                {isRejected
                  ? "Order rejected"
                  : order.cancelledBy === "CUSTOMER"
                  ? "Order cancelled by you"
                  : order.cancelledBy === "SYSTEM"
                  ? "Order cancelled — the store didn't respond in time"
                  : order.cancelledBy === "ADMIN"
                  ? "Order cancelled by VasBazaar"
                  : "Order cancelled by the store"}
                {(isRejected ? order.rejectionReason : order.cancellationReason)
                  ? ` — ${isRejected ? order.rejectionReason : order.cancellationReason}`
                  : ""}
                {refundStatusLine(order) && (
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{refundStatusLine(order)}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Self-serve cancellation — free until the store packs / dispatches the order */}
        {cancelMessage && (
          <div className="mkt-receipt-card no-print" style={{ marginTop: 12, textAlign: "center" }}>
            <FaCheckCircle size={24} style={{ color: "#34d399" }} />
            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>Order cancelled</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>{cancelMessage}</div>
          </div>
        )}
        {!cancelMessage && ["PLACED", "ACCEPTED", "PREPARING"].includes(order.orderStatus) && (
          <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
            {!showCancel ? (
              <button
                onClick={() => setShowCancel(true)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.5)", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Cancel this order
              </button>
            ) : (
              <>
                <div className="mkt-receipt-section-title">Cancel order</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {CANCEL_REASONS.map((r) => (
                    <label key={r.code} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--cm-ink)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="cancelReason"
                        checked={cancelReasonCode === r.code}
                        onChange={() => setCancelReasonCode(r.code)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="Anything else you'd like to tell the store? (optional)"
                  rows={2}
                  style={{ marginTop: 10, width: "100%", resize: "vertical", padding: 10, borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card, rgba(255,255,255,0.04))", color: "var(--cm-ink)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--cm-muted)" }}>
                  {order.paymentStatus === "PAID"
                    ? (order.paymentTxnId || "").startsWith("WALLET:")
                      ? `${inr(total)} will be refunded to your VasBazaar wallet instantly.`
                      : `${inr(total)} will be refunded to your original payment method (3–7 days).`
                    : "No payment was collected for this order — there is nothing to refund."}
                </div>
                {cancelError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{cancelError}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowCancel(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "transparent", color: "var(--cm-ink)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Keep order
                  </button>
                  <button onClick={submitCancel} disabled={cancelSubmitting} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: cancelSubmitting ? "var(--cm-line)" : "linear-gradient(135deg, #f43f5e, #ef4444)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: cancelSubmitting ? "default" : "pointer" }}>
                    {cancelSubmitting ? "Cancelling…" : "Confirm cancel"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Ratings & Reviews */}
        {reviewState && (reviewThanks || reviewState.alreadyReviewed || reviewState.canReview) && (
          <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
            {reviewThanks ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <FaCheckCircle size={28} style={{ color: "#34d399" }} />
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 8 }}>
                  Thanks for your feedback!
                </div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
                  Your review helps other shoppers.
                </div>
              </div>
            ) : reviewState.alreadyReviewed && reviewState.review ? (
              <>
                <div className="mkt-receipt-section-title">Your review</div>
                <div style={{ marginTop: 8 }}>
                  <StarRating value={Number(reviewState.review.rating || 0)} size={22} readOnly />
                </div>
                {reviewState.review.comment && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: "var(--cm-ink)",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    “{reviewState.review.comment}”
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mkt-receipt-section-title">Rate your order</div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Overall rating <span style={{ color: "#f87171" }}>*</span>
                  </div>
                  <StarRating value={rating} onChange={setRating} size={30} />
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--cm-muted)" }}>Product quality</span>
                    <StarRating value={productRating} onChange={setProductRating} size={20} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--cm-muted)" }}>
                      {isPickup ? "Pickup experience" : "Delivery"}
                    </span>
                    <StarRating value={deliveryRating} onChange={setDeliveryRating} size={20} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--cm-muted)" }}>Packaging</span>
                    <StarRating value={packagingRating} onChange={setPackagingRating} size={20} />
                  </div>
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share a few words about your experience (optional)"
                  rows={3}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    resize: "vertical",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid var(--cm-line)",
                    background: "var(--cm-card, rgba(255,255,255,0.04))",
                    color: "var(--cm-ink)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />

                {reviewError && (
                  <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{reviewError}</div>
                )}

                <button
                  onClick={submitReview}
                  disabled={submitting}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: submitting
                      ? "var(--cm-line)"
                      : "linear-gradient(135deg, #14b8a6, #10b981)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: submitting ? "default" : "pointer",
                  }}
                >
                  {submitting ? "Submitting…" : "Submit review"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Report an issue (returns / refunds / complaints) on completed orders */}
        {(order.orderStatus === "DELIVERED" || order.orderStatus === "PICKED_UP") && (
          <div className="mkt-receipt-card no-print" style={{ marginTop: 12 }}>
            {disputeDone ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <FaCheckCircle size={24} style={{ color: "#34d399" }} />
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>Issue reported</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
                  Our team will review and get back to you.
                </div>
              </div>
            ) : !showDispute ? (
              <button
                onClick={() => setShowDispute(true)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "transparent", color: "var(--cm-ink)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Report an issue with this order
              </button>
            ) : (
              <>
                <div className="mkt-receipt-section-title">Report an issue</div>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card, rgba(255,255,255,0.04))", color: "var(--cm-ink)", fontSize: 13 }}
                >
                  <option value="COMPLAINT">Complaint</option>
                  <option value="RETURN">Return request</option>
                  <option value="REFUND">Refund request</option>
                </select>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe what went wrong…"
                  rows={3}
                  style={{ marginTop: 10, width: "100%", resize: "vertical", padding: 10, borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card, rgba(255,255,255,0.04))", color: "var(--cm-ink)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                />
                {disputeError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{disputeError}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowDispute(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "transparent", color: "var(--cm-ink)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  <button onClick={submitDispute} disabled={disputeSubmitting} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: disputeSubmitting ? "var(--cm-line)" : "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: disputeSubmitting ? "default" : "pointer" }}>
                    {disputeSubmitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
