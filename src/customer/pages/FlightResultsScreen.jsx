import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPlaneDeparture, FaPlaneArrival, FaClock, FaSuitcase,
  FaUtensils, FaRupeeSign, FaFilter, FaSortAmountDown, FaTimes, FaChevronDown,
  FaChevronUp, FaInfoCircle, FaCheckCircle } from "react-icons/fa";
import { travelService } from "../services/travelService";

const FlightResultsScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { flights = [], searchParams = {}, token = "" } = location.state || {};

  const [sortBy, setSortBy] = useState("price");
  const [filters, setFilters] = useState({ stops: "all", airline: "all", minPrice: 0, maxPrice: Infinity });
  const [showFilters, setShowFilters] = useState(false);
  const [fareRuleModal, setFareRuleModal] = useState(null);
  const [loadingFareRule, setLoadingFareRule] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(null); // stores resultIndex of loading flight

  // Get unique airlines for filter
  const airlines = useMemo(() => {
    const set = new Set(flights.map(f => f.airlineName));
    return [...set];
  }, [flights]);

  // Filter and sort flights
  const filteredFlights = useMemo(() => {
    let result = [...flights];

    // Apply filters
    if (filters.stops !== "all") {
      const stopsNum = parseInt(filters.stops);
      result = result.filter(f => parseInt(f.stops) === stopsNum);
    }
    if (filters.airline !== "all") {
      result = result.filter(f => f.airlineName === filters.airline);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "price": return parseFloat(a.offeredFare) - parseFloat(b.offeredFare);
        case "departure": return a.departure.localeCompare(b.departure);
        case "duration": return parseInt(a.totalDuration) - parseInt(b.totalDuration);
        case "arrival": return a.arrival.localeCompare(b.arrival);
        default: return 0;
      }
    });

    return result;
  }, [flights, filters, sortBy]);

  // Format time from ISO string
  const formatTime = (dateStr) => {
    if (!dateStr) return "--:--";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // Format duration from minutes
  const formatDuration = (mins) => {
    const h = Math.floor(parseInt(mins) / 60);
    const m = parseInt(mins) % 60;
    return `${h}h ${m}m`;
  };

  // View fare rules
  const handleViewFareRule = async (flight) => {
    setLoadingFareRule(true);
    try {
      const res = await travelService.getFareRule({
        token: token,
        resultIndex: flight.resultIndex,
        adultCount: parseInt(searchParams.adultCount || "1"),
        childCount: parseInt(searchParams.childCount || "0"),
        infantCount: parseInt(searchParams.infantCount || "0"),
        isInt: flight.isINT === 1
      });
      if (res.success && res.data?.data?.fareRule) {
        setFareRuleModal(res.data.data.fareRule);
      } else {
        setFareRuleModal({ error: res.message || "Unable to fetch fare rules" });
      }
    } catch (e) {
      setFareRuleModal({ error: "Failed to fetch fare rules" });
    }
    setLoadingFareRule(false);
  };

  // Book flight - get fare quote first
  const handleBookNow = async (flight) => {
    setLoadingQuote(flight.resultIndex);
    try {
      const res = await travelService.getFareQuote({
        token: token,
        resultIndex: flight.resultIndex,
        adultCount: parseInt(searchParams.adultCount || "1"),
        childCount: parseInt(searchParams.childCount || "0"),
        infantCount: parseInt(searchParams.infantCount || "0"),
        isInt: flight.isINT === 1
      });

      if (res.success && res.data?.data) {
        const quoteData = res.data.data;

        // Check if price changed
        if (quoteData.isPriceChanged === 1) {
          const confirmMsg = `Price has changed from \u20B9${flight.offeredFare} to \u20B9${quoteData.offeredFare}. Continue?`;
          if (!window.confirm(confirmMsg)) {
            setLoadingQuote(null);
            return;
          }
        }

        // Navigate to booking page
        navigate("/customer/app/flight-booking", {
          state: {
            flight,
            fareQuote: quoteData,
            searchParams,
            token: quoteData.token || token,
            resultIndex: quoteData.resultIndex || flight.resultIndex
          }
        });
      } else {
        alert(res.message || "Unable to get fare quote. Please try again.");
      }
    } catch (e) {
      alert("Failed to get fare quote. Please try again.");
    }
    setLoadingQuote(null);
  };

  if (!flights.length) {
    return (
      <div className="fc-page">
        <div className="th-header">
          <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <div className="th-header-text"><h1 className="th-title">No Flights Found</h1></div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
          <FaPlaneDeparture size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 16 }}>No flights available for your search. Try different dates or routes.</p>
          <button className="fc-submit" style={{ maxWidth: 200, margin: "20px auto" }} onClick={() => navigate("/customer/app/travel")}>Search Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-page">
      {/* Header */}
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text">
          <h1 className="th-title">
            {flights[0]?.sourceCity || flights[0]?.sourceAirportCode} &rarr; {flights[0]?.destinationCity || flights[0]?.destinationAirportCode}
          </h1>
          <span className="th-count">{filteredFlights.length} flights found</span>
        </div>
      </div>

      {/* Sort & Filter Bar */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto" }}>
        <button className={`tv-trip-btn${showFilters ? " is-active" : ""}`} onClick={() => setShowFilters(!showFilters)} style={{ fontSize: 12, padding: "6px 12px" }}>
          <FaFilter size={10} /> Filters
        </button>
        {["price", "departure", "duration", "arrival"].map(s => (
          <button key={s} className={`tv-trip-btn${sortBy === s ? " is-active" : ""}`} onClick={() => setSortBy(s)} style={{ fontSize: 12, padding: "6px 12px", textTransform: "capitalize" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="fc-select" style={{ flex: 1, minWidth: 120 }} value={filters.stops} onChange={e => setFilters({...filters, stops: e.target.value})}>
            <option value="all">All Stops</option>
            <option value="0">Non-stop</option>
            <option value="1">1 Stop</option>
            <option value="2">2+ Stops</option>
          </select>
          <select className="fc-select" style={{ flex: 1, minWidth: 120 }} value={filters.airline} onChange={e => setFilters({...filters, airline: e.target.value})}>
            <option value="all">All Airlines</option>
            {airlines.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {/* Flight Cards */}
      <div className="tv-results" style={{ padding: "0 16px 80px" }}>
        {filteredFlights.map((fl, idx) => (
          <div key={idx} className="tv-flight-card" style={{ marginBottom: 12 }}>
            <div className="tv-flight-top">
              <div className="tv-airline">
                {fl.airlineLogo ? (
                  <img src={fl.airlineLogo} alt={fl.airlineName} style={{ width: 32, height: 32, borderRadius: 4, objectFit: "contain" }} />
                ) : (
                  <div className="tv-airline-badge">{fl.airlineCode}</div>
                )}
                <div>
                  <div className="tv-airline-name">{fl.airlineName}</div>
                  <div className="tv-flight-no">{fl.airlineCode}-{fl.flightNumber}</div>
                </div>
              </div>
              <div className="tv-flight-price">
                <span className="tv-price">{"\u20B9"}{parseFloat(fl.offeredFare).toLocaleString("en-IN")}</span>
                <span className="tv-per-person">per person</span>
              </div>
            </div>

            <div className="tv-flight-route">
              <div className="tv-route-point">
                <div className="tv-route-time">{formatTime(fl.departure)}</div>
                <div className="tv-route-code">{fl.sourceAirportCode}</div>
              </div>
              <div className="tv-route-line">
                <div className="tv-route-duration"><FaClock size={10} /> {formatDuration(fl.totalDuration)}</div>
                <div className="tv-route-bar" />
                <div className="tv-route-stops">{fl.stops === "0" || fl.stops === 0 ? "Non-stop" : `${fl.stops} stop(s)`}</div>
              </div>
              <div className="tv-route-point">
                <div className="tv-route-time">{formatTime(fl.arrival)}</div>
                <div className="tv-route-code">{fl.destinationAirportCode}</div>
              </div>
            </div>

            <div className="tv-flight-meta">
              <span><FaSuitcase size={10} /> {fl.checkInBaggage || "15kg"}</span>
              {fl.cabinBaggage && <span>Cabin: {fl.cabinBaggage}</span>}
              {fl.isRefundable === 1 && <span style={{ color: "#16a34a" }}><FaCheckCircle size={10} /> Refundable</span>}
              {fl.availableSeats && <span className="tv-seats-left">{fl.availableSeats} seats</span>}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" style={{ flex: 1, padding: "8px", background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                onClick={() => handleViewFareRule(fl)} disabled={loadingFareRule}>
                <FaInfoCircle size={10} /> {loadingFareRule ? "Loading..." : "Fare Rules"}
              </button>
              <button type="button" className="tv-book-btn" style={{ flex: 2 }}
                onClick={() => handleBookNow(fl)} disabled={loadingQuote === fl.resultIndex}>
                {loadingQuote === fl.resultIndex ? <><span className="md-spinner" /> Getting Price...</> : "Book Now"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fare Rule Modal */}
      {fareRuleModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setFareRuleModal(null)}>
          <div style={{ background: "#fff", borderRadius: 12, maxWidth: 500, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 20 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Fare Rules</h3>
              <button onClick={() => setFareRuleModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><FaTimes /></button>
            </div>
            {fareRuleModal.error ? (
              <p style={{ color: "#dc2626" }}>{fareRuleModal.error}</p>
            ) : (
              <div>
                {fareRuleModal.fareRuleDetail?.map((rule, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: 12, background: "#f9fafb", borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{rule.origin} &rarr; {rule.destination} ({rule.airline})</div>
                    <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: rule.fareRules || "No details available" }} />
                  </div>
                )) || <p>No fare rules available.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlightResultsScreen;
