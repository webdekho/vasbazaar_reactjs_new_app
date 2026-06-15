import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaTimes, FaMapMarkerAlt, FaMicrophone, FaStop, FaUpload, FaTrash } from "react-icons/fa";
import { rybboSocialService } from "../../../services/rybboSocialService";
import DataState from "../../../components/DataState";
import { useToast } from "../../../context/ToastContext";
import LocationPickerSheet from "../../../components/LocationPickerSheet";
import { useGeolocation } from "../../../hooks/useGeolocation";
import { isGoogleEnabled, googleReverseGeocode } from "../../../services/placesService";

// Reverse-geocode GPS coords to a readable address. Uses Google when a key is
// configured, else the free OpenStreetMap (Nominatim) endpoint.
async function reverseGeocodeAddress(lat, lng) {
  if (isGoogleEnabled()) {
    const g = await googleReverseGeocode(lat, lng).catch(() => "");
    if (g) return g;
  }
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse failed");
  const r = await res.json();
  return r.display_name || "";
}

const ACCENT = "#7C3AED";
const MAX_IMAGES = 3;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;   // ~3 MB cap for the host voice note
const MAX_AUDIO_SECONDS = 60;              // auto-stop recording after a minute

// Two-level event taxonomy: 8 main categories, each with specific sub-types.
// `eventCategory` stores the main key, `eventType` stores the sub-type key.
const EVENT_CATEGORIES = [
  { key: "celebration", label: "Celebration", types: [
    { key: "birthday-party", label: "Birthday Party" },
    { key: "kids-birthday", label: "Kids Birthday" },
    { key: "sweet-16-18", label: "Sweet 16 / 18th Birthday" },
    { key: "surprise-birthday", label: "Surprise Birthday" },
    { key: "milestone-birthday", label: "Milestone Birthday (30/40/50)" },
    { key: "cake-cutting", label: "Cake Cutting Event" },
    { key: "pool-party", label: "Pool Party" },
    { key: "anniversary", label: "Anniversary" },
    { key: "engagement", label: "Engagement" },
    { key: "ring-ceremony", label: "Ring Ceremony" },
    { key: "baby-shower", label: "Baby Shower" },
    { key: "naming-ceremony", label: "Naming Ceremony" },
    { key: "housewarming", label: "Housewarming (Griha Pravesh)" },
    { key: "retirement-party", label: "Retirement Party" },
    { key: "family-reunion", label: "Family Reunion" },
  ] },
  { key: "wedding", label: "Wedding", types: [
    { key: "save-the-date", label: "Save The Date" },
    { key: "haldi", label: "Haldi" },
    { key: "mehendi", label: "Mehendi" },
    { key: "sangeet", label: "Sangeet" },
    { key: "wedding-ceremony", label: "Wedding Ceremony" },
    { key: "reception", label: "Reception" },
    { key: "cocktail-party", label: "Cocktail Party" },
    { key: "bachelor-bachelorette", label: "Bachelor / Bachelorette Party" },
  ] },
  { key: "religious", label: "Religious & Cultural", types: [
    { key: "satyanarayan-pooja", label: "Satyanarayan Pooja" },
    { key: "ganpati-celebration", label: "Ganpati Celebration" },
    { key: "navratri-event", label: "Navratri Event" },
    { key: "diwali-party", label: "Diwali Party" },
    { key: "eid-gathering", label: "Eid Gathering" },
    { key: "christmas-celebration", label: "Christmas Celebration" },
    { key: "mata-ki-chowki", label: "Mata Ki Chowki" },
    { key: "bhajan-sandhya", label: "Bhajan Sandhya" },
    { key: "iftar-party", label: "Iftar Party" },
  ] },
  { key: "social", label: "Social Gathering", types: [
    { key: "house-party", label: "House Party" },
    { key: "friends-meetup", label: "Friends Meetup" },
    { key: "society-event", label: "Society Event" },
    { key: "kitty-party", label: "Kitty Party" },
    { key: "community-gathering", label: "Community Gathering" },
    { key: "alumni-meetup", label: "Alumni Meetup" },
    { key: "farewell-party", label: "Farewell Party" },
    { key: "weekend-get-together", label: "Weekend Get-Together" },
  ] },
  { key: "corporate", label: "Corporate & Professional", types: [
    { key: "team-party", label: "Team Party" },
    { key: "corporate-meetup", label: "Corporate Meetup" },
    { key: "product-launch", label: "Product Launch" },
    { key: "networking-event", label: "Networking Event" },
    { key: "award-ceremony", label: "Award Ceremony" },
    { key: "seminar", label: "Seminar" },
    { key: "training-workshop", label: "Training Workshop" },
    { key: "office-celebration", label: "Office Celebration" },
  ] },
  { key: "kids", label: "Kids & School", types: [
    { key: "school-annual-day", label: "School Annual Day" },
    { key: "kids-workshop", label: "Kids Workshop" },
    { key: "summer-camp", label: "Summer Camp" },
    { key: "parent-meetup", label: "Parent Meetup" },
    { key: "school-reunion", label: "School Reunion" },
    { key: "kids-activity-session", label: "Kids Activity Session" },
  ] },
  { key: "entertainment", label: "Entertainment & Hobby", types: [
    { key: "music-jam", label: "Music Jam" },
    { key: "open-mic", label: "Open Mic" },
    { key: "gaming-tournament", label: "Gaming Tournament" },
    { key: "watch-party", label: "Watch Party" },
    { key: "karaoke-night", label: "Karaoke Night" },
    { key: "dance-workshop", label: "Dance Workshop" },
    { key: "art-workshop", label: "Art Workshop" },
    { key: "fitness-session", label: "Fitness Session" },
  ] },
  { key: "outdoor", label: "Travel & Outdoor", types: [
    { key: "trekking-group", label: "Trekking Group" },
    { key: "camping-event", label: "Camping Event" },
    { key: "bike-ride-meetup", label: "Bike Ride Meetup" },
    { key: "road-trip-gathering", label: "Road Trip Gathering" },
    { key: "beach-party", label: "Beach Party" },
    { key: "picnic-event", label: "Picnic Event" },
  ] },
];

