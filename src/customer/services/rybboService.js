import { authGet, authPost, authPut, authDelete } from "./apiClient";

const BASE = "/api/customer/rybbo";

export const rybboService = {
  getCities: () => authGet(`${BASE}/cities`),

  getCategories: () => authGet(`${BASE}/categories`),

  getEvents: ({ city, category, q, pageNumber = 0, pageSize = 30 } = {}) => {
    const params = { pageNumber, pageSize };
    if (city) params.city = city;
    if (category && category !== "all") params.category = category;
    if (q) params.q = q;
    return authGet(`${BASE}/events`, params).then((r) => {
      if (!r.success) return r;
      return { ...r, data: r.data?.records || [] };
    });
  },

  getFeatured: ({ city } = {}) => {
    const params = {};
    if (city) params.city = city;
    return authGet(`${BASE}/events/featured`, params);
  },

  getEventBySlug: (slug) => authGet(`${BASE}/events/${slug}`),

  getTicketCategoriesForShowtime: (showtimeId) =>
    authGet(`${BASE}/showtimes/${showtimeId}/categories`),

  applyCoupon: ({ code, amount }) => authPost(`${BASE}/coupons/apply`, { code, amount }),

  /**
   * payload: {
   *   eventId, showtimeId, couponCode?, paymentMode: "upi"|"wallet",
   *   returnUrl?,                       // gateway sends user back here after payment
   *   items: [{ ticketCategoryId, qty }, ...]
   * }
   * Returns: { bookingId, bookingCode, finalAmount, status, paymentMode, paymentUrl }
   *   - paymentMode="wallet" → status="CONFIRMED", paymentUrl=null
   *   - paymentMode="upi"    → status="PAYMENT_INITIATE", redirect user to paymentUrl
   */
  initiateBooking: (payload) => authPost(`${BASE}/bookings/initiate`, payload),

  /** Poll booking status after returning from the payment gateway. */
  checkBookingStatus: (bookingId) => authPost(`${BASE}/bookings/${bookingId}/check-status`, {}),

  getMyBookings: ({ pageNumber = 0, pageSize = 20 } = {}) =>
    authGet(`${BASE}/bookings/me`, { pageNumber, pageSize }).then((r) => {
      if (!r.success) return r;
      return { ...r, data: r.data?.records || [] };
    }),

  getBookingById: (id) => authGet(`${BASE}/bookings/${id}`),

  getTicket: (bookingId) => authGet(`${BASE}/bookings/${bookingId}/ticket`),

  checkIn: ({ qrToken, deviceInfo } = {}) =>
    authPost(`${BASE}/checkin`, { qrToken, deviceInfo }),

  submitShow: (payload) => authPost(`${BASE}/submissions`, payload),

  updateShow: (id, payload) => authPut(`${BASE}/submissions/${id}`, payload),

  deleteShow: (id) => authDelete(`${BASE}/submissions/${id}`),

  getMySubmissions: () => authGet(`${BASE}/submissions/mine`),
};
