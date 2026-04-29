import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaPencilAlt, FaTrash, FaStore, FaCamera, FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaEdit, FaRegClock, FaChevronRight, FaPowerOff } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATUS_META = {
  PENDING: { cls: "mkt-status--pending", icon: FaClock, label: "Pending Approval", text: "Your store is awaiting admin review. You'll be notified once approved." },
  APPROVED: { cls: "mkt-status--approved", icon: FaCheckCircle, label: "Approved", text: "Your store is live on Marketplace." },
  REJECTED: { cls: "mkt-status--rejected", icon: FaTimesCircle, label: "Rejected", text: "Your submission was not approved. Please update your profile and resubmit." },
  FINAL_REJECTED: { cls: "mkt-status--rejected", icon: FaBan, label: "Permanently Rejected", text: "Your store has been permanently rejected. You cannot edit or resubmit this profile." },
  SUSPENDED: { cls: "mkt-status--suspended", icon: FaBan, label: "Suspended", text: "Your store is temporarily suspended." },
};

const MyStoreManageScreen = () => {
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");

  const load = useCallback(async () => {
    setLoading(true);
    // Items + recent orders fetch in parallel; orders endpoint only succeeds
    // for approved stores so a 404/403 is fine — we just fall back to [].
    const [s, i, o] = await Promise.all([
      marketplaceService.getMyStore(),
      marketplaceService.getMyItems().catch(() => ({ success: false, data: [] })),
      marketplaceService.getMyStoreOrders({ pageSize: 100 }).catch(() => ({ success: false, data: { records: [] } })),
    ]);
    setLoading(false);
    if (s.success && s.data && s.data.id) {
      setStore(s.data);
      if (i.success) setItems(Array.isArray(i.data) ? i.data : []);
      if (o.success) setRecentOrders(o.data?.records || []);
    } else {
      // No store yet — redirect to onboarding
      navigate("/customer/app/marketplace/onboard", { replace: true });
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const handleToggleOpen = async () => {
    const next = !(store.isOpen);
    const res = await marketplaceService.toggleMyStoreOpen(next);
    if (res.success) setStore({ ...store, isOpen: next });
    else setError(res.message || "Failed to update");
  };

  // Truncate API time strings (e.g. "09:00:00") to "09:00" for window math.
  const trimTime = (t) => (t ? String(t).slice(0, 5) : "");
  const isWithinWindow = (cur, openStr, closeStr) => {
    if (!openStr || !closeStr) return true;
    const [oh, om] = openStr.split(":").map(Number);
    const [ch, cm] = closeStr.split(":").map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    return close > open ? cur >= open && cur < close : cur >= open || cur < close;
  };
  const isCurrentlyClosedBySchedule = (() => {
    if (!store?.autoSchedule) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    // Per-day weekly schedule wins when set
    if (store.weeklySchedule) {
      try {
        const arr = JSON.parse(store.weeklySchedule);
        const keys = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        const today = keys[(now.getDay() + 6) % 7];
        const entry = Array.isArray(arr) ? arr.find((e) => String(e.day).toUpperCase() === today) : null;
        if (entry) {
          if (entry.closed) return true;
          return !isWithinWindow(cur, trimTime(entry.openTime), trimTime(entry.closeTime));
        }
      } catch (_) { /* fall through */ }
    }
    if (!store.openTime || !store.closeTime) return false;
    return !isWithinWindow(cur, trimTime(store.openTime), trimTime(store.closeTime));
  })();

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    const res = await marketplaceService.deleteMyItem(id);
    if (res.success) setItems((p) => p.filter((it) => it.id !== id));
    else setError(res.message || "Failed to delete");
  };

  const handleToggleAvailability = async (id, current) => {
    const next = !current;
    const res = await marketplaceService.toggleItemAvailability(id, next);
    if (res.success) setItems((p) => p.map((it) => it.id === id ? { ...it, isAvailable: next } : it));
  };

  if (loading || !store) {
    return (
      <div className="mkt">
        <div className="mkt-header"><button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button><h1 className="mkt-header-title">My Store</h1></div>
        <div className="mkt-empty">Loading…</div>
      </div>
    );
  }

  const statusKey = store.status || "PENDING";
  const meta = STATUS_META[statusKey] || STATUS_META.PENDING;
  const StatusIcon = meta.icon;
  const canManageItems = statusKey === "APPROVED";
  const canEditProfile = statusKey !== "FINAL_REJECTED";

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate("/customer/app/marketplace")}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Store</h1>
        {canEditProfile && (
          <button
            className="mkt-header-action"
            title="Edit profile"
            aria-label="Edit profile"
            onClick={() => navigate("/customer/app/marketplace/onboard", { state: { editMode: true, store } })}
          >
            <FaEdit size={14} />
          </button>
        )}
        {canManageItems && (
          <button
            className="mkt-header-action"
            title="Manage timings & holidays"
            aria-label="Manage timings"
            onClick={() => navigate("/customer/app/marketplace/my-store/timings")}
          >
            <FaRegClock size={14} />
          </button>
        )}
        {canManageItems && (
          <button
            className="mkt-header-action"
            title={store.isOpen ? "Close store" : "Open store"}
            aria-label={store.isOpen ? "Close store" : "Open store"}
            onClick={handleToggleOpen}
            style={{
              background: store.isOpen ? "#ef4444" : "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)",
              color: "#fff",
              borderColor: "transparent",
              boxShadow: store.isOpen ? "0 4px 12px rgba(239,68,68,0.3)" : "0 4px 12px rgba(0,123,255,0.3)",
            }}
          >
            <FaPowerOff size={14} />
          </button>
        )}
      </div>

      {statusKey !== "APPROVED" && (
        <div className={`mkt-status-banner ${meta.cls}`}>
          <StatusIcon size={16} style={{ marginTop: 2 }} />
          <div>
            <div>{meta.label}</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, opacity: 0.85 }}>{meta.text}</div>
            {store.rejectionReason && <div style={{ fontSize: 12, marginTop: 4 }}>Reason: {store.rejectionReason}</div>}
          </div>
        </div>
      )}

      <div style={{ padding: "0 14px 14px" }}>
        {canManageItems && isCurrentlyClosedBySchedule && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#dc2626",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Store is currently closed (off-hours / holiday).
          </div>
        )}

        {canManageItems && (
          <div
            role="tablist"
            aria-label="My Store sections"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              padding: 4,
              marginTop: 12,
              borderRadius: 12,
              background: "var(--cm-bg-secondary)",
              border: "1px solid var(--cm-line)",
            }}
          >
            {[
              { key: "orders", label: "Orders", count: recentOrders.length },
              { key: "items", label: "Items", count: items.length },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "transparent",
                    color: isActive ? "#fff" : "var(--cm-muted)",
                    boxShadow: isActive ? "0 4px 12px rgba(20,184,166,0.25)" : "none",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {tab.label} <span style={{ opacity: 0.85, fontWeight: 600 }}>({tab.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {canManageItems && activeTab === "orders" && (
          <RecentOrdersSection
            orders={recentOrders}
            onSeeAll={() => navigate("/customer/app/marketplace/store-orders")}
          />
        )}
      </div>

      {canManageItems && activeTab === "items" && (
        <>
          {/* === Add Item — its own CTA card === */}
          <div style={{ padding: "4px 14px 0" }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingItem(null); setShowItemForm(true); } }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 14,
                border: "1.5px dashed #007BFF",
                background: "rgba(20, 184, 166, 0.06)",
                color: "var(--cm-ink)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: 12,
                  display: "grid", placeItems: "center",
                  background: "linear-gradient(135deg, #40E0D0, #007BFF)",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <FaPlus size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Add new item</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                  New items go to admin for approval before going live.
                </div>
              </div>
              <FaChevronRight size={12} color="var(--cm-muted)" />
            </div>
          </div>

          {/* === Listed Items section === */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 14px 8px" }}>
            <div className="mkt-form-section-title" style={{ margin: 0 }}>
              Listed items <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>({items.length})</span>
            </div>
          </div>

          {error && <div className="mkt-error-text" style={{ padding: "0 14px" }}>{error}</div>}

          {items.length === 0 ? (
            <div className="mkt-empty">No items listed yet</div>
          ) : (
            <div style={{ padding: "0 14px 24px" }}>
              {items.map((it) => {
                const itemStatus = String(it.status || "PENDING").toUpperCase();
                const statusStyle =
                  itemStatus === "APPROVED" ? { bg: "rgba(16, 185, 129, 0.12)", color: "#059669", label: "APPROVED" } :
                  itemStatus === "REJECTED" ? { bg: "rgba(239, 68, 68, 0.12)", color: "#dc2626", label: "REJECTED" } :
                  { bg: "rgba(245, 158, 11, 0.12)", color: "#d97706", label: "PENDING APPROVAL" };
                return (
                  <div key={it.id} className="mkt-cart-line" style={{ borderRadius: 12, border: "1px solid var(--cm-line)", marginBottom: 8, borderBottom: "1px solid var(--cm-line)" }}>
                    <div className="mkt-cart-line-img">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" /> : <FaStore size={20} />}
                    </div>
                    <div className="mkt-cart-line-info">
                      <p className="mkt-cart-line-name">{it.name}</p>
                      <div className="mkt-cart-line-price">₹{Number(it.sellingPrice).toFixed(0)}{it.unit ? ` / ${it.unit}` : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          letterSpacing: "0.02em",
                        }}>
                          {statusStyle.label}
                        </span>
                        {itemStatus === "APPROVED" && (
                          <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--cm-muted)" }}>
                            <input type="checkbox" checked={!!it.isAvailable} onChange={() => handleToggleAvailability(it.id, it.isAvailable)} />
                            Available
                          </label>
                        )}
                      </div>
                      {itemStatus === "REJECTED" && it.rejectionReason && (
                        <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                          Reason: {it.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => { setEditingItem(it); setShowItemForm(true); }} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer" }}><FaPencilAlt size={12} /></button>
                      <button onClick={() => handleDeleteItem(it.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><FaTrash size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showItemForm && (
        <ItemFormModal
          initial={editingItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
          onSaved={() => { setShowItemForm(false); setEditingItem(null); load(); }}
        />
      )}
    </div>
  );
};

const ItemFormModal = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    description: initial?.description || "",
    sellingPrice: initial?.sellingPrice ?? "",
    mrp: initial?.mrp ?? "",
    unit: initial?.unit || "",
    stockQty: initial?.stockQty ?? 0,
    imageUrl: initial?.imageUrl || "",
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB"); return; }
    setUploading(true);
    const res = await marketplaceService.uploadImage(file, "item");
    setUploading(false);
    if (res.success && res.data?.url) setField("imageUrl", res.data.url);
    else setError(res.message || "Upload failed");
  };

  const submit = async () => {
    if (!form.name.trim()) { setError("Item name required"); return; }
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) { setError("Valid selling price required"); return; }
    setError(null);
    setSaving(true);
    const payload = {
      ...(initial ? { id: initial.id } : {}),
      name: form.name.trim(),
      description: form.description.trim() || null,
      sellingPrice: Number(form.sellingPrice),
      mrp: form.mrp ? Number(form.mrp) : null,
      unit: form.unit || null,
      stockQty: form.stockQty ? Number(form.stockQty) : 0,
      imageUrl: form.imageUrl || null,
      isAvailable: true,
    };
    const res = initial
      ? await marketplaceService.updateMyItem(payload)
      : await marketplaceService.addMyItem(payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.message || "Save failed");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
          <button className="mkt-header-back" onClick={onClose}>×</button>
          <h1 className="mkt-header-title">{initial ? "Edit Item" : "Add Item"}</h1>
        </div>
        <div className="mkt-form">
          <div className="mkt-field">
            <label className="mkt-field-label">Item image</label>
            <div className="mkt-image-upload" onClick={() => fileInput.current?.click()}>
              <div className="mkt-image-upload-preview">
                {form.imageUrl ? <img src={form.imageUrl} alt="" /> : <FaCamera size={18} />}
              </div>
              <div className="mkt-image-upload-text">{uploading ? "Uploading…" : form.imageUrl ? "Tap to change" : "Tap to upload"}</div>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleImagePick} />
            </div>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Name *</label>
            <input className="mkt-input" value={form.name} onChange={(e) => setField("name", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Description</label>
            <textarea className="mkt-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Selling price (₹) *</label>
            <input className="mkt-input" inputMode="decimal" value={form.sellingPrice} onChange={(e) => setField("sellingPrice", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">MRP (₹)</label>
            <input className="mkt-input" inputMode="decimal" value={form.mrp} onChange={(e) => setField("mrp", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Unit (e.g. kg, piece)</label>
            <input className="mkt-input" value={form.unit} onChange={(e) => setField("unit", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Stock quantity</label>
            <input className="mkt-input" inputMode="numeric" value={form.stockQty} onChange={(e) => setField("stockQty", e.target.value.replace(/\D/g, ""))} />
          </div>
          {error && <div className="mkt-error-text">{error}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ORDER_STATUS_TONE = {
  PLACED: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  ACCEPTED: { bg: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" },
  PREPARING: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" },
  OUT_FOR_DELIVERY: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" },
  DELIVERED: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444" },
  CANCELLED: { bg: "rgba(148, 163, 184, 0.18)", color: "#64748b" },
};

const formatOrderTime = (s) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const ORDER_STATUS_FILTERS = [
  { key: "PLACED", label: "Pending" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "PREPARING", label: "Preparing" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ALL", label: "All" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const RecentOrdersSection = ({ orders, onSeeAll }) => {
  const navigate = useNavigate();
  // Default to PLACED (= pending, awaiting seller action) — that's the most
  // actionable bucket on landing. Seller can flip to All / other states.
  const [statusFilter, setStatusFilter] = useState("PLACED");
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.orderStatus !== statusFilter) return false;
      const ts = o.placedAt || o.date || o.createdDate;
      if (!ts) return true;
      const t = new Date(ts).getTime();
      return t >= from && t <= to;
    });
  }, [orders, statusFilter, fromDate, toDate]);

  // Cap displayed rows even if filter has more — keeps the inline preview light.
  const visible = filtered.slice(0, 5);
  const totalForLabel = filtered.length;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>
          Orders {totalForLabel > 0 && <span style={{ fontWeight: 500, color: "var(--cm-muted)" }}>({visible.length} of {totalForLabel})</span>}
        </div>
      </div>

      {/* Status filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: 8,
          scrollbarWidth: "none",
        }}
      >
        {ORDER_STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          // Per-status count helps the seller see what's where at a glance.
          const count = f.key === "ALL"
            ? orders.length
            : orders.filter((o) => o.orderStatus === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${isActive ? "transparent" : "var(--cm-line)"}`,
                background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
                color: isActive ? "#fff" : "var(--cm-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {f.label} <span style={{ opacity: 0.85 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>From</div>
          <input
            type="date"
            className="mkt-input"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>To</div>
          <input
            type="date"
            className="mkt-input"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            padding: "18px 14px",
            borderRadius: 12,
            border: "1px dashed var(--cm-line)",
            background: "var(--cm-card)",
            color: "var(--cm-muted)",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {orders.length === 0
            ? "No orders yet. New orders will appear here."
            : `No ${statusFilter === "ALL" ? "orders" : (ORDER_STATUS_FILTERS.find((f) => f.key === statusFilter)?.label || "matching")} orders in this date range.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((o) => {
            const tone = ORDER_STATUS_TONE[o.orderStatus] || ORDER_STATUS_TONE.ACCEPTED;
            return (
              <div
                key={o.id}
                onClick={() => navigate("/customer/app/marketplace/store-orders")}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--cm-line)",
                  background: "var(--cm-card)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{o.orderNo || `#${o.id}`}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.userId?.name || "Customer"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: tone.bg, color: tone.color, letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {String(o.orderStatus || "").replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--cm-muted)" }}>
                  <span>{formatOrderTime(o.placedAt || o.createdDate)}</span>
                  <span style={{ fontWeight: 700, color: "var(--cm-ink)" }}>
                    ₹{Number(o.totalAmount || 0).toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visible.length > 0 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="mkt-btn mkt-btn--secondary"
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          View more orders <FaChevronRight size={11} />
        </button>
      )}
    </div>
  );
};

export default MyStoreManageScreen;