// Flattened sub-type → category lookup, plus aliases for the old flat values
// so existing events still resolve to a category when editing.
const ALL_TYPES = EVENT_CATEGORIES.flatMap((c) => c.types.map((t) => ({ ...t, category: c.key })));
const LEGACY_TYPE_MAP = {
  birthday: "birthday-party",
  party: "house-party",
  anniversary: "anniversary",
  pooja: "satyanarayan-pooja",
  dinner: "weekend-get-together",
  kitty: "kitty-party",
  baby_shower: "baby-shower",
  reunion: "family-reunion",
};
const prettifyType = (s) => (s ? String(s).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
const categoryOfType = (typeKey) => ALL_TYPES.find((t) => t.key === typeKey)?.category;

const FOOD_PREFS = ["", "veg", "non-veg", "jain", "vegan", "eggless", "custom"];

// Dress-code presets the host can pick; "" = none, "custom" lets them type their own.
const DRESS_CODES = [
  "", "Casual", "Traditional", "Formal", "Ethnic", "Theme Party",
  "Color Theme", "White Party", "Black & Gold", "Bollywood Theme", "custom",
];
const AGE_RESTRICTIONS = ["", "All ages", "Adults only", "18+", "21+", "Kids welcome"];

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

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const { requestLocation } = useGeolocation({ autoRequest: false });
  const [form, setForm] = useState({
    title: "", hostName: "", eventCategory: "celebration", eventType: "birthday-party",
    eventDates: [""], endAt: "", venue: "", venueLat: null, venueLng: null,
    description: "", dressCode: "", dressCodePreset: "", foodPref: "",
    guestLimit: "", maxPerInvitee: "", rsvpDeadline: "",
    parkingInfo: "", kidsAllowed: false, plusOneAllowed: false, ageRestriction: "",
    askParking: true, askAccommodation: true, askSong: true, askDrink: false,
    hostMessage: "", coverImages: [], hostAudio: "", isPublic: false, contributionAmount: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      const r = await rybboSocialService.getEvent(id);
      if (cancelled) return;
      if (!r.success) { setLoadError(r.message || "Could not load event"); setLoading(false); return; }
      const e = r.data || {};
      // Resolve stored eventType to a known sub-type (handle legacy flat values),
      // then derive its main category.
      const rawType = e.eventType || "";
      const resolvedType = ALL_TYPES.some((t) => t.key === rawType)
        ? rawType
        : (LEGACY_TYPE_MAP[rawType] || rawType);
      const resolvedCategory = e.eventCategory || categoryOfType(resolvedType) || "celebration";
      const dressCode = e.dressCode || "";
      setForm({
        title: e.title || "",
        hostName: e.hostName || "",
        eventCategory: resolvedCategory,
        eventType: resolvedType,
        // Prefer multi-date array; fall back to legacy single eventAt. ISO → "YYYY-MM-DDTHH:mm"
        eventDates: (Array.isArray(e.eventDates) && e.eventDates.length
          ? e.eventDates
          : [e.eventAt || ""]).map((d) => (d || "").slice(0, 16)),
        endAt: (e.endAt || "").slice(0, 16),
        venue: e.venue || "",
        venueLat: e.venueLat != null ? e.venueLat : null,
        venueLng: e.venueLng != null ? e.venueLng : null,
        description: e.description || "",
        dressCode,
        // If the stored dress code matches a preset, preselect it; else treat as custom.
        dressCodePreset: dressCode ? (DRESS_CODES.includes(dressCode) ? dressCode : "custom") : "",
        foodPref: e.foodPref || "",
        guestLimit: e.guestLimit != null ? String(e.guestLimit) : "",
        maxPerInvitee: e.maxPerInvitee != null ? String(e.maxPerInvitee) : "",
        rsvpDeadline: (e.rsvpDeadline || "").slice(0, 16),
        parkingInfo: e.parkingInfo || "",
        kidsAllowed: Boolean(e.kidsAllowed),
        plusOneAllowed: Boolean(e.plusOneAllowed),
        askParking: e.askParking !== false,
        askAccommodation: e.askAccommodation !== false,
        askSong: e.askSong !== false,
        askDrink: e.askDrink === true,
        ageRestriction: e.ageRestriction || "",
        hostMessage: e.hostMessage || "",
        // Prefer multi-image array; fall back to legacy single coverImage.
        coverImages: (Array.isArray(e.coverImages) && e.coverImages.length
          ? e.coverImages
          : [e.coverImage].filter(Boolean)).slice(0, MAX_IMAGES),
        hostAudio: e.hostAudio || "",
        isPublic: Boolean(e.isPublic),
        contributionAmount: e.contributionAmount != null ? String(e.contributionAmount) : "",
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Switching main category resets the sub-type to that category's first option.
  const pickCategory = (catKey) => setForm((p) => {
    const cat = EVENT_CATEGORIES.find((c) => c.key === catKey);
    return { ...p, eventCategory: catKey, eventType: cat?.types[0]?.key || "" };
  });

  const setDateAt = (i, v) => setForm((p) => {
    const dates = [...p.eventDates];
    dates[i] = v;
    return { ...p, eventDates: dates };
  });
  const addDate = () => setForm((p) => ({ ...p, eventDates: [...p.eventDates, ""] }));
  const removeDate = (i) => setForm((p) => ({
    ...p,
    eventDates: p.eventDates.length > 1 ? p.eventDates.filter((_, idx) => idx !== i) : p.eventDates,
  }));

  // Venue picked from the map/search sheet → store address + coords.
  const handlePickPlace = (place) => {
    setForm((p) => ({
      ...p,
      venue: place.full || place.label || p.venue,
      venueLat: place.lat ?? null,
      venueLng: place.lng ?? null,
    }));
  };
  // "Use my current location" → GPS, then reverse-geocode to an address.
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const c = await requestLocation();
      if (c?.lat) {
        const addr = await reverseGeocodeAddress(c.lat, c.lng).catch(() => "");
        setForm((p) => ({ ...p, venue: addr || p.venue, venueLat: c.lat, venueLng: c.lng }));
      }
    } catch { showToast("Could not get your location", "error"); }
    finally { setLocating(false); }
  };

  // Read one file → base64 data URI.
  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });


  const submit = async () => {
    if (!form.title.trim()) { showToast("Please enter an event name", "error"); return; }
    const dates = form.eventDates.map((d) => (d || "").trim()).filter(Boolean);
    if (!dates.length) { showToast("Please pick at least one date & time", "error"); return; }
    const uniqueDates = [...new Set(dates)].sort();
    // Resolve the dress code: a named preset wins; "custom" uses the typed value.
    const dressCode = form.dressCodePreset === "custom"
      ? (form.dressCode.trim() || null)
      : (form.dressCodePreset || null);
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      hostName: form.hostName.trim() || null,
      eventCategory: form.eventCategory,
      eventType: form.eventType,
      eventAt: uniqueDates[0],        // earliest date — legacy single-date field
      eventDates: uniqueDates,        // full recurring set
      endAt: form.endAt || null,
      venue: form.venue.trim() || null,
      venueLat: form.venueLat ?? null,
      venueLng: form.venueLng ?? null,
      description: form.description.trim() || null,
      dressCode,
      foodPref: form.foodPref || null,
      guestLimit: form.guestLimit ? Number(form.guestLimit) : null,
      maxPerInvitee: form.maxPerInvitee ? Number(form.maxPerInvitee) : null,
      rsvpDeadline: form.rsvpDeadline || null,
      parkingInfo: form.parkingInfo.trim() || null,
      kidsAllowed: form.kidsAllowed,
      plusOneAllowed: form.plusOneAllowed,
      askParking: form.askParking,
      askAccommodation: form.askAccommodation,
      askSong: form.askSong,
      askDrink: form.askDrink,
      ageRestriction: form.ageRestriction || null,
      hostMessage: form.hostMessage.trim() || null,
      coverImages: form.coverImages,
      coverImage: form.coverImages[0] || null,   // legacy single-image field
      hostAudio: form.hostAudio || null,
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
          {/* Cover image is now added later from the event dashboard's "Create & upload invite banner". */}
          <div>
            <label style={labelStyle}>Event name *</label>
            <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Aarav's 5th Birthday" />
          </div>

          <div>
            <label style={labelStyle}>Host name (optional)</label>
            <input style={inputStyle} value={form.hostName} onChange={(e) => set("hostName", e.target.value)} placeholder="Shown on the invite — e.g. The Sharma Family" />
          </div>

          <div>
            <label style={labelStyle}>Event category</label>
            <select style={inputStyle} value={form.eventCategory} onChange={(e) => pickCategory(e.target.value)}>
              {EVENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Event type</label>
            <select style={inputStyle} value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
              {(() => {
                const cat = EVENT_CATEGORIES.find((c) => c.key === form.eventCategory) || EVENT_CATEGORIES[0];
                let opts = cat.types;
                if (form.eventType && !opts.some((t) => t.key === form.eventType)) {
                  opts = [{ key: form.eventType, label: prettifyType(form.eventType) }, ...opts];
                }
                return opts.map((t) => <option key={t.key} value={t.key}>{t.label}</option>);
              })()}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Date & time *</label>
            <div style={{ display: "grid", gap: 8 }}>
              {form.eventDates.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input style={{ ...inputStyle, flex: 1 }} type="datetime-local" value={d} onChange={(e) => setDateAt(i, e.target.value)} />
                  {form.eventDates.length > 1 && (
                    <button type="button" onClick={() => removeDate(i)} aria-label="Remove date"
                      style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)", color: "var(--cm-muted, #6B7280)", cursor: "pointer" }}>
                      <FaTimes />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addDate}
              style={{ marginTop: 8, background: "transparent", border: "none", color: ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>
              + Add another date
            </button>
            <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 4 }}>
              Add multiple dates for a recurring or multi-day event.
            </div>
          </div>

          <div>
            <label style={labelStyle}>End time (optional)</label>
            <input style={inputStyle} type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Venue / location</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Address or landmark" />
              <button type="button" onClick={() => setPickerOpen(true)} aria-label="Pick on map"
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <FaMapMarkerAlt /> Map
              </button>
            </div>
            {form.venueLat != null && form.venueLng != null && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${form.venueLat},${form.venueLng}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: ACCENT, fontWeight: 600 }}>
                View on Google Maps
              </a>
            )}
          </div>

          <div>
            <label style={labelStyle}>Parking details (optional)</label>
            <input style={inputStyle} value={form.parkingInfo} onChange={(e) => set("parkingInfo", e.target.value)} placeholder="e.g. Basement parking available, or street parking only" />
          </div>

          <div>
            <label style={labelStyle}>Event description (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Tell guests what to expect — agenda, programme, what to bring…" />
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

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Max guests per invitee</label>
              <input style={inputStyle} type="number" min="1" value={form.maxPerInvitee} onChange={(e) => set("maxPerInvitee", e.target.value)} placeholder="No limit" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>RSVP deadline (optional)</label>
              <input style={inputStyle} type="datetime-local" value={form.rsvpDeadline} onChange={(e) => set("rsvpDeadline", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Dress code (optional)</label>
            <select style={inputStyle} value={form.dressCodePreset} onChange={(e) => set("dressCodePreset", e.target.value)}>
              {DRESS_CODES.map((d) => (
                <option key={d || "none"} value={d}>{d === "custom" ? "Custom…" : (d || "None")}</option>
              ))}
            </select>
            {form.dressCodePreset === "custom" && (
              <input style={{ ...inputStyle, marginTop: 8 }} value={form.dressCode} onChange={(e) => set("dressCode", e.target.value)} placeholder="Describe the dress code / theme" />
            )}
          </div>

          <div>
            <label style={labelStyle}>Age restriction (optional)</label>
            <select style={inputStyle} value={form.ageRestriction} onChange={(e) => set("ageRestriction", e.target.value)}>
              {AGE_RESTRICTIONS.map((a) => <option key={a || "none"} value={a}>{a || "None"}</option>)}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={form.kidsAllowed} onChange={(e) => set("kidsAllowed", e.target.checked)} />
            Kids are welcome at this event
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={form.plusOneAllowed} onChange={(e) => set("plusOneAllowed", e.target.checked)} />
            Guests may bring a plus-one
          </label>

          {/* Host picks which optional questions guests answer on the invite */}
          <div>
            <label style={labelStyle}>Ask guests on the invite</label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
              <input type="checkbox" checked={form.askParking} onChange={(e) => set("askParking", e.target.checked)} />
              Will you need parking?
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
              <input type="checkbox" checked={form.askAccommodation} onChange={(e) => set("askAccommodation", e.target.checked)} />
              Will you need accommodation?
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
              <input type="checkbox" checked={form.askSong} onChange={(e) => set("askSong", e.target.checked)} />
              Song request
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
              <input type="checkbox" checked={form.askDrink} onChange={(e) => set("askDrink", e.target.checked)} />
              Will you have drinks (alcohol)?
            </label>
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

          <div>
            <label style={labelStyle}>Voice note for guests (optional)</label>
            <HostAudioField value={form.hostAudio} onChange={(v) => set("hostAudio", v)} showToast={showToast} readFile={readFile} />
            <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 4 }}>
              Record or upload a short clip — it plays automatically on the invitation (guests can mute it).
            </div>
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

      <LocationPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickPlace}
        onUseCurrent={handleUseCurrentLocation}
        currentLabel={form.venue || undefined}
        allowFreeText
      />
      {locating && <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", color: "#fff", fontWeight: 700 }}>Getting location…</div>}
    </DataState>
  );
};

/**
 * Host voice-note control: record from the mic (MediaRecorder) or upload an audio
 * file. Stores the clip as a base64 data-URI in `value`; shows a preview player
 * with a remove button once a clip exists.
 */
const HostAudioField = ({ value, onChange, showToast, readFile }) => {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioInputRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const canRecord = typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia && typeof window !== "undefined" && window.MediaRecorder;

  const cleanupStream = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Stop any in-flight recording / release the mic when the field unmounts.
  useEffect(() => () => { try { recorderRef.current?.stop(); } catch { /* ignore */ } cleanupStream(); }, []);

  const stopRecording = () => { try { recorderRef.current?.stop(); } catch { /* ignore */ } };

  const startRecording = async () => {
    if (!canRecord) { showToast("Recording isn't supported on this device — try Upload", "error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => { if (ev.data?.size) chunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        cleanupStream();
        setRecording(false);
        setElapsed(0);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) return;
        if (blob.size > MAX_AUDIO_BYTES) { showToast("Recording is too long — keep it under 3 MB", "error"); return; }
        onChange(await readFile(blob));
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_AUDIO_SECONDS) { stopRecording(); return MAX_AUDIO_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch {
      showToast("Microphone permission denied", "error");
      cleanupStream();
    }
  };

  const onUploadAudio = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) { showToast("Please pick an audio file", "error"); return; }
    if (file.size > MAX_AUDIO_BYTES) { showToast("Audio must be under 3 MB", "error"); return; }
    onChange(await readFile(file));
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)" }}>
        <audio src={value} controls style={{ flex: 1, height: 40, minWidth: 0 }} />
        <button type="button" onClick={() => onChange("")} aria-label="Remove audio"
          style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FaTrash size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" onClick={recording ? stopRecording : startRecording}
        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: `1px solid ${recording ? "#ef4444" : ACCENT}`, background: recording ? "#fef2f2" : "transparent", color: recording ? "#ef4444" : ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
        {recording ? <><FaStop /> Stop · {fmtTime(elapsed)}</> : <><FaMicrophone /> Record</>}
      </button>
      <button type="button" onClick={() => audioInputRef.current?.click()} disabled={recording}
        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "var(--cm-ink, inherit)", fontWeight: 700, fontSize: 13, cursor: recording ? "default" : "pointer", opacity: recording ? 0.5 : 1 }}>
        <FaUpload /> Upload
      </button>
      <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={(e) => { onUploadAudio(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
};

export default CreateEventScreen;
