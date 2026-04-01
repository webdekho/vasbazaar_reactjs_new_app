import { authGet, authPost } from "./apiClient";

export const travelService = {
  // Get list of airlines
  getAirlines: () => authGet("/api/customer/flight/airlines"),

  // Get list of airports
  getAirports: () => authGet("/api/customer/flight/airports"),

  // Search flights
  searchFlights: (payload) => authPost("/api/customer/flight/search", payload),

  // Get calendar fare
  getCalendarFare: (payload) => authPost("/api/customer/flight/calendar-fare", payload),

  // Get fare rules for a flight
  getFareRule: (payload) => authPost("/api/customer/flight/fare-rule", payload),

  // Get fare quote (confirmed pricing)
  getFareQuote: (payload) => authPost("/api/customer/flight/fare-quote", payload),

  // Get SSR (meals, baggage, seats)
  getSsr: (payload) => authPost("/api/customer/flight/ssr", payload),

  // Book a one-way flight
  bookFlight: (payload) => authPost("/api/customer/flight/booking", payload),

  // Book a round-trip flight
  roundTripBooking: (payload) => authPost("/api/customer/flight/round-trip-booking", payload),

  // Get cancellation charges
  getCancellationCharges: (payload) => authPost("/api/customer/flight/cancellation-charges", payload),

  // Get booking details
  getBookingDetails: (payload) => authPost("/api/customer/flight/booking-details", payload),

  // Full cancellation
  fullCancel: (payload) => authPost("/api/customer/flight/full-cancel", payload),

  // Partial cancellation
  partialCancel: (payload) => authPost("/api/customer/flight/partial-cancel", payload),

  // Get user's flight bookings
  getMyBookings: () => authGet("/api/customer/flight/my-bookings"),
};
