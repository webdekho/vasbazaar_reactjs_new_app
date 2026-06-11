import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaBook, FaSearch, FaStar, FaMapMarkerAlt, FaCheckCircle, FaPlusCircle,
  FaEdit, FaTrashAlt, FaCamera, FaBarcode, FaArrowRight, FaTimes, FaRupeeSign, FaRegImage,
  FaThLarge, FaListUl, FaHistory, FaTruck, FaTags, FaUserCircle, FaCalendarAlt, FaCheck,
  FaBookOpen, FaLightbulb, FaRegBookmark, FaLocationArrow, FaChevronDown, FaRegBell,
} from "react-icons/fa";
import { useGeolocation } from "../../hooks/useGeolocation";
import LocationPickerSheet from "../../components/LocationPickerSheet";
import { isGoogleEnabled, googleReverseGeocode } from "../../services/placesService";

const PLATFORM_FEE = 15;
const OWNER_SHARE = 0.85; // platform keeps 15% commission on rent
const MY_BOOKS_KEY = "vb_rentabook_my_books";
const LIBRARY_KEY = "vb_rentabook_library"; // personal digital bookshelf

// Reading shelves for the personal library.
const SHELVES = [
  { key: "want", label: "Want to read", color: "#2563EB", bg: "#EFF6FF" },
  { key: "reading", label: "Reading", color: "#CA8A04", bg: "#FEF9C3" },
  { key: "read", label: "Read", color: "#16a34a", bg: "#dcfce7" },
];
const shelfMeta = (key) => SHELVES.find((s) => s.key === key) || SHELVES[0];

const loadLibrary = () => {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"); }
  catch { return []; }
};
const saveLibrary = (list) => {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(list)); } catch { /* ignore quota */ }
};

// Delivery pricing for sold books. The base shipping is quoted by Shiprocket
// at checkout (depends on weight, pickup & delivery pincodes). Until that
// integration lands we use a flat estimate; on top we add our handling
// premium and a percentage commission. Buyer pays the sum of all three.
const SHIPROCKET_BASE_ESTIMATE = 42; // ₹ — placeholder until live Shiprocket rate API
const DELIVERY_PREMIUM = 10;         // ₹ — our packaging/handling premium
const DELIVERY_COMMISSION_PCT = 0.10; // 10% commission on the base shipping
const computeDelivery = (base = SHIPROCKET_BASE_ESTIMATE) => {
  const commission = Math.round(base * DELIVERY_COMMISSION_PCT);
  return { base, premium: DELIVERY_PREMIUM, commission, total: base + DELIVERY_PREMIUM + commission };
};

const LISTING_TYPES = [
  { key: "rent", label: "Rent" },
  { key: "sell", label: "Sell" },
  { key: "both", label: "Both" },
];

// Sample reading history — books the user has read over time.
// Replace with a real API (rentabookService.getReadingHistory) later.
const READING_HISTORY = [
  { id: "r1", title: "Sapiens", author: "Yuval Noah Harari", finishedOn: "2025-12-18", rating: 5, source: "Rented", days: 30, cover: "#EEF2FF", accent: "#4F46E5" },
  { id: "r2", title: "The Psychology of Money", author: "Morgan Housel", finishedOn: "2025-10-02", rating: 5, source: "Owned", cover: "#ECFDF5", accent: "#059669" },
  { id: "r3", title: "Deep Work", author: "Cal Newport", finishedOn: "2025-08-21", rating: 4, source: "Rented", days: 15, cover: "#FEF2F2", accent: "#DC2626" },
  { id: "r4", title: "Shoe Dog", author: "Phil Knight", finishedOn: "2025-05-11", rating: 4, source: "Bought used", cover: "#FFF7ED", accent: "#EA580C" },
  { id: "r5", title: "The Almanack of Naval Ravikant", author: "Eric Jorgenson", finishedOn: "2025-02-27", rating: 5, source: "Rented", days: 7, cover: "#F5F3FF", accent: "#7C3AED" },
];

// Sample lending history — for books the user lent out, who rented them.
// Keyed loosely by book title so it can surface against My Listings.
const LENDING_HISTORY = [
  { id: "l1", title: "Atomic Habits", renter: "Sneha P.", city: "Pune", from: "2026-04-02", to: "2026-05-02", days: 30, earned: 153, status: "Returned", rating: 5 },
  { id: "l2", title: "Atomic Habits", renter: "Rohit K.", city: "Pune", from: "2026-02-10", to: "2026-02-25", days: 15, earned: 76, status: "Returned", rating: 4 },
  { id: "l3", title: "Atomic Habits", renter: "Aman S.", city: "Mumbai", from: "2026-05-20", to: "2026-06-19", days: 30, earned: 153, status: "Active", rating: null },
  { id: "l4", title: "Ikigai", renter: "Priya M.", city: "Nashik", from: "2026-03-05", to: "2026-03-20", days: 15, earned: 89, status: "Returned", rating: 5 },
];

// Field option sets — mirror the Rentabook PRD.
const CATEGORIES = ["School", "College", "Engineering", "Medical", "Commerce", "UPSC", "MPSC", "SSC", "Banking", "JEE", "NEET", "Fiction", "Non-Fiction", "Biography", "Self Help", "Business", "Spiritual", "Comics", "Children's"];
const CONDITIONS = ["New", "Excellent", "Good", "Fair", "Missing Pages", "Damaged"];
const LANGUAGES = ["English", "Hindi", "Marathi", "Gujarati", "Tamil", "Telugu", "Kannada", "Bengali", "Other"];

// Sample catalogue for the browse view. Replace with a real API
// (rentabookService.getBooks) when the backend is ready.
const SAMPLE_BOOKS = [
  { id: "b1", title: "Atomic Habits", author: "James Clear", category: "Self Help", city: "Pune", condition: "Excellent", rating: 4.8, rentPerDay: 6, deposit: 250, cover: "#EEF2FF", accent: "#4F46E5" },
  { id: "b2", title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", category: "Business", city: "Mumbai", condition: "Good", rating: 4.6, rentPerDay: 5, deposit: 200, cover: "#ECFDF5", accent: "#059669" },
  { id: "b3", title: "Wings of Fire", author: "A.P.J. Abdul Kalam", category: "Biography", city: "Nagpur", condition: "Good", rating: 4.9, rentPerDay: 4, deposit: 180, cover: "#FEF2F2", accent: "#DC2626" },
  { id: "b4", title: "Concepts of Physics", author: "H.C. Verma", category: "Engineering", city: "Pune", condition: "Good", rating: 4.7, rentPerDay: 8, deposit: 400, cover: "#FFF7ED", accent: "#EA580C" },
  { id: "b5", title: "Ikigai", author: "Hector Garcia", category: "Spiritual", city: "Nashik", condition: "New", rating: 4.5, rentPerDay: 7, deposit: 300, cover: "#F5F3FF", accent: "#7C3AED" },
  { id: "b6", title: "The Alchemist", author: "Paulo Coelho", category: "Fiction", city: "Mumbai", condition: "Excellent", rating: 4.8, rentPerDay: 5, deposit: 220, cover: "#FEFCE8", accent: "#CA8A04" },
];

// Rent is priced in slab tiers — a PER-DAY rate for each day-range, set by the
// owner. Total is computed slab-by-slab (like tax brackets): e.g. 8 days =
// 7 × tier-1 rate + 1 × tier-2 rate.
const RENT_SLOTS = [
  { key: "s7", label: "Day 1–7", fromDay: 1, toDay: 7, placeholder: "e.g. 10" },
  { key: "s15", label: "Day 8–15", fromDay: 8, toDay: 15, placeholder: "e.g. 6" },
  { key: "s30", label: "Day 16–30", fromDay: 16, toDay: 30, placeholder: "e.g. 2" },
];
const DEFAULT_MAX_RENT_DAYS = 30; // platform ceiling / default when lister sets none
// Books not returned within the rental window auto-convert to a sale (deposit lapses).

// Effective max rental days for a book — lister's `maxDays`, capped to the
// pricing slabs (30) and floored at 1.
const getMaxDays = (book) => {
  const m = Number(book?.maxDays);
  if (!m || m < 1) return DEFAULT_MAX_RENT_DAYS;
  return Math.min(m, DEFAULT_MAX_RENT_DAYS);
};

// Resolve a book's per-day tier rates. New listings carry `slotPrices`; older
// sample books only have a single `rentPerDay`, applied to every tier.
const getSlots = (book) => {
  if (book?.slotPrices && (book.slotPrices.s7 || book.slotPrices.s15 || book.slotPrices.s30)) {
    return book.slotPrices;
  }
  const d = Number(book?.rentPerDay) || 0;
  return { s7: d, s15: d, s30: d };
};

// Slab-compute the rent for `days` using per-day tier rates.
// Returns { rows: [{ tier, days, rate, cost, fromDay, toDay }], total }.
const computeRent = (days, slots, maxDays = DEFAULT_MAX_RENT_DAYS) => {
  const n = Math.max(0, Math.min(Number(days) || 0, maxDays));
  const rows = [];
  let total = 0;
  RENT_SLOTS.forEach((t) => {
    const upTo = Math.min(n, t.toDay);
    const daysInTier = Math.max(0, upTo - t.fromDay + 1);
    if (daysInTier > 0) {
      const rate = Number(slots?.[t.key]) || 0;
      const cost = daysInTier * rate;
      rows.push({ tier: t, days: daysInTier, rate, cost, fromDay: t.fromDay, toDay: upTo });
      total += cost;
    }
  });
  return { rows, total };
};

// Lowest per-day tier rate → compact "from ₹X/day" label in lists.
const fromPrice = (book) => {
  const s = getSlots(book);
  const vals = [s.s7, s.s15, s.s30].map(Number).filter((n) => n > 0);
  return vals.length ? Math.min(...vals) : 0;
};

const EMPTY_FORM = {
  id: null, photo: null, title: "", author: "", publisher: "", edition: "", isbn: "",
  language: "English", category: "Fiction", condition: "Good", city: "", address: "",
  listingType: "rent",
  // slotPrices: { s7, s15, s30 } — per-day rate per duration tier
  slotPrices: { s7: "", s15: "", s30: "" },
  deposit: "", availableFrom: "",
  maxDays: 30, // lister-set maximum rental length (1–30)
  autoSell: true, // auto-sell if not returned by the max-day window (deposit lapses)
  mrp: "", sellPrice: "", deliveryCharge: "",
};

// The lending wizard steps. Each declares which fields it owns so we can
// validate just that step before advancing.
const WIZARD_STEPS = [
  { key: "photo", title: "Cover & ISBN", hint: "A clear photo helps it rent faster" },
  { key: "details", title: "Book details", hint: "What is the book?" },
  { key: "condition", title: "Condition", hint: "Be honest — it builds trust" },
  { key: "pricing", title: "Pricing", hint: "How do you want to offer this book?" },
  { key: "review", title: "Review", hint: "Confirm and publish" },
];

// Map a 2-letter language code from the ISBN API to our dropdown labels.
const mapLanguage = (code) => (
  {
    en: "English", eng: "English",
    hi: "Hindi", hin: "Hindi",
    mr: "Marathi", mar: "Marathi",
    gu: "Gujarati", guj: "Gujarati",
    ta: "Tamil", tam: "Tamil",
    te: "Telugu", tel: "Telugu",
    kn: "Kannada", kan: "Kannada",
    bn: "Bengali", ben: "Bengali",
  }[String(code || "").toLowerCase()]
  || (code ? "Other" : "English")
);

// Best-effort match of the API's free-text categories to our category list.
const matchCategory = (cats = []) => {
  const joined = cats.join(" ").toLowerCase();
  return CATEGORIES.find((c) => joined.includes(c.toLowerCase())) || "";
};

const isbnLookupCache = new Map();
const isbnLookupInflight = new Map();
const normaliseIsbn = (isbn) => String(isbn || "").replace(/[^0-9Xx]/g, "").toUpperCase();
const GOOGLE_BOOKS_API_KEY = process.env.REACT_APP_GOOGLE_BOOKS_API_KEY || "";

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (res.status === 429) {
    const err = new Error("rate-limit");
    err.status = 429;
    throw err;
  }
  if (!res.ok) throw new Error("network");
  return res.json();
};

