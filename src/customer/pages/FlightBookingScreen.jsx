import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaArrowLeft, FaUser,
  FaEnvelope, FaPassport, FaBuilding, FaChevronDown, FaChevronUp
} from "react-icons/fa";
import { travelService } from "../services/travelService";

const FlightBookingScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { flight = {}, fareQuote = {}, searchParams = {}, token = "", resultIndex = "" } = location.state || {};

  const adultCount = parseInt(searchParams.adultCount || "1");
  const childCount = parseInt(searchParams.childCount || "0");
  const infantCount = parseInt(searchParams.infantCount || "0");
  const totalPassengers = adultCount + childCount + infantCount;

  const [contactInfo, setContactInfo] = useState({ email: "", mobileNo: "", cellCountryCode: "+91" });
  const [passengers, setPassengers] = useState(() => {
    const pax = [];
    for (let i = 0; i < adultCount; i++) pax.push({ title: "Mr", firstName: "", lastName: "", paxType: "1", gender: 1, dateOfBirth: "", passportNumber: "", passportExpiry: "", nationality: "Indian", countryCode: "IN", countryName: "India", city: "", pinCode: "", addressLine1: "", addressLine2: "", ffAirlineCode: "", ffNumber: "" });
    for (let i = 0; i < childCount; i++) pax.push({ title: "Master", firstName: "", lastName: "", paxType: "2", gender: 1, dateOfBirth: "", passportNumber: "", passportExpiry: "", nationality: "Indian", countryCode: "IN", countryName: "India", city: "", pinCode: "", addressLine1: "", addressLine2: "", ffAirlineCode: "", ffNumber: "" });
    for (let i = 0; i < infantCount; i++) pax.push({ title: "Master", firstName: "", lastName: "", paxType: "3", gender: 1, dateOfBirth: "", passportNumber: "", passportExpiry: "", nationality: "Indian", countryCode: "IN", countryName: "India", city: "", pinCode: "", addressLine1: "", addressLine2: "", ffAirlineCode: "", ffNumber: "" });
    return pax;
  });

  const [gstInfo, setGstInfo] = useState({ gstCompanyName: "", gstNumber: "", gstCompanyAddress: "", gstCompanyEmail: "" });
  const [showGst, setShowGst] = useState(false);
  const [errors, setErrors] = useState({});
  const [booking, setBooking] = useState(false);

  const isInternational = flight.isINT === 1;

  const getPaxLabel = (paxType, index) => {
    if (paxType === "1") return `Adult ${index + 1}`;
    if (paxType === "2") return `Child ${index + 1}`;
    return `Infant ${index + 1}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "--:--";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const formatDuration = (mins) => {
    const h = Math.floor(parseInt(mins) / 60);
    const m = parseInt(mins) % 60;
    return `${h}h ${m}m`;
  };

  const updatePassenger = (index, field, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-set gender based on title
    if (field === "title") {
      if (value === "Mr" || value === "Master") updated[index].gender = 1;
      else updated[index].gender = 2;
    }
    setPassengers(updated);
  };

  const validate = () => {
    const errs = {};
    if (!contactInfo.email.trim() || !/\S+@\S+\.\S+/.test(contactInfo.email)) errs.email = "Valid email required";
    if (!contactInfo.mobileNo.trim() || contactInfo.mobileNo.length < 10) errs.mobileNo = "Valid mobile required";

    passengers.forEach((pax, i) => {
      if (!pax.firstName.trim()) errs[`pax_${i}_firstName`] = "Required";
      if (!pax.lastName.trim()) errs[`pax_${i}_lastName`] = "Required";
      if (!pax.dateOfBirth) errs[`pax_${i}_dob`] = "Required";
      if (isInternational && !pax.passportNumber.trim()) errs[`pax_${i}_passport`] = "Required";
      if (isInternational && !pax.passportExpiry) errs[`pax_${i}_passportExpiry`] = "Required";
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBook = async () => {
    if (!validate()) return;
    setBooking(true);

    try {
      const passengerList = passengers.map(pax => ({
        ...pax,
        fareBook: {
          currency: fareQuote.currency || "INR",
          baseFare: 0, tax: 0, taxBreakup: "0", yqTax: 0,
          additionalTxnFeeOfrd: 0, additionalTxnFeePub: 0, pgCharge: 0,
          otherCharges: 0, chargeBU: "0", discount: 0, publishedFare: 0,
          commissionEarned: 0, plbEarned: 0, incentiveEarned: 0, offeredFare: 0,
          serviceFee: 0, totalBaggageCharges: 0, totalMealCharges: 0,
          totalSeatCharges: 0, totalSpecialServiceCharges: 0
        },
        seatDetails: null, mealsDetails: null, baggageDetails: null, intMealsDetails: null
      }));

      const bookingPayload = {
        clientOrderId: "",
        payType: "wallet",
        adultCount: String(adultCount),
        childCount: String(childCount),
        infantCount: String(infantCount),
        source: flight.sourceAirportCode || flight.sourceCity,
        destination: flight.destinationAirportCode || flight.destinationCity,
        sourceAirportCode: flight.sourceAirportCode,
        sourceAirportName: flight.sourceAirportName,
        sourceCountryCode: flight.sourceCountryCode || "IN",
        destinationAirportCode: flight.destinationAirportCode,
        destinationAirportName: flight.destinationAirportName,
        destinationCountryCode: flight.destinationCountryCode || "IN",
        departureDate: flight.departure,
        arrivalDate: flight.arrival,
        returnDate: "",
        airlineLogo: flight.airlineLogo || "",
        airline: flight.airlineName,
        cabinClass: searchParams.travelClass || "ECONOMY",
        journeyType: searchParams.journeyType || "ONEWAY",
        amount: fareQuote.offeredFare || flight.offeredFare,
        grossAmount: fareQuote.publishedFare || flight.publishedFare,
        email: contactInfo.email,
        mobileNo: contactInfo.mobileNo,
        baseFare: fareQuote.baseFare || flight.publishedFare,
        tax: fareQuote.tax || "0",
        yqTax: "0",
        otherCharges: "0",
        discount: fareQuote.discount || flight.discount || "0",
        publishedFare: fareQuote.publishedFare || flight.publishedFare,
        offeredFare: fareQuote.offeredFare || flight.offeredFare,
        tdsOnCommission: "0",
        tdsOnPLB: "0",
        tdsOnIncentive: "0",
        flightNumber: flight.flightNumber,
        fareType: "0",
        fareOptions: "0",
        cellCountryCode: contactInfo.cellCountryCode,
        serviceCharges: "0",
        duration: flight.totalDuration || flight.duration,
        nationality: "Indian",
        travelGuideLines: "",
        sequenceNumber: 0,
        token: token,
        resultIndex: resultIndex,
        tpin: "",
        channel: 1,
        latitude: "0",
        longitude: "0",
        isLcc: flight.isLCC === 1,
        currency: fareQuote.currency || "INR",
        isPriceChangeAccepted: true,
        gstCompanyAddress: gstInfo.gstCompanyAddress,
        gstCompanyName: gstInfo.gstCompanyName,
        gstNumber: gstInfo.gstNumber,
        gstCompanyEmail: gstInfo.gstCompanyEmail,
        passengers: passengerList
      };

      // Try to get user's location
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }));
          bookingPayload.latitude = String(pos.coords.latitude);
          bookingPayload.longitude = String(pos.coords.longitude);
        } catch (e) { /* ignore location errors */ }
      }

      const res = await travelService.bookFlight(bookingPayload);

      if (res.success && res.data?.data?.statusCode === 1) {
        const bookingData = res.data.data;
        navigate("/customer/app/success", {
          state: {
            title: "Booking Confirmed!",
            message: `Your flight ${flight.airlineName} ${flight.airlineCode}-${flight.flightNumber} has been booked.`,
            details: [
              { label: "PNR", value: bookingData.pnr },
              { label: "Booking ID", value: bookingData.bookingId },
              { label: "Route", value: `${flight.sourceAirportCode} → ${flight.destinationAirportCode}` },
              { label: "Amount", value: `₹${parseFloat(fareQuote.offeredFare || flight.offeredFare).toLocaleString("en-IN")}` },
            ],
            txnId: bookingData.clientOrderId || bookingData.bookingId,
          }
        });
      } else {
        navigate("/customer/app/failure", {
          state: {
            title: "Booking Failed",
            message: res.data?.data?.message || res.message || "Unable to complete booking. Please try again.",
            canRetry: true,
            retryPath: "/customer/app/travel"
          }
        });
      }
    } catch (e) {
      navigate("/customer/app/failure", {
        state: {
          title: "Booking Failed",
          message: "An error occurred while processing your booking. Please try again.",
          canRetry: true,
          retryPath: "/customer/app/travel"
        }
      });
    }
    setBooking(false);
  };

  if (!flight.airlineName) {
    return (
      <div className="fc-page">
        <div className="th-header">
          <button className="th-back" type="button" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <div className="th-header-text"><h1 className="th-title">Invalid Booking</h1></div>
        </div>
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
          <p>No flight data found. Please search again.</p>
          <button className="fc-submit" style={{ maxWidth: 200, margin: "20px auto" }} onClick={() => navigate("/customer/app/travel")}>Search Flights</button>
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
          <h1 className="th-title">Complete Booking</h1>
          <span className="th-count">{totalPassengers} traveller{totalPassengers > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Flight Summary */}
      <div style={{ margin: "0 16px 16px", padding: 16, background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)", borderRadius: 12, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {flight.airlineLogo && <img src={flight.airlineLogo} alt="" style={{ width: 28, height: 28, borderRadius: 4, background: "#fff" }} />}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{flight.airlineName}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{flight.airlineCode}-{flight.flightNumber}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>₹{parseFloat(fareQuote.offeredFare || flight.offeredFare).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>per person</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatTime(flight.departure)}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{flight.sourceAirportCode}</div>
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{formatDuration(flight.totalDuration)}</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.3)", margin: "4px 20px" }} />
            <div style={{ fontSize: 10, opacity: 0.7 }}>{flight.stops === "0" || flight.stops === 0 ? "Non-stop" : `${flight.stops} stop(s)`}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatTime(flight.arrival)}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{flight.destinationAirportCode}</div>
          </div>
        </div>
      </div>

      <div className="fc-form" style={{ padding: "0 16px 100px" }}>
        {/* Contact Details */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><FaEnvelope size={12} /> Contact Details</h3>
          <div className="fc-field">
            <label className="fc-label">Email</label>
            <input className="fc-input" type="email" placeholder="email@example.com" value={contactInfo.email}
              onChange={e => setContactInfo({...contactInfo, email: e.target.value})} />
            {errors.email && <span className="fc-error">{errors.email}</span>}
          </div>
          <div className="fc-field" style={{ marginTop: 8 }}>
            <label className="fc-label">Mobile Number</label>
            <input className="fc-input" type="tel" placeholder="10-digit mobile" maxLength={10} value={contactInfo.mobileNo}
              onChange={e => setContactInfo({...contactInfo, mobileNo: e.target.value.replace(/\D/g, "")})} />
            {errors.mobileNo && <span className="fc-error">{errors.mobileNo}</span>}
          </div>
        </div>

        {/* Passenger Forms */}
        {passengers.map((pax, i) => {
          let paxIdx = i;
          if (pax.paxType === "2") paxIdx = i - adultCount;
          if (pax.paxType === "3") paxIdx = i - adultCount - childCount;
          return (
            <div key={i} style={{ marginBottom: 20, padding: 16, background: "#f9fafb", borderRadius: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <FaUser size={12} /> {getPaxLabel(pax.paxType, paxIdx)}
              </h3>

              <div className="fc-date-row">
                <div className="fc-field">
                  <label className="fc-label">Title</label>
                  <select className="fc-select" value={pax.title} onChange={e => updatePassenger(i, "title", e.target.value)}>
                    {pax.paxType === "1" ? (
                      <>{["Mr", "Mrs", "Ms"].map(t => <option key={t} value={t}>{t}</option>)}</>
                    ) : (
                      <>{["Master", "Miss"].map(t => <option key={t} value={t}>{t}</option>)}</>
                    )}
                  </select>
                </div>
                <div className="fc-field">
                  <label className="fc-label">Gender</label>
                  <select className="fc-select" value={pax.gender} onChange={e => updatePassenger(i, "gender", parseInt(e.target.value))}>
                    <option value={1}>Male</option>
                    <option value={2}>Female</option>
                  </select>
                </div>
              </div>

              <div className="fc-date-row" style={{ marginTop: 8 }}>
                <div className="fc-field">
                  <label className="fc-label">First Name</label>
                  <input className="fc-input" placeholder="First name" value={pax.firstName}
                    onChange={e => updatePassenger(i, "firstName", e.target.value)} />
                  {errors[`pax_${i}_firstName`] && <span className="fc-error">{errors[`pax_${i}_firstName`]}</span>}
                </div>
                <div className="fc-field">
                  <label className="fc-label">Last Name</label>
                  <input className="fc-input" placeholder="Last name" value={pax.lastName}
                    onChange={e => updatePassenger(i, "lastName", e.target.value)} />
                  {errors[`pax_${i}_lastName`] && <span className="fc-error">{errors[`pax_${i}_lastName`]}</span>}
                </div>
              </div>

              <div className="fc-field" style={{ marginTop: 8 }}>
                <label className="fc-label">Date of Birth</label>
                <input className="fc-input" type="date" value={pax.dateOfBirth}
                  onChange={e => updatePassenger(i, "dateOfBirth", e.target.value)} />
                {errors[`pax_${i}_dob`] && <span className="fc-error">{errors[`pax_${i}_dob`]}</span>}
              </div>

              {isInternational && (
                <div className="fc-date-row" style={{ marginTop: 8 }}>
                  <div className="fc-field">
                    <label className="fc-label"><FaPassport size={10} /> Passport No.</label>
                    <input className="fc-input" placeholder="Passport number" value={pax.passportNumber}
                      onChange={e => updatePassenger(i, "passportNumber", e.target.value)} />
                    {errors[`pax_${i}_passport`] && <span className="fc-error">{errors[`pax_${i}_passport`]}</span>}
                  </div>
                  <div className="fc-field">
                    <label className="fc-label">Passport Expiry</label>
                    <input className="fc-input" type="date" value={pax.passportExpiry}
                      onChange={e => updatePassenger(i, "passportExpiry", e.target.value)} />
                    {errors[`pax_${i}_passportExpiry`] && <span className="fc-error">{errors[`pax_${i}_passportExpiry`]}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* GST Details (Optional) */}
        <div style={{ marginBottom: 20 }}>
          <button type="button" onClick={() => setShowGst(!showGst)}
            style={{ width: "100%", padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600 }}>
            <span><FaBuilding size={12} style={{ marginRight: 6 }} /> GST Details (Optional)</span>
            {showGst ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </button>
          {showGst && (
            <div style={{ padding: "12px 0" }}>
              <div className="fc-date-row">
                <div className="fc-field">
                  <label className="fc-label">Company Name</label>
                  <input className="fc-input" placeholder="Company name" value={gstInfo.gstCompanyName}
                    onChange={e => setGstInfo({...gstInfo, gstCompanyName: e.target.value})} />
                </div>
                <div className="fc-field">
                  <label className="fc-label">GST Number</label>
                  <input className="fc-input" placeholder="GST number" value={gstInfo.gstNumber}
                    onChange={e => setGstInfo({...gstInfo, gstNumber: e.target.value})} />
                </div>
              </div>
              <div className="fc-field" style={{ marginTop: 8 }}>
                <label className="fc-label">Company Address</label>
                <input className="fc-input" placeholder="Address" value={gstInfo.gstCompanyAddress}
                  onChange={e => setGstInfo({...gstInfo, gstCompanyAddress: e.target.value})} />
              </div>
              <div className="fc-field" style={{ marginTop: 8 }}>
                <label className="fc-label">Company Email</label>
                <input className="fc-input" type="email" placeholder="company@example.com" value={gstInfo.gstCompanyEmail}
                  onChange={e => setGstInfo({...gstInfo, gstCompanyEmail: e.target.value})} />
              </div>
            </div>
          )}
        </div>

        {/* Fare Breakdown */}
        <div style={{ marginBottom: 20, padding: 16, background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Fare Breakdown</h3>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>Base Fare ({totalPassengers} pax)</span>
            <span>₹{parseFloat(fareQuote.baseFare || flight.publishedFare || 0).toLocaleString("en-IN")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>Taxes & Fees</span>
            <span>₹{parseFloat(fareQuote.tax || 0).toLocaleString("en-IN")}</span>
          </div>
          {parseFloat(fareQuote.discount || flight.discount || 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#16a34a" }}>
              <span>Discount</span>
              <span>-₹{parseFloat(fareQuote.discount || flight.discount).toLocaleString("en-IN")}</span>
            </div>
          )}
          <div style={{ borderTop: "1px dashed #86efac", paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
            <span>Total</span>
            <span>₹{(parseFloat(fareQuote.offeredFare || flight.offeredFare || 0) * totalPassengers).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Book Button */}
        <button type="button" className="fc-submit" onClick={handleBook} disabled={booking}>
          {booking ? <><span className="md-spinner" /> Processing Booking...</> : <>Book & Pay ₹{(parseFloat(fareQuote.offeredFare || flight.offeredFare || 0) * totalPassengers).toLocaleString("en-IN")}</>}
        </button>
      </div>
    </div>
  );
};

export default FlightBookingScreen;
