import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaImage, FaTimes } from "react-icons/fa";
import { rybboSocialService } from "../../../services/rybboSocialService";
import DataState from "../../../components/DataState";
import { useToast } from "../../../context/ToastContext";

const ACCENT = "#7C3AED";
const MAX_IMG_BYTES = 2 * 1024 * 1024;

const EVENT_TYPES = [
  { key: "birthday", label: "Birthday" },
  { key: "party", label: "House / Get-together" },
  { key: "anniversary", label: "Anniversary" },
  { key: "pooja", label: "Pooja / Religious" },
  { key: "dinner", label: "Dinner" },
  { key: "kitty", label: "Kitty party" },
  { key: "baby_shower", label: "Baby shower" },
  { key: "reunion", label: "Reunion" },
  { key: "custom", label: "Custom" },
];

const FOOD_PREFS = ["", "veg", "non-veg", "jain", "custom"];

const labelStyle = { fontSize: 12, fontWeight: 700, color: "var(--cm-muted, #6B7280)", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10,
  border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)",
  color: "var(--cm-ink, inherit)", fontSize: 14, outline: "none",
};

const CreateEventScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", eventType: "birthday", eventAt: "", venue: "", dressCode: "",
    foodPref: "", guestLimit: "", hostMessage: "", coverImage: "", isPublic: false,
    contributionAmount: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      const r = await rybboSocialService.getEvent(id);
      if (cancelled) return;
      if (!r.success) { setLoadError(r.message || "Could not load event"); setLoading(false); return; }
      const e = r.data || {};
      setForm({
        title: e.title || "",
        eventType: e.eventType || "custom",
        eventAt: (e.eventAt || "").slice(0, 16), // ISO → "YYYY-MM-DDTHH:mm"
        venue: e.venue || "",
        dressCode: e.dressCode || "",
        foodPref: e.foodPref || "",
        guestLimit: e.guestLimit != null ? String(e.guestLimit) : "",
        hostMessage: e.hostMessage || "",
        coverImage: e.coverImage || "",
        isPublic: Boolean(e.isPublic),
        contributionAmount: e.contributionAmount != null ? String(e.contributionAmount) : "",
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onPickImage = (file) => {
    if (!file) return;
    if (file.size > MAX_IMG_BYTES) { showToast("Image must be under 2 MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => set("coverImage", reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.title.trim()) { showToast("Please enter an event name", "error"); return; }
    if (!form.eventAt) { showToast("Please pick a date & time", "error"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      eventType: form.eventType,
      eventAt: form.eventAt,
      venue: form.venue.trim() || null,
      dressCode: form.dressCode.trim() || null,
      foodPref: form.foodPref || null,
      guestLimit: form.guestLimit ? Number(form.guestLimit) : null,
      hostMessage: form.hostMessage.trim() || null,
      coverImage: form.coverImage || null,
      isPublic: form.isPublic,
      contributionAmount: form.contributionAmount ? Number(form.contributionAmount) : null,
    };
    const r = isEdit
      ? await rybboSocialService.updateEvent(id, payload)
      : await rybboSocialService.createEvent(payload);
    setSaving(false);
    if (!r.success) { showToast(r.message || "Could not save event", "error"); return; }
    showToast(isEdit ? "Event updated" : "Event created — share your invite!", "success");
    const eventId = r.data?.id || id;
    navigate(`/customer/app/rybbo/social/event/${eventId}`, { replace: true });
  };

  return (
    <DataState loading={loading} error={loadError}>
      <div style={{ width: "100%", padding: "0 0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
            <FaArrowLeft />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{isEdit ? "Edit event" : "Create event"}</div>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 16 }}>
          {/* Cover image */}
          <div>
            <label style={labelStyle}>Cover image / theme (optional)</label>
            {form.coverImage ? (
              <div style={{ position: "relative" }}>
                <img src={form.coverImage} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }} />
                <button type="button" onClick={() => set("coverImage", "")}
                  style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer" }}>
                  <FaTimes />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ width: "100%", height: 120, borderRadius: 12, border: "1.5px dashed var(--cm-line, #D1D5DB)", background: "transparent", color: "var(--cm-muted, #6B7280)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                <FaImage size={22} />
                <span style={{ fontSize: 13 }}>Tap to add a photo (max 2 MB)</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickImage(e.target.files?.[0])} />
          </div>

          <div>
            <label style={labelStyle}>Event name *</label>
            <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Aarav's 5th Birthday" />
          </div>

          <div>
            <label style={labelStyle}>Event type</label>
            <select style={inputStyle} value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Date & time *</label>
            <input style={inputStyle} type="datetime-local" value={form.eventAt} onChange={(e) => set("eventAt", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Venue / location</label>
            <input style={inputStyle} value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Address or landmark" />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Food preference</label>
              <select style={inputStyle} value={form.foodPref} onChange={(e) => set("foodPref", e.target.value)}>
                {FOOD_PREFS.map((f) => <option key={f || "any"} value={f}>{f ? f.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Any"}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Guest limit</label>
              <input style={inputStyle} type="number" min="1" value={form.guestLimit} onChange={(e) => set("guestLimit", e.target.value)} placeholder="No limit" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Dress code (optional)</label>
            <input style={inputStyle} value={form.dressCode} onChange={(e) => set("dressCode", e.target.value)} placeholder="e.g. Traditional, Casual" />
          </div>

          <div>
            <label style={labelStyle}>Contribution per guest (optional)</label>
            <input style={inputStyle} type="number" min="0" value={form.contributionAmount} onChange={(e) => set("contributionAmount", e.target.value)} placeholder="₹ amount each guest pays (e.g. kitty / pool)" />
            <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 4 }}>
              Guests who accept will be asked to pay this via wallet or UPI. Leave blank for a free event.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Message to guests</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.hostMessage} onChange={(e) => set("hostMessage", e.target.value)} placeholder="A warm note for your invitees…" />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={form.isPublic} onChange={(e) => set("isPublic", e.target.checked)} />
            Allow anyone with the link to view & RSVP (public)
          </label>

          <button type="button" onClick={submit} disabled={saving}
            style={{ padding: "13px", borderRadius: 12, border: "none", background: ACCENT, color: "#fff", fontWeight: 800, fontSize: 15, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create & get invite link"}
          </button>
        </div>
      </div>
    </DataState>
  );
};

export default CreateEventScreen;