// OpenLibrary — no API key, no daily quota. Primary source.
async function lookupOpenLibrary(isbn) {
  const json = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`);
  const b = json?.[`ISBN:${isbn}`];
  if (!b) return null;
  const cover = b.cover?.large || b.cover?.medium || b.cover?.small || "";
  return {
    title: b.title || "",
    subtitle: b.subtitle || "",
    author: (b.authors || []).map((a) => a.name).join(", "),
    publisher: (b.publishers || []).map((p) => p.name).join(", "),
    publishedDate: b.publish_date || "",
    pageCount: b.number_of_pages || null,
    language: "English",
    category: matchCategory((b.subjects || []).map((s) => s.name || s)),
    categories: (b.subjects || []).map((s) => s.name || s).slice(0, 6),
    description: typeof b.notes === "string" ? b.notes : (b.notes?.value || ""),
    thumbnail: cover.replace("http://", "https://"),
  };
}

async function lookupOpenLibraryEdition(isbn) {
  const edition = await fetchJson(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if (!edition?.title) return null;

  const authorRefs = (edition.authors || []).slice(0, 4).map((a) => a.key).filter(Boolean);
  const authorNames = await Promise.all(authorRefs.map(async (key) => {
    try {
      const author = await fetchJson(`https://openlibrary.org${key}.json`);
      return author?.name || "";
    } catch { return ""; }
  }));

  const subjects = edition.subjects || edition.subject_places || edition.subject_people || [];
  const langKey = edition.languages?.[0]?.key?.split("/").pop();
  const coverId = edition.covers?.[0];
  const cover = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : "";

  return {
    title: edition.title || "",
    subtitle: edition.subtitle || "",
    author: authorNames.filter(Boolean).join(", "),
    publisher: (edition.publishers || []).join(", "),
    publishedDate: edition.publish_date || "",
    pageCount: edition.number_of_pages || null,
    language: mapLanguage(langKey),
    category: matchCategory(subjects),
    categories: subjects.slice(0, 6),
    description: typeof edition.notes === "string" ? edition.notes : (edition.notes?.value || ""),
    thumbnail: cover,
  };
}

async function lookupOpenLibrarySearch(isbn) {
  const json = await fetchJson(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=title,subtitle,author_name,publisher,first_publish_year,language,subject,number_of_pages_median,cover_i&limit=1`);
  const doc = json?.docs?.[0];
  if (!doc?.title) return null;
  return {
    title: doc.title || "",
    subtitle: doc.subtitle || "",
    author: (doc.author_name || []).join(", "),
    publisher: (doc.publisher || []).slice(0, 2).join(", "),
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : "",
    pageCount: doc.number_of_pages_median || null,
    language: mapLanguage(doc.language?.[0]),
    category: matchCategory(doc.subject || []),
    categories: (doc.subject || []).slice(0, 6),
    description: "",
    thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "",
  };
}

// Google Books — optional fallback. Keep it behind an API key so anonymous
// quota failures do not create noisy 429s in the browser console.
async function lookupGoogleBooks(isbn) {
  if (!GOOGLE_BOOKS_API_KEY) return null;
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`isbn:${isbn}`)}&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}`);
  if (res.status === 429) return null;
  if (!res.ok) throw new Error("network");
  const json = await res.json();
  const v = json?.items?.[0]?.volumeInfo;
  if (!json?.totalItems || !v) return null;
  return {
    title: v.title || "",
    subtitle: v.subtitle || "",
    author: (v.authors || []).join(", "),
    publisher: v.publisher || "",
    publishedDate: v.publishedDate || "",
    pageCount: v.pageCount || null,
    language: mapLanguage(v.language),
    category: matchCategory(v.categories),
    categories: v.categories || [],
    description: v.description || "",
    thumbnail: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "").replace("http://", "https://"),
  };
}

/**
 * Look up book metadata by ISBN. Tries OpenLibrary first (no quota), then
 * Google Books. Returns a normalised object, or null when neither matches.
 */
async function lookupIsbn(isbn) {
  const clean = normaliseIsbn(isbn);
  if (isbnLookupCache.has(clean)) return isbnLookupCache.get(clean);
  if (isbnLookupInflight.has(clean)) return isbnLookupInflight.get(clean);

  const promise = (async () => {
    const providers = [lookupOpenLibrary, lookupOpenLibraryEdition, lookupOpenLibrarySearch, lookupGoogleBooks];
    for (const provider of providers) {
      try {
        const data = await provider(clean);
        if (data?.title) {
          isbnLookupCache.set(clean, data);
          return data;
        }
      } catch (err) {
        if (err?.status !== 429) {
          // Try the next source; ISBN lookup should not block manual listing.
        }
      }
    }
    isbnLookupCache.set(clean, null);
    return null;
  })();

  isbnLookupInflight.set(clean, promise);
  try { return await promise; }
  finally { isbnLookupInflight.delete(clean); }
}

// Reverse-geocode lat/lng to a human city label via OpenStreetMap Nominatim
// (same free provider the rest of the app's location picker uses).
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse failed");
  const r = await res.json();
  const a = r.address || {};
  return a.city || a.town || a.village || a.suburb || a.county || a.state_district || a.state || (r.display_name || "").split(",")[0] || "";
}

const loadMyBooks = () => {
  try { return JSON.parse(localStorage.getItem(MY_BOOKS_KEY) || "[]"); }
  catch { return []; }
};
const saveMyBooks = (list) => {
  try { localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(list)); } catch { /* ignore quota */ }
};

/* ── Ratings ──────────────────────────────────────────────
 * Each book gets a deterministic seeded base rating (4.5–4.9) and a
 * sample number of customer reviews. When the real user rates a book we
 * store it and blend it into the displayed average so it actually moves.
 */
const RATINGS_KEY = "vb_rentabook_ratings"; // { [bookId]: { sum, count, last, takeaway } }

// Sample community takeaways shown on a book — a rotating pool seeded per book
// so it stays stable. Replace with a real reviews API later.
const TAKEAWAY_POOL = [
  { by: "Sneha P.", stars: 5, text: "Loved the 1% better idea — small habits really do compound." },
  { by: "Rohit K.", stars: 4, text: "Practical and easy to apply. The habit-stacking chapter is gold." },
  { by: "Aman S.", stars: 5, text: "Changed how I think about systems vs goals. A must-read." },
  { by: "Priya M.", stars: 4, text: "Some repetition, but the core ideas stuck with me for months." },
  { by: "Karan D.", stars: 5, text: "Short, clear, actionable. Finished it in a weekend." },
  { by: "Neha R.", stars: 4, text: "Great for beginners; the examples make it memorable." },
];
// Pick 2 stable community takeaways for a book.
const communityTakeaways = (id) => {
  const i = hashStr(String(id)) % TAKEAWAY_POOL.length;
  const j = (i + 1 + (hashStr(`${id}-b`) % (TAKEAWAY_POOL.length - 1))) % TAKEAWAY_POOL.length;
  return [TAKEAWAY_POOL[i], TAKEAWAY_POOL[j]];
};

const hashStr = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
};
// Seeded rating in [4.5, 4.9] (5 buckets) — stable per book.
const seededRating = (id) => 4.5 + (hashStr(String(id)) % 5) * 0.1;
// Seeded sample customer count, ~24–423 — stable per book.
const seededReviews = (id) => 24 + (hashStr(`${id}-rev`) % 400);

const loadRatings = () => {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || "{}"); }
  catch { return {}; }
};
const saveRatings = (map) => {
  try { localStorage.setItem(RATINGS_KEY, JSON.stringify(map)); } catch { /* ignore quota */ }
};

// Blend seeded base with any real user ratings for this book.
const effectiveRating = (book, userRatings) => {
  const baseAvg = book.rating && book.rating > 0 ? book.rating : seededRating(book.id);
  const baseCount = seededReviews(book.id);
  const u = userRatings[book.id];
  if (!u || !u.count) return { avg: Math.round(baseAvg * 10) / 10, count: baseCount, mine: 0, takeaway: u?.takeaway || "" };
  const avg = (baseAvg * baseCount + u.sum) / (baseCount + u.count);
  return { avg: Math.round(avg * 10) / 10, count: baseCount + u.count, mine: u.last || 0, takeaway: u.takeaway || "" };
};

