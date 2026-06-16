import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaImage, FaTimes, FaMapMarkerAlt, FaCrosshairs, FaPlus, FaTicketAlt, FaExternalLinkAlt, FaSearch, FaSpinner, FaMagic } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import { useToast } from "../../context/ToastContext";
import { buildBannerAiUrl, buildCanvaPrompt, CANVA_BANNER_URL } from "../../services/rybboSocialService";

const MAX_BANNER_BYTES = 2 * 1024 * 1024; // 2 MB

const newTicketCategory = (rows = []) => ({
  id: `tc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: "", price: "", seats: "", entryGate: "", rows,
});

// Row label by index: 0 → "A", 1 → "B" … 25 → "Z".
const ALPHA = (i) => String.fromCharCode(65 + i);

// Total seats across a row-based tier's explicit rows. Tolerates legacy/non-array
// `rows` shapes (e.g. a saved { start, end, seatsPerRow } object) by normalising first.
const tierRowSeats = (tc) =>
  (Array.isArray(tc.rows) ? tc.rows : loadTierRows(tc)).reduce((s, r) => s + num(r.seats, 0), 0);

// Row labels already claimed by OTHER tiers — a row can belong to only one tier.
const rowsUsedByOtherTiers = (categories, idx) => {
  const used = new Set();
  (categories || []).forEach((c, i) => {
    if (i === idx) return;
    (c.rows || []).forEach((r) => r.label && used.add(String(r.label).toUpperCase()));
  });
  return used;
};

// Normalise a saved tier into the explicit rows array, accepting both the new
// array shape and the legacy { start, end, seatsPerRow } range shape.
const loadTierRows = (t) => {
  if (Array.isArray(t.rows)) {
    return t.rows.map((r) => ({ label: String(r.label || "").toUpperCase(), seats: String(r.seats ?? "") }));
  }
  if (Array.isArray(t.rows?.list)) {
    return t.rows.list.map((r) => ({ label: String(r.label || "").toUpperCase(), seats: String(r.seats ?? "") }));
  }
  if (t.rows?.start || t.rowStart) {
    const per = String(t.rows?.seatsPerRow ?? t.seatsPerRow ?? "20");
    return rowLetters(t.rows?.start ?? t.rowStart, t.rows?.end ?? t.rowEnd ?? t.rows?.start ?? t.rowStart)
      .map((label) => ({ label, seats: per }));
  }
  return [];
};

// First A–Z label not used by this tier or any other tier (null if all 26 taken).
const nextFreeRow = (categories, idx) => {
  const used = rowsUsedByOtherTiers(categories, idx);
  (categories[idx]?.rows || []).forEach((r) => r.label && used.add(String(r.label).toUpperCase()));
  for (let i = 0; i < 26; i++) if (!used.has(ALPHA(i))) return ALPHA(i);
  return null;
};

// Selectable row letters for one row: free letters + this row's own current label.
const availableRowOptions = (categories, idx, currentLabel) => {
  const used = rowsUsedByOtherTiers(categories, idx);
  (categories[idx]?.rows || []).forEach((r) => {
    const l = String(r.label || "").toUpperCase();
    if (l && l !== String(currentLabel || "").toUpperCase()) used.add(l);
  });
  const opts = [];
  for (let i = 0; i < 26; i++) if (!used.has(ALPHA(i))) opts.push(ALPHA(i));
  return opts;
};

const empty = {
  organizerName: "", contactEmail: "", contactMobile: "",
  title: "", category: "events", city: "",
  expectedDate: "", description: "", bannerImage: "",
  venueName: "", venueAddress: "", venueLat: "", venueLng: "",
  totalCapacity: "",
  seatingType: "GENERAL_ADMISSION",
  quickSetup: false,
  tableCount: "",
  seatsPerTable: "8",
  blockedSeats: "",
  reservedSeats: "",
  unavailableSeats: "",
  complimentaryEnabled: false,
  complimentaryLimit: "",
  complimentaryApprovalMode: "HOST_DIRECT",
  complimentaryGuests: [],
  complimentaryTeamMembers: [],
  complimentaryTeamDraft: { name: "", mobile: "" },
  complimentaryDraft: {
    name: "", mobile: "", email: "", qty: "1", ticketType: "VIP Complimentary", ticketCategory: "", remarks: "",
  },
  ticketCategories: [],
};

const SEATING_TYPES = [
  { value: "GENERAL_ADMISSION", title: "General Admission", note: "Open entry with only capacity count." },
  { value: "ZONE_BASED", title: "Zone Based", note: "VIP, Gold, Silver, General style booking." },
  { value: "ROW_BASED", title: "Row Based", note: "Rows and seat numbers auto-generated." },
  { value: "TABLE_SEATING", title: "Table Seating", note: "Tables with seats for dinners and weddings." },
];

const STATUS_COLORS = {
  available: "#22c55e",
  blocked: "#64748b",
  reserved: "#F59E0B",
  unavailable: "#ef4444",
  sold: "#7C3AED",
};

const COMPLIMENTARY_TYPES = [
  "VIP Complimentary",
  "Gold Complimentary",
  "General Complimentary",
  "Backstage Pass",
  "Artist / Crew Pass",
];

const newComplimentaryGuest = (draft, index, status = "Generated") => ({
  id: `comp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  ticketId: `RYC-${Date.now().toString().slice(-6)}-${index + 1}`,
  name: draft.name.trim(),
  mobile: draft.mobile.trim(),
  email: draft.email.trim(),
  qty: Math.max(1, num(draft.qty, 1)),
  ticketType: draft.ticketType || "VIP Complimentary",
  ticketCategory: draft.ticketCategory || draft.ticketType || "VIP Complimentary",
  remarks: draft.remarks.trim(),
  status,
  shareChannels: ["WhatsApp", "SMS"],
  seatOrZone: draft.ticketCategory || draft.ticketType || "VIP Complimentary",
  issuedAt: new Date().toISOString(),
});

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const num = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csvTokens = (value) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);

const rowLetters = (start = "A", end = "A") => {
  const a = Math.max(65, String(start || "A").toUpperCase().charCodeAt(0));
  const b = Math.max(a, String(end || start || "A").toUpperCase().charCodeAt(0));
  return Array.from({ length: Math.min(26, b - a + 1) }, (_, i) => String.fromCharCode(a + i));
};

const estimateCategorySeats = (tc, seatingType) => {
  if (seatingType === "ROW_BASED") {
    return tierRowSeats(tc);
  }
  return num(tc.seats, 0);
};

const totalCategorySeats = (categories, seatingType) =>
  (categories || []).reduce((sum, tc) => sum + estimateCategorySeats(tc, seatingType), 0);

const complimentaryIssuedQty = (guests = []) =>
  guests.reduce((sum, guest) => sum + num(guest.qty, 0), 0);

