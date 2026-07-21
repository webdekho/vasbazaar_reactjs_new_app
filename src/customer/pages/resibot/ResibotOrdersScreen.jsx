import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaBoxOpen } from "react-icons/fa";
import {
  resibotService, RESIBOT_ORDER_VENDORS, RESIBOT_ORDER_STATUSES, RESIBOT_ORDER_TRACKING,
} from "../../services/resibotService";
import {
  RB, ResibotHeader, Spinner, Card, Field, TextInput, Select, PrimaryButton, EmptyState, dueLabel,
} from "./resibotUi";
import { formatDisplayDate } from "../../../utils/dateFormat";

const STATUS_COLOR = {
  ORDERED: "#6B7280", PACKED: "#7C3AED", SHIPPED: "#2563EB",
  OUT_FOR_DELIVERY: "#B45309", DELIVERED: "#16A34A", INSTALLED: "#16A34A",
};

const empty = { id: null, orderName: "", vendor: "", orderValue: "", orderRef: "", orderDate: "", expectedDeliveryDate: "", status: "ORDERED", trackingStatus: "", notes: "" };

const ResibotOrdersScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await resibotService.listOrders(tab);
    setOrders(res?.success && Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setForm(empty); setShowForm(true); };

  const save = async () => {
    if (!form.orderName.trim()) return;
    setSaving(true);
    const payload = {
      orderName: form.orderName.trim(),
      vendor: form.vendor || null,
      orderValue: form.orderValue === "" ? null : Number(form.orderValue),
      orderRef: form.orderRef || null,
      orderDate: form.orderDate || null,
      expectedDeliveryDate: form.expectedDeliveryDate || null,
      status: form.status,
      trackingStatus: form.trackingStatus || null,
      notes: form.notes || null,
    };
    if (form.id) { payload.id = form.id; await resibotService.updateOrder(payload); }
    else { await resibotService.createOrder(payload); }
    setShowForm(false); setForm(empty); setSaving(false);
    await load();
  };

  const changeStatus = async (o, status) => { await resibotService.updateOrderStatus(o.id, status, o.trackingStatus || ""); await load(); };
  const changeTracking = async (o, trackingStatus) => { await resibotService.updateOrderStatus(o.id, o.status, trackingStatus); await load(); };
  const remove = async (id) => { if (!window.confirm("Delete this order?")) return; await resibotService.deleteOrder(id); await load(); };

  if (loading) return <Spinner />;

  const tabBtn = (key, label) => (
    <button type="button" onClick={() => setTab(key)}
      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
        background: tab === key ? RB.brand : "transparent", color: tab === key ? "#fff" : RB.muted }}>
      {label}
    </button>
  );

  return (
    <div className="rb-page">
      <ResibotHeader
        title="Orders & Delivery" subtitle="Track your orders in one place"
        onBack={() => navigate("/customer/app/resibot")}
        right={<button type="button" onClick={openNew} style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: RB.brand, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><FaPlus size={14} /></button>}
      />

      <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, border: `1px solid ${RB.border}`, marginBottom: 16 }}>
        {tabBtn("active", "Active")}
        {tabBtn("completed", "Completed")}
        {tabBtn("all", "All")}
      </div>

      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Order name"><TextInput value={form.orderName} onChange={set("orderName")} placeholder="e.g. Running shoes" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Vendor">
              <Select value={form.vendor} onChange={set("vendor")}>
                <option value="">Select</option>
                {RESIBOT_ORDER_VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Order value (₹)"><TextInput type="number" value={form.orderValue} onChange={set("orderValue")} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Order date"><TextInput type="date" value={form.orderDate} onChange={set("orderDate")} /></Field>
            <Field label="Expected delivery"><TextInput type="date" value={form.expectedDeliveryDate} onChange={set("expectedDeliveryDate")} /></Field>
          </div>
          <Field label="Order reference (optional)"><TextInput value={form.orderRef} onChange={set("orderRef")} placeholder="Tracking / order id" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {RESIBOT_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving…" : form.id ? "Update" : "Add order"}</PrimaryButton>
            <button type="button" onClick={() => { setShowForm(false); setForm(empty); }}
              style={{ padding: "13px 18px", borderRadius: 12, border: `1px solid ${RB.border}`, background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </Card>
      )}

      {orders.length === 0 ? (
        <EmptyState>No {tab !== "all" ? tab : ""} orders. Tap + to track one.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {orders.map((o) => (
            <Card key={o.id}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: RB.brandSoft, color: RB.brand, display: "grid", placeItems: "center", flexShrink: 0 }}><FaBoxOpen size={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{o.orderName}</div>
                  <div style={{ fontSize: 12.5, color: RB.muted, marginTop: 2 }}>
                    {[o.vendor, o.orderValue ? `₹${o.orderValue}` : null].filter(Boolean).join(" · ")}
                  </div>
                  {o.expectedDeliveryDate && (
                    <div style={{ fontSize: 12, color: RB.muted, marginTop: 2 }}>{formatDisplayDate(o.expectedDeliveryDate, "—")} · {dueLabel(o.expectedDeliveryDate)}</div>
                  )}
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: "#F1F5F9", color: STATUS_COLOR[o.status] || "#6B7280", fontSize: 11, fontWeight: 700 }}>
                  {(o.status || "ORDERED").replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <Select value={o.status || "ORDERED"} onChange={(e) => changeStatus(o, e.target.value)} style={{ padding: "8px 10px", fontSize: 12.5 }}>
                  {RESIBOT_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </Select>
                <Select value={o.trackingStatus || ""} onChange={(e) => changeTracking(o, e.target.value)} style={{ padding: "8px 10px", fontSize: 12.5 }}>
                  <option value="">No return</option>
                  {RESIBOT_ORDER_TRACKING.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </Select>
                <button type="button" onClick={() => remove(o.id)} aria-label="Delete"
                  style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #DC2626", background: "transparent", color: "#DC2626", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <FaTrash size={12} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResibotOrdersScreen;
