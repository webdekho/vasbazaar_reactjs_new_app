import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBook, FaSearch, FaStar, FaMapMarkerAlt, FaCheckCircle, FaPlusCircle } from "react-icons/fa";

const PLATFORM_FEE = 15;

// Sample catalogue. Replace with a real API (rentabookService.getBooks) when the
// backend is ready — the UI below is data-driven so only this source changes.
const SAMPLE_BOOKS = [
  { id: "b1", title: "Atomic Habits", author: "James Clear", category: "Self Help", city: "Pune", condition: "Excellent", rating: 4.8, rentPerDay: 6, deposit: 250, cover: "#EEF2FF", accent: "#4F46E5" },
  { id: "b2", title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", category: "Business", city: "Mumbai", condition: "Good", rating: 4.6, rentPerDay: 5, deposit: 200, cover: "#ECFDF5", accent: "#059669" },
  { id: "b3", title: "Wings of Fire", author: "A.P.J. Abdul Kalam", category: "Biography", city: "Nagpur", condition: "Good", rating: 4.9, rentPerDay: 4, deposit: 180, cover: "#FEF2F2", accent: "#DC2626" },
  { id: "b4", title: "Concepts of Physics", author: "H.C. Verma", category: "Engineering", city: "Pune", condition: "Highlighted Notes", rating: 4.7, rentPerDay: 8, deposit: 400, cover: "#FFF7ED", accent: "#EA580C" },
  { id: "b5", title: "Ikigai", author: "Hector Garcia", category: "Spiritual", city: "Nashik", condition: "New", rating: 4.5, rentPerDay: 7, deposit: 300, cover: "#F5F3FF", accent: "#7C3AED" },
  { id: "b6", title: "The Alchemist", author: "Paulo Coelho", category: "Fiction", city: "Mumbai", condition: "Excellent", rating: 4.8, rentPerDay: 5, deposit: 220, cover: "#FEFCE8", accent: "#CA8A04" },
];

const DURATIONS = [7, 15, 30];

const RentABookScreen = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("browse"); // browse | detail | success
  const [selected, setSelected] = useState(null);
  const [days, setDays] = useState(7);

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAMPLE_BOOKS;
    return SAMPLE_BOOKS.filter((b) =>
      `${b.title} ${b.author} ${b.category} ${b.city}`.toLowerCase().includes(q)
    );
  }, [query]);

  const rentAmount = selected ? selected.rentPerDay * days : 0;
  const total = selected ? rentAmount + selected.deposit + PLATFORM_FEE : 0;

  const openDetail = (book) => {
    setSelected(book);
    setDays(7);
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (view === "detail") { setView("browse"); return; }
    if (view === "success") { setView("browse"); setSelected(null); return; }
    navigate(-1);
  };

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC", paddingBottom: 90 }}>
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
          <strong style={{ fontSize: 17, color: "#0f172a" }}>Rent a Book</strong>
        </div>
      </div>

      {view === "browse" && (
        <div style={{ padding: 16 }}>
          {/* Hero */}
          <div style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)", color: "#fff", borderRadius: 16, padding: "18px 18px 20px" }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>Read More. Spend Less.</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Rent books from people near you, or earn by lending the ones you do not use.
            </div>
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <FaSearch style={{ color: "#94a3b8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, category or city"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#0f172a" }}
            />
          </div>

          {/* List your book CTA */}
          <button type="button" onClick={() => setView("list-owner")}
            style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, border: "1px dashed #2563EB", background: "#EFF6FF", color: "#2563EB", fontWeight: 600, cursor: "pointer" }}>
            <FaPlusCircle /> List your book &amp; earn
          </button>

          {/* Results */}
          <div style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>{books.length} books available</div>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {books.map((book) => (
              <button key={book.id} type="button" onClick={() => openDetail(book)}
                style={{ display: "flex", gap: 12, textAlign: "left", padding: 12, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, cursor: "pointer" }}>
                <div style={{ width: 56, height: 76, borderRadius: 8, background: book.cover, color: book.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                  <FaBook />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{book.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{book.author}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#CA8A04" }}><FaStar /> {book.rating}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FaMapMarkerAlt /> {book.city}</span>
                    <span>{book.condition}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: "#2563EB" }}>₹{book.rentPerDay}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>per day</div>
                </div>
              </button>
            ))}
            {books.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No books match “{query}”.</div>
            )}
          </div>
        </div>
      )}

      {view === "list-owner" && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, color: "#2563EB", marginBottom: 8 }}><FaPlusCircle /></div>
          <h2 style={{ margin: "0 0 6px", color: "#0f172a" }}>Lend your books</h2>
          <p style={{ color: "#64748b", fontSize: 14, maxWidth: 360, margin: "0 auto 18px" }}>
            Listing for book owners is launching soon. You will be able to scan an ISBN, set a rent and deposit, and start earning.
          </p>
          <button type="button" onClick={() => setView("browse")}
            style={{ border: "none", borderRadius: 12, padding: "12px 22px", background: "#2563EB", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Browse books instead
          </button>
        </div>
      )}

      {view === "detail" && selected && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 14, background: "#fff", border: "1px solid #eef2f7", borderRadius: 16, padding: 16 }}>
            <div style={{ width: 80, height: 108, borderRadius: 10, background: selected.cover, color: selected.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 30 }}>
              <FaBook />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{selected.title}</h2>
              <div style={{ color: "#64748b", fontSize: 13 }}>{selected.author}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 12, color: "#475569", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#CA8A04" }}><FaStar /> {selected.rating}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FaMapMarkerAlt /> {selected.city}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#F1F5F9", color: "#475569" }}>{selected.category}</span>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#F1F5F9", color: "#475569" }}>{selected.condition}</span>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Rental duration</div>
            <div style={{ display: "flex", gap: 10 }}>
              {DURATIONS.map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontWeight: 600,
                    border: days === d ? "2px solid #2563EB" : "1px solid #e2e8f0",
                    background: days === d ? "#EFF6FF" : "#fff", color: days === d ? "#2563EB" : "#475569",
                  }}>
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {/* Cost breakdown */}
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, padding: 16 }}>
            <Row label={`Rent (₹${selected.rentPerDay} × ${days} days)`} value={`₹${rentAmount}`} />
            <Row label="Security deposit (refundable)" value={`₹${selected.deposit}`} />
            <Row label="Platform fee" value={`₹${PLATFORM_FEE}`} />
            <div style={{ borderTop: "1px dashed #e2e8f0", margin: "10px 0" }} />
            <Row label="Total payable" value={`₹${total}`} strong />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              ₹{selected.deposit} deposit is refunded when you return the book in good condition.
            </div>
          </div>

          <button type="button" onClick={() => { setView("success"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
            Your request for <strong>{selected.title}</strong> for {days} days has been sent to the owner.
          </p>
          <p style={{ color: "#64748b", fontSize: 13, maxWidth: 360, margin: "0 auto 20px" }}>
            You will be notified once the owner approves. Pickup or delivery is arranged after approval.
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

const Row = ({ label, value, strong }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
    <span style={{ fontSize: strong ? 15 : 13, color: strong ? "#0f172a" : "#475569", fontWeight: strong ? 800 : 400 }}>{label}</span>
    <span style={{ fontSize: strong ? 16 : 13, color: strong ? "#2563EB" : "#0f172a", fontWeight: strong ? 800 : 600 }}>{value}</span>
  </div>
);

export default RentABookScreen;
