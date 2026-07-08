import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaCalendarTimes, FaMapMarkerAlt } from "react-icons/fa";
import { marketplaceVendorService } from "../../services/marketplaceVendorService";
import { useToast } from "../../context/ToastContext";
import "./marketplace.css";

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return d;
  }
};

const todayStr = () => {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - off).toISOString().slice(0, 10);
};

/**
 * Seller vendor-management screen with two tabs:
 *  - Holidays: dates the store is closed (customers see a "closed" flag)
 *  - Pincodes: serviceable pincodes (max 50) that augment the delivery radius;
 *    checkout shows a soft warning outside the list — orders are not blocked.
 */
const StoreHolidaysScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState("holidays");

  // Holidays
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ holidayDate: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pincodes
  const [pincodes, setPincodes] = useState([]);
  const [loadingPins, setLoadingPins] = useState(true);
  const [newPin, setNewPin] = useState("");
  const [addingPin, setAddingPin] = useState(false);
  const [pinError, setPinError] = useState(null);

  const loadHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    const res = await marketplaceVendorService.getMyHolidays();
    setLoadingHolidays(false);
    if (res.success) setHolidays(Array.isArray(res.data) ? res.data : []);
  }, []);

  const loadPincodes = useCallback(async () => {
    setLoadingPins(true);
    const res = await marketplaceVendorService.getMyPincodes();
    setLoadingPins(false);
    if (res.success) setPincodes(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => { loadHolidays(); loadPincodes(); }, [loadHolidays, loadPincodes]);

  const submitHoliday = async () => {
    if (!form.holidayDate) { setError("Pick a date"); return; }
    setError(null);
    setSaving(true);
    const res = await marketplaceVendorService.addHoliday({
      holidayDate: form.holidayDate,
      note: form.note.trim() || null,
    });
    setSaving(false);
    if (res.success) {
      showToast("Holiday added", "success");
      setForm({ holidayDate: "", note: "" });
      setShowForm(false);
      loadHolidays();
    } else {
      setError(res.message || "Could not add holiday");
    }
  };

  const removeHoliday = async (h) => {
    if (!window.confirm(`Remove holiday on ${fmtDate(h.holidayDate)}?`)) return;
    const res = await marketplaceVendorService.deleteHoliday(h.id);
    if (res.success) { showToast("Holiday removed", "info"); setHolidays((p) => p.filter((x) => x.id !== h.id)); }
    else showToast(res.message || "Could not remove", "error");
  };

  const submitPincode = async () => {
    const pin = newPin.trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) { setPinError("Enter a valid 6-digit pincode"); return; }
    setPinError(null);
    setAddingPin(true);
    const res = await marketplaceVendorService.addPincode(pin);
    setAddingPin(false);
    if (res.success) { showToast("Pincode added", "success"); setNewPin(""); loadPincodes(); }
    else setPinError(res.message || "Could not add pincode");
  };

  const removePincode = async (p) => {
    if (!window.confirm(`Remove pincode ${p.pincode}?`)) return;
    const res = await marketplaceVendorService.deletePincode(p.id);
    if (res.success) { showToast("Pincode removed", "info"); setPincodes((prev) => prev.filter((x) => x.id !== p.id)); }
    else showToast(res.message || "Could not remove", "error");
  };

  const tabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{
        flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
        border: tab === key ? "1px solid transparent" : "1px solid var(--cm-line)",
        background: tab === key ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
        color: tab === key ? "#fff" : "var(--cm-ink)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Holidays &amp; Serviceability</h1>
      </div>

      <div style={{ padding: "8px 14px 90px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {tabBtn("holidays", "Holiday calendar")}
          {tabBtn("pincodes", "Pincodes")}
        </div>

        {tab === "holidays" ? (
          <>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
              Mark days your store stays closed. Customers see a "closed" note on your store page — orders are not blocked.
            </div>

            {!showForm ? (
              <button type="button" onClick={() => { setError(null); setShowForm(true); }}
                className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "8px 14px", fontSize: 13, marginBottom: 14 }}>
                <FaPlus size={11} style={{ marginRight: 6 }} /> Add holiday
              </button>
            ) : (
              <div style={{ border: "1px solid var(--cm-line)", borderRadius: 14, padding: 14, marginBottom: 16, background: "var(--cm-card)" }}>
                <div className="mkt-field">
                  <label className="mkt-field-label">Date <span className="mkt-req">*</span></label>
                  <input type="date" className="mkt-input" value={form.holidayDate} min={todayStr()}
                    onChange={(e) => setForm((p) => ({ ...p, holidayDate: e.target.value }))} />
                </div>
                <div className="mkt-field">
                  <label className="mkt-field-label">Note (shown to customers)</label>
                  <input className="mkt-input" value={form.note} maxLength={120} placeholder="e.g. Diwali"
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
                </div>
                {error && <div style={{ color: "#e5484d", fontSize: 12, marginBottom: 8 }}>{error}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="mkt-btn mkt-btn--add" disabled={saving} onClick={submitHoliday}
                    style={{ flex: 1, padding: "10px 0", fontSize: 13 }}>
                    {saving ? "Saving…" : "Save holiday"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ flex: 1, padding: "10px 0", fontSize: 13, borderRadius: 10, border: "1px solid var(--cm-line)", background: "transparent", color: "var(--cm-ink)", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loadingHolidays ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--cm-muted)", fontSize: 13 }}>Loading…</div>
            ) : holidays.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--cm-muted)", fontSize: 13 }}>
                <FaCalendarTimes size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>No holidays declared yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {holidays.map((h) => {
                  const past = h.holidayDate < todayStr();
                  return (
                    <div key={h.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: 12,
                      borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)",
                      opacity: past ? 0.55 : 1,
                    }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", flexShrink: 0 }}>
                        <FaCalendarTimes size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{fmtDate(h.holidayDate)}</div>
                        <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{h.note || (past ? "Past holiday" : "Store closed")}</div>
                      </div>
                      <button type="button" onClick={() => removeHoliday(h)} aria-label="Remove holiday"
                        style={{ border: "none", background: "transparent", color: "#e5484d", cursor: "pointer", padding: 8 }}>
                        <FaTrash size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
              List the pincodes you serve (max 50), in addition to your delivery radius. Customers outside these pincodes
              see a soft warning at checkout — orders are not blocked. Leave the list empty for no pincode restriction.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input className="mkt-input" style={{ flex: 1 }} inputMode="numeric" maxLength={6}
                placeholder="e.g. 411001" value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") submitPincode(); }} />
              <button type="button" className="mkt-btn mkt-btn--add" disabled={addingPin} onClick={submitPincode}
                style={{ width: "auto", padding: "0 16px", fontSize: 13 }}>
                <FaPlus size={11} style={{ marginRight: 5 }} /> {addingPin ? "Adding…" : "Add"}
              </button>
            </div>
            {pinError && <div style={{ color: "#e5484d", fontSize: 12, marginBottom: 8 }}>{pinError}</div>}
            <div style={{ fontSize: 11.5, color: "var(--cm-muted)", marginBottom: 12 }}>{pincodes.length}/50 pincodes added</div>

            {loadingPins ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--cm-muted)", fontSize: 13 }}>Loading…</div>
            ) : pincodes.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--cm-muted)", fontSize: 13 }}>
                <FaMapMarkerAlt size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>No pincode restriction — serving by radius only</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {pincodes.map((p) => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 6px 8px 12px",
                    borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card)",
                  }}>
                    <FaMapMarkerAlt size={11} color="var(--cm-muted)" />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{p.pincode}</span>
                    <button type="button" onClick={() => removePincode(p)} aria-label={`Remove ${p.pincode}`}
                      style={{ border: "none", background: "transparent", color: "#e5484d", cursor: "pointer", padding: "4px 6px" }}>
                      <FaTrash size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StoreHolidaysScreen;
