import { authGet, authPost, authPut, authDelete, guestGet, guestPost } from "./apiClient";
import { server_api } from "../../utils/constants";

const BASE = "/api/customer/rybbo/social";

/**
 * RYBBO Social — private events & guest RSVP.
 * Host calls are authenticated; the two `public*` calls are login-free so an
 * invited guest can open the invite and RSVP without a VasBazaar account.
 */
export const rybboSocialService = {
  // ── Host (authenticated) ──
  createEvent: (payload) => authPost(`${BASE}/events`, payload),

  getMyEvents: () => authGet(`${BASE}/events/mine`),

  getEvent: (id) => authGet(`${BASE}/events/${id}`),

  updateEvent: (id, payload) => authPut(`${BASE}/events/${id}`, payload),

  cancelEvent: (id) => authPost(`${BASE}/events/${id}/cancel`, {}),

  deleteEvent: (id) => authDelete(`${BASE}/events/${id}`),

  inviteByMobile: (id, mobile) => authPost(`${BASE}/events/${id}/invite`, { mobile }),

  // Host scans a guest's QR entry pass at the venue.
  checkIn: ({ qrToken, deviceInfo } = {}) => authPost(`${BASE}/checkin`, { qrToken, deviceInfo }),

  // ── Public (login-free) ──
  getPublicInvite: (token) => guestGet(`${BASE}/public/invite/${token}`),

  submitRsvp: (token, payload) => guestPost(`${BASE}/public/invite/${token}/rsvp`, payload),

  contribute: (token, payload) => guestPost(`${BASE}/public/invite/${token}/contribute`, payload),

  checkContribution: (paymentCode) => guestPost(`${BASE}/public/contribution/${paymentCode}/check-status`, {}),

  getPass: (token, mobile) => guestPost(`${BASE}/public/invite/${token}/pass`, { mobile }),
};

/** Backend HDFC redirect target for social contributions (mirrors RYBBO booking). */
export const buildContributionReturnUrl = () => {
  const apiBase = (server_api() || "").replace(/\/$/, "");
  const appOrigin = encodeURIComponent(window.location.origin);
  return `${apiBase}/RybboSocialPaymentCallback?app=${appOrigin}`;
};

/** Build the shareable invite URL for a given public token. */
export const buildInviteUrl = (token) =>
  `${window.location.origin}/customer/rybbo/i/${token}`;

/** Pre-filled WhatsApp share message for an event. */
export const buildWhatsappShare = (event, token) => {
  const url = buildInviteUrl(token);
  const lines = [
    `*You're invited!* 🎉`,
    ``,
    `Join us for *${event.title}*`,
    event.date ? `🗓️ ${event.date}${event.time ? ` at ${event.time}` : ""}` : "",
    event.venue ? `📍 ${event.venue}` : "",
    ``,
    `Please confirm here: ${url}`,
  ].filter(Boolean);
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
};
