import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPlaneDeparture, FaPlaneArrival, FaHotel, FaCalendarAlt,
  FaUsers, FaSearch, FaExchangeAlt, FaStar, FaMapMarkerAlt, FaClock,
  FaRupeeSign, FaWifi, FaSuitcase, FaUtensils, FaSwimmingPool, FaParking,
} from "react-icons/fa";

const AIRPORTS = [
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Intl" },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi Intl" },
  { code: "BLR", city: "Bangalore", name: "Kempegowda Intl" },
  { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi Intl" },
  { code: "MAA", city: "Chennai", name: "Chennai Intl" },
  { code: "CCU", city: "Kolkata", name: "Netaji Subhas Chandra Bose Intl" },
  { code: "PNQ", city: "Pune", name: "Pune Airport" },
  { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel Intl" },
  { code: "JAI", city: "Jaipur", name: "Jaipur Intl" },
  { code: "GOI", city: "Goa", name: "Manohar Intl" },
  { code: "LKO", city: "Lucknow", name: "Chaudhary Charan Singh Intl" },
  { code: "COK", city: "Kochi", name: "Cochin Intl" },
  { code: "GAU", city: "Guwahati", name: "Lokpriya Gopinath Bordoloi Intl" },
  { code: "IXC", city: "Chandigarh", name: "Chandigarh Airport" },
  { code: "PAT", city: "Patna", name: "Jay Prakash Narayan Intl" },
  { code: "VNS", city: "Varanasi", name: "Lal Bahadur Shastri Intl" },
  { code: "SXR", city: "Srinagar", name: "Sheikh ul-Alam Intl" },
  { code: "IXB", city: "Bagdogra", name: "Bagdogra Airport" },
  { code: "UDR", city: "Udaipur", name: "Maharana Pratap Airport" },
  { code: "IDR", city: "Indore", name: "Devi Ahilyabai Holkar Airport" },
];

const HOTEL_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata",
  "Goa", "Jaipur", "Udaipur", "Shimla", "Manali", "Ooty",
  "Munnar", "Rishikesh", "Varanasi", "Agra", "Amritsar", "Darjeeling",
];

// Generate mock flight results
const generateFlights = (from, to, date) => {
  const airlines = [
    { name: "IndiGo", code: "6E", color: "#003B7A" },
    { name: "Air India", code: "AI", color: "#E31837" },
    { name: "SpiceJet", code: "SG", color: "#FFD100" },
    { name: "Vistara", code: "UK", color: "#4B286D" },
    { name: "GoFirst", code: "G8", color: "#00A651" },
    { name: "AirAsia India", code: "I5", color: "#FF0000" },
  ];
  const fromCode = AIRPORTS.find((a) => a.city === from || a.code === from)?.code || "BOM";
  const toCode = AIRPORTS.find((a) => a.city === to || a.code === to)?.code || "DEL";

  return airlines.slice(0, 4 + Math.floor(Math.random() * 3)).map((airline, i) => {
    const depHour = 5 + Math.floor(Math.random() * 16);
    const depMin = Math.floor(Math.random() * 60);
    const duration = 1 + Math.floor(Math.random() * 3);
    const durMin = Math.floor(Math.random() * 50);
    const arrHour = (depHour + duration) % 24;
    const arrMin = (depMin + durMin) % 60;
    const basePrice = 2500 + Math.floor(Math.random() * 6000);
    const pad = (n) => String(n).padStart(2, "0");

    return {
      id: `fl-${i}`,
      airline: airline.name,
      airlineCode: airline.code,
      color: airline.color,
      flightNo: `${airline.code}-${100 + Math.floor(Math.random() * 900)}`,
      from: fromCode,
      to: toCode,
      depTime: `${pad(depHour)}:${pad(depMin)}`,
      arrTime: `${pad(arrHour)}:${pad(arrMin)}`,
      duration: `${duration}h ${durMin}m`,
      stops: Math.random() > 0.6 ? 1 : 0,
      price: basePrice,
      seats: 2 + Math.floor(Math.random() * 15),
      baggage: "15 kg",
      meal: Math.random() > 0.5,
    };
  }).sort((a, b) => a.price - b.price);
};

