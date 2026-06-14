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

/**
 * Build a ready-made prompt + claude.ai link that opens a new Claude chat with
 * the prompt pre-filled, so the host can generate a polished invite banner from
 * their own event details. claude.ai prefills the composer from the `?q=` param.
 */
export const buildBannerPrompt = (event, inviteUrl) => {
  const title = (event.title || "").trim();
  const lines = [
    `Create a premium, modern event invitation poster in a 4:5 vertical format, 1080 × 1350 pixels, suitable for sharing on WhatsApp and Instagram.`,
    ``,
    `Design style:`,
    ``,
    `* Luxurious, elegant, and cutting-edge`,
    `* Deep midnight navy, royal purple, black, and subtle gold colour palette`,
    `* Smooth premium gradients`,
    `* Tasteful glassmorphism card effects`,
    `* Soft golden glow, elegant light particles, and minimal decorative confetti`,
    `* Clean, sophisticated layout with excellent spacing`,
    `* Bold, high-end typography`,
    `* Every word must be crisp, readable, and correctly spelled`,
    `* Do not overcrowd the design`,
    `* Do not include random people, faces, or unrelated objects`,
    ``,
    `Invitation text:`,
    ``,
    `YOU'RE INVITED`,
    ``,
    title.toUpperCase(),
    ``,
    `Join us for a special evening filled with wonderful moments, meaningful conversations, and beautiful memories.`,
    ``,
    event.date || null,
    event.time || null,
    ``,
    event.venue ? `VENUE` : null,
    event.venue || null,
    ``,
    `Add a prominent premium button near the bottom:`,
    ``,
    `RSVP NOW`,
    ``,
    inviteUrl ? `Below the button, display this RSVP link clearly in a smaller readable font:` : null,
    inviteUrl || null,
    ``,
    `Add a small elegant line at the bottom:`,
    ``,
    `"Your presence will make the occasion even more special."`,
    ``,
    `Layout requirements:`,
    ``,
    `* "${title.toUpperCase()}" must be the main hero text in the centre`,
    `* "YOU'RE INVITED" should appear elegantly above the name`,
    `* Date, time, and venue should be organised in separate clean sections`,
    `* Use subtle calendar, clock, and location icons`,
    `* Keep the RSVP button highly visible`,
    `* Preserve any non-English (e.g. Marathi/Devanagari) characters in the text exactly as written`,
    `* Maintain sufficient margins so no text is cropped`,
    `* No spelling mistakes`,
    `* No watermark`,
    `* Ultra-high-resolution, polished professional event invitation design`,
    ``,
    `Render it as a single self-contained HTML file (inline CSS) artifact so I can preview it, then let me tweak the colours and wording.`,
  ].filter((l) => l !== null);
  return lines.join("\n");
};

/**
 * AI chat URL with the banner prompt pre-filled, for the chosen provider.
 * Both Claude and ChatGPT prefill the composer from the `?q=` query param.
 */
export const buildBannerAiUrl = (provider, event, inviteUrl) => {
  const q = encodeURIComponent(buildBannerPrompt(event, inviteUrl));
  return provider === "chatgpt"
    ? `https://chatgpt.com/?q=${q}`
    : `https://claude.ai/new?q=${q}`;
};

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
