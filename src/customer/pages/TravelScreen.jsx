import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPlaneDeparture, FaPlaneArrival, FaCalendarAlt,
  FaSearch, FaExchangeAlt, FaTicketAlt, FaUsers, FaChild, FaBaby,
  FaStar, FaGlobeAmericas,
} from "react-icons/fa";
import { travelService } from "../services/travelService";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";

const FALLBACK_AIRPORTS = [
  { airportCode: "BOM", cityName: "Mumbai", airportName: "Chhatrapati Shivaji Intl" },
  { airportCode: "DEL", cityName: "Delhi", airportName: "Indira Gandhi Intl" },
  { airportCode: "BLR", cityName: "Bangalore", airportName: "Kempegowda Intl" },
  { airportCode: "HYD", cityName: "Hyderabad", airportName: "Rajiv Gandhi Intl" },
  { airportCode: "MAA", cityName: "Chennai", airportName: "Chennai Intl" },
  { airportCode: "CCU", cityName: "Kolkata", airportName: "Netaji Subhas Chandra Bose Intl" },
  { airportCode: "PNQ", cityName: "Pune", airportName: "Pune Airport" },
  { airportCode: "AMD", cityName: "Ahmedabad", airportName: "Sardar Vallabhbhai Patel Intl" },
  { airportCode: "JAI", cityName: "Jaipur", airportName: "Jaipur Intl" },
  { airportCode: "GOI", cityName: "Goa", airportName: "Manohar Intl" },
];

const TRAVEL_CLASS_MAP = { economy: "ECONOMY", premium_economy: "PREMIUM_ECONOMY", business: "BUSINESS", first: "FIRST" };

const TravelScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isLight = theme === "light";
  const [tripType, setTripType] = useState("oneway");
  const [focusedField, setFocusedField] = useState("");
  const [airports, setAirports] = useState(FALLBACK_AIRPORTS);

  const [form, setForm] = useState({
    fromCity: "", toCity: "", date: "", returnDate: "",
    adultCount: "1", childCount: "0", infantCount: "0", travelClass: "economy",
  });

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [errors, setErrors] = useState({});
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const res = await travelService.getAirports();
        if (res.success && res.data?.data?.data) {
          const list = res.data.data.data;
          if (Array.isArray(list) && list.length > 0) setAirports(list);
        }
      } catch (e) { /* fallback */ }
    })();
  }, []);

  const resolveCode = useCallback((input) => {
    if (!input) return "";
    const t = input.trim();
    const byCode = airports.find((a) => a.airportCode === t.toUpperCase());
    if (byCode) return byCode.airportCode;
    const byCity = airports.find((a) => a.cityName?.toLowerCase() === t.toLowerCase());
    if (byCity) return byCity.airportCode;
    const partial = airports.find((a) => a.cityName?.toLowerCase().includes(t.toLowerCase()) || a.airportName?.toLowerCase().includes(t.toLowerCase()));
    return partial?.airportCode || t.toUpperCase().substring(0, 3);
  }, [airports]);

  const getAirportInfo = (cityName) => airports.find((a) => a.cityName === cityName);
  const swap = () => setForm((f) => ({ ...f, fromCity: f.toCity, toCity: f.fromCity }));
  const ff = (name) => ({ onFocus: () => setFocusedField(name), onBlur: () => setFocusedField("") });

  const handleSearch = async (e) => {
    e.preventDefault();
    showToast("Coming Soon!", "info");
  };

  // Theme-aware colors
  const accent = "#40E0D0";
  const accentBlue = "#007BFF";
  const t = {
    pageBg: isLight ? "#F8FAFC" : "var(--cm-bg, #0B0B0B)",
    cardBg: isLight ? "#FFFFFF" : "var(--cm-card, #1A1A1A)",
    cardBorder: isLight ? "#E2E8F0" : "rgba(255,255,255,0.06)",
    text: isLight ? "#0F172A" : "#fff",
    textSoft: isLight ? "#64748B" : "rgba(255,255,255,0.5)",
    textMuted: isLight ? "#94A3B8" : "rgba(255,255,255,0.3)",
    inputBg: isLight ? "#F8FAFC" : "rgba(255,255,255,0.04)",
    focusBg: isLight ? "rgba(0,123,255,0.04)" : "rgba(64,224,208,0.06)",
    focusBorder: isLight ? accentBlue : accent,
    divider: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
    toggleBg: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)",
    toggleInactive: isLight ? "#94A3B8" : "rgba(255,255,255,0.4)",
    heroBg: isLight
      ? "linear-gradient(135deg, #E0F2FE 0%, #DBEAFE 40%, #EDE9FE 100%)"
      : "linear-gradient(135deg, rgba(64,224,208,0.08) 0%, rgba(0,123,255,0.08) 100%)",
    errBg: isLight ? "#FEF2F2" : "rgba(239,68,68,0.1)",
    errBorder: isLight ? "#FECACA" : "rgba(239,68,68,0.2)",
    errColor: isLight ? "#DC2626" : "#F87171",
  };

  const fieldStyle = (name) => ({
    padding: "16px 18px", borderBottom: `1px solid ${t.divider}`, transition: "all 0.2s",
    background: focusedField === name ? t.focusBg : "transparent",
    borderLeft: focusedField === name ? `3px solid ${t.focusBorder}` : "3px solid transparent",
  });

  const labelStyle = { display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: t.textMuted, marginBottom: 6 };
  const inputStyle = { width: "100%", background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 17, fontWeight: 600, padding: 0 };
  const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };
  const codeStyle = { fontSize: 22, fontWeight: 900, color: accent, opacity: 0.6, letterSpacing: "1px" };

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, paddingBottom: 40 }}>
      <style>{`
        @keyframes tv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes tv-pulse { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
        @keyframes tv-spin { to { transform: rotate(360deg) } }
        .tv2-swap:hover { transform: translateY(-50%) scale(1.1) rotate(180deg) !important; }
        .tv2-search:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(64,224,208,0.35) !important; }
        .tv2-search:active:not(:disabled) { transform: translateY(0); }
        select option { background: ${isLight ? "#fff" : "#1A1A1A"}; color: ${t.text}; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: ${isLight ? "none" : "invert(1) opacity(0.4)"}; cursor: pointer; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 0" }}>
        <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)", border: "none", color: t.text, cursor: "pointer", display: "grid", placeItems: "center", fontSize: 15 }}>
          <FaArrowLeft />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: "-0.3px" }}>Flights</h1>
        </div>
        <button onClick={() => navigate("/customer/app/my-bookings")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: `linear-gradient(135deg, ${accent}15, ${accentBlue}15)`, border: `1px solid ${accent}30`, color: accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <FaTicketAlt /> My Trips
        </button>
      </div>

      {/* ── Hero Banner ── */}
      <div style={{ margin: "16px 16px 0", padding: "20px", borderRadius: 20, background: t.heroBg, border: `1px solid ${t.cardBorder}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -10, top: -10, fontSize: 80, opacity: 0.06, animation: "tv-float 4s ease-in-out infinite" }}>
          <FaPlaneDeparture />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${accentBlue})`, display: "grid", placeItems: "center", color: "#fff", fontSize: 16 }}>
            <FaGlobeAmericas />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Where to next?</div>
            <div style={{ fontSize: 12, color: t.textSoft }}>Search best deals across airlines</div>
          </div>
        </div>
      </div>

      {/* ── Trip Toggle ── */}
      <div style={{ display: "flex", margin: "16px 16px 0", background: t.toggleBg, borderRadius: 14, padding: 4, border: `1px solid ${t.cardBorder}` }}>
        {["oneway", "roundtrip"].map((type) => (
          <button key={type} type="button" onClick={() => setTripType(type)} style={{
            flex: 1, padding: "11px 0", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.3s",
            ...(tripType === type
              ? { background: `linear-gradient(135deg, ${accent}, ${accentBlue})`, color: "#fff", boxShadow: `0 4px 16px ${accent}50` }
              : { background: "transparent", color: t.toggleInactive })
          }}>
            {type === "oneway" ? "One Way" : "Round Trip"}
          </button>
        ))}
      </div>

      {/* ── Search Card ── */}
      <form onSubmit={handleSearch}>
        <div style={{ margin: "16px 16px 0", borderRadius: 20, background: t.cardBg, border: `1px solid ${t.cardBorder}`, overflow: "hidden", boxShadow: isLight ? "0 4px 20px rgba(0,0,0,0.04)" : "0 4px 20px rgba(0,0,0,0.2)" }}>

          {/* From */}
          <div style={{ ...fieldStyle("from"), position: "relative" }}>
            <div style={labelStyle}><FaPlaneDeparture style={{ fontSize: 11, color: accent }} /> From</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input style={inputStyle} list="ap-from" placeholder="Departure city" value={form.fromCity}
                onChange={(e) => setForm({ ...form, fromCity: e.target.value })} {...ff("from")} />
              {form.fromCity && getAirportInfo(form.fromCity) && (
                <span style={codeStyle}>{getAirportInfo(form.fromCity).airportCode}</span>
              )}
            </div>
            <datalist id="ap-from">{airports.map((a) => <option key={a.airportCode} value={a.cityName} label={`${a.airportCode} - ${a.airportName}`} />)}</datalist>
            {errors.fromCity && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{errors.fromCity}</div>}
          </div>

          {/* Swap Button */}
          <div style={{ position: "relative", height: 0, zIndex: 5 }}>
            <button type="button" className="tv2-swap" onClick={swap} style={{
              position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)",
              width: 40, height: 40, borderRadius: "50%", border: `2px solid ${t.cardBorder}`,
              background: `linear-gradient(135deg, ${accent}, ${accentBlue})`, color: "#fff",
              cursor: "pointer", display: "grid", placeItems: "center", fontSize: 14,
              boxShadow: `0 4px 16px ${accent}40`, transition: "all 0.3s",
            }}>
              <FaExchangeAlt style={{ transform: "rotate(90deg)" }} />
            </button>
          </div>

          {/* To */}
          <div style={fieldStyle("to")}>
            <div style={labelStyle}><FaPlaneArrival style={{ fontSize: 11, color: accentBlue }} /> To</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input style={inputStyle} list="ap-to" placeholder="Arrival city" value={form.toCity}
                onChange={(e) => setForm({ ...form, toCity: e.target.value })} {...ff("to")} />
              {form.toCity && getAirportInfo(form.toCity) && (
                <span style={codeStyle}>{getAirportInfo(form.toCity).airportCode}</span>
              )}
            </div>
            <datalist id="ap-to">{airports.map((a) => <option key={a.airportCode} value={a.cityName} label={`${a.airportCode} - ${a.airportName}`} />)}</datalist>
            {errors.toCity && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{errors.toCity}</div>}
          </div>

          {/* Dates */}
          <div style={{ display: "flex" }}>
            <div style={{ ...fieldStyle("date"), flex: 1, borderRight: tripType === "roundtrip" ? `1px solid ${t.divider}` : "none" }}>
              <div style={labelStyle}><FaCalendarAlt style={{ fontSize: 11, color: accent }} /> Departure</div>
              <input style={inputStyle} type="date" min={today} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} {...ff("date")} />
              {errors.date && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{errors.date}</div>}
            </div>
            {tripType === "roundtrip" && (
              <div style={{ ...fieldStyle("return"), flex: 1 }}>
                <div style={labelStyle}><FaCalendarAlt style={{ fontSize: 11, color: accentBlue }} /> Return</div>
                <input style={inputStyle} type="date" min={form.date || today} value={form.returnDate}
                  onChange={(e) => setForm({ ...form, returnDate: e.target.value })} {...ff("return")} />
                {errors.returnDate && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{errors.returnDate}</div>}
              </div>
            )}
          </div>

          {/* Passengers */}
          <div style={{ display: "flex" }}>
            {[
              { key: "adultCount", label: "Adults", sub: "12+", icon: <FaUsers />, options: [1,2,3,4,5,6,7,8,9] },
              { key: "childCount", label: "Children", sub: "2-11", icon: <FaChild />, options: [0,1,2,3,4,5,6] },
              { key: "infantCount", label: "Infants", sub: "0-2", icon: <FaBaby />, options: [0,1,2,3,4] },
            ].map((pax, i) => (
              <div key={pax.key} style={{ ...fieldStyle(pax.key), flex: 1, borderRight: i < 2 ? `1px solid ${t.divider}` : "none" }}>
                <div style={labelStyle}>{pax.label} <span style={{ opacity: 0.5, fontWeight: 500 }}>{pax.sub}</span></div>
                <select style={selectStyle} value={form[pax.key]} onChange={(e) => setForm({ ...form, [pax.key]: e.target.value })} {...ff(pax.key)}>
                  {pax.options.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Class */}
          <div style={fieldStyle("class")}>
            <div style={labelStyle}><FaStar style={{ fontSize: 11, color: "#FFB800" }} /> Cabin Class</div>
            <select style={selectStyle} value={form.travelClass} onChange={(e) => setForm({ ...form, travelClass: e.target.value })} {...ff("class")}>
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>
        </div>

        {/* Search Button */}
        <button type="submit" className="tv2-search" disabled={searching} style={{
          margin: "20px 16px 0", width: "calc(100% - 32px)", padding: "16px 24px",
          border: "none", borderRadius: 16, cursor: "pointer",
          background: `linear-gradient(135deg, ${accent} 0%, ${accentBlue} 100%)`,
          color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.5px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: `0 8px 30px ${accent}30`, transition: "all 0.3s",
          ...(searching ? { opacity: 0.7, cursor: "not-allowed" } : {}),
        }}>
          {searching ? (
            <><span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "tv-spin 0.6s linear infinite", display: "inline-block" }} /> Searching...</>
          ) : (
            <><FaSearch /> Search Flights</>
          )}
        </button>
      </form>

      {/* Error */}
      {searchError && (
        <div style={{ margin: "16px", padding: 16, borderRadius: 14, background: t.errBg, border: `1px solid ${t.errBorder}`, color: t.errColor, fontSize: 13, textAlign: "center", fontWeight: 600 }}>
          {searchError}
        </div>
      )}
    </div>
  );
};

export default TravelScreen;