// Generate mock hotel results
const generateHotels = (city) => {
  const names = [
    "Grand Hyatt", "Taj Palace", "ITC Royal", "The Oberoi", "Lemon Tree Premier",
    "Radisson Blu", "Marriott Suites", "Holiday Inn", "Novotel", "FabHotel Prime",
    "OYO Townhouse", "Treebo Trend", "Ginger Hotel",
  ];
  return names.slice(0, 5 + Math.floor(Math.random() * 4)).map((name, i) => {
    const rating = (3.5 + Math.random() * 1.5).toFixed(1);
    const basePrice = 1200 + Math.floor(Math.random() * 8000);
    const discount = Math.floor(Math.random() * 30) + 10;
    return {
      id: `ht-${i}`,
      name: `${name} ${city}`,
      rating: Number(rating),
      stars: Math.floor(Number(rating)),
      reviews: 50 + Math.floor(Math.random() * 500),
      price: basePrice,
      originalPrice: Math.round(basePrice * (100 / (100 - discount))),
      discount,
      amenities: ["wifi", "parking", "pool", "restaurant"].filter(() => Math.random() > 0.3),
      location: `${["MG Road", "Station Road", "City Centre", "Airport Road", "Beach Side"][Math.floor(Math.random() * 5)]}, ${city}`,
    };
  }).sort((a, b) => a.price - b.price);
};

const AMENITY_ICONS = { wifi: <FaWifi />, parking: <FaParking />, pool: <FaSwimmingPool />, restaurant: <FaUtensils /> };

