import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaPencilAlt, FaTrash, FaToggleOn, FaToggleOff, FaChevronRight, FaTag, FaBolt } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const OFFER_TYPES = [
  { key: "FLAT", label: "Flat ₹" },
  { key: "PERCENT", label: "Percent %" },
  { key: "BOGO", label: "BOGO" },
];

const formatRange = (startAt, endAt) => {
  const fmt = (s) => {
    if (!s) return null;
    try { return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return null; }
  };
  const f = fmt(startAt);
  const t = fmt(endAt);
  if (!f && !t) return null;
  return `${f || "—"} → ${t || "—"}`;
};

const StoreOffersScreen = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyOffers();
    setLoading(false);
    if (res.success) setOffers(Array.isArray(res.data) ? res.data : []);
    else { setError(res.message || "Failed to load offers"); navigate("/customer/app/marketplace/my-store", { replace: true }); }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  const handleToggle = async (o) => {
    const next = !o.isActive;
    const res = await marketplaceService.toggleOffer(o.id, next);
    if (res.success) { setOffers((p) => p.map((x) => x.id === o.id ? { ...x, isActive: next } : x)); flash("success", next ? "Offer activated" : "Offer paused"); }
    else flash("error", res.message || "Failed to update");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this offer?")) return;
    const res = await marketplaceService.deleteOffer(id);
    if (res.success) { setOffers((p) => p.filter((x) => x.id !== id)); flash("success", "Offer deleted"); }
    else flash("error", res.message || "Failed to delete");
  };

  const valueLabel = (o) => {
    if (o.type === "FLAT") return `₹${Number(o.value || 0).toFixed(0)} OFF`;
    if (o.type === "PERCENT") return `${Number(o.value || 0)}% OFF${o.maxDiscount ? ` (max ₹${Number(o.maxDiscount).toFixed(0)})` : ""}`;
    if (o.type === "BOGO") return "Buy 1 Get 1";
    return o.type;
  };

  if (loading) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Offers & Promotions</h1>
        </div>
        <div className="mkt-empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Offers & Promotions</h1>
      </div>

      <div style={{ padding: "4px 14px 0" }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setEditing(null); setShowForm(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(null); setShowForm(true); } }}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: 14,
            borderRadius: 14, border: "1.5px dashed #007BFF",
            background: "rgba(20, 184, 166, 0.06)", color: "var(--cm-ink)", cursor: "pointer",
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", flexShrink: 0 }}>
            <FaPlus size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Create offer</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Flat, percent or BOGO promo codes for your store</div>
          </div>
          <FaChevronRight size={12} color="var(--cm-muted)" />
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px 0", fontSize: 12, fontWeight: 600, color: msg.type === "success" ? "#059669" : "#dc2626" }}>
          {msg.text}
        </div>
      )}
      {error && <div className="mkt-error-text" style={{ padding: "8px 14px 0" }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 14px 8px" }}>
        <div className="mkt-form-section-title" style={{ margin: 0 }}>
          Your offers <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>({offers.length})</span>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="mkt-empty">No offers yet. Create one to attract customers.</div>
      ) : (
        <div style={{ padding: "0 14px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {offers.map((o) => {
            const range = formatRange(o.startAt, o.endAt);
            return (
              <div key={o.id} style={{ borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-ink)", letterSpacing: "0.04em" }}>{o.code}</span>
                      {o.isFlash && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(245,158,11,0.14)", color: "#d97706", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <FaBolt size={8} /> FLASH
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: o.isActive ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.18)", color: o.isActive ? "#059669" : "#64748b" }}>
                        {o.isActive ? "ACTIVE" : "PAUSED"}
                      </span>
                    </div>
                    {o.title && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-ink)", marginTop: 4 }}>{o.title}</div>}
                    <div style={{ fontSize: 12, color: "#007BFF", fontWeight: 700, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <FaTag size={10} /> {valueLabel(o)}
                    </div>
                    {o.description && <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>{o.description}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                    <button onClick={() => handleToggle(o)} style={{ background: "none", border: "none", cursor: "pointer", color: o.isActive ? "#14b8a6" : "var(--cm-muted)", padding: 2 }} title={o.isActive ? "Pause" : "Activate"}>
                      {o.isActive ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
                    </button>
                    <button onClick={() => { setEditing(o); setShowForm(true); }} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer", padding: 2 }}><FaPencilAlt size={12} /></button>
                    <button onClick={() => handleDelete(o.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2 }}><FaTrash size={12} /></button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 11, color: "var(--cm-muted)" }}>
                  {o.minOrderValue ? <span>Min order ₹{Number(o.minOrderValue).toFixed(0)}</span> : null}
                  <span>Used {o.usedCount ?? 0}{o.usageLimit ? ` / ${o.usageLimit}` : ""}</span>
                  {o.perUserLimit ? <span>Per user {o.perUserLimit}</span> : null}
                  {range ? <span>{range}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <OfferFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={(text) => { setShowForm(false); setEditing(null); flash("success", text); load(); }}
        />
      )}
    </div>
  );
};

// datetime-local needs 'YYYY-MM-DDTHH:mm'; the API returns ISO strings, so trim.
const toLocalInput = (s) => {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s).slice(0, 16);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
};

const OfferFormModal = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({
    type: initial?.type || "FLAT",
    code: initial?.code || "",
    title: initial?.title || "",
    description: initial?.description || "",
    value: initial?.value ?? "",
    minOrderValue: initial?.minOrderValue ?? "",
    maxDiscount: initial?.maxDiscount ?? "",
    startAt: toLocalInput(initial?.startAt),
    endAt: toLocalInput(initial?.endAt),
    usageLimit: initial?.usageLimit ?? "",
    perUserLimit: initial?.perUserLimit ?? "",
    isFlash: initial?.isFlash ?? false,
    isActive: initial?.isActive ?? true,
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.code.trim()) { setError("Code is required"); return; }
    if (form.type !== "BOGO" && (!form.value || Number(form.value) <= 0)) { setError("Enter a valid offer value"); return; }
    setError(null);
    setSaving(true);
    const payload = {
      ...(initial ? { id: initial.id } : {}),
      type: form.type,
      code: form.code.trim().toUpperCase(),
      title: form.title.trim() || null,
      description: form.description.trim() || null,
      value: form.type === "BOGO" ? 0 : Number(form.value),
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
      maxDiscount: form.type === "PERCENT" && form.maxDiscount ? Number(form.maxDiscount) : null,
      ...(form.startAt ? { startAt: form.startAt } : {}),
      ...(form.endAt ? { endAt: form.endAt } : {}),
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      isFlash: form.isFlash,
      isActive: form.isActive,
    };
    const res = initial
      ? await marketplaceService.updateOffer(payload)
      : await marketplaceService.createOffer(payload);
    setSaving(false);
    if (res.success) onSaved(initial ? "Offer updated" : "Offer created");
    else setError(res.message || "Save failed");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
          <button className="mkt-header-back" onClick={onClose}>×</button>
          <h1 className="mkt-header-title">{initial ? "Edit Offer" : "Create Offer"}</h1>
        </div>
        <div className="mkt-form">
          <div className="mkt-field">
            <label className="mkt-field-label">Offer type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: 4, borderRadius: 12, background: "var(--cm-bg-secondary)", border: "1px solid var(--cm-line)" }}>
              {OFFER_TYPES.map((t) => {
                const isActive = form.type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setField("type", t.key)}
                    style={{
                      minWidth: 0, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                      fontSize: 13, fontWeight: 700,
                      background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "transparent",
                      color: isActive ? "#fff" : "var(--cm-muted)",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mkt-field">
            <label className="mkt-field-label">Code <span className="mkt-req">*</span></label>
            <input className="mkt-input" value={form.code} onChange={(e) => setField("code", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="e.g. SAVE50" style={{ textTransform: "uppercase" }} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Title</label>
            <input className="mkt-input" value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. Flat ₹50 off" />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Description</label>
            <textarea className="mkt-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Terms shown to customers" />
          </div>

          {form.type !== "BOGO" && (
            <div className="mkt-field">
              <label className="mkt-field-label">{form.type === "PERCENT" ? "Discount percent (%) *" : "Discount amount (₹) *"}</label>
              <input className="mkt-input" inputMode="decimal" value={form.value} onChange={(e) => setField("value", e.target.value)} />
            </div>
          )}
          {form.type === "PERCENT" && (
            <div className="mkt-field">
              <label className="mkt-field-label">Max discount (₹)</label>
              <input className="mkt-input" inputMode="decimal" value={form.maxDiscount} onChange={(e) => setField("maxDiscount", e.target.value)} placeholder="Cap on percent discount" />
            </div>
          )}

          <div className="mkt-field">
            <label className="mkt-field-label">Min order value (₹)</label>
            <input className="mkt-input" inputMode="decimal" value={form.minOrderValue} onChange={(e) => setField("minOrderValue", e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Starts</label>
              <input type="datetime-local" className="mkt-input" value={form.startAt} onChange={(e) => setField("startAt", e.target.value)} />
            </div>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Ends</label>
              <input type="datetime-local" className="mkt-input" value={form.endAt} onChange={(e) => setField("endAt", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Total usage limit</label>
              <input className="mkt-input" inputMode="numeric" value={form.usageLimit} onChange={(e) => setField("usageLimit", e.target.value.replace(/\D/g, ""))} placeholder="Unlimited" />
            </div>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Per-user limit</label>
              <input className="mkt-input" inputMode="numeric" value={form.perUserLimit} onChange={(e) => setField("perUserLimit", e.target.value.replace(/\D/g, ""))} placeholder="Unlimited" />
            </div>
          </div>

          <div className="mkt-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="offer-flash" checked={form.isFlash} onChange={(e) => setField("isFlash", e.target.checked)} />
            <label htmlFor="offer-flash" className="mkt-field-label" style={{ margin: 0 }}>Flash offer (highlighted &amp; time-limited)</label>
          </div>
          <div className="mkt-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="offer-active" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} />
            <label htmlFor="offer-active" className="mkt-field-label" style={{ margin: 0 }}>Active</label>
          </div>

          {error && <div className="mkt-error-text">{error}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Create offer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreOffersScreen;