const RentABookScreen = () => {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState("grid"); // grid | list — grid shows more books per screen
  // browse | detail | success | my-books | lend | published
  const [view, setView] = useState("browse");
  const [selected, setSelected] = useState(null);
  const [days, setDays] = useState(7); // number of rental days the renter picks
  const [reminderDays, setReminderDays] = useState(2); // remind renter N days before due

  const [myBooks, setMyBooks] = useState(() => loadMyBooks());
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});

  // ISBN lookup: status = idle | loading | found | notfound | error
  const [isbnLookup, setIsbnLookup] = useState({ status: "idle", data: null });

  const [userRatings, setUserRatings] = useState(() => loadRatings());

  // Location picker for the City field (GPS + manual place selection).
  const [locPickerOpen, setLocPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const { requestLocation } = useGeolocation({ autoRequest: false });

  // Selected from the search list → use its city label directly.
  const handlePickPlace = (place) => {
    setForm((f) => ({
      ...f,
      city: place.label || place.full || "",
      address: place.full && place.full !== place.label ? place.full : f.address,
    }));
  };
  // "Use my current location" → get GPS, then reverse-geocode to a city name.
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const c = await requestLocation();
      if (c?.lat) {
        const city = isGoogleEnabled()
          ? await googleReverseGeocode(c.lat, c.lng)
          : await reverseGeocode(c.lat, c.lng);
        if (city) setField("city", city);
      }
    } catch { /* ignore — user can type manually */ }
    finally { setLocating(false); }
  };

  useEffect(() => { saveMyBooks(myBooks); }, [myBooks]);
  useEffect(() => { saveRatings(userRatings); }, [userRatings]);

  // Record the real user's rating for a book and blend it into the average.
  const rateBook = (bookId, stars) => {
    setUserRatings((prev) => {
      const cur = prev[bookId] || { sum: 0, count: 0, last: 0, takeaway: "" };
      // Replace the user's previous vote rather than stacking it.
      const sum = cur.sum - (cur.last || 0) + stars;
      const count = cur.last ? cur.count : cur.count + 1;
      return { ...prev, [bookId]: { ...cur, sum, count, last: stars } };
    });
  };

  // Save/update the user's own takeaway (only meaningful once they've rated).
  const setTakeaway = (bookId, text) => {
    setUserRatings((prev) => {
      const cur = prev[bookId] || { sum: 0, count: 0, last: 0, takeaway: "" };
      return { ...prev, [bookId]: { ...cur, takeaway: text } };
    });
  };

  // Auto-fetch book details when a full ISBN (10 or 13 digits) is entered.
  const isbnDigits = normaliseIsbn(form.isbn);
  useEffect(() => {
    if (view !== "lend") return;
    if (isbnDigits.length !== 10 && isbnDigits.length !== 13) {
      setIsbnLookup((s) => (s.status === "idle" ? s : { status: "idle", data: null }));
      return;
    }
    let cancelled = false;
    setIsbnLookup({ status: "loading", data: null });
    const t = setTimeout(async () => {
      try {
        const data = await lookupIsbn(isbnDigits);
        if (cancelled) return;
        if (!data) { setIsbnLookup({ status: "notfound", data: null }); return; }
        setIsbnLookup({ status: "found", data });
        // Prefill any fields the owner has not already typed.
        setForm((f) => ({
          ...f,
          title: f.title || data.title,
          author: f.author || data.author,
          publisher: f.publisher || data.publisher,
          language: data.language || f.language,
          category: f.category && f.category !== "Fiction" ? f.category : (data.category || f.category),
          photo: f.photo || data.thumbnail || null,
        }));
      } catch {
        if (!cancelled) setIsbnLookup({ status: "error", data: null });
      }
    }, 500); // debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [isbnDigits, view]);

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAMPLE_BOOKS;
    return SAMPLE_BOOKS.filter((b) =>
      `${b.title} ${b.author} ${b.category} ${b.city} ${b.isbn || ""}`.toLowerCase().includes(q)
    );
  }, [query]);

  // Slot pricing for the selected (renter) book — selected.slotPrices if set,
  // otherwise derive a sensible amount from a legacy rentPerDay sample book.
  const selectedSlots = selected ? getSlots(selected) : null;
  const selMaxDays = selected ? getMaxDays(selected) : DEFAULT_MAX_RENT_DAYS;
  const rentBreakdown = selected ? computeRent(days, selectedSlots, selMaxDays) : { rows: [], total: 0 };
  const rentAmount = rentBreakdown.total;
  const total = selected ? rentAmount + (Number(selected.deposit) || 0) + PLATFORM_FEE : 0;

  // Earnings projection shown to the lender — based on the 16–30 day slot.
  // Owner's earnings on a full 30-day rental (slab total) after platform fee.
  const full30Rent = computeRent(30, form.slotPrices).total;
  const monthlyEarning = Math.round(full30Rent * OWNER_SHARE);

  // Sell maths
  const offersRent = form.listingType === "rent" || form.listingType === "both";
  const offersSell = form.listingType === "sell" || form.listingType === "both";
  const delivery = computeDelivery(); // { base, premium, commission, total }
  const buyerDelivery = delivery.total;
  const sellTotal = (Number(form.sellPrice) || 0) + buyerDelivery;
  const sellSaving = (Number(form.mrp) || 0) - (Number(form.sellPrice) || 0);
  const sellDiscountPct = Number(form.mrp) > 0 ? Math.round((sellSaving / Number(form.mrp)) * 100) : 0;

  // Field-completion progress for the listing wizard. The relevant field set
  // depends on whether the user is renting, selling or both — so the % always
  // reflects what THIS listing actually needs.
  const completion = useMemo(() => {
    const fields = [
      !!form.photo,                 // cover photo
      form.isbn.trim() !== "",      // ISBN
      form.title.trim() !== "",     // title
      form.author.trim() !== "",    // author
      form.publisher.trim() !== "", // publisher
      form.edition.trim() !== "",   // edition
      !!form.language,              // language (has default)
      !!form.category,              // category (has default)
      !!form.condition,             // condition (has default)
      form.city.trim() !== "",      // city
    ];
    if (offersRent) {
      fields.push(
        Number(form.slotPrices.s7) > 0,
        Number(form.slotPrices.s15) > 0,
        Number(form.slotPrices.s30) > 0,
        form.deposit !== "",
        form.availableFrom.trim() !== "",
      );
    }
    if (offersSell) {
      fields.push(form.mrp.trim() !== "", Number(form.sellPrice) > 0);
    }
    const filled = fields.filter(Boolean).length;
    return { filled, total: fields.length, pct: Math.round((filled / fields.length) * 100) };
  }, [form, offersRent, offersSell]);

  // Lending history grouped per book title (sample data for now).
  const lendingByTitle = useMemo(() => {
    const map = {};
    LENDING_HISTORY.forEach((h) => {
      (map[h.title] = map[h.title] || []).push(h);
    });
    return map;
  }, []);

  const goTo = (next) => { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openDetail = (book) => { setSelected(book); setDays(Math.min(7, getMaxDays(book))); setReminderDays(2); goTo("detail"); };

  const startLend = () => { setForm(EMPTY_FORM); setStep(0); setErrors({}); goTo("lend"); };
  const startEdit = (book) => {
    setForm({
      id: book.id, photo: book.photo || null, title: book.title || "", author: book.author || "",
      publisher: book.publisher || "", edition: book.edition || "", isbn: book.isbn || "",
      language: book.language || "English", category: book.category || "Fiction",
      condition: book.condition || "Good", city: book.city || "", address: book.address || "",
      listingType: book.listingType || "rent",
      slotPrices: {
        s7: String(book.slotPrices?.s7 ?? book.rentPerDay ?? ""),
        s15: String(book.slotPrices?.s15 ?? book.rentPerDay ?? ""),
        s30: String(book.slotPrices?.s30 ?? book.rentPerDay ?? ""),
      },
      deposit: String(book.deposit ?? ""),
      availableFrom: book.availableFrom || "",
      maxDays: Number(book.maxDays) || 30,
      autoSell: book.autoSell !== false,
      mrp: String(book.mrp ?? ""), sellPrice: String(book.sellPrice ?? ""), deliveryCharge: String(book.deliveryCharge ?? ""),
    });
    setStep(0); setErrors({}); goTo("lend");
  };

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("photo", reader.result);
    reader.readAsDataURL(file);
  };

  // Validate only the current step's fields.
  const validateStep = (idx) => {
    const e = {};
    const k = WIZARD_STEPS[idx].key;
    if (k === "details") {
      if (!form.title.trim()) e.title = "Title is required";
      if (!form.author.trim()) e.author = "Author is required";
    }
    if (k === "pricing") {
      if (!form.city.trim()) e.city = "City is required";
      if (offersRent) {
        const anySlot = RENT_SLOTS.some((s) => Number(form.slotPrices[s.key]) > 0);
        if (!anySlot) e.slots = "Set a price for at least one duration slot";
        if (form.deposit === "" || Number(form.deposit) < 0) e.deposit = "Enter deposit amount";
      }
      if (offersSell) {
        if (!form.sellPrice || Number(form.sellPrice) <= 0) e.sellPrice = "Enter selling price";
        if (form.mrp && Number(form.sellPrice) > Number(form.mrp)) e.sellPrice = "Selling price can't exceed MRP";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step < WIZARD_STEPS.length - 1) { setStep((s) => s + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else publish();
  };
  const prev = () => { if (step > 0) setStep((s) => s - 1); else goTo("my-books"); };

  const publish = () => {
    const slotPrices = {
      s7: Number(form.slotPrices.s7) || 0,
      s15: Number(form.slotPrices.s15) || 0,
      s30: Number(form.slotPrices.s30) || 0,
    };
    const payload = {
      ...form,
      title: form.title.trim(), author: form.author.trim(), city: form.city.trim(), address: form.address.trim(),
      slotPrices,
      rentPerDay: 0, // legacy field no longer used; slots are authoritative
      maxDays: Math.min(Math.max(Number(form.maxDays) || 30, 1), 30),
      deposit: Number(form.deposit) || 0,
      mrp: Number(form.mrp) || 0, sellPrice: Number(form.sellPrice) || 0,
      // What the buyer pays for delivery (Shiprocket + our premium + commission).
      deliveryCharge: offersSell ? buyerDelivery : 0,
      rating: form.id ? (myBooks.find((b) => b.id === form.id)?.rating || 0) : 0,
      cover: "#EEF2FF", accent: "#2563EB",
      // Every listing is reviewed by admin before it goes live.
      status: "Pending approval", submittedAt: Date.now(),
    };
    setMyBooks((prev2) => {
      if (form.id) return prev2.map((b) => (b.id === form.id ? { ...b, ...payload } : b));
      return [{ ...payload, id: `my-${prev2.length}-${Date.now().toString(36)}` }, ...prev2];
    });
    goTo("published");
  };

  const deleteBook = (id) => setMyBooks((prev2) => prev2.filter((b) => b.id !== id));

  const goBack = () => {
    if (view === "detail") return setView("browse");
    if (view === "success") { setView("browse"); setSelected(null); return; }
    if (view === "my-books") return setView("browse");
    if (view === "history") return setView("browse");
    if (view === "library") return setView("browse");
    if (view === "lend") return prev();
    if (view === "published") return setView("my-books");
    navigate(-1);
  };

  const headerTitle = view === "my-books" ? "My Listings"
    : view === "history" ? "Reading & Lending History"
    : view === "library" ? "My Library"
    : view === "lend" ? (form.id ? "Edit Listing" : "List a Book")
    : view === "published" ? "Submitted" : "Rent a Book";

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC", paddingBottom: 90 }}>
      <style>{"@keyframes rab-spin{to{transform:rotate(360deg)}}"}</style>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", background: "#fff", borderBottom: "1px solid #eef2f7",
      }}>
        <button type="button" onClick={goBack} aria-label="Back"
          style={{ border: "none", background: "transparent", fontSize: 18, color: "#0f172a", cursor: "pointer", display: "flex" }}>
          <FaArrowLeft />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: "#E8F3FF", color: "#2563EB" }}>
            <FaBook />
          </span>
          <strong style={{ fontSize: 17, color: "#0f172a" }}>{headerTitle}</strong>
        </div>
        {view === "browse" && (
          <button type="button" onClick={startLend}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: "none", background: "#2563EB", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <FaPlusCircle /> List
          </button>
        )}
      </div>

      {view === "browse" && (
        <div style={{ padding: "12px 16px 16px" }}>
          {/* Compact search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <FaSearch style={{ color: "#94a3b8" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, author, ISBN, category, city"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#0f172a" }} />
          </div>

          {/* Three nav chips — equal width, one line */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => goTo("library")}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", borderRadius: 12, border: "1px solid #c7d2fe", background: "#EEF2FF", color: "#4338ca", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" }}>
              <FaRegBookmark /> My Library
            </button>
            <button type="button" onClick={() => goTo("my-books")}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" }}>
              <FaBook /> My Listing{myBooks.length ? ` (${myBooks.length})` : ""}
            </button>
            <button type="button" onClick={() => goTo("history")}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" }}>
              <FaHistory /> History
            </button>
          </div>

          {/* Count + layout toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>{books.length} books available</div>
            <div style={{ display: "flex", gap: 4, background: "#eef2f7", borderRadius: 10, padding: 3 }}>
              <LayoutBtn active={layout === "grid"} onClick={() => setLayout("grid")} aria="Grid view"><FaThLarge /></LayoutBtn>
              <LayoutBtn active={layout === "list"} onClick={() => setLayout("list")} aria="List view"><FaListUl /></LayoutBtn>
            </div>
          </div>

          {books.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No books match “{query}”.</div>
          ) : layout === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
              {books.map((book) => (
                <button key={book.id} type="button" onClick={() => openDetail(book)}
                  style={{ display: "flex", flexDirection: "column", textAlign: "left", padding: 8, background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, cursor: "pointer" }}>
                  <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: 8 }}>
                    <BookThumb book={book} w="100%" h={104} fz={26} zoomable />
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{book.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.author}</div>
                  <div style={{ fontSize: 11 }}>
                    <RatingInline book={book} userRatings={userRatings} small />
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 6, display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ fontWeight: 800, color: "#2563EB", fontSize: 14 }}>₹{fromPrice(book)}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>/day</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              {books.map((book) => (
                <button key={book.id} type="button" onClick={() => openDetail(book)}
                  style={{ display: "flex", gap: 12, textAlign: "left", padding: 12, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, cursor: "pointer" }}>
                  <BookThumb book={book} w={56} h={76} fz={22} zoomable />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{book.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{book.author}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                      <RatingInline book={book} userRatings={userRatings} />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FaMapMarkerAlt /> {book.city}</span>
                      <span>{book.condition}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: "#2563EB" }}>₹{fromPrice(book)}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>per day</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "history" && (
        <HistoryView readingHistory={READING_HISTORY} lendingHistory={LENDING_HISTORY} />
      )}

      {view === "library" && <LibraryView />}

      {view === "my-books" && (
        <div style={{ padding: 16 }}>
          <button type="button" onClick={startLend}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, border: "1px dashed #2563EB", background: "#EFF6FF", color: "#2563EB", fontWeight: 600, cursor: "pointer" }}>
            <FaPlusCircle /> List a new book
          </button>

          {myBooks.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "48px 16px" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><FaBook /></div>
              You have not listed any books yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {myBooks.map((book) => (
                <div key={book.id} style={{ display: "flex", gap: 12, padding: 12, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14 }}>
                  <BookThumb book={book} w={50} h={68} fz={20} zoomable />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{book.title}</div>
                      <StatusBadge status={book.status} />
                      <TypeBadge type={book.listingType} />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{book.author}{book.edition ? ` · ${book.edition}` : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FaMapMarkerAlt /> {book.city}</span>
                      <span>{book.condition}</span>
                      {(book.listingType === "rent" || book.listingType === "both") && fromPrice(book) > 0 && (
                        <span style={{ color: "#2563EB", fontWeight: 700 }}>from ₹{fromPrice(book)}/day</span>
                      )}
                      {(book.listingType === "sell" || book.listingType === "both") && book.sellPrice > 0 && (
                        <span style={{ color: "#059669", fontWeight: 700 }}>Sell ₹{book.sellPrice}</span>
                      )}
                    </div>
                    {/* Rental track-record from lending history */}
                    {(lendingByTitle[book.title]?.length > 0) && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "#F5F3FF", padding: "3px 9px", borderRadius: 999 }}>
                        <FaHistory /> Rented {lendingByTitle[book.title].length}× · earned ₹{lendingByTitle[book.title].reduce((s, h) => s + h.earned, 0)}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button type="button" onClick={() => startEdit(book)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "1px solid #2563EB", background: "#fff", color: "#2563EB", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <FaEdit /> Edit
                      </button>
                      <button type="button" onClick={() => deleteBook(book.id)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <FaTrashAlt /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────── Lend wizard ───────────── */}
      {view === "lend" && (
        <div style={{ padding: 16 }}>
          <Stepper steps={WIZARD_STEPS} current={step} onJump={(i) => i < step && setStep(i)} />

          {/* Field-completion progress — fills as the user completes fields */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Listing completeness</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: completion.pct === 100 ? "#16a34a" : "#2563EB" }}>
                {completion.pct}% · {completion.filled}/{completion.total} fields
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
              <div style={{
                width: `${completion.pct}%`, height: "100%", borderRadius: 999,
                background: completion.pct === 100 ? "#16a34a" : "linear-gradient(90deg,#2563EB,#7C3AED)",
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>

          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <h2 style={{ margin: "0 0 2px", fontSize: 18, color: "#0f172a" }}>{WIZARD_STEPS[step].title}</h2>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{WIZARD_STEPS[step].hint}</div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 16, padding: 16, display: "grid", gap: 14 }}>
            {/* Step 0 — Photo + ISBN */}
            {step === 0 && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: "none" }} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%", aspectRatio: "3 / 2", borderRadius: 14, cursor: "pointer", overflow: "hidden",
                    border: form.photo ? "1px solid #e2e8f0" : "2px dashed #cbd5e1",
                    background: form.photo ? `center/cover no-repeat url(${form.photo})` : "#F8FAFC",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#64748b",
                  }}>
                  {!form.photo && (
                    <>
                      <span style={{ fontSize: 30, color: "#2563EB" }}><FaCamera /></span>
                      <span style={{ fontWeight: 600 }}>Add a cover photo</span>
                      <span style={{ fontSize: 12 }}>Tap to take a photo or choose from gallery</span>
                    </>
                  )}
                </button>
                {form.photo && (
                  <button type="button" onClick={() => setField("photo", null)}
                    style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "#dc2626", fontSize: 13, cursor: "pointer" }}>
                    <FaTimes /> Remove photo
                  </button>
                )}
                <Field label="ISBN">
                  <div style={{ position: "relative" }}>
                    <input style={{ ...inputStyle, paddingRight: 40 }} value={form.isbn}
                      onChange={(e) => setField("isbn", e.target.value.replace(/[^0-9Xx-]/g, ""))}
                      placeholder="Scan or enter the 13-digit ISBN" inputMode="numeric" />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#2563EB" }}>
                      {isbnLookup.status === "loading" ? <span className="rab-spin" style={spinStyle} /> : <FaBarcode />}
                    </span>
                  </div>
                  {isbnLookup.status === "loading" && (
                    <span style={{ fontSize: 11, color: "#2563EB", marginTop: 4, display: "block" }}>Looking up book details…</span>
                  )}
                  {isbnLookup.status === "notfound" && (
                    <span style={{ fontSize: 11, color: "#ea580c", marginTop: 4, display: "block" }}>No match found — you can fill the details manually in the next step.</span>
                  )}
                  {isbnLookup.status === "error" && (
                    <span style={{ fontSize: 11, color: "#dc2626", marginTop: 4, display: "block" }}>Lookup failed (check connection). You can still continue manually.</span>
                  )}
                  {isbnLookup.status !== "found" && (
                    <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "block" }}>Optional — enter it and we auto-fill the rest.</span>
                  )}
                </Field>

                {/* Fetched details card — shows the full API response */}
                {isbnLookup.status === "found" && isbnLookup.data && (
                  <div style={{ background: "#F0F9FF", border: "1px solid #bae6fd", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0369a1", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                      <FaCheckCircle /> Details found for this ISBN
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <BookThumb book={{ photo: isbnLookup.data.thumbnail, title: isbnLookup.data.title }} w={64} h={88} fz={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>{isbnLookup.data.title}</div>
                        {isbnLookup.data.subtitle && <div style={{ fontSize: 12, color: "#475569" }}>{isbnLookup.data.subtitle}</div>}
                        {isbnLookup.data.author && <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>by {isbnLookup.data.author}</div>}
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          {isbnLookup.data.publishedDate && <Pill>{String(isbnLookup.data.publishedDate).slice(0, 4)}</Pill>}
                          {isbnLookup.data.pageCount && <Pill>{isbnLookup.data.pageCount} pages</Pill>}
                          {isbnLookup.data.language && <Pill>{isbnLookup.data.language}</Pill>}
                        </div>
                      </div>
                    </div>
                    {isbnLookup.data.publisher && (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>
                        <strong>Publisher:</strong> {isbnLookup.data.publisher}
                      </div>
                    )}
                    {isbnLookup.data.categories?.length > 0 && (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        <strong>Categories:</strong> {isbnLookup.data.categories.join(", ")}
                      </div>
                    )}
                    {isbnLookup.data.description && (
                      <p style={{ fontSize: 12, color: "#64748b", marginTop: 8, marginBottom: 0, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {isbnLookup.data.description}
                      </p>
                    )}
                    <div style={{ fontSize: 11, color: "#0369a1", marginTop: 10 }}>
                      ✓ Title, author, publisher, language &amp; cover have been auto-filled. You can edit them in the next steps.
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 1 — Details */}
            {step === 1 && (
              <>
                <Field label="Book title" required error={errors.title}>
                  <input style={inputStyle} value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. Atomic Habits" />
                </Field>
                <Field label="Author" required error={errors.author}>
                  <input style={inputStyle} value={form.author} onChange={(e) => setField("author", e.target.value)} placeholder="e.g. James Clear" />
                </Field>
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Publisher" style={{ flex: 1 }}>
                    <input style={inputStyle} value={form.publisher} onChange={(e) => setField("publisher", e.target.value)} placeholder="Optional" />
                  </Field>
                  <Field label="Edition" style={{ flex: 1 }}>
                    <input style={inputStyle} value={form.edition} onChange={(e) => setField("edition", e.target.value)} placeholder="e.g. 2nd" />
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Language" style={{ flex: 1 }}>
                    <select style={inputStyle} value={form.language} onChange={(e) => setField("language", e.target.value)}>
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Category" style={{ flex: 1 }}>
                    <select style={inputStyle} value={form.category} onChange={(e) => setField("category", e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}

            {/* Step 2 — Condition */}
            {step === 2 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {CONDITIONS.map((c) => {
                  const active = form.condition === c;
                  return (
                    <button key={c} type="button" onClick={() => setField("condition", c)}
                      style={{
                        padding: "16px 10px", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 14,
                        border: active ? "2px solid #2563EB" : "1px solid #e2e8f0",
                        background: active ? "#EFF6FF" : "#fff", color: active ? "#2563EB" : "#475569",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}>
                      {active && <FaCheckCircle />} {c}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 3 — Pricing & availability */}
            {step === 3 && (
              <>
                {/* Listing type selector */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>I want to</div>
                  <div style={{ display: "flex", gap: 4, background: "#eef2f7", borderRadius: 12, padding: 4 }}>
                    {LISTING_TYPES.map((t) => {
                      const active = form.listingType === t.key;
                      return (
                        <button key={t.key} type="button" onClick={() => setField("listingType", t.key)}
                          style={{
                            flex: 1, padding: "10px 0", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 14,
                            background: active ? "#fff" : "transparent", color: active ? "#2563EB" : "#94a3b8",
                            boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                          }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="City / Location" required error={errors.city}>
                  <input style={inputStyle} value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="e.g. Pune" />
                  <input
                    style={{ ...inputStyle, marginTop: 8 }}
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="Full address / area / landmark (optional)"
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={handleUseCurrentLocation} disabled={locating}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 12px", borderRadius: 10, border: "1px solid #2563EB", background: "#EFF6FF", color: "#2563EB", fontWeight: 600, fontSize: 13, cursor: locating ? "default" : "pointer" }}>
                      {locating ? <span style={spinStyle} /> : <FaLocationArrow />}
                      {locating ? "Locating…" : "Use current location"}
                    </button>
                    <button type="button" onClick={() => setLocPickerOpen(true)}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      <FaMapMarkerAlt /> Choose on map <FaChevronDown style={{ fontSize: 10 }} />
                    </button>
                  </div>
                </Field>

                {/* Rent fields — per-day rate for each day tier (slab pricing) */}
                {offersRent && (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 2 }}>
                        Rent per day, by tier (₹/day) <span style={{ color: "#dc2626" }}>*</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                        Charged slab-wise — e.g. 8 days = 7×(Day 1–7 rate) + 1×(Day 8–15 rate).
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {RENT_SLOTS.map((slot) => (
                          <div key={slot.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ flex: "0 0 92px", fontSize: 13, fontWeight: 600, color: "#475569" }}>{slot.label}</span>
                            <div style={{ position: "relative", flex: 1 }}>
                              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>₹</span>
                              <input style={{ ...inputStyle, paddingLeft: 26, paddingRight: 48 }} inputMode="numeric"
                                value={form.slotPrices[slot.key]}
                                onChange={(e) => setField("slotPrices", { ...form.slotPrices, [slot.key]: e.target.value.replace(/[^0-9]/g, "") })}
                                placeholder={slot.placeholder} />
                              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 11 }}>/day</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {errors.slots && <span style={{ display: "block", fontSize: 11, color: "#dc2626", marginTop: 6 }}>{errors.slots}</span>}
                      {/* Owner-side worked example for a full 30 days */}
                      {RENT_SLOTS.some((s) => Number(form.slotPrices[s.key]) > 0) && (
                        <div style={{ marginTop: 10, background: "#F8FAFC", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Example: a 30-day rental</div>
                          {computeRent(30, form.slotPrices).rows.map((r) => (
                            <Row key={r.tier.key} label={`Day ${r.fromDay}–${r.toDay} · ${r.days} × ₹${r.rate}`} value={`₹${r.cost}`} />
                          ))}
                          <div style={{ borderTop: "1px dashed #e2e8f0", margin: "6px 0" }} />
                          <Row label="Total for 30 days" value={`₹${computeRent(30, form.slotPrices).total}`} strong />
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <Field label="Deposit (₹)" required error={errors.deposit} style={{ flex: 1 }}>
                        <input style={inputStyle} value={form.deposit} onChange={(e) => setField("deposit", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 250" inputMode="numeric" />
                      </Field>
                      <Field label="Available from" style={{ flex: 1 }}>
                        <input style={inputStyle} type="date" value={form.availableFrom} onChange={(e) => setField("availableFrom", e.target.value)} />
                      </Field>
                    </div>

                    {/* Max rental length, set by the lister */}
                    <Field label="Maximum rental days">
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button type="button" onClick={() => setField("maxDays", Math.max(1, (Number(form.maxDays) || 30) - 1))}
                          style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#2563EB", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>−</button>
                        <input
                          value={form.maxDays}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setField("maxDays", v === "" ? "" : Math.min(30, Number(v)));
                          }}
                          onBlur={() => setField("maxDays", Math.min(30, Math.max(1, Number(form.maxDays) || 30)))}
                          inputMode="numeric"
                          style={{ ...inputStyle, textAlign: "center", flex: 1 }} />
                        <button type="button" onClick={() => setField("maxDays", Math.min(30, (Number(form.maxDays) || 30) + 1))}
                          style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#2563EB", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>+</button>
                      </div>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "block" }}>
                        Renters can keep the book up to {Number(form.maxDays) || 30} days. Platform max is 30.
                      </span>
                    </Field>

                    {/* Auto-sell provision */}
                    <button type="button" onClick={() => setField("autoSell", !form.autoSell)}
                      style={{ display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", width: "100%", background: form.autoSell ? "#FFF7ED" : "#fff", border: `1px solid ${form.autoSell ? "#fed7aa" : "#e2e8f0"}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                      <span style={{ flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: form.autoSell ? "#ea580c" : "#fff", border: form.autoSell ? "none" : "1.5px solid #cbd5e1", color: "#fff", fontSize: 12 }}>
                        {form.autoSell && <FaCheck />}
                      </span>
                      <span style={{ fontSize: 12, color: "#9a3412" }}>
                        <strong>Auto-sell if not returned in {Number(form.maxDays) || 30} days.</strong> If the renter does not return the book within the {Number(form.maxDays) || 30}-day window, it is treated as sold — the security deposit lapses and is kept as the sale price.
                      </span>
                    </button>

                    {full30Rent > 0 && (
                      <div style={{ background: "#ECFDF5", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#15803d", fontSize: 13, marginBottom: 8 }}>
                          <FaRupeeSign /> Your earnings (full 30-day rental)
                        </div>
                        <Row label="Total rent collected" value={`₹${full30Rent}`} />
                        <Row label={`Platform fee (${Math.round((1 - OWNER_SHARE) * 100)}%)`} value={`− ₹${full30Rent - monthlyEarning}`} />
                        <div style={{ borderTop: "1px dashed #bbf7d0", margin: "8px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, color: "#15803d", fontSize: 14 }}>You receive</span>
                          <span style={{ fontWeight: 800, color: "#15803d", fontSize: 16 }}>₹{monthlyEarning}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#16a34a", marginTop: 6 }}>
                          Estimate for one 30-day rental. Shorter rentals earn proportionally less.
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Sell fields */}
                {offersSell && (
                  <>
                    <div style={{ display: "flex", gap: 12 }}>
                      <Field label="MRP (₹)" style={{ flex: 1 }}>
                        <input style={inputStyle} value={form.mrp} onChange={(e) => setField("mrp", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Printed price" inputMode="numeric" />
                      </Field>
                      <Field label="Your selling price (₹)" required error={errors.sellPrice} style={{ flex: 1 }}>
                        <input style={inputStyle} value={form.sellPrice} onChange={(e) => setField("sellPrice", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 180" inputMode="numeric" />
                      </Field>
                    </div>
                    {sellSaving > 0 && Number(form.sellPrice) > 0 && (
                      <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                        Buyer saves ₹{sellSaving} ({sellDiscountPct}% off MRP)
                      </div>
                    )}

                    {/* Delivery breakdown — Shiprocket + premium + commission */}
                    <div style={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#0f172a", fontSize: 13, marginBottom: 8 }}>
                        <FaTruck style={{ color: "#2563EB" }} /> Delivery charge
                      </div>
                      <Row label="Shiprocket shipping (est.)" value={`₹${delivery.base}`} />
                      <Row label="Handling premium" value={`₹${delivery.premium}`} />
                      <Row label={`Platform commission (${Math.round(DELIVERY_COMMISSION_PCT * 100)}%)`} value={`₹${delivery.commission}`} />
                      <div style={{ borderTop: "1px dashed #e2e8f0", margin: "8px 0" }} />
                      <Row label="Delivery charged to buyer" value={`₹${buyerDelivery}`} strong />
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                        Final shipping is quoted live by Shiprocket at checkout (based on weight &amp; pincodes). This is an estimate.
                      </div>
                    </div>

                    {Number(form.sellPrice) > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#EFF6FF", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 14px" }}>
                        <span style={{ fontSize: 20, color: "#2563EB" }}><FaTags /></span>
                        <div>
                          <div style={{ fontWeight: 800, color: "#1d4ed8" }}>Buyer pays ₹{sellTotal}</div>
                          <div style={{ fontSize: 11, color: "#2563EB" }}>₹{form.sellPrice} book + ₹{buyerDelivery} delivery</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Step 4 — Review */}
            {step === 4 && (
              <>
                <div style={{ display: "flex", gap: 14 }}>
                  <BookThumb book={form} w={70} h={96} fz={26} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{form.title || "Untitled book"}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{form.author || "Unknown author"}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <Pill>{form.category}</Pill><Pill>{form.condition}</Pill><Pill>{form.language}</Pill>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}><TypeBadge type={form.listingType} /></div>
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 14, marginTop: 4 }}>
                  <Row label="City" value={form.city || "—"} />
                  {form.address && <Row label="Address" value={form.address} />}
                  {form.publisher && <Row label="Publisher" value={form.publisher} />}
                  {form.edition && <Row label="Edition" value={form.edition} />}
                  {form.isbn && <Row label="ISBN" value={form.isbn} />}
                  {offersRent && <>
                    <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0" }} />
                    {RENT_SLOTS.map((s) => (
                      <Row key={s.key} label={`Rent · ${s.label}`} value={`₹${form.slotPrices[s.key] || 0}/day`} />
                    ))}
                    <Row label="Security deposit" value={`₹${form.deposit || 0}`} />
                    {form.availableFrom && <Row label="Available from" value={form.availableFrom} />}
                    <Row label="Maximum rental" value={`${Number(form.maxDays) || 30} days`} />
                    {form.autoSell && <Row label={`Auto-sell after ${Number(form.maxDays) || 30} days`} value="Yes (deposit lapses)" />}
                    <Row label="Est. monthly earnings" value={`≈ ₹${monthlyEarning}`} strong />
                  </>}
                  {offersSell && <>
                    <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0" }} />
                    {Number(form.mrp) > 0 && <Row label="MRP" value={`₹${form.mrp}`} />}
                    <Row label="Selling price" value={`₹${form.sellPrice || 0}`} />
                    <Row label="Delivery (Shiprocket + premium + commission)" value={`₹${buyerDelivery}`} />
                    <Row label="Buyer pays" value={`₹${sellTotal}`} strong />
                  </>}
                </div>

                {/* Admin approval notice */}
                <div style={{ display: "flex", gap: 10, background: "#FFF7ED", border: "1px solid #fed7aa", borderRadius: 12, padding: "12px 14px" }}>
                  <span style={{ fontSize: 18, color: "#ea580c", marginTop: 1 }}><FaCheckCircle /></span>
                  <div style={{ fontSize: 12, color: "#9a3412" }}>
                    Your listing will be sent to our team for a quick review. It goes live only after admin approval — usually within a few hours.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Wizard nav */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={prev}
              style={{ flex: 1, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 12, padding: "13px", fontWeight: 600, cursor: "pointer" }}>
              {step === 0 ? "Cancel" : "Back"}
            </button>
            <button type="button" onClick={next}
              style={{ flex: 2, border: "none", borderRadius: 12, padding: "13px", background: "#2563EB", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {step === WIZARD_STEPS.length - 1 ? (form.id ? "Resubmit for approval" : "Submit for approval") : <>Continue <FaArrowRight /></>}
            </button>
          </div>

          <LocationPickerSheet
            open={locPickerOpen}
            onClose={() => setLocPickerOpen(false)}
            onSelect={handlePickPlace}
            onUseCurrent={handleUseCurrentLocation}
            currentLabel={form.city || undefined}
            allowFreeText
          />
        </div>
      )}

      {view === "published" && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 54, color: "#ea580c", marginBottom: 10 }}><FaCheckCircle /></div>
          <h2 style={{ margin: "0 0 6px", color: "#0f172a" }}>Sent for approval!</h2>
          <p style={{ color: "#64748b", fontSize: 14, maxWidth: 360, margin: "0 auto 4px" }}>
            <strong>{form.title}</strong> has been submitted. Our team will review it and it will go live
            for readers near {form.city || "you"} once approved — usually within a few hours.
          </p>
          {offersRent && (
            <p style={{ color: "#16a34a", fontSize: 13, fontWeight: 600, maxWidth: 360, margin: "10px auto 20px" }}>
              Once live, you could earn ≈ ₹{monthlyEarning} per 30-day rental from this book.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, maxWidth: 360, margin: "20px auto 0" }}>
            <button type="button" onClick={() => goTo("my-books")}
              style={{ flex: 1, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 12, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
              View my listings
            </button>
            <button type="button" onClick={startLend}
              style={{ flex: 1, border: "none", background: "#2563EB", color: "#fff", borderRadius: 12, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
              List another
            </button>
          </div>
        </div>
      )}

      {view === "detail" && selected && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 14, background: "#fff", border: "1px solid #eef2f7", borderRadius: 16, padding: 16 }}>
            <BookThumb book={selected} w={80} h={108} fz={30} zoomable />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{selected.title}</h2>
              <div style={{ color: "#64748b", fontSize: 13 }}>{selected.author}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                <RatingInline book={selected} userRatings={userRatings} showCount />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FaMapMarkerAlt /> {selected.city}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <Pill>{selected.category}</Pill><Pill>{selected.condition}</Pill>
              </div>
            </div>
          </div>

          {/* Interactive: the user's own rating updates the real average */}
          <RateBox book={selected} userRatings={userRatings} onRate={(s) => rateBook(selected.id, s)} onTakeaway={(t) => setTakeaway(selected.id, t)} />

          {/* Reader takeaways */}
          <TakeawaysSection book={selected} userRatings={userRatings} />

          {/* Day chooser */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>How many days?</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" onClick={() => setDays((d) => Math.max(1, d - 1))}
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#2563EB", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>−</button>
                <span style={{ minWidth: 56, textAlign: "center", fontWeight: 800, color: "#0f172a" }}>{days} {days === 1 ? "day" : "days"}</span>
                <button type="button" onClick={() => setDays((d) => Math.min(selMaxDays, d + 1))}
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#2563EB", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>+</button>
              </div>
            </div>
            {/* Quick presets (only those within this book's max) */}
            <div style={{ display: "flex", gap: 8 }}>
              {[7, 15, 30].filter((d) => d <= selMaxDays).map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
                    border: days === d ? "2px solid #2563EB" : "1px solid #e2e8f0",
                    background: days === d ? "#EFF6FF" : "#fff", color: days === d ? "#2563EB" : "#475569" }}>
                  {d} days
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Max for this book: {selMaxDays} days</div>
          </div>

          {/* Slab breakdown */}
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Rent breakdown ({days} {days === 1 ? "day" : "days"})</div>
            {rentBreakdown.rows.map((r) => (
              <Row key={r.tier.key}
                label={`Day ${r.fromDay}–${r.toDay} · ${r.days} × ₹${r.rate}/day`}
                value={`₹${r.cost}`} />
            ))}
            <div style={{ borderTop: "1px dashed #e2e8f0", margin: "8px 0" }} />
            <Row label="Rent subtotal" value={`₹${rentAmount}`} />
            <Row label="Security deposit (refundable)" value={`₹${selected.deposit}`} />
            <Row label="Platform fee" value={`₹${PLATFORM_FEE}`} />
            <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0" }} />
            <Row label="Total payable" value={`₹${total}`} strong />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              The {days}-day rental period starts once the book is delivered to you. ₹{selected.deposit} deposit is refunded after you return it to the owner. If not returned within {selMaxDays} days, it is treated as sold — your deposit becomes the purchase price.
            </div>
          </div>

          {/* Return reminder preference */}
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
              <FaRegBell style={{ color: "#2563EB" }} /> Return reminder
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
              We&apos;ll remind you before the rental ends so you can return on time and get your deposit back.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map((d) => (
                <button key={d} type="button" onClick={() => setReminderDays(d)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
                    border: reminderDays === d ? "2px solid #2563EB" : "1px solid #e2e8f0",
                    background: reminderDays === d ? "#EFF6FF" : "#fff", color: reminderDays === d ? "#2563EB" : "#475569" }}>
                  {d} day{d > 1 ? "s" : ""} before
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => goTo("success")}
            style={{ width: "100%", marginTop: 16, border: "none", borderRadius: 12, padding: "14px", background: "#2563EB", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Request to rent · ₹{total}
          </button>
        </div>
      )}

      {view === "success" && selected && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 54, color: "#16a34a", marginBottom: 10 }}><FaCheckCircle /></div>
          <h2 style={{ margin: "0 0 6px", color: "#0f172a" }}>Rental requested!</h2>
          <p style={{ color: "#64748b", fontSize: 14, maxWidth: 360, margin: "0 auto 4px" }}>
            Your request for <strong>{selected.title}</strong> ({days} {days === 1 ? "day" : "days"}, ₹{rentAmount}) has been sent to the owner.
          </p>
          <p style={{ color: "#64748b", fontSize: 13, maxWidth: 360, margin: "0 auto 10px" }}>
            You will be notified once the owner approves. Your {days}-day period starts on delivery.
          </p>
          <p style={{ color: "#2563EB", fontSize: 12, fontWeight: 600, maxWidth: 360, margin: "0 auto 20px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FaRegBell /> We&apos;ll remind you {reminderDays} day{reminderDays > 1 ? "s" : ""} before it&apos;s due.
          </p>
          <div style={{ display: "flex", gap: 10, maxWidth: 360, margin: "0 auto" }}>
            <button type="button" onClick={() => { setView("browse"); setSelected(null); }}
              style={{ flex: 1, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 12, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
              Browse more
            </button>
            <button type="button" onClick={() => navigate("/customer/app/home")}
              style={{ flex: 1, border: "none", background: "#2563EB", color: "#fff", borderRadius: 12, padding: "12px", fontWeight: 600, cursor: "pointer" }}>
              Go home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────── small presentational helpers ───────────── */

const Stepper = ({ steps, current, onJump }) => (
  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
    {steps.map((s, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i === steps.length - 1 ? "0 0 auto" : 1 }}>
          <button type="button" onClick={() => onJump(i)} aria-label={s.title}
            style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0, cursor: done ? "pointer" : "default",
              border: "none", fontSize: 13, fontWeight: 700,
              background: done ? "#16a34a" : active ? "#2563EB" : "#e2e8f0",
              color: done || active ? "#fff" : "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            {done ? <FaCheckCircle /> : i + 1}
          </button>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 3, margin: "0 6px", borderRadius: 2, background: i < current ? "#16a34a" : "#e2e8f0" }} />
          )}
        </div>
      );
    })}
  </div>
);

const BookThumb = ({ book, w, h, fz, zoomable }) => {
  const [zoom, setZoom] = useState(false);
  const open = zoomable && book?.photo; // only zoom when there's a real cover image

  const openZoom = (e) => { e.stopPropagation(); e.preventDefault(); setZoom(true); };
  const closeZoom = (e) => { e?.stopPropagation?.(); setZoom(false); };

  return (
    <>
      <div
        onClick={open ? openZoom : undefined}
        style={{
          width: w, height: h, borderRadius: 10, flexShrink: 0, overflow: "hidden",
          background: book?.photo ? `center/cover no-repeat url(${book.photo})` : (book?.cover || "#EEF2FF"),
          color: book?.accent || "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fz,
          cursor: open ? "zoom-in" : undefined,
        }}>
        {!book?.photo && (book?.title ? <FaBook /> : <FaRegImage />)}
      </div>

      {zoom && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeZoom}
          style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <button type="button" onClick={closeZoom} aria-label="Close"
            style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FaTimes />
          </button>
          <img
            src={book.photo}
            alt={book.title || "Book cover"}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "82vh", borderRadius: 12, boxShadow: "0 12px 50px rgba(0,0,0,0.5)", objectFit: "contain" }}
          />
          {book.title && (
            <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", color: "#fff", fontWeight: 600, fontSize: 15, padding: "0 20px" }}>
              {book.title}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
};

const LayoutBtn = ({ active, onClick, aria, children }) => (
  <button type="button" onClick={onClick} aria-label={aria} aria-pressed={active}
    style={{
      display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 30,
      border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14,
      background: active ? "#fff" : "transparent",
      color: active ? "#2563EB" : "#94a3b8",
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
    }}>
    {children}
  </button>
);

const Pill = ({ children }) => (
  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#F1F5F9", color: "#475569" }}>{children}</span>
);

const inputStyle = {
  width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
  fontSize: 14, color: "#0f172a", outline: "none", background: "#fff", boxSizing: "border-box",
};

const spinStyle = {
  display: "inline-block", width: 16, height: 16, borderRadius: "50%",
  border: "2px solid #bfdbfe", borderTopColor: "#2563EB", animation: "rab-spin 0.7s linear infinite",
};

const Field = ({ label, required, error, children, style }) => (
  <label style={{ display: "block", ...style }}>
    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
      {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
    </span>
    {children}
    {error && <span style={{ display: "block", fontSize: 11, color: "#dc2626", marginTop: 4 }}>{error}</span>}
  </label>
);

const Row = ({ label, value, strong }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
    <span style={{ fontSize: strong ? 15 : 13, color: strong ? "#0f172a" : "#475569", fontWeight: strong ? 800 : 400 }}>{label}</span>
    <span style={{ fontSize: strong ? 16 : 13, color: strong ? "#2563EB" : "#0f172a", fontWeight: strong ? 800 : 600 }}>{value}</span>
  </div>
);

// Compact "★ 4.7 (128)" display, blending seeded + real user ratings.
const RatingInline = ({ book, userRatings, showCount, small }) => {
  const { avg, count } = effectiveRating(book, userRatings);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#CA8A04", fontSize: small ? 11 : undefined }}>
      <FaStar /> {avg.toFixed(1)}{showCount || !small ? <span style={{ color: "#94a3b8" }}> ({count})</span> : null}
    </span>
  );
};

// Interactive 5-star rater + personal takeaway editor (takeaway unlocks after
// the user has rated the book).
const RateBox = ({ book, userRatings, onRate, onTakeaway }) => {
  const { avg, count, mine, takeaway } = effectiveRating(book, userRatings);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(takeaway || "");

  // Keep the draft in sync when switching between books.
  useEffect(() => { setDraft(takeaway || ""); setEditing(false); }, [book.id, takeaway]);

  return (
    <div style={{ marginTop: 16, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
            <FaStar style={{ color: "#CA8A04" }} /> {avg.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{count} ratings</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>{mine ? "Your rating" : "Rate this book"}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onClick={() => onRate(s)} aria-label={`Rate ${s} star`}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, padding: 0, color: s <= mine ? "#F59E0B" : "#cbd5e1" }}>
                <FaStar />
              </button>
            ))}
          </div>
        </div>
      </div>

      {mine > 0 && (
        <>
          <div style={{ borderTop: "1px solid #f1f5f9", margin: "12px 0 0" }} />
          {/* Existing takeaway, view mode */}
          {takeaway && !editing && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>Your takeaway</div>
              <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#334155", background: "#F8FAFC", borderRadius: 10, padding: "10px 12px" }}>
                <FaLightbulb style={{ color: "#CA8A04", flexShrink: 0, marginTop: 2 }} />
                <span style={{ flex: 1 }}>{takeaway}</span>
              </div>
              <button type="button" onClick={() => setEditing(true)}
                style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "#2563EB", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <FaEdit /> Edit takeaway
              </button>
            </div>
          )}
          {/* Add / edit mode */}
          {(!takeaway || editing) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Add your takeaway</div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                placeholder="What did this book teach you? Share a key idea for other readers…"
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => { onTakeaway(draft.trim()); setEditing(false); }}
                  style={{ border: "none", borderRadius: 10, padding: "9px 16px", background: "#2563EB", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {takeaway ? "Update" : "Post takeaway"}
                </button>
                {takeaway && (
                  <button type="button" onClick={() => { setDraft(takeaway); setEditing(false); }}
                    style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 16px", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Avatar bubble from a name's initial.
const Avatar = ({ name }) => (
  <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
    {(name || "?")[0].toUpperCase()}
  </span>
);

// Reader takeaways list: the user's own (if any) + sample community ones.
const TakeawaysSection = ({ book, userRatings }) => {
  const { mine, takeaway } = effectiveRating(book, userRatings);
  const community = communityTakeaways(book.id);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Reader takeaways</div>
      <div style={{ display: "grid", gap: 10 }}>
        {takeaway && (
          <div style={{ display: "flex", gap: 10, background: "#EFF6FF", border: "1px solid #bfdbfe", borderRadius: 12, padding: 12 }}>
            <Avatar name="You" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>You</span>
                <span style={{ display: "inline-flex", gap: 1, color: "#F59E0B", fontSize: 11 }}>
                  {Array.from({ length: mine }).map((_, i) => <FaStar key={i} />)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#334155", marginTop: 3 }}>{takeaway}</div>
            </div>
          </div>
        )}
        {community.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, padding: 12 }}>
            <Avatar name={t.by} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{t.by}</span>
                <span style={{ display: "inline-flex", gap: 1, color: "#F59E0B", fontSize: 11 }}>
                  {Array.from({ length: t.stars }).map((_, k) => <FaStar key={k} />)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#334155", marginTop: 3 }}>{t.text}</div>
            </div>
          </div>
        ))}
      </div>
      {!mine && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
          Rate this book above to add your own takeaway.
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const s = status || "Pending approval";
  const map = {
    "Pending approval": { c: "#9a3412", bg: "#ffedd5" },
    "Live": { c: "#16a34a", bg: "#dcfce7" },
    "Rejected": { c: "#dc2626", bg: "#fee2e2" },
  };
  const { c, bg } = map[s] || map["Pending approval"];
  return <span style={{ fontSize: 10, fontWeight: 700, color: c, background: bg, padding: "2px 7px", borderRadius: 999 }}>{s}</span>;
};

const TypeBadge = ({ type }) => {
  const label = { rent: "For rent", sell: "For sale", both: "Rent + Sale" }[type] || "For rent";
  return <span style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", padding: "2px 7px", borderRadius: 999 }}>{label}</span>;
};

/* ── History view: reading log + lending track-record ── */
const HistoryView = ({ readingHistory, lendingHistory }) => {
  const [tab, setTab] = useState("read"); // read | lent

  const lentByTitle = useMemo(() => {
    const m = {};
    lendingHistory.forEach((h) => { (m[h.title] = m[h.title] || []).push(h); });
    return m;
  }, [lendingHistory]);

  const totalEarned = lendingHistory.reduce((s, h) => s + h.earned, 0);

  return (
    <div style={{ padding: 16 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#eef2f7", borderRadius: 12, padding: 4 }}>
        {[{ k: "read", label: `Books read (${readingHistory.length})` }, { k: "lent", label: `Lent out (${lendingHistory.length})` }].map((t) => {
          const active = tab === t.k;
          return (
            <button key={t.k} type="button" onClick={() => setTab(t.k)}
              style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: active ? "#fff" : "transparent", color: active ? "#2563EB" : "#94a3b8", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "read" && (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {readingHistory.map((b) => (
            <div key={b.id} style={{ display: "flex", gap: 12, padding: 12, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14 }}>
              <BookThumb book={b} w={50} h={68} fz={20} zoomable />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{b.author}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#CA8A04" }}>
                    {Array.from({ length: b.rating }).map((_, i) => <FaStar key={i} />)}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FaCalendarAlt /> {b.finishedOn}</span>
                </div>
                <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, color: "#475569", background: "#F1F5F9", padding: "2px 9px", borderRadius: 999 }}>
                  {b.source}{b.days ? ` · ${b.days} days` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "lent" && (
        <>
          {/* Earnings summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, background: "#ECFDF5", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 14px" }}>
            <span style={{ fontSize: 22, color: "#16a34a" }}><FaRupeeSign /></span>
            <div>
              <div style={{ fontWeight: 800, color: "#15803d" }}>₹{totalEarned} earned</div>
              <div style={{ fontSize: 11, color: "#16a34a" }}>across {lendingHistory.length} rentals of your books</div>
            </div>
          </div>

          {Object.keys(lentByTitle).map((title) => {
            const rentals = lentByTitle[title];
            const earned = rentals.reduce((s, h) => s + h.earned, 0);
            return (
              <div key={title} style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <FaBook style={{ color: "#2563EB" }} /> {title}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#F5F3FF", padding: "3px 9px", borderRadius: 999 }}>
                    {rentals.length}× · ₹{earned}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {rentals.map((h) => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#fff", border: "1px solid #eef2f7", borderRadius: 12 }}>
                      <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
                        <FaUserCircle />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{h.renter}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FaMapMarkerAlt /> {h.city}</span>
                          <span>{h.from} → {h.to}</span>
                          <span>{h.days} days</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, color: "#16a34a", fontSize: 14 }}>₹{h.earned}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                          color: h.status === "Active" ? "#1d4ed8" : "#16a34a",
                          background: h.status === "Active" ? "#dbeafe" : "#dcfce7" }}>{h.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {lendingHistory.length === 0 && (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 16px" }}>No rentals yet.</div>
          )}
        </>
      )}
    </div>
  );
};

/* ── My Library: personal digital bookshelf ──────────────
 * Not for rent or sale — just a private catalogue of books the user owns,
 * with a reading shelf, personal rating and a "takeaway" note per book.
 */
const LIB_EMPTY = { id: null, photo: null, title: "", author: "", isbn: "", shelf: "want", rating: 0, takeaway: "" };

const LibraryView = () => {
  const [books, setBooks] = useState(() => loadLibrary());
  const [mode, setMode] = useState("list"); // list | form
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(LIB_EMPTY);
  const [err, setErr] = useState("");
  const [lookup, setLookup] = useState({ status: "idle" });
  const fileRef = useRef(null);

  useEffect(() => { saveLibrary(books); }, [books]);

  // ISBN auto-fill (same OpenLibrary→Google fallback used by the listing flow).
  const isbnDigits = normaliseIsbn(form.isbn);
  useEffect(() => {
    if (mode !== "form") return;
    if (isbnDigits.length !== 10 && isbnDigits.length !== 13) {
      setLookup((s) => (s.status === "idle" ? s : { status: "idle" }));
      return;
    }
    let cancelled = false;
    setLookup({ status: "loading" });
    const t = setTimeout(async () => {
      try {
        const data = await lookupIsbn(isbnDigits);
        if (cancelled) return;
        if (!data) { setLookup({ status: "notfound" }); return; }
        setLookup({ status: "found" });
        setForm((f) => ({ ...f, title: f.title || data.title, author: f.author || data.author, photo: f.photo || data.thumbnail || null }));
      } catch { if (!cancelled) setLookup({ status: "error" }); }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isbnDigits, mode]);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setF("photo", r.result);
    r.readAsDataURL(file);
  };

  const openAdd = () => { setForm(LIB_EMPTY); setErr(""); setLookup({ status: "idle" }); setMode("form"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openEdit = (b) => { setForm({ ...LIB_EMPTY, ...b }); setErr(""); setLookup({ status: "idle" }); setMode("form"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const save = () => {
    if (!form.title.trim()) { setErr("Book title is required"); return; }
    const payload = { ...form, title: form.title.trim(), author: form.author.trim() };
    setBooks((prev) => {
      if (form.id) return prev.map((b) => (b.id === form.id ? payload : b));
      return [{ ...payload, id: `lib-${Date.now().toString(36)}`, addedAt: Date.now() }, ...prev];
    });
    setMode("list");
  };

  const remove = (id) => setBooks((prev) => prev.filter((b) => b.id !== id));
  const moveShelf = (id, shelf) => setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, shelf } : b)));

  const counts = useMemo(() => {
    const c = { all: books.length };
    SHELVES.forEach((s) => { c[s.key] = books.filter((b) => b.shelf === s.key).length; });
    return c;
  }, [books]);

  const shown = filter === "all" ? books : books.filter((b) => b.shelf === filter);

  /* ── Add / edit form ── */
  if (mode === "form") {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 18, color: "#0f172a" }}>{form.id ? "Edit book" : "Add to my library"}</h2>
        <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 16, padding: 16, display: "grid", gap: 14 }}>
          {/* Cover */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <BookThumb book={form} w={64} h={88} fz={24} />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#2563EB", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <FaCamera /> {form.photo ? "Change cover" : "Add cover"}
            </button>
            {form.photo && (
              <button type="button" onClick={() => setF("photo", null)}
                style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: 13, cursor: "pointer" }}>Remove</button>
            )}
          </div>

          <Field label="ISBN">
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} value={form.isbn}
                onChange={(e) => setF("isbn", e.target.value.replace(/[^0-9Xx-]/g, ""))}
                placeholder="Scan or enter ISBN to auto-fill" inputMode="numeric" />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#2563EB" }}>
                {lookup.status === "loading" ? <span style={spinStyle} /> : <FaBarcode />}
              </span>
            </div>
            {lookup.status === "loading" && <span style={{ fontSize: 11, color: "#2563EB", marginTop: 4, display: "block" }}>Looking up…</span>}
            {lookup.status === "found" && <span style={{ fontSize: 11, color: "#16a34a", marginTop: 4, display: "block" }}>✓ Auto-filled — edit if needed</span>}
            {lookup.status === "notfound" && <span style={{ fontSize: 11, color: "#ea580c", marginTop: 4, display: "block" }}>No match — fill in manually</span>}
          </Field>

          <Field label="Book title" required error={err}>
            <input style={inputStyle} value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="e.g. Sapiens" />
          </Field>
          <Field label="Author">
            <input style={inputStyle} value={form.author} onChange={(e) => setF("author", e.target.value)} placeholder="e.g. Yuval Noah Harari" />
          </Field>

          {/* Shelf */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Shelf</div>
            <div style={{ display: "flex", gap: 8 }}>
              {SHELVES.map((s) => {
                const active = form.shelf === s.key;
                return (
                  <button key={s.key} type="button" onClick={() => setF("shelf", s.key)}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
                      border: active ? `2px solid ${s.color}` : "1px solid #e2e8f0",
                      background: active ? s.bg : "#fff", color: active ? s.color : "#475569" }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal rating */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>My rating</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setF("rating", s === form.rating ? 0 : s)} aria-label={`${s} star`}
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 26, padding: 0, color: s <= form.rating ? "#F59E0B" : "#cbd5e1" }}>
                  <FaStar />
                </button>
              ))}
            </div>
          </div>

          {/* Takeaway */}
          <Field label="My takeaway">
            <textarea value={form.takeaway} onChange={(e) => setF("takeaway", e.target.value)} rows={3}
              placeholder="What did this book teach you? Key idea, favourite quote…"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setMode("list")}
            style={{ flex: 1, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 12, padding: "13px", fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={save}
            style={{ flex: 2, border: "none", borderRadius: 12, padding: "13px", background: "#2563EB", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            {form.id ? "Save changes" : "Add to library"}
          </button>
        </div>
      </div>
    );
  }

  /* ── Shelf list ── */
  return (
    <div style={{ padding: 16 }}>
      <button type="button" onClick={openAdd}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, border: "1px dashed #2563EB", background: "#EFF6FF", color: "#2563EB", fontWeight: 600, cursor: "pointer" }}>
        <FaPlusCircle /> Add a book to my library
      </button>

      {/* Shelf filter */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
        {[{ key: "all", label: "All" }, ...SHELVES].map((s) => {
          const active = filter === s.key;
          return (
            <button key={s.key} type="button" onClick={() => setFilter(s.key)}
              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13,
                border: active ? "1px solid #2563EB" : "1px solid #e2e8f0",
                background: active ? "#2563EB" : "#fff", color: active ? "#fff" : "#475569" }}>
              {s.label} {counts[s.key] ? `(${counts[s.key]})` : ""}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", color: "#94a3b8", padding: "48px 16px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}><FaRegBookmark /></div>
          {books.length === 0 ? "Your library is empty. Add the books you own." : "No books on this shelf yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {shown.map((b) => {
            const sm = shelfMeta(b.shelf);
            return (
              <div key={b.id} style={{ display: "flex", gap: 12, padding: 12, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14 }}>
                <BookThumb book={b} w={50} h={68} fz={20} zoomable />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{b.title}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sm.color, background: sm.bg, padding: "2px 8px", borderRadius: 999 }}>{sm.label}</span>
                  </div>
                  {b.author && <div style={{ fontSize: 12, color: "#64748b" }}>{b.author}</div>}
                  {b.rating > 0 && (
                    <div style={{ display: "inline-flex", gap: 2, marginTop: 4, color: "#F59E0B", fontSize: 12 }}>
                      {Array.from({ length: b.rating }).map((_, i) => <FaStar key={i} />)}
                    </div>
                  )}
                  {b.takeaway && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 12, color: "#475569", background: "#F8FAFC", borderRadius: 8, padding: "8px 10px" }}>
                      <FaLightbulb style={{ color: "#CA8A04", flexShrink: 0, marginTop: 2 }} />
                      <span>{b.takeaway}</span>
                    </div>
                  )}
                  {/* Quick shelf switch */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {SHELVES.filter((s) => s.key !== b.shelf).map((s) => (
                      <button key={s.key} type="button" onClick={() => moveShelf(b.id, s.key)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <FaBookOpen style={{ fontSize: 10 }} /> {s.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => openEdit(b)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: "1px solid #2563EB", background: "#fff", color: "#2563EB", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <FaEdit /> Edit
                    </button>
                    <button type="button" onClick={() => remove(b.id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <FaTrashAlt /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RentABookScreen;
