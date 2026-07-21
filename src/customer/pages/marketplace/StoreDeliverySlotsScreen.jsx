import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaClock, FaToggleOn, FaToggleOff } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import { formatDisplayTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const fmt = (t) => formatDisplayTime(t, "--:--");
const daysText = (csv) =>
  !csv ? "Every day" : csv.split(",").filter(Boolean).map((d) => d[0] + d.slice(1).toLowerCase()).join(", ");

const StoreDeliverySlotsScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", startTime: "", endTime: "", days: [] });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyDeliverySlots();
    setLoading(false);
    if (res.success) setSlots(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDay = (d) =>
    setForm((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] }));

  const submit = async () => {
    if (!form.label.trim()) { setError("Slot name is required"); return; }
    if (!form.startTime || !form.endTime) { setError("Start and end time are required"); return; }
    if (form.endTime <= form.startTime) { setError("End time must be after start time"); return; }
    setError(null);
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      startTime: form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
      endTime: form.endTime.length === 5 ? form.endTime + ":00" : form.endTime,
      daysOfWeek: form.days.length ? form.days.join(",") : null,
      isActive: true,
    };
    const res = await marketplaceService.createMyDeliverySlot(payload);
    setSaving(false);
    if (res.success) {
      showToast("Delivery slot created", "success");
      setForm({ label: "", startTime: "", endTime: "", days: [] });
      setShowForm(false);
      load();
    } else {
      setError(res.message || "Could not save slot");
    }
  };

  const toggleActive = async (slot) => {
    const res = await marketplaceService.toggleMyDeliverySlot(slot.id, !slot.isActive);
    if (res.success) { showToast(slot.isActive ? "Slot disabled" : "Slot enabled", "info"); load(); }
    else showToast(res.message || "Could not update", "error");
  };

  const remove = async (slot) => {
    if (!window.confirm("Delete this delivery slot?")) return;
    const res = await marketplaceService.deleteMyDeliverySlot(slot.id);
    if (res.success) { showToast("Slot deleted", "info"); setSlots((p) => p.filter((s) => s.id !== slot.id)); }
    else showToast(res.message || "Could not delete", "error");
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Delivery Slots</h1>
      </div>

      <div style={{ padding: "8px 14px 90px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
          Create delivery windows. Customers pick one of these when scheduling an order or setting up a subscription.
        </div>

        {/* Add slot */}
        {!showForm ? (
          <button type="button" onClick={() => { setError(null); setShowForm(true); }}
            className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "8px 14px", fontSize: 13, marginBottom: 14 }}>
            <FaPlus size={11} style={{ marginRight: 6 }} /> Add delivery slot
          </button>
        ) : (
          <div style={{ border: "1px solid var(--cm-line)", borderRadius: 14, padding: 14, marginBottom: 16, background: "var(--cm-card)" }}>
            <div className="mkt-field">
              <label className="mkt-field-label">Slot name <span className="mkt-req">*</span></label>
              <input className="mkt-input" value={form.label} placeholder="e.g. Morning (9-11 AM)"
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="mkt-field" style={{ flex: 1 }}>
                <label className="mkt-field-label">Start <span className="mkt-req">*</span></label>
                <input type="time" className="mkt-input" value={form.startTime}
                  onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="mkt-field" style={{ flex: 1 }}>
                <label className="mkt-field-label">End <span className="mkt-req">*</span></label>
                <input type="time" className="mkt-input" value={form.endTime}
                  onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Available days (leave empty = every day)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DAYS.map((d) => {
                  const on = form.days.includes(d);
                  return (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      style={{
                        width: 40, height: 34, borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        border: on ? "1px solid transparent" : "1px solid var(--cm-line)",
                        background: on ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
                        color: on ? "#fff" : "var(--cm-muted)",
                      }}>
                      {d[0] + d[1].toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <div className="mkt-error-text">{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => { setShowForm(false); setError(null); }}
                className="mkt-btn mkt-btn--secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="button" onClick={submit} disabled={saving}
                className="mkt-btn mkt-btn--primary" style={{ flex: 1 }}>{saving ? "Saving…" : "Add slot"}</button>
            </div>
          </div>
        )}

        {/* Slot list */}
        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : slots.length === 0 ? (
          <div className="mkt-empty">No delivery slots yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slots.map((s) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14,
                border: "1px solid var(--cm-line)", background: "var(--cm-card)", opacity: s.isActive ? 1 : 0.6,
              }}>
                <FaClock size={14} color="#007BFF" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                    {fmt(s.startTime)}–{fmt(s.endTime)} · {daysText(s.daysOfWeek)}
                  </div>
                </div>
                <button onClick={() => toggleActive(s)} title={s.isActive ? "Disable" : "Enable"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: s.isActive ? "#10b981" : "var(--cm-muted)" }}>
                  {s.isActive ? <FaToggleOn size={22} /> : <FaToggleOff size={22} />}
                </button>
                <button onClick={() => remove(s)} title="Delete"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                  <FaTrash size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDeliverySlotsScreen;
