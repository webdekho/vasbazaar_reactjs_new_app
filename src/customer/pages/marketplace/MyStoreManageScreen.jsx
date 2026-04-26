import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaPencilAlt, FaTrash, FaStore, FaCamera, FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaEdit } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const STATUS_META = {
  PENDING: { cls: "mkt-status--pending", icon: FaClock, label: "Pending Approval", text: "Your store is awaiting admin review. You'll be notified once approved." },
  APPROVED: { cls: "mkt-status--approved", icon: FaCheckCircle, label: "Approved", text: "Your store is live on Marketplace." },
  REJECTED: { cls: "mkt-status--rejected", icon: FaTimesCircle, label: "Rejected", text: "Your submission was not approved." },
  SUSPENDED: { cls: "mkt-status--suspended", icon: FaBan, label: "Suspended", text: "Your store is temporarily suspended." },
};

const MyStoreManageScreen = () => {
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, i] = await Promise.all([
      marketplaceService.getMyStore(),
      marketplaceService.getMyItems().catch(() => ({ success: false, data: [] })),
    ]);
    setLoading(false);
    if (s.success && s.data && s.data.id) {
      setStore(s.data);
      if (i.success) setItems(Array.isArray(i.data) ? i.data : []);
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

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate("/customer/app/marketplace")}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Store</h1>
      </div>

      <div className={`mkt-status-banner ${meta.cls}`}>
        <StatusIcon size={16} style={{ marginTop: 2 }} />
        <div>
          <div>{meta.label}</div>
          <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, opacity: 0.85 }}>{meta.text}</div>
          {store.rejectionReason && <div style={{ fontSize: 12, marginTop: 4 }}>Reason: {store.rejectionReason}</div>}
        </div>
      </div>

      <div style={{ padding: "0 14px 14px" }}>
        <div className="mkt-store-card" style={{ cursor: "default" }}>
          <div className="mkt-store-logo">
            {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <FaStore size={24} />}
          </div>
          <div className="mkt-store-info">
            <h3 className="mkt-store-name">{store.businessName}</h3>
            <div className="mkt-store-meta">
              {store.deliveryTimeMinutes && <span><FaClock size={11} />{store.deliveryTimeMinutes} min</span>}
              <span>{store.servingRadiusKm} km radius</span>
              <span>{Number(store.deliveryCharges) > 0 ? `₹${Number(store.deliveryCharges).toFixed(0)} delivery` : "Free delivery"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            className="mkt-btn mkt-btn--secondary"
            onClick={() => navigate("/customer/app/marketplace/onboard", { state: { editMode: true, store } })}
          >
            <FaEdit size={12} style={{ marginRight: 6 }} /> Edit profile
          </button>
          {canManageItems && (
            <button
              className="mkt-btn mkt-btn--primary"
              onClick={handleToggleOpen}
              style={{ background: store.isOpen ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #14b8a6, #10b981)" }}
            >
              {store.isOpen ? "Close Store" : "Open Store"}
            </button>
          )}
        </div>

        {canManageItems && (
          <button
            className="mkt-btn mkt-btn--secondary"
            onClick={() => navigate("/customer/app/marketplace/store-orders")}
            style={{ marginTop: 8 }}
          >
            View store orders
          </button>
        )}
      </div>

      {canManageItems && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px" }}>
            <div className="mkt-form-section-title" style={{ margin: 0 }}>Items ({items.length})</div>
            <button
              className="mkt-add-btn"
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              style={{ height: 32, padding: "4px 12px" }}
            >
              <FaPlus size={10} style={{ marginRight: 4 }} /> Add Item
            </button>
          </div>

          {error && <div className="mkt-error-text" style={{ padding: "0 14px" }}>{error}</div>}

          {items.length === 0 ? (
            <div className="mkt-empty">No items added yet</div>
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
                      <button onClick={() => { setEditingItem(it); setShowItemForm(true); }} style={{ background: "none", border: "none", color: "#14b8a6", cursor: "pointer" }}><FaPencilAlt size={12} /></button>
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

export default MyStoreManageScreen;
