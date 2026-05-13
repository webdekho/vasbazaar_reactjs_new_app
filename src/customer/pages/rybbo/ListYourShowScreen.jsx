import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaImage, FaTimes, FaMapMarkerAlt, FaCrosshairs, FaPlus, FaTicketAlt, FaExternalLinkAlt } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";

const MAX_BANNER_BYTES = 2 * 1024 * 1024; // 2 MB

const newTicketCategory = () => ({
  id: `tc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: "", price: "", seats: "",
});

const empty = {
  organizerName: "", contactEmail: "", contactMobile: "",
  title: "", category: "events", city: "",
  expectedDate: "", description: "", bannerImage: "",
  venueName: "", venueAddress: "", venueLat: "", venueLng: "",
  ticketCategories: [],
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const ListYourShowScreen = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadMine = async () => {
    const r = await rybboService.getMySubmissions();
    if (r.success) setSubmissions(r.data || []);
  };
  useEffect(() => { loadMine(); }, []);

  const beginEdit = (s) => {
    setEditingId(s.id);
    const str = (v) => (v == null ? "" : String(v));
    const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
    const tcs = Array.isArray(s.ticketCategories) ? s.ticketCategories : [];
    setForm({
      organizerName: str(s.organizerName ?? s.organizer_name),
      contactEmail: str(s.contactEmail ?? s.contact_email),
      contactMobile: str(s.contactMobile ?? s.contact_mobile),
      title: str(s.title),
      category: str(s.category) || "events",
      city: str(s.city),
      expectedDate: dateOnly(s.expectedDate ?? s.expected_date),
      description: str(s.description),
      bannerImage: str(s.bannerImage ?? s.banner_image),
      venueName: str(s.venueName ?? s.venue_name),
      venueAddress: str(s.venueAddress ?? s.venue_address),
      venueLat: s.venueLat ?? s.venue_lat ?? "",
      venueLng: s.venueLng ?? s.venue_lng ?? "",
      ticketCategories: tcs.map((t, i) => ({
        id: t.id || `tc_edit_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: str(t.name),
        price: t.price ?? "",
        seats: t.seats ?? "",
      })),
    });
    setError(""); setSuccess(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null); setForm(empty); setError("");
  };

  const submit = async () => {
    setError(""); setSubmitting(true);
    const r = editingId
      ? await rybboService.updateShow(editingId, form)
      : await rybboService.submitShow(form);
    setSubmitting(false);
    if (!r.success) { setError(r.message || "Submission failed"); return; }
    setSuccess(true); setForm(empty); setEditingId(null); loadMine();
    setTimeout(() => setSuccess(false), 3500);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete submission "${s.title}"? This cannot be undone.`)) return;
    const r = await rybboService.deleteShow(s.id);
    if (!r.success) { setError(r.message || "Delete failed"); return; }
    if (editingId === s.id) cancelEdit();
    loadMine();
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fileInputRef = useRef(null);
  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > MAX_BANNER_BYTES) { setError("Banner must be 2 MB or less."); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, bannerImage: dataUrl }));
      setError("");
    } catch {
      setError("Could not read the image. Try another file.");
    }
  };
  const clearBanner = () => setForm((f) => ({ ...f, bannerImage: "" }));

  // ── Venue / map ────────────────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          venueLat: pos.coords.latitude.toFixed(6),
          venueLng: pos.coords.longitude.toFixed(6),
        }));
        setError("");
      },
      () => setError("Could not get current location. Enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const lat = parseFloat(form.venueLat);
  const lng = parseFloat(form.venueLng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const mapEmbedSrc = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`
    : "";
  const directionsHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : "";

  // ── Ticket categories ───────────────────────────────────────────
  const addTicketCategory = () =>
    setForm((f) => ({ ...f, ticketCategories: [...(f.ticketCategories || []), newTicketCategory()] }));
  const updateTicketCategory = (id, key, value) =>
    setForm((f) => ({
      ...f,
      ticketCategories: f.ticketCategories.map((tc) => tc.id === id ? { ...tc, [key]: value } : tc),
    }));
  const removeTicketCategory = (id) =>
    setForm((f) => ({ ...f, ticketCategories: f.ticketCategories.filter((tc) => tc.id !== id) }));

  return (
    <div style={{ paddingBottom: 32, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
          <FaArrowLeft />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{editingId ? "Edit submission" : "List your show on RYBBO"}</div>
      </div>

      <div style={{ padding: "16px 14px" }}>
        <p style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", margin: "0 0 16px" }}>
          Are you organizing an event, play, sports match or activity? Submit the details — our team will review and reach out within 2–3 business days.
        </p>

        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(34,197,94,0.12)", borderRadius: 8, color: "#22c55e", marginBottom: 14, fontSize: 13 }}>
            <FaCheckCircle /> Submitted. We'll be in touch soon.
          </div>
        )}
        {error && (
          <div style={{ padding: "10px 12px", background: "rgba(255,60,60,0.12)", borderRadius: 8, color: "#ff6b6b", marginBottom: 14, fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Organizer name *" value={form.organizerName} onChange={set("organizerName")} placeholder="Your or company name" />
          <Field label="Contact mobile *" value={form.contactMobile} onChange={set("contactMobile")} placeholder="10-digit mobile" inputMode="numeric" />
          <Field label="Contact email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="you@example.com" type="email" />
          <div>
            <label style={labelStyle}>Banner image</label>
            <input
              ref={fileInputRef} type="file" accept="image/*"
              onChange={handleBannerChange} style={{ display: "none" }}
            />
            {form.bannerImage ? (
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--cm-line, #2A2A3A)" }}>
                <img src={form.bannerImage} alt="Banner preview" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "6px 10px", borderRadius: 999, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Replace
                  </button>
                  <button type="button" onClick={clearBanner} aria-label="Remove banner"
                    style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <FaTimes size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%", padding: "22px 14px", borderRadius: 12,
                  border: "1px dashed var(--cm-line, #2A2A3A)", background: "transparent",
                  color: "var(--cm-muted, #A0A0A0)", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}>
                <FaImage size={18} color="#007BFF" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-ink, inherit)" }}>Upload banner</span>
                <span style={{ fontSize: 11 }}>JPG / PNG, up to 2 MB · recommended 1200×600</span>
              </button>
            )}
          </div>
          <Field label="Show title *" value={form.title} onChange={set("title")} placeholder="e.g. Stand-up night with X" />
          <div>
            <label style={labelStyle}>Category *</label>
            <select value={form.category} onChange={set("category")} style={inputStyle}>
              <option value="events">Events</option>
              <option value="plays">Plays</option>
              <option value="workshops">Workshops</option>
              <option value="sports">Sports</option>
              <option value="activities">Activities</option>
            </select>
          </div>
          <Field label="City *" value={form.city} onChange={set("city")} placeholder="Mumbai / Pune …" />
          <Field label="Expected date" value={form.expectedDate} onChange={set("expectedDate")} type="date" />

          {/* ── Venue & map ─────────────────────────────────────── */}
          <div style={sectionCard}>
            <div style={sectionHead}>
              <FaMapMarkerAlt color="#007BFF" />
              <span>Venue & directions</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Venue name" value={form.venueName} onChange={set("venueName")} placeholder="e.g. Phoenix Marketcity Auditorium" />
              <Field label="Address" value={form.venueAddress} onChange={set("venueAddress")} placeholder="Street, area, landmark" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <Field label="Latitude" value={form.venueLat} onChange={set("venueLat")} placeholder="19.0760" inputMode="decimal" />
                <Field label="Longitude" value={form.venueLng} onChange={set("venueLng")} placeholder="72.8777" inputMode="decimal" />
                <button type="button" onClick={useMyLocation}
                  style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FaCrosshairs size={11} /> Use mine
                </button>
              </div>
              {hasCoords ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--cm-line, #2A2A3A)" }}>
                    <iframe
                      title="Venue map"
                      src={mapEmbedSrc}
                      width="100%" height="220" style={{ border: 0, display: "block" }}
                      loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <a href={directionsHref} target="_blank" rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: "1px solid #007BFF", color: "#007BFF", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                    <FaExternalLinkAlt size={11} /> Open directions in Google Maps
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "var(--cm-muted, #6B7280)" }}>
                  Add lat/long (or tap “Use mine”) to preview the venue on Google Maps.
                </div>
              )}
            </div>
          </div>

          {/* ── Ticket categories ──────────────────────────────── */}
          <div style={sectionCard}>
            <div style={{ ...sectionHead, justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaTicketAlt color="#007BFF" />
                Ticket categories
              </span>
              <button type="button" onClick={addTicketCategory}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <FaPlus size={10} /> Add tier
              </button>
            </div>
            {form.ticketCategories.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
                Add custom tiers like <strong style={{ color: "var(--cm-ink, inherit)" }}>Silver, Gold, Platinum</strong> — set your own price and seat count.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {form.ticketCategories.map((tc, idx) => (
                  <div key={tc.id} style={{ padding: 10, borderRadius: 10, border: "1px solid var(--cm-line, #2A2A3A)", background: "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-muted, #6B7280)" }}>Tier {idx + 1}</span>
                      <button type="button" onClick={() => removeTicketCategory(tc.id)} aria-label="Remove tier"
                        style={{ background: "transparent", border: "none", color: "var(--cm-muted, #6B7280)", cursor: "pointer", padding: 0 }}>
                        <FaTimes size={12} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8 }}>
                      <input type="text" value={tc.name}
                        onChange={(e) => updateTicketCategory(tc.id, "name", e.target.value)}
                        placeholder="Tier name (Silver)" style={inputStyle} />
                      <input type="number" min="0" inputMode="decimal" value={tc.price}
                        onChange={(e) => updateTicketCategory(tc.id, "price", e.target.value)}
                        placeholder="Price ₹" style={inputStyle} />
                      <input type="number" min="0" inputMode="numeric" value={tc.seats}
                        onChange={(e) => updateTicketCategory(tc.id, "seats", e.target.value)}
                        placeholder="Seats" style={inputStyle} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={set("description")} rows={4}
              placeholder="Venue ideas, expected audience size, prior experience, anything else…"
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {editingId && (
            <button type="button" onClick={cancelEdit}
              style={{ flex: "0 0 auto", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--cm-line, #2A2A3A)", background: "transparent", color: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Cancel
            </button>
          )}
          <button type="button" onClick={submit} disabled={submitting}
            style={{ flex: 1, padding: 14, borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, fontSize: 16, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Saving…" : (editingId ? "Update submission" : "Submit for review")}
          </button>
        </div>

        {submissions.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Your previous submissions</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {submissions.map((s) => {
                const isEditing = editingId === s.id;
                const locked = s.status && s.status !== "PENDING";
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${isEditing ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`, borderRadius: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>{s.category} · {s.city} · {s.expectedDate || "TBD"}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.status === "APPROVED" ? "#22c55e" : s.status === "REJECTED" ? "#ff6b6b" : "#F4A261" }}>
                      {s.status}
                    </span>
                    <button type="button" onClick={() => beginEdit(s)} disabled={locked}
                      title={locked ? "Approved/rejected submissions can't be edited" : "Edit"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #007BFF", background: "transparent", color: locked ? "var(--cm-muted, #6B7280)" : "#007BFF", fontSize: 11, fontWeight: 700, cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.5 : 1 }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(s)} aria-label="Delete submission"
                      style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--cm-line, #2A2A3A)", background: "transparent", color: "var(--cm-muted, #6B7280)", cursor: "pointer" }}>
                      <FaTimes size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--cm-muted, #6B7280)", marginBottom: 4, display: "block" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 14, fontFamily: "inherit" };
const sectionCard = { padding: 14, borderRadius: 12, border: "1px solid var(--cm-line, #2A2A3A)", background: "transparent", display: "grid", gap: 10 };
const sectionHead = { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700 };

const Field = ({ label, value, onChange, type = "text", placeholder, inputMode }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} style={inputStyle} />
  </div>
);

export default ListYourShowScreen;