const buildComplimentarySettings = (form) => ({
  enabled: Boolean(form.complimentaryEnabled),
  limit: num(form.complimentaryLimit, 0),
  issuedTickets: complimentaryIssuedQty(form.complimentaryGuests),
  unusedTickets: Math.max(0, num(form.complimentaryLimit, 0) - complimentaryIssuedQty(form.complimentaryGuests)),
  scannedTickets: (form.complimentaryGuests || []).filter((guest) => guest.status === "Used / Scanned").length,
  cancelledTickets: (form.complimentaryGuests || []).filter((guest) => guest.status === "Cancelled").length,
  approvalMode: form.complimentaryApprovalMode,
  teamMembers: (form.complimentaryTeamMembers || []).map((m) => ({
    id: m.id,
    name: String(m.name || "").trim(),
    mobile: String(m.mobile || "").trim(),
  })),
  guests: (form.complimentaryGuests || []).map((guest) => ({
    ...guest,
    issuedBy: form.organizerName || "Host",
    revenueType: "COMPLIMENTARY",
    affectsRevenue: false,
    reducesCapacity: true,
  })),
  shareOptions: ["WhatsApp", "SMS", "Email", "Download PDF", "Copy Link"],
  statuses: ["Generated", "Shared", "Accepted", "Used / Scanned", "Cancelled", "Expired"],
  reportColumns: ["Guest Name", "Mobile", "Ticket Type", "Seat / Zone", "Issued By", "Shared Date", "Scan Status", "Entry Time"],
});

const enrichTicketCategories = (form) => {
  const seatingType = form.seatingType || "GENERAL_ADMISSION";
  const categories = (form.ticketCategories || []).length
    ? form.ticketCategories
    : [{ ...newTicketCategory(), name: "General", price: "0", seats: form.totalCapacity || "0" }];
  const complimentary = buildComplimentarySettings(form);
  return categories.map((tc) => ({
    ...tc,
    seatingType,
    complimentary,
    entryGate: tc.entryGate || "",
    rows: seatingType === "ROW_BASED"
      ? (tc.rows || []).map((r) => ({ label: String(r.label || "").toUpperCase(), seats: num(r.seats, 0) }))
      : null,
    tables: seatingType === "TABLE_SEATING" ? { tableCount: num(form.tableCount, 0), seatsPerTable: num(form.seatsPerTable, 0) } : null,
    blockedSeats: csvTokens(form.blockedSeats),
    reservedSeats: csvTokens(form.reservedSeats),
    unavailableSeats: csvTokens(form.unavailableSeats),
    seats: estimateCategorySeats(tc, seatingType) || num(tc.seats, 0),
  }));
};

const buildSubmitPayload = (form) => ({
  ...form,
  // Send null (not "") for empty dates so the backend's LocalDate parser doesn't
  // throw "Text '' could not be parsed at index 0".
  expectedDate: form.expectedDate ? form.expectedDate : null,
  totalCapacity: num(form.totalCapacity, 0),
  ticketCategories: enrichTicketCategories(form),
});

// Mandatory fields — checked client-side so the user gets a clear toast + red
// highlight instead of a raw backend error.
const REQUIRED_FIELDS = [
  { key: "organizerName", label: "Organizer name" },
  { key: "contactMobile", label: "Contact mobile" },
  { key: "title", label: "Show title" },
  { key: "city", label: "City" },
  { key: "expectedDate", label: "Event Date" },
];

const validateForm = (form) => {
  const missing = REQUIRED_FIELDS.filter((f) => !String(form[f.key] || "").trim());
  if (missing.length === 0) return { fields: [], message: "" };
  const message =
    missing.length === 1
      ? `${missing[0].label} is required.`
      : `Please fill the required fields: ${missing.map((f) => f.label).join(", ")}.`;
  return { fields: missing.map((f) => f.key), message };
};

const buildPreviewSeats = (form) => {
  const blocked = new Set(csvTokens(form.blockedSeats));
  const reserved = new Set(csvTokens(form.reservedSeats));
  const unavailable = new Set(csvTokens(form.unavailableSeats));
  const mark = (label) => {
    if (blocked.has(label)) return "blocked";
    if (reserved.has(label)) return "reserved";
    if (unavailable.has(label)) return "unavailable";
    return "available";
  };

  if (form.seatingType === "TABLE_SEATING") {
    const tables = Math.min(num(form.tableCount, 0), 8);
    const seatsPerTable = Math.min(num(form.seatsPerTable, 0), 12);
    return Array.from({ length: tables }, (_, t) => ({
      label: `Table ${t + 1}`,
      seats: Array.from({ length: seatsPerTable }, (_, s) => {
        const label = `T${t + 1}-${s + 1}`;
        return { label, status: mark(label) };
      }),
    }));
  }

  if (form.seatingType === "ROW_BASED") {
    // Merge each tier's explicit rows so every configured row shows up.
    const rowMap = new Map();
    (form.ticketCategories || []).forEach((tc) => {
      (tc.rows || []).forEach((r) => {
        const label = String(r.label || "").toUpperCase();
        if (!label || rowMap.has(label)) return;
        rowMap.set(label, Math.min(num(r.seats, 20), 24));
      });
    });
    const rows = Array.from(rowMap.keys()).sort().slice(0, 12);
    return rows.map((row) => ({
      label: row,
      seats: Array.from({ length: rowMap.get(row) }, (_, i) => {
        const label = `${row}${i + 1}`;
        return { label, status: mark(label) };
      }),
    }));
  }

  return (form.ticketCategories || []).map((tc, idx) => ({
    label: tc.name || `Zone ${idx + 1}`,
    seats: Array.from({ length: Math.min(num(tc.seats, 0), 24) }, (_, i) => {
      const label = `${(tc.name || `Z${idx + 1}`).replace(/\s+/g, "").toUpperCase()}-${i + 1}`;
      return { label, status: mark(label) };
    }),
  }));
};

const ListYourShowScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const editIdFromUrl = searchParams.get("edit");
  const [form, setForm] = useState(empty);
  const [invalidFields, setInvalidFields] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  // Surface all errors as a toast. setError("") is a no-op (used to clear old inline state).
  const setError = (msg) => { if (msg) showToast(msg, "error"); };
  const [submitting, setSubmitting] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [creativeStep, setCreativeStep] = useState(null);
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
    const first = tcs[0] || {};
    const seatingType = str(first.seatingType || s.seatingType || s.seating_type || "GENERAL_ADMISSION");
    const complimentary = first.complimentary || {};
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
      totalCapacity: s.totalCapacity ?? s.total_capacity ?? totalCategorySeats(tcs, seatingType) ?? "",
      seatingType,
      quickSetup: false,
      tableCount: first.tables?.tableCount ?? first.tableCount ?? "",
      seatsPerTable: first.tables?.seatsPerTable ?? first.seatsPerTable ?? "8",
      blockedSeats: Array.isArray(first.blockedSeats) ? first.blockedSeats.join(", ") : "",
      reservedSeats: Array.isArray(first.reservedSeats) ? first.reservedSeats.join(", ") : "",
      unavailableSeats: Array.isArray(first.unavailableSeats) ? first.unavailableSeats.join(", ") : "",
      complimentaryEnabled: Boolean(complimentary.enabled),
      complimentaryLimit: complimentary.limit ?? "",
      complimentaryApprovalMode: complimentary.approvalMode || "HOST_DIRECT",
      complimentaryGuests: Array.isArray(complimentary.guests) ? complimentary.guests : [],
      complimentaryTeamMembers: Array.isArray(complimentary.teamMembers)
        ? complimentary.teamMembers.map((m, i) => ({ id: m.id || `tm_edit_${i}`, name: str(m.name), mobile: str(m.mobile) }))
        : [],
      complimentaryTeamDraft: { name: "", mobile: "" },
      complimentaryDraft: {
        name: "", mobile: "", email: "", qty: "1", ticketType: "VIP Complimentary", ticketCategory: "", remarks: "",
      },
      ticketCategories: tcs.map((t, i) => ({
        id: t.id || `tc_edit_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: str(t.name),
        price: t.price ?? "",
        seats: t.seats ?? "",
        entryGate: str(t.entryGate),
        rows: loadTierRows(t),
      })),
    });
    setError(""); setSuccess(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null); setEditingStatus(null); setForm(empty); setError("");
  };

  const showPromptEvent = (source = form) => ({
    title: source.title,
    hostName: source.organizerName,
    date: source.expectedDate,
    time: "",
    venue: source.venueName || source.venueAddress || source.city,
  });

  const openPosterStep = (submissionId = editingId, source = form) => {
    if (!submissionId) {
      setError("Save the show details first, then upload or create the poster.");
      return;
    }
    setCreativeStep({ id: submissionId, form: source, bannerImage: source.bannerImage || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setError("");
    const { fields, message } = validateForm(form);
    if (fields.length) {
      setInvalidFields(new Set(fields));
      showToast(message, "error");
      return;
    }
    setInvalidFields(new Set());
    setSubmitting(true);
    const payload = buildSubmitPayload(form);
    const r = editingId
      ? await rybboService.updateShow(editingId, payload)
      : await rybboService.submitShow(payload);
    setSubmitting(false);
    if (!r.success) { showToast(r.message || "Submission failed", "error"); return; }
    const submissionId = r.data?.id || editingId;
    setSuccess(true); loadMine();
    if (submissionId) {
      setEditingId(submissionId);
      setEditingStatus("PENDING");
      openPosterStep(submissionId, { ...form, bannerImage: payload.bannerImage || "" });
    } else {
      setForm(empty); setEditingId(null); setEditingStatus(null);
    }
    setTimeout(() => setSuccess(false), 3500);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete submission "${s.title}"? This cannot be undone.`)) return;
    const r = await rybboService.deleteShow(s.id);
    if (!r.success) { setError(r.message || "Delete failed"); return; }
    if (editingId === s.id) cancelEdit();
    loadMine();
  };

  const set = (k) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [k]: value }));
    if (value && value.trim && value.trim()) {
      setInvalidFields((prev) => {
        if (!prev.has(k)) return prev;
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  };

  // Host taps a seat in the preview to block/unblock it. Reserved / unavailable /
  // sold seats are left untouched — only available <-> blocked toggles.
  const toggleBlockSeat = (seat) => {
    if (!seat || (seat.status !== "available" && seat.status !== "blocked")) return;
    const label = String(seat.label).trim().toUpperCase();
    setForm((f) => {
      const tokens = csvTokens(f.blockedSeats);
      const next = tokens.includes(label)
        ? tokens.filter((t) => t !== label)
        : [...tokens, label];
      return { ...f, blockedSeats: next.join(", ") };
    });
  };

  const fileInputRef = useRef(null);
  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > MAX_BANNER_BYTES) { setError("Banner must be 2 MB or less."); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      const submissionId = creativeStep?.id || editingId;
      if (submissionId) {
        setSavingBanner(true);
        const r = await rybboService.updateShow(submissionId, { bannerImage: dataUrl });
        setSavingBanner(false);
        if (!r.success) { setError(r.message || "Could not save poster image."); return; }
      }
      setForm((f) => ({ ...f, bannerImage: dataUrl }));
      setCreativeStep((p) => p ? { ...p, bannerImage: dataUrl, form: { ...p.form, bannerImage: dataUrl } } : p);
      setError("");
    } catch {
      setSavingBanner(false);
      setError("Could not read the image. Try another file.");
    }
  };
  const clearBanner = async () => {
    const submissionId = creativeStep?.id || editingId;
    if (submissionId) {
      setSavingBanner(true);
      const r = await rybboService.updateShow(submissionId, { bannerImage: "" });
      setSavingBanner(false);
      if (!r.success) { setError(r.message || "Could not remove poster image."); return; }
    }
    setForm((f) => ({ ...f, bannerImage: "" }));
    setCreativeStep((p) => p ? { ...p, bannerImage: "", form: { ...p.form, bannerImage: "" } } : p);
  };

  const openCanvaForShow = async () => {
    try {
      await navigator.clipboard.writeText(buildCanvaPrompt(showPromptEvent(creativeStep?.form || form), ""));
      setError("");
    } catch {
      setError("Could not copy Canva prompt. You can still open Canva and type your own prompt.");
    }
    window.open(CANVA_BANNER_URL, "_blank", "noopener,noreferrer");
  };

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
    setForm((f) => {
      const cats = f.ticketCategories || [];
      // For row-based tiers seed one free row so a new tier never reuses an existing row.
      let rows = [];
      if (f.seatingType === "ROW_BASED") {
        const free = nextFreeRow([...cats, { rows: [] }], cats.length);
        rows = free ? [{ label: free, seats: "20" }] : [];
      }
      return { ...f, ticketCategories: [...cats, newTicketCategory(rows)] };
    });
  const updateTicketCategory = (id, key, value) =>
    setForm((f) => ({
      ...f,
      ticketCategories: f.ticketCategories.map((tc) => tc.id === id ? { ...tc, [key]: value } : tc),
    }));
  // ── Per-tier row editing (row-based seating) ──
  const addRowToTier = (id) =>
    setForm((f) => {
      const cats = f.ticketCategories;
      const idx = cats.findIndex((tc) => tc.id === id);
      if (idx < 0) return f;
      const free = nextFreeRow(cats, idx);
      if (!free) { setError("All rows A–Z are already assigned to a tier."); return f; }
      const rows = [...(cats[idx].rows || []), { label: free, seats: "20" }];
      return { ...f, ticketCategories: cats.map((tc, i) => i === idx ? { ...tc, rows } : tc) };
    });
  const removeRowFromTier = (id, rowIndex) =>
    setForm((f) => ({
      ...f,
      ticketCategories: f.ticketCategories.map((tc) =>
        tc.id === id ? { ...tc, rows: (tc.rows || []).filter((_, i) => i !== rowIndex) } : tc),
    }));
  const updateRowField = (id, rowIndex, key, value) =>
    setForm((f) => ({
      ...f,
      ticketCategories: f.ticketCategories.map((tc) =>
        tc.id === id ? { ...tc, rows: (tc.rows || []).map((r, i) => i === rowIndex ? { ...r, [key]: value } : r) } : tc),
    }));
  const removeTicketCategory = (id) =>
    setForm((f) => ({ ...f, ticketCategories: f.ticketCategories.filter((tc) => tc.id !== id) }));
  const setSeatingType = (type) =>
    setForm((f) => ({
      ...f,
      seatingType: type,
      ticketCategories: f.ticketCategories.length ? f.ticketCategories : [
        { ...newTicketCategory(type === "ROW_BASED" ? [{ label: "A", seats: "20" }, { label: "B", seats: "20" }] : []), name: type === "GENERAL_ADMISSION" ? "General" : "VIP", price: type === "GENERAL_ADMISSION" ? "0" : "999", seats: type === "ROW_BASED" ? "" : "100", entryGate: type === "ZONE_BASED" ? "Gate 1" : "" },
        ...(type === "ZONE_BASED" ? [
          { ...newTicketCategory(), name: "Gold", price: "699", seats: "200", entryGate: "Gate 2" },
          { ...newTicketCategory(), name: "Silver", price: "399", seats: "200", entryGate: "Gate 3" },
        ] : []),
      ],
    }));
  const applyQuickSetup = () =>
    setForm((f) => {
      const capacity = num(f.totalCapacity, 500);
      const vip = Math.max(1, Math.round(capacity * 0.2));
      const gold = Math.max(1, Math.round(capacity * 0.4));
      const silver = Math.max(0, capacity - vip - gold);
      return {
        ...f,
        quickSetup: true,
        seatingType: "ZONE_BASED",
        totalCapacity: String(capacity),
        ticketCategories: [
          { ...newTicketCategory(), name: "VIP", price: "999", seats: String(vip), entryGate: "Gate A" },
          { ...newTicketCategory(), name: "Gold", price: "699", seats: String(gold), entryGate: "Gate B" },
          { ...newTicketCategory(), name: "Silver", price: "399", seats: String(silver), entryGate: "Gate C" },
        ],
      };
    });
  const setComplimentaryDraft = (key, value) =>
    setForm((f) => ({ ...f, complimentaryDraft: { ...f.complimentaryDraft, [key]: value } }));
  // ── Team members (for "Team member requests, host approves" mode) ──
  const setTeamDraft = (key, value) =>
    setForm((f) => ({ ...f, complimentaryTeamDraft: { ...(f.complimentaryTeamDraft || { name: "", mobile: "" }), [key]: value } }));
  const addTeamMember = () =>
    setForm((f) => {
      const draft = f.complimentaryTeamDraft || { name: "", mobile: "" };
      const name = draft.name.trim();
      const mobile = draft.mobile.trim();
      if (!name || !mobile) { setError("Team member name and mobile are required."); return f; }
      const members = f.complimentaryTeamMembers || [];
      if (members.some((m) => String(m.mobile).trim() === mobile)) {
        setError("This mobile number is already added as a team member.");
        return f;
      }
      return {
        ...f,
        complimentaryTeamMembers: [...members, { id: `tm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, mobile }],
        complimentaryTeamDraft: { name: "", mobile: "" },
      };
    });
  const removeTeamMember = (id) =>
    setForm((f) => ({ ...f, complimentaryTeamMembers: (f.complimentaryTeamMembers || []).filter((m) => m.id !== id) }));
  const addComplimentaryGuest = () =>
    setForm((f) => {
      const draft = f.complimentaryDraft || empty.complimentaryDraft;
      if (!draft.name.trim() || !draft.mobile.trim()) {
        setError("Complimentary guest name and mobile are required.");
        return f;
      }
      const nextQty = complimentaryIssuedQty(f.complimentaryGuests) + Math.max(1, num(draft.qty, 1));
      const limit = num(f.complimentaryLimit, 0);
      if (limit > 0 && nextQty > limit) {
        setError("Complimentary ticket limit exceeded.");
        return f;
      }
      setError("");
      // In "Team member requests, host approves" mode new entries start as a
      // pending request the host must approve before a QR ticket is issued.
      const status = f.complimentaryApprovalMode === "REQUEST_APPROVAL" ? "Pending Approval" : "Generated";
      return {
        ...f,
        complimentaryEnabled: true,
        complimentaryGuests: [...f.complimentaryGuests, newComplimentaryGuest(draft, f.complimentaryGuests.length, status)],
        complimentaryDraft: { ...empty.complimentaryDraft },
      };
    });
  const updateComplimentaryGuest = (id, key, value) =>
    setForm((f) => ({
      ...f,
      complimentaryGuests: f.complimentaryGuests.map((guest) => guest.id === id ? { ...guest, [key]: value } : guest),
    }));
  // Host approval actions for pending team-member requests.
  const approveComplimentaryGuest = (id) =>
    setForm((f) => ({
      ...f,
      complimentaryGuests: f.complimentaryGuests.map((guest) =>
        guest.id === id ? { ...guest, status: "Generated", approvedAt: new Date().toISOString() } : guest),
    }));
  const rejectComplimentaryGuest = (id) =>
    setForm((f) => ({
      ...f,
      complimentaryGuests: f.complimentaryGuests.map((guest) =>
        guest.id === id ? { ...guest, status: "Rejected" } : guest),
    }));
  const removeComplimentaryGuest = (id) =>
    setForm((f) => ({ ...f, complimentaryGuests: f.complimentaryGuests.filter((guest) => guest.id !== id) }));

  const computedCapacity = totalCategorySeats(form.ticketCategories, form.seatingType);
  const previewGroups = buildPreviewSeats(form);
  const unavailableCount = csvTokens(form.blockedSeats).length + csvTokens(form.reservedSeats).length + csvTokens(form.unavailableSeats).length;
  const compIssued = complimentaryIssuedQty(form.complimentaryGuests);
  const compLimit = num(form.complimentaryLimit, 0);
  const compUnused = Math.max(0, compLimit - compIssued);
  const paidAvailable = Math.max(0, num(form.totalCapacity || computedCapacity, 0) - compIssued);
  const pendingApprovals = (form.complimentaryGuests || []).filter((g) => g.status === "Pending Approval").length;
  // Complimentary guest details can only be issued once the event is approved.
  const canIssueComplimentary = Boolean(editingId) && editingStatus === "APPROVED";

  if (creativeStep) {
    const promptEvent = showPromptEvent(creativeStep.form);
    return (
      <div className="rybbo-lys" style={{ paddingBottom: 32, width: "100%" }}>
        <style>{LYS_CSS}</style>
        <div className="rybbo-hero" style={{ background: "linear-gradient(135deg, #6D28D9 0%, #2563EB 55%, #06B6D4 100%)", color: "#fff", padding: "18px 16px 22px" }}>
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => setCreativeStep(null)} aria-label="Back"
              style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center" }}>
              <FaArrowLeft />
            </button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)", fontSize: 11, fontWeight: 800, letterSpacing: 0.4 }}>
              <FaMagic size={11} /> POSTER
            </div>
          </div>
          <h1 style={{ position: "relative", zIndex: 1, margin: "14px 0 0", fontSize: 24, fontWeight: 900, letterSpacing: -0.4 }}>Upload or create poster</h1>
        </div>
        <div style={{ padding: "18px 14px", display: "grid", gap: 12 }} className="rybbo-anim">
          {success && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(34,197,94,0.12)", borderRadius: 8, color: "#22c55e", fontSize: 13 }}>
              <FaCheckCircle /> Details saved. Poster is optional and can be done now.
            </div>
          )}
          <div style={sectionCard}>
            <div style={sectionHead}>
              <FaMagic color="#007BFF" />
              Event poster
            </div>
            <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", lineHeight: 1.45 }}>
              Main show details are saved first. Upload a ready poster here, or create one with AI/Canva and upload the final image.
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBannerChange} style={{ display: "none" }} />
            {creativeStep.bannerImage ? (
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--cm-line, #2A2A3A)" }}>
                <img src={creativeStep.bannerImage} alt="Poster preview" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                <button type="button" onClick={clearBanner} aria-label="Remove poster"
                  style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <FaTimes size={11} />
                </button>
              </div>
            ) : (
              <div style={{ border: "1px dashed var(--cm-line, #2A2A3A)", borderRadius: 12, padding: 18, textAlign: "center", color: "var(--cm-muted, #6B7280)", fontSize: 12 }}>
                No poster uploaded yet.
              </div>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={savingBanner} className="rybbo-cta"
              style={{ display: "inline-flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 14, border: "1.5px dashed #2563EB", background: "rgba(37,99,235,0.06)", color: "#2563EB", fontWeight: 800, cursor: savingBanner ? "wait" : "pointer", opacity: savingBanner ? 0.7 : 1 }}>
              <FaImage /> {savingBanner ? "Saving poster..." : creativeStep.bannerImage ? "Replace poster" : "Upload poster"}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              <a href={buildBannerAiUrl("claude", promptEvent, "")} target="_blank" rel="noreferrer" className="rybbo-cta"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 14, background: "#D77655", color: "#fff", fontWeight: 800, textDecoration: "none", boxShadow: "0 10px 22px -14px #D77655" }}>
                <FaMagic /> Claude
              </a>
              <a href={buildBannerAiUrl("chatgpt", promptEvent, "")} target="_blank" rel="noreferrer" className="rybbo-cta"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 14, background: "#10A37F", color: "#fff", fontWeight: 800, textDecoration: "none", boxShadow: "0 10px 22px -14px #10A37F" }}>
                <FaMagic /> ChatGPT
              </a>
              <button type="button" onClick={openCanvaForShow} className="rybbo-cta"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 14, border: "none", background: "#00C4CC", color: "#fff", fontWeight: 800, cursor: "pointer", boxShadow: "0 10px 22px -14px #00C4CC" }}>
                <FaMagic /> Canva
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", lineHeight: 1.45 }}>
              Canva prompt is copied automatically. For Claude/ChatGPT, generate the poster, download/screenshot it, then upload it here.
            </div>
          </div>
          <button type="button" onClick={() => { setCreativeStep(null); setForm(empty); setEditingId(null); setEditingStatus(null); }} className="rybbo-cta"
            style={{ padding: 15, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6D28D9, #2563EB 60%, #06B6D4)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 12px 26px -12px rgba(37,99,235,0.6)" }}>
            Finish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rybbo-lys" style={{ paddingBottom: 32, width: "100%" }}>
      <style>{LYS_CSS}</style>

      {/* ── Gradient hero header ─────────────────────────────── */}
      <div className="rybbo-hero" style={{ background: "linear-gradient(135deg, #6D28D9 0%, #2563EB 55%, #06B6D4 100%)", color: "#fff", padding: "18px 16px 22px" }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => navigate(-1)} aria-label="Back"
            style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center" }}>
            <FaArrowLeft />
          </button>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)", fontSize: 11, fontWeight: 800, letterSpacing: 0.4 }}>
            <FaMagic size={11} /> RYBBO
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, marginTop: 14 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.15 }}>
            {editingId ? "Edit your show" : "List your show"}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.88)", maxWidth: 520 }}>
            Organizing an event, play, sports match or activity? Submit the details — our team reviews and reaches out within 2–3 business days.
          </p>
        </div>
      </div>

      <div style={{ padding: "18px 14px", display: "grid", gap: 12 }} className="rybbo-anim">

        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 14, color: "#16a34a", fontSize: 13, fontWeight: 600 }}>
            <FaCheckCircle /> Submitted. We'll be in touch soon.
          </div>
        )}
        {editingId && editingStatus && editingStatus !== "PENDING" && (
          <div style={{ padding: "12px 14px", background: "rgba(244,162,97,0.14)", border: "1px solid rgba(244,162,97,0.3)", borderRadius: 14, color: "#d97706", fontSize: 13 }}>
            This submission is currently <strong>{editingStatus}</strong>. Saving changes will send it back for review.
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Organizer name *" value={form.organizerName} onChange={set("organizerName")} placeholder="Your or company name" invalid={invalidFields.has("organizerName")} />
          <Field label="Contact mobile *" value={form.contactMobile} onChange={set("contactMobile")} placeholder="10-digit mobile" inputMode="numeric" invalid={invalidFields.has("contactMobile")} />
          <Field label="Contact email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="you@example.com" type="email" />
          <div style={sectionCard}>
            <div style={sectionHead}>
              <FaMagic color="#007BFF" />
              Poster comes next
            </div>
            <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", lineHeight: 1.45 }}>
              Like personal events, show poster upload/AI creation is kept after the details step. Save the show first, then upload a poster or create one with Claude, ChatGPT or Canva.
            </div>
            {editingId ? (
              <button type="button" onClick={() => openPosterStep(editingId, form)}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontWeight: 800, cursor: "pointer" }}>
                <FaImage /> Open poster page
              </button>
            ) : (
              <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>
                The poster page opens automatically after submission.
              </div>
            )}
          </div>
          <Field label="Show title *" value={form.title} onChange={set("title")} placeholder="e.g. Stand-up night with X" invalid={invalidFields.has("title")} />
          <div>
            <label style={labelStyle}>Category *</label>
            <select value={form.category} onChange={set("category")} style={inputStyle}>
              <option value="events">Events</option>
              <option value="plays">Plays</option>
              <option value="workshops">Workshops</option>
              <option value="sports">Sports</option>
              <option value="activities">Activities</option>
              <option value="others">Others</option>
            </select>
          </div>
          <Field label="City *" value={form.city} onChange={set("city")} placeholder="Mumbai / Pune …" invalid={invalidFields.has("city")} />
          <Field label="Event Date *" value={form.expectedDate} onChange={set("expectedDate")} type="date" invalid={invalidFields.has("expectedDate")} />

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

          {/* ── Seat arrangement ───────────────────────────────── */}
          <div style={sectionCard}>
            <div style={{ ...sectionHead, justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaMagic color="#007BFF" />
                Seat arrangement
              </span>
              <button type="button" onClick={applyQuickSetup}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid #007BFF", background: "transparent", color: "#007BFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Quick setup
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(138px, 1fr))", gap: 8 }}>
              {SEATING_TYPES.map((type) => {
                const active = form.seatingType === type.value;
                return (
                  <button key={type.value} type="button" onClick={() => setSeatingType(type.value)}
                    style={{ textAlign: "left", padding: 10, borderRadius: 10, border: `1px solid ${active ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`, background: active ? "rgba(0,123,255,0.08)" : "transparent", color: "inherit", cursor: "pointer" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800 }}>{type.title}</div>
                    <div style={{ fontSize: 10.5, color: "var(--cm-muted, #6B7280)", lineHeight: 1.35, marginTop: 3 }}>{type.note}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <Field label="Total capacity" value={form.totalCapacity} onChange={set("totalCapacity")} placeholder="500" inputMode="numeric" />
              {form.seatingType === "TABLE_SEATING" && (
                <>
                  <Field label="Number of tables" value={form.tableCount} onChange={set("tableCount")} placeholder="25" inputMode="numeric" />
                  <Field label="Seats per table" value={form.seatsPerTable} onChange={set("seatsPerTable")} placeholder="8" inputMode="numeric" />
                </>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <Field label="Blocked seats" value={form.blockedSeats} onChange={set("blockedSeats")} placeholder="A1, A2, T1-1" />
              <Field label="Reserved seats" value={form.reservedSeats} onChange={set("reservedSeats")} placeholder="VIP guests" />
              <Field label="Unavailable seats" value={form.unavailableSeats} onChange={set("unavailableSeats")} placeholder="Broken / blocked view" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              <MiniStat label="Configured seats" value={computedCapacity || form.totalCapacity || 0} />
              <MiniStat label="Marked unavailable" value={unavailableCount} />
              <MiniStat label="Booking mode" value={form.seatingType.replace("_", " ")} />
            </div>

            {/* ── Ticket categories (above stage/entry) ──────────── */}
            <div style={{ borderTop: "1px solid var(--cm-line, #E5E7EB)", paddingTop: 14, display: "grid", gap: 12 }}>
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
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                        <LabeledInput label="Tier name">
                          <input type="text" value={tc.name}
                            onChange={(e) => updateTicketCategory(tc.id, "name", e.target.value)}
                            placeholder="Silver" style={inputStyle} />
                        </LabeledInput>
                        <LabeledInput label="Price ₹">
                          <input type="number" min="0" inputMode="decimal" value={tc.price}
                            onChange={(e) => updateTicketCategory(tc.id, "price", e.target.value)}
                            placeholder="0" style={inputStyle} />
                        </LabeledInput>
                        {form.seatingType !== "ROW_BASED" && (
                          <LabeledInput label="Seats">
                            <input type="number" min="0" inputMode="numeric" value={tc.seats}
                              onChange={(e) => updateTicketCategory(tc.id, "seats", e.target.value)}
                              placeholder="100" style={inputStyle} />
                          </LabeledInput>
                        )}
                      </div>
                      {form.seatingType === "ROW_BASED" && (
                        <>
                          <div style={{ marginTop: 8 }}>
                            <LabeledInput label="Entry gate">
                              <input type="text" value={tc.entryGate}
                                onChange={(e) => updateTicketCategory(tc.id, "entryGate", e.target.value)}
                                placeholder="Gate 1" style={inputStyle} />
                            </LabeledInput>
                          </div>
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <label style={labelStyle}>Rows &amp; seats</label>
                              <button type="button" onClick={() => addRowToTier(tc.id)} className="rybbo-cta"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, border: "1px solid #2563EB", background: "transparent", color: "#2563EB", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                <FaPlus size={9} /> Add row
                              </button>
                            </div>
                            {(tc.rows || []).length === 0 ? (
                              <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
                                No rows yet — tap <strong style={{ color: "var(--cm-ink, inherit)" }}>Add row</strong> to assign rows and their seat counts.
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: 8, fontSize: 10.5, fontWeight: 700, color: "var(--cm-muted, #6B7280)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                                  <span>Row</span><span>Seats in row</span><span />
                                </div>
                                {(tc.rows || []).map((r, ri) => (
                                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: 8, alignItems: "center" }}>
                                    <select value={r.label} onChange={(e) => updateRowField(tc.id, ri, "label", e.target.value)} style={inputStyle}>
                                      {availableRowOptions(form.ticketCategories, idx, r.label).map((l) => (
                                        <option key={l} value={l}>Row {l}</option>
                                      ))}
                                    </select>
                                    <input type="number" min="1" inputMode="numeric" value={r.seats}
                                      onChange={(e) => updateRowField(tc.id, ri, "seats", e.target.value)}
                                      placeholder="20" style={inputStyle} />
                                    <button type="button" onClick={() => removeRowFromTier(tc.id, ri)} aria-label={`Remove row ${r.label}`}
                                      style={{ width: 34, height: 38, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                      <FaTimes size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ marginTop: 8, fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
                              {(tc.rows || []).length} row{(tc.rows || []).length === 1 ? "" : "s"} ={" "}
                              <strong style={{ color: "#007BFF" }}>{estimateCategorySeats(tc, form.seatingType)} seats</strong>
                            </div>
                          </div>
                        </>
                      )}
                      {form.seatingType === "ZONE_BASED" && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 8 }}>
                          <LabeledInput label="Entry gate">
                            <input type="text" value={tc.entryGate}
                              onChange={(e) => updateTicketCategory(tc.id, "entryGate", e.target.value)}
                              placeholder="Gate 1" style={inputStyle} />
                          </LabeledInput>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <SeatPreview groups={previewGroups} seatingType={form.seatingType} onSeatClick={toggleBlockSeat} />
          </div>

          <div style={sectionCard}>
            <div style={{ ...sectionHead, justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaTicketAlt color="#22c55e" />
                Complimentary tickets
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "var(--cm-muted, #6B7280)" }}>
                <input
                  type="checkbox"
                  checked={form.complimentaryEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, complimentaryEnabled: e.target.checked }))}
                />
                Allow
              </label>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--cm-muted, #6B7280)", lineHeight: 1.45 }}>
              Issue free QR tickets for VIP guests, sponsors, artists, media, partners, family or internal team. These tickets reduce capacity but stay out of paid revenue.
            </div>
            {form.complimentaryEnabled && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  <Field label="Complimentary limit" value={form.complimentaryLimit} onChange={set("complimentaryLimit")} placeholder="50" inputMode="numeric" />
                  <div>
                    <label style={labelStyle}>Approval mode</label>
                    <select value={form.complimentaryApprovalMode} onChange={set("complimentaryApprovalMode")} style={inputStyle}>
                      <option value="HOST_DIRECT">Host can generate directly</option>
                      <option value="REQUEST_APPROVAL">Team member requests, host approves</option>
                    </select>
                  </div>
                </div>

                {form.complimentaryApprovalMode === "REQUEST_APPROVAL" && (
                  <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--cm-line, #E5E7EB)", background: "rgba(0,123,255,0.04)", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>Team members</span>
                      <span style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>
                        {(form.complimentaryTeamMembers || []).length} added
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--cm-muted, #6B7280)", lineHeight: 1.45 }}>
                      These people can request complimentary tickets; you approve before they are issued.
                    </div>
                    {(form.complimentaryTeamMembers || []).length > 0 && (
                      <div style={{ display: "grid", gap: 6 }}>
                        {form.complimentaryTeamMembers.map((m) => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                              <div style={{ fontSize: 11.5, color: "var(--cm-muted, #6B7280)" }}>{m.mobile}</div>
                            </div>
                            <button type="button" onClick={() => removeTeamMember(m.id)} aria-label={`Remove ${m.name}`}
                              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                              <FaTimes size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "stretch" }}>
                      <input type="text" value={form.complimentaryTeamDraft?.name || ""}
                        onChange={(e) => setTeamDraft("name", e.target.value)}
                        placeholder="Member name" style={inputStyle} />
                      <input type="tel" inputMode="numeric" value={form.complimentaryTeamDraft?.mobile || ""}
                        onChange={(e) => setTeamDraft("mobile", e.target.value)}
                        placeholder="Mobile number" style={inputStyle} />
                      <button type="button" onClick={addTeamMember} className="rybbo-cta"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", borderRadius: 10, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                        <FaPlus size={10} /> Add
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  <MiniStat label="Quota" value={compLimit || "Open"} />
                  <MiniStat label="Issued" value={compIssued} />
                  <MiniStat label="Unused" value={compLimit ? compUnused : "Open"} />
                  <MiniStat label="Paid capacity left" value={paidAvailable} />
                </div>

                {!canIssueComplimentary ? (
                  <div style={{ padding: 12, borderRadius: 12, border: "1px dashed var(--cm-line, #E5E7EB)", background: "rgba(120,130,160,0.05)", fontSize: 12, color: "var(--cm-muted, #6B7280)", lineHeight: 1.5 }}>
                    These settings are saved with your event. You can <strong style={{ color: "var(--cm-ink, inherit)" }}>add complimentary guest details and issue QR tickets after the event is approved</strong>.
                  </div>
                ) : (
                <>
                {pendingApprovals > 0 && (
                  <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #F59E0B", background: "rgba(245,158,11,0.1)", color: "#b45309", fontSize: 12.5, fontWeight: 700 }}>
                    {pendingApprovals} request{pendingApprovals === 1 ? "" : "s"} waiting for your approval — review below.
                  </div>
                )}
                <div style={{ padding: 10, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                    <input type="text" value={form.complimentaryDraft.name}
                      onChange={(e) => setComplimentaryDraft("name", e.target.value)}
                      placeholder="Guest name" style={inputStyle} />
                    <input type="tel" value={form.complimentaryDraft.mobile}
                      onChange={(e) => setComplimentaryDraft("mobile", e.target.value)}
                      placeholder="Mobile number" style={inputStyle} />
                    <input type="email" value={form.complimentaryDraft.email}
                      onChange={(e) => setComplimentaryDraft("email", e.target.value)}
                      placeholder="Email ID" style={inputStyle} />
                    <input type="number" min="1" value={form.complimentaryDraft.qty}
                      onChange={(e) => setComplimentaryDraft("qty", e.target.value)}
                      placeholder="Tickets" style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                    <select value={form.complimentaryDraft.ticketType}
                      onChange={(e) => setComplimentaryDraft("ticketType", e.target.value)}
                      style={inputStyle}>
                      {COMPLIMENTARY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <select value={form.complimentaryDraft.ticketCategory}
                      onChange={(e) => setComplimentaryDraft("ticketCategory", e.target.value)}
                      style={inputStyle}>
                      <option value="">Seat / zone from ticket type</option>
                      {form.ticketCategories.map((tc) => (
                        <option key={tc.id} value={tc.name}>{tc.name || "Unnamed tier"}</option>
                      ))}
                    </select>
                    <input type="text" value={form.complimentaryDraft.remarks}
                      onChange={(e) => setComplimentaryDraft("remarks", e.target.value)}
                      placeholder="Remark e.g. Sponsor Guest" style={inputStyle} />
                    <button type="button" onClick={addComplimentaryGuest}
                      style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                      {form.complimentaryApprovalMode === "REQUEST_APPROVAL" ? "Submit for approval" : "Generate QR Ticket"}
                    </button>
                  </div>
                  <div style={{ fontSize: 10.8, color: "var(--cm-muted, #6B7280)", lineHeight: 1.45 }}>
                    Message: Dear guest, you are invited to attend this RYBBO event. Show the QR code at the entry gate.
                  </div>
                </div>

                {form.complimentaryGuests.length > 0 && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {form.complimentaryGuests.map((guest) => (
                      <div key={guest.id} style={{ padding: 10, borderRadius: 10, border: guest.status === "Pending Approval" ? "1px solid #F59E0B" : "1px solid var(--cm-line, #E5E7EB)", background: guest.status === "Pending Approval" ? "rgba(245,158,11,0.06)" : "transparent", display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>{guest.name} · {guest.qty} ticket(s)</div>
                            <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 2 }}>
                              {guest.ticketId} · {guest.ticketType} · {guest.mobile} · {guest.seatOrZone}
                            </div>
                            {guest.remarks && <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 2 }}>{guest.remarks}</div>}
                          </div>
                          <button type="button" onClick={() => removeComplimentaryGuest(guest.id)} aria-label="Remove complimentary guest"
                            style={{ background: "transparent", border: "none", color: "var(--cm-muted, #6B7280)", cursor: "pointer", padding: 0 }}>
                            <FaTimes size={12} />
                          </button>
                        </div>
                        {guest.status === "Pending Approval" ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#d97706" }}>Pending your approval</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <button type="button" onClick={() => approveComplimentaryGuest(guest.id)}
                                style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                                Approve &amp; issue QR
                              </button>
                              <button type="button" onClick={() => rejectComplimentaryGuest(guest.id)}
                                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 800, cursor: "pointer" }}>
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                            <select value={guest.status} onChange={(e) => updateComplimentaryGuest(guest.id, "status", e.target.value)} style={inputStyle}>
                              {["Generated", "Shared", "Accepted", "Used / Scanned", "Cancelled", "Rejected", "Expired"].map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            <button type="button" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #22c55e", background: "transparent", color: "#22c55e", fontWeight: 800, cursor: "pointer" }}>
                              WhatsApp / SMS
                            </button>
                            <button type="button" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 800, cursor: "pointer" }}>
                              PDF / Copy Link
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </>
                )}
              </>
            )}
          </div>

          <div style={sectionCard}>
            <div style={sectionHead}>
              <FaCheckCircle color="#22c55e" />
              MVP controls covered
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {["Edit layout before sales", "Block seats anytime", "View booked seats", "Download seat list", "Export attendees", "QR scan at entry", "Gate by zone", "Stop once full"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--cm-muted, #6B7280)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flex: "0 0 auto" }} />
                  {item}
                </div>
              ))}
            </div>
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
          <button type="button" onClick={submit} disabled={submitting} className="rybbo-cta"
            style={{ flex: 1, padding: 15, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6D28D9, #2563EB 60%, #06B6D4)", color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: 0.2, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1, boxShadow: "0 12px 26px -12px rgba(37,99,235,0.6)" }}>
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

const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "var(--cm-muted, #6B7280)", marginBottom: 6, display: "block", letterSpacing: 0.2 };
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-input-bg, rgba(120,130,160,0.06))", color: "inherit", fontSize: 14.5, fontFamily: "inherit", outline: "none", transition: "border-color .15s ease, box-shadow .15s ease, background .15s ease" };
const invalidInputStyle = { ...inputStyle, border: "1px solid #ef4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.16)" };
const sectionCard = { padding: 16, borderRadius: 18, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, rgba(255,255,255,0.6))", boxShadow: "0 8px 24px -16px rgba(31,41,55,0.35)", display: "grid", gap: 12 };
const sectionHead = { display: "flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 800, letterSpacing: 0.1 };

// Scoped polish: focus rings, button hover lift, animated accent bar. Injected once.
const LYS_CSS = `
.rybbo-lys input:focus, .rybbo-lys select:focus, .rybbo-lys textarea:focus {
  border-color: #6D28D9 !important;
  box-shadow: 0 0 0 3px rgba(109,40,217,0.18) !important;
  background: var(--cm-card, rgba(255,255,255,0.85)) !important;
}
.rybbo-lys .rybbo-cta { transition: transform .14s ease, box-shadow .14s ease, filter .14s ease; }
.rybbo-lys .rybbo-cta:hover { transform: translateY(-1px); filter: brightness(1.04); }
.rybbo-lys .rybbo-cta:active { transform: translateY(0); }
.rybbo-lys .rybbo-hero { position: relative; overflow: hidden; }
.rybbo-lys .rybbo-hero::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(120% 140% at 12% -10%, rgba(255,255,255,0.28), transparent 45%),
              radial-gradient(90% 120% at 100% 0%, rgba(6,182,212,0.35), transparent 50%);
  pointer-events: none;
}
@keyframes rybboFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.rybbo-lys .rybbo-anim { animation: rybboFadeUp .35s ease both; }
`;

const Field = ({ label, value, onChange, type = "text", placeholder, inputMode, invalid }) => (
  <div>
    <label style={invalid ? { ...labelStyle, color: "#ef4444" } : labelStyle}>{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} style={invalid ? invalidInputStyle : inputStyle} />
  </div>
);

const LabeledInput = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

const MiniStat = ({ label, value }) => (
  <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "rgba(0,123,255,0.04)" }}>
    <div style={{ fontSize: 10.5, color: "var(--cm-muted, #6B7280)", textTransform: "uppercase", letterSpacing: 0 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{value}</div>
  </div>
);

const SeatPreview = ({ groups, seatingType, onSeatClick }) => {
  const hasSeats = groups.some((group) => group.seats.length > 0);
  const clickable = typeof onSeatClick === "function";
  return (
    <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 10, overflow: "hidden" }}>
      <div style={{ height: 26, borderRadius: "8px 8px 18px 18px", background: "linear-gradient(90deg, #111827, #334155)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, marginBottom: 10 }}>
        STAGE / ENTRY
      </div>
      {hasSeats ? (
        <div style={{ display: "grid", gap: 8, maxHeight: 280, overflow: "auto", paddingRight: 2 }}>
          {groups.map((group) => (
            <div key={group.label} style={{ display: "grid", gridTemplateColumns: seatingType === "TABLE_SEATING" ? "76px 1fr" : "44px 1fr", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--cm-muted, #6B7280)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {group.seats.map((seat) => {
                  const toggleable = clickable && (seat.status === "available" || seat.status === "blocked");
                  return (
                    <button key={seat.label} type="button" disabled={!toggleable}
                      onClick={() => toggleable && onSeatClick(seat)}
                      title={toggleable ? `${seat.label} · ${seat.status} (tap to ${seat.status === "blocked" ? "unblock" : "block"})` : `${seat.label} · ${seat.status}`}
                      style={{ width: seatingType === "TABLE_SEATING" ? 28 : 24, height: 24, padding: 0, border: seat.status === "blocked" ? "1.5px solid #fff" : "none", borderRadius: seatingType === "TABLE_SEATING" ? "50%" : 6, background: STATUS_COLORS[seat.status], color: "#fff", display: "grid", placeItems: "center", fontSize: 8.5, fontWeight: 800, cursor: toggleable ? "pointer" : "default", transition: "transform 0.12s ease" }}>
                      {seat.label.replace(/^TABLE/i, "T").slice(-3)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "14px 8px", textAlign: "center", fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
          Add capacity or ticket categories to preview the layout.
        </div>
      )}
      {clickable && hasSeats && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--cm-muted, #6B7280)" }}>
          Tap a green seat to block it for guests. Tap again to unblock.
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--cm-muted, #6B7280)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            {status}
          </span>
        ))}
      </div>
    </div>
  );
};

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