const TravelScreen = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("flights");
  const [tripType, setTripType] = useState("oneway");
  const [focusedField, setFocusedField] = useState("");

  const [flightForm, setFlightForm] = useState({
    fromCity: "", toCity: "", date: "", returnDate: "", passengers: "1", travelClass: "economy",
  });

  const [hotelForm, setHotelForm] = useState({
    city: "", checkIn: "", checkOut: "", rooms: "1", guests: "2",
  });

  const [flightResults, setFlightResults] = useState(null);
  const [hotelResults, setHotelResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [errors, setErrors] = useState({});

  const today = new Date().toISOString().split("T")[0];

  const swapCities = () => setFlightForm((f) => ({ ...f, fromCity: f.toCity, toCity: f.fromCity }));

  const handleFlightSearch = (e) => {
    e.preventDefault();
    const errs = {};
    if (!flightForm.fromCity.trim()) errs.fromCity = "Required";
    if (!flightForm.toCity.trim()) errs.toCity = "Required";
    if (!flightForm.date) errs.date = "Required";
    if (tripType === "roundtrip" && !flightForm.returnDate) errs.returnDate = "Required";
    if (flightForm.fromCity && flightForm.toCity && flightForm.fromCity === flightForm.toCity) errs.toCity = "Must differ";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSearching(true);
    setTimeout(() => {
      setFlightResults(generateFlights(flightForm.fromCity, flightForm.toCity, flightForm.date));
      setSearching(false);
    }, 1200);
  };

  const handleHotelSearch = (e) => {
    e.preventDefault();
    const errs = {};
    if (!hotelForm.city.trim()) errs.city = "Required";
    if (!hotelForm.checkIn) errs.checkIn = "Required";
    if (!hotelForm.checkOut) errs.checkOut = "Required";
    if (hotelForm.checkIn && hotelForm.checkOut && hotelForm.checkOut <= hotelForm.checkIn) errs.checkOut = "After check-in";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSearching(true);
    setTimeout(() => {
      setHotelResults(generateHotels(hotelForm.city));
      setSearching(false);
    }, 1200);
  };

  const handleTabSwitch = (t) => { setTab(t); setErrors({}); setFlightResults(null); setHotelResults(null); };

  const ff = (name) => ({ onFocus: () => setFocusedField(name), onBlur: () => setFocusedField("") });

  return (
    <div className="fc-page">
      {/* Header */}
      <div className="th-header">
        <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <div className="th-header-text">
          <h1 className="th-title">Travel Booking</h1>
          <span className="th-count">Search flights & hotels</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tv-tabs">
        <button className={`tv-tab${tab === "flights" ? " is-active" : ""}`} type="button" onClick={() => handleTabSwitch("flights")}>
          <FaPlaneDeparture /> <span>Flights</span>
        </button>
        <button className={`tv-tab${tab === "hotels" ? " is-active" : ""}`} type="button" onClick={() => handleTabSwitch("hotels")}>
          <FaHotel /> <span>Hotels</span>
        </button>
      </div>

      {/* ── FLIGHTS ── */}
      {tab === "flights" && (
        <>
          {/* Trip type toggle */}
          <div className="tv-trip-toggle">
            <button type="button" className={`tv-trip-btn${tripType === "oneway" ? " is-active" : ""}`} onClick={() => setTripType("oneway")}>One Way</button>
            <button type="button" className={`tv-trip-btn${tripType === "roundtrip" ? " is-active" : ""}`} onClick={() => setTripType("roundtrip")}>Round Trip</button>
          </div>

          <form className="fc-form" onSubmit={handleFlightSearch}>
            <div style={{ position: "relative" }}>
              <div className={`fc-field${focusedField === "fromCity" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaPlaneDeparture className="fc-label-icon" /> From</label>
                <input className="fc-input" list="airports-from" placeholder="City or airport" value={flightForm.fromCity}
                  onChange={(e) => setFlightForm({ ...flightForm, fromCity: e.target.value })} {...ff("fromCity")} />
                <datalist id="airports-from">{AIRPORTS.map((a) => <option key={a.code} value={a.city} label={`${a.code} — ${a.name}`} />)}</datalist>
                {errors.fromCity && <span className="fc-error">{errors.fromCity}</span>}
              </div>
              <button type="button" className="tv-swap-btn" onClick={swapCities}><FaExchangeAlt /></button>
              <div className={`fc-field${focusedField === "toCity" ? " is-focused" : ""}`} style={{ marginTop: 8 }}>
                <label className="fc-label"><FaPlaneArrival className="fc-label-icon" /> To</label>
                <input className="fc-input" list="airports-to" placeholder="City or airport" value={flightForm.toCity}
                  onChange={(e) => setFlightForm({ ...flightForm, toCity: e.target.value })} {...ff("toCity")} />
                <datalist id="airports-to">{AIRPORTS.map((a) => <option key={a.code} value={a.city} label={`${a.code} — ${a.name}`} />)}</datalist>
                {errors.toCity && <span className="fc-error">{errors.toCity}</span>}
              </div>
            </div>

            <div className="fc-date-row">
              <div className={`fc-field${focusedField === "date" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> Departure</label>
                <input className="fc-input" type="date" min={today} value={flightForm.date}
                  onChange={(e) => setFlightForm({ ...flightForm, date: e.target.value })} {...ff("date")} />
                {errors.date && <span className="fc-error">{errors.date}</span>}
              </div>
              {tripType === "roundtrip" && (
                <div className={`fc-field${focusedField === "returnDate" ? " is-focused" : ""}`}>
                  <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> Return</label>
                  <input className="fc-input" type="date" min={flightForm.date || today} value={flightForm.returnDate}
                    onChange={(e) => setFlightForm({ ...flightForm, returnDate: e.target.value })} {...ff("returnDate")} />
                  {errors.returnDate && <span className="fc-error">{errors.returnDate}</span>}
                </div>
              )}
            </div>

            <div className="fc-date-row">
              <div className={`fc-field${focusedField === "passengers" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaUsers className="fc-label-icon" /> Travellers</label>
                <select className="fc-select" value={flightForm.passengers} onChange={(e) => setFlightForm({ ...flightForm, passengers: e.target.value })} {...ff("passengers")}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className={`fc-field${focusedField === "class" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaStar className="fc-label-icon" /> Class</label>
                <select className="fc-select" value={flightForm.travelClass} onChange={(e) => setFlightForm({ ...flightForm, travelClass: e.target.value })} {...ff("class")}>
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First Class</option>
                </select>
              </div>
            </div>

            <button type="submit" className="fc-submit" disabled={searching}>
              {searching ? <><span className="md-spinner" /> Searching...</> : <><FaSearch /> Search Flights</>}
            </button>
          </form>

          {/* Flight Results */}
          {flightResults && (
            <div className="tv-results">
              <div className="tv-results-header">{flightResults.length} flights found</div>
              {flightResults.map((fl) => (
                <div key={fl.id} className="tv-flight-card">
                  <div className="tv-flight-top">
                    <div className="tv-airline">
                      <div className="tv-airline-badge" style={{ background: fl.color }}>{fl.airlineCode}</div>
                      <div><div className="tv-airline-name">{fl.airline}</div><div className="tv-flight-no">{fl.flightNo}</div></div>
                    </div>
                    <div className="tv-flight-price">
                      <span className="tv-price">₹{fl.price.toLocaleString()}</span>
                      <span className="tv-per-person">per person</span>
                    </div>
                  </div>
                  <div className="tv-flight-route">
                    <div className="tv-route-point">
                      <div className="tv-route-time">{fl.depTime}</div>
                      <div className="tv-route-code">{fl.from}</div>
                    </div>
                    <div className="tv-route-line">
                      <div className="tv-route-duration"><FaClock size={10} /> {fl.duration}</div>
                      <div className="tv-route-bar" />
                      <div className="tv-route-stops">{fl.stops === 0 ? "Non-stop" : `${fl.stops} stop`}</div>
                    </div>
                    <div className="tv-route-point">
                      <div className="tv-route-time">{fl.arrTime}</div>
                      <div className="tv-route-code">{fl.to}</div>
                    </div>
                  </div>
                  <div className="tv-flight-meta">
                    <span><FaSuitcase size={10} /> {fl.baggage}</span>
                    {fl.meal && <span><FaUtensils size={10} /> Meal</span>}
                    <span className="tv-seats-left">{fl.seats} seats left</span>
                  </div>
                  <button type="button" className="tv-book-btn" onClick={() => alert("API integration pending. This will connect to a flight booking API.")}>Book Now</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── HOTELS ── */}
      {tab === "hotels" && (
        <>
          <form className="fc-form" onSubmit={handleHotelSearch}>
            <div className={`fc-field${focusedField === "city" ? " is-focused" : ""}`}>
              <label className="fc-label"><FaMapMarkerAlt className="fc-label-icon" /> Destination</label>
              <input className="fc-input" list="hotel-cities" placeholder="City, area or hotel name" value={hotelForm.city}
                onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })} {...ff("city")} />
              <datalist id="hotel-cities">{HOTEL_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
              {errors.city && <span className="fc-error">{errors.city}</span>}
            </div>

            <div className="fc-date-row">
              <div className={`fc-field${focusedField === "checkIn" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> Check-in</label>
                <input className="fc-input" type="date" min={today} value={hotelForm.checkIn}
                  onChange={(e) => setHotelForm({ ...hotelForm, checkIn: e.target.value })} {...ff("checkIn")} />
                {errors.checkIn && <span className="fc-error">{errors.checkIn}</span>}
              </div>
              <div className={`fc-field${focusedField === "checkOut" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaCalendarAlt className="fc-label-icon" /> Check-out</label>
                <input className="fc-input" type="date" min={hotelForm.checkIn || today} value={hotelForm.checkOut}
                  onChange={(e) => setHotelForm({ ...hotelForm, checkOut: e.target.value })} {...ff("checkOut")} />
                {errors.checkOut && <span className="fc-error">{errors.checkOut}</span>}
              </div>
            </div>

            <div className="fc-date-row">
              <div className={`fc-field${focusedField === "rooms" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaHotel className="fc-label-icon" /> Rooms</label>
                <select className="fc-select" value={hotelForm.rooms} onChange={(e) => setHotelForm({ ...hotelForm, rooms: e.target.value })} {...ff("rooms")}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className={`fc-field${focusedField === "guests" ? " is-focused" : ""}`}>
                <label className="fc-label"><FaUsers className="fc-label-icon" /> Guests</label>
                <select className="fc-select" value={hotelForm.guests} onChange={(e) => setHotelForm({ ...hotelForm, guests: e.target.value })} {...ff("guests")}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" className="fc-submit" disabled={searching}>
              {searching ? <><span className="md-spinner" /> Searching...</> : <><FaSearch /> Search Hotels</>}
            </button>
          </form>

          {/* Hotel Results */}
          {hotelResults && (
            <div className="tv-results">
              <div className="tv-results-header">{hotelResults.length} hotels found</div>
              {hotelResults.map((ht) => (
                <div key={ht.id} className="tv-hotel-card">
                  <div className="tv-hotel-top">
                    <div>
                      <div className="tv-hotel-name">{ht.name}</div>
                      <div className="tv-hotel-location"><FaMapMarkerAlt size={10} /> {ht.location}</div>
                      <div className="tv-hotel-rating">
                        <span className="tv-rating-badge">{ht.rating} <FaStar size={9} /></span>
                        <span className="tv-reviews">({ht.reviews} reviews)</span>
                      </div>
                    </div>
                    <div className="tv-hotel-price-col">
                      <div className="tv-hotel-discount">-{ht.discount}%</div>
                      <div className="tv-hotel-original">₹{ht.originalPrice.toLocaleString()}</div>
                      <div className="tv-hotel-price">₹{ht.price.toLocaleString()}</div>
                      <div className="tv-per-night">per night</div>
                    </div>
                  </div>
                  <div className="tv-hotel-amenities">
                    {ht.amenities.map((a) => <span key={a} className="tv-amenity">{AMENITY_ICONS[a]} {a}</span>)}
                  </div>
                  <button type="button" className="tv-book-btn" onClick={() => alert("API integration pending. This will connect to a hotel booking API.")}>Book Now</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TravelScreen;
