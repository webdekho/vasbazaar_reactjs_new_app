import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaImage, FaTimes, FaMapMarkerAlt, FaCrosshairs, FaPlus, FaTicketAlt, FaExternalLinkAlt, FaSearch, FaSpinner } from "react-icons/fa";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const editIdFromUrl = searchParams.get("edit");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadMine = async () => {
    const r = await rybboService.getMySubmissions();
    if (r.success) {
      const list = r.data || [];
      setSubmissions(list);
      return list;
    }
    return [];
  };
  useEffect(() => {
    (async () => {
      const list = await loadMine();
      if (editIdFromUrl) {
        const match = list.find((s) => String(s.id) === String(editIdFromUrl));
        if (match) beginEdit(match);
        // Clear the param so a manual "New submission" reset isn't overridden on next render.
        searchParams.delete("edit");
        setSearchParams(searchParams, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginEdit = (s) => {
    setEditingId(s.id);
    setEditingStatus(s.status || null);
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
    setEditingId(null); setEditingStatus(null); setForm(empty); setError("");
  };

  const submit = async () => {
    setError(""); setSubmitting(true);
    const r = editingId
      ? await rybboService.updateShow(editingId, form)
      : await rybboService.submitShow(form);
    setSubmitting(false);
    if (!r.success) { setError(r.message || "Submission failed"); return; }
    setSuccess(true); setForm(empty); setEditingId(null); setEditingStatus(null); loadMine();
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
        {editingId && editingStatus && editingStatus !== "PENDING" && (
          <div style={{ padding: "10px 12px", background: "rgba(244,162,97,0.14)", borderRadius: 8, color: "#F4A261", marginBottom: 14, fontSize: 13 }}>
            This submission is currently <strong>{editingStatus}</strong>. Saving changes will send it back for review.
          </div>
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
              <LocationSearch onPick={(p) => {
                setForm((f) => ({
                  ...f,
                  venueName: f.venueName || p.venueName,
                  venueAddress: p.address || f.venueAddress,
                  venueLat: p.lat,
                  venueLng: p.lng,
                  city: f.city || p.city,
                }));
                setError("");
              }} />
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
            {submitting ? "Saving…" : (editingId ? (editingStatus && editingStatus !== "PENDING" ? "Resubmit for review" : "Update submission") : "Submit for review")}
          </button>
        </div>

        {submissions.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Your previous submissions</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {submissions.map((s) => {
                const isEditing = editingId === s.id;
                const deletable = !s.status || s.status === "PENDING";
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${isEditing ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`, borderRadius: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>{s.category} · {s.city} · {s.expectedDate || "TBD"}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.status === "APPROVED" ? "#22c55e" : s.status === "REJECTED" ? "#ff6b6b" : "#F4A261" }}>
                      {s.status}
                    </span>
                    <button type="button" onClick={() => beginEdit(s)}
                      title={s.status && s.status !== "PENDING" ? "Editing will send this back for review" : "Edit"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(s)} disabled={!deletable}
                      title={deletable ? "Delete" : "Only pending submissions can be deleted"}
                      aria-label="Delete submission"
                      style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--cm-line, #2A2A3A)", background: "transparent", color: "var(--cm-muted, #6B7280)", cursor: deletable ? "pointer" : "not-allowed", opacity: deletable ? 1 : 0.4 }}>
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

// Forward-geocode using OpenStreetMap Nominatim. Free, no API key — debounced,
// India-biased so local venues rank first. On pick, fills lat/lng/address/city.
const LocationSearch = ({ onPick }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setResults([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6&countrycodes=in`;
      fetch(url, { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (cancelled) return;
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (item) => {
    const a = item.address || {};
    const cityVal = a.city || a.town || a.village || a.county || "";
    const addrParts = [
      a.house_number, a.road || a.pedestrian || a.neighbourhood,
      a.suburb || a.city_district, cityVal, a.state, a.postcode,
    ].filter(Boolean);
    const address = addrParts.length ? addrParts.join(", ") : item.display_name || "";
    const venueName = item.namedetails?.name || (item.display_name || "").split(",")[0] || "";
    onPick({
      lat: Number(item.lat).toFixed(6),
      lng: Number(item.lon).toFixed(6),
      address, city: cityVal, venueName,
    });
    setQuery(item.display_name || venueName);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <label style={labelStyle}>Search location</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--cm-muted, #6B7280)", pointerEvents: "none" }}>
          <FaSearch size={12} />
        </span>
        <input
          type="search" value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search venue, address, landmark…"
          style={{ ...inputStyle, paddingLeft: 30, paddingRight: 30 }}
        />
        {loading && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--cm-muted, #6B7280)" }}>
            <FaSpinner size={12} style={{ animation: "cm-spin 0.7s linear infinite" }} />
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--cm-card, #fff)", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 50, maxHeight: 260, overflowY: "auto" }}>
          {results.map((r) => (
            <button key={r.place_id} type="button" onClick={() => pick(r)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--cm-line, #F1F5F9)", cursor: "pointer", color: "inherit" }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                {(r.display_name || "").split(",")[0]}
              </div>
              <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 2, lineHeight: 1.3 }}>
                {r.display_name}
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && open && query.trim().length >= 3 && results.length === 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--cm-card, #fff)", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "var(--cm-muted, #6B7280)", zIndex: 50 }}>
          No matches. Try a broader query or enter lat/lng manually.
        </div>
      )}
    </div>
  );
};

export default ListYourShowScreen;
