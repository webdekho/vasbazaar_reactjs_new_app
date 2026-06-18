import { authGet, authPost, authPut, authDelete, guestGet, guestPost } from "./apiClient";
import { server_api, web_app_url } from "../../utils/constants";

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

  // Events the logged-in user has RSVP'd to ("My invites").
  getMyInvites: () => authGet(`${BASE}/invites/mine`),

  updateEvent: (id, payload) => authPut(`${BASE}/events/${id}`, payload),

  cancelEvent: (id) => authPost(`${BASE}/events/${id}/cancel`, {}),

  deleteEvent: (id) => authDelete(`${BASE}/events/${id}`),

  inviteByMobile: (id, mobile) => authPost(`${BASE}/events/${id}/invite`, { mobile }),

  // ── Co-hosts (owner only) ── up to 2 extra hosts who can co-manage the event.
  getCoHosts: (id) => authGet(`${BASE}/events/${id}/cohosts`),

  addCoHost: (id, mobile) => authPost(`${BASE}/events/${id}/cohosts`, { mobile }),

  removeCoHost: (id, userId) => authDelete(`${BASE}/events/${id}/cohosts/${userId}`),

  // Cancel a pending co-host invite (someone who hasn't signed up yet) by mobile.
  removePendingCoHost: (id, mobile) => authDelete(`${BASE}/events/${id}/cohosts/pending/${mobile}`),

  // Email an invite (banner + details + RSVP link) to a guest. payload: { email, inviteUrl, message, banner }
  inviteByEmail: (id, payload) => authPost(`${BASE}/events/${id}/invite-email`, payload),

  // Host scans a guest's QR entry pass at the venue.
  checkIn: ({ qrToken, deviceInfo } = {}) => authPost(`${BASE}/checkin`, { qrToken, deviceInfo }),

  // ── Public (login-free) ──
  // When logged in, send auth so the backend can return the caller's prior RSVP
  // (myRsvp) for prefill/edit; otherwise stay login-free.
  getPublicInvite: (token) =>
    (localStorage.getItem("customerSessionToken")
      ? authGet(`${BASE}/public/invite/${token}`)
      : guestGet(`${BASE}/public/invite/${token}`)),

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
  `${web_app_url()}/customer/rybbo/i/${token}`;

/**
 * Build a ready-made prompt + claude.ai link that opens a new Claude chat with
 * the prompt pre-filled, so the host can generate a polished invite banner from
 * their own event details. claude.ai prefills the composer from the `?q=` param.
 */
export const buildBannerPrompt = (event, inviteUrl, provider = "claude") => {
  const title = (event.title || "").trim();
  // ChatGPT can render a raster image directly; ask it to do so. Claude renders an
  // HTML/SVG artifact that the host screenshots — but it must be the FINISHED poster,
  // never an interactive editor with form fields.
  const opening =
    provider === "chatgpt"
      ? `Generate an image: a premium, modern event invitation poster in a 4:5 vertical format, 1080 × 1350 pixels, suitable for sharing on WhatsApp and Instagram.`
      : `Create a premium, modern event invitation poster in a 4:5 vertical format, 1080 × 1350 pixels, suitable for sharing on WhatsApp and Instagram.`;
  const lines = [
    opening,
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
    // Hard constraint: the output must be the FINISHED poster, not a tool to build one.
    `Important: produce only the final, ready-to-share poster. Do NOT build an editor, form, input fields, colour pickers, tabs, buttons, or any interactive controls, and do not add explanations around it.`,
    provider === "chatgpt"
      ? `Output the poster directly as a downloadable image.`
      : `Render it as a single, self-contained, full-bleed HTML artifact (inline CSS) sized exactly 1080 × 1350 px that fills the whole canvas edge-to-edge, so I can screenshot it as a finished poster.`,
  ].filter((l) => l !== null);
  return lines.join("\n");
};

/**
 * AI chat URL with the banner prompt pre-filled, for the chosen provider.
 * Both Claude and ChatGPT prefill the composer from the `?q=` query param.
 */
export const buildBannerAiUrl = (provider, event, inviteUrl) => {
  const q = encodeURIComponent(buildBannerPrompt(event, inviteUrl, provider));
  return provider === "chatgpt"
    ? `https://chatgpt.com/?q=${q}`
    : `https://claude.ai/new?q=${q}`;
};

/**
 * A concise, image-generation-oriented prompt for Canva's Magic Media. Canva has
 * no `?q=` prefill, so the caller copies this to the clipboard and the host pastes
 * it into Canva. This variant drops the HTML-artifact instruction used for chat AIs.
 */
export const buildCanvaPrompt = (event, inviteUrl) => {
  const title = (event.title || "").trim();
  const lines = [
    `Premium, modern event invitation poster — 4:5 vertical, 1080 × 1350 px.`,
    `Style: luxurious and elegant; deep midnight navy, royal purple, black and subtle gold; smooth premium gradients, tasteful glassmorphism, soft golden glow and minimal confetti; clean layout, generous spacing, bold high-end typography; no random people or faces; every word crisp and correctly spelled.`,
    ``,
    `Text to place on the poster:`,
    `YOU'RE INVITED`,
    title.toUpperCase(),
    `Join us for a special celebration filled with wonderful moments.`,
    event.date || null,
    event.time || null,
    event.venue ? `Venue: ${event.venue}` : null,
    `RSVP NOW`,
    inviteUrl || null,
    ``,
    `Preserve any Marathi / Devanagari characters exactly as written. Keep margins so no text is cropped. No watermark. Ultra-high-resolution.`,
  ].filter((l) => l !== null);
  return lines.join("\n");
};

// Canva deep link that opens a new design with the Magic Media (text-to-image) app
// already open, so the prompt box is right there. Canva has NO public URL field to
// inject the prompt text itself (unlike Claude/ChatGPT's ?q=), so the caller copies
// the prompt to the clipboard and the host pastes it in.
//   ui = base64({"E":{"A":"generate_image"}})  → opens the generate_image app
//   type = TABQqs5Kbyc                          → Instagram-post canvas
// The /login/?redirect= wrapper preserves the params for users not yet signed in.
const CANVA_MAGIC_MEDIA_PATH = "/design?create&type=TABQqs5Kbyc&ui=eyJFIjp7IkEiOiJnZW5lcmF0ZV9pbWFnZSJ9fQ==";
export const CANVA_BANNER_URL = `https://www.canva.com/login/?redirect=${encodeURIComponent(CANVA_MAGIC_MEDIA_PATH)}`;

// ── Category / sub-type aware sample invite messages ───────────────────────────
// Each config: { hook, intro, close }. buildInviteMessage() fills in the event's
// title/host/date/venue. The host can edit the result before sharing. A sub-type
// override wins over the category default; otherwise a sensible category default.
const G = (hook, intro, close) => ({ hook, intro, close });

const MSG_BY_CATEGORY = {
  celebration: G("🎉 *You're Invited!*", "Come celebrate", "Your presence will make it truly special! 🥳"),
  wedding: G("💍 *With great joy…*", "We request the pleasure of your company at", "We would be honoured by your presence. 💛"),
  religious: G("🙏 *Sneh Nimantran*", "You are warmly invited to", "Do join us and seek blessings together. 🪔"),
  social: G("🎊 *Let's get together!*", "You're invited to", "It won't be the same without you — be there! 😄"),
  corporate: G("📣 *You're Invited*", "We're pleased to invite you to", "We look forward to your participation. 🤝"),
  kids: G("🎈 *You're Invited!*", "Join the fun at", "Lots of games, smiles and fun await! 🧒"),
  entertainment: G("🎵 *You're Invited!*", "Come join us for", "Bring your energy — let's make it memorable! 🎤"),
  outdoor: G("⛰️ *Adventure Awaits!*", "Join us for", "Pack up and let's make memories! 🌄"),
};

const ENGAGE = G("💍 *We're Engaged!*", "Join us at the engagement celebration —", "Come bless the couple as they begin a new journey. 💕");
const EID = G("🌙 *Eid Mubarak!*", "Join us for the celebration —", "Come share the joy and feast together. 🤲");
const STAGE = G("🎤 *Mic's Ready!*", "Come perform & vibe at", "Bring your talent and your tribe! 🎶");
const REUNION = G("🎓 *Reunion Time!*", "Let's relive old memories at", "Come reconnect with old friends! 🤗");
const OFFICE = G("📣 *You're Invited*", "Join the team at", "Looking forward to seeing you there! 🤝");
const LEARN = G("📚 *You're Invited*", "Join us for", "Reserve your seat today! 🎟️");
const TREK = G("⛰️ *Adventure Awaits!*", "Lace up and join us for", "Nature, trails and memories await! 🌲");
const RIDE = G("🏍️ *Let's Ride!*", "Rev up and join us for", "Fuel up — adventure calls! 🛣️");

const MSG_BY_TYPE = {
  // Celebration
  "birthday-party": G("🎂 *It's Birthday Time!*", "Come celebrate the birthday bash —", "Cake, music and masti await — be there! 🎉"),
  "kids-birthday": G("🎈 *Birthday Party!*", "Join the birthday fun at", "Games, cake and giggles — see you there! 🧁"),
  "sweet-16-18": G("✨ *A Special Birthday!*", "Celebrate this special birthday with us —", "Let's make it unforgettable! 🥳"),
  "surprise-birthday": G("🤫 *Shhh… It's a Surprise!*", "You're invited to a surprise celebration —", "Please arrive on time and keep it a secret! 🎉"),
  "milestone-birthday": G("🥂 *A Milestone to Celebrate!*", "Join us as we celebrate a special milestone —", "Let's raise a toast together! 🎉"),
  "cake-cutting": G("🎂 *Cake Cutting!*", "Join us for the cake cutting at", "Be there to share the first slice! 🍰"),
  "pool-party": G("🏊 *Pool Party!*", "Dive into the fun at", "Bring your swimwear and your smiles! 😎"),
  "anniversary": G("💑 *Happy Anniversary!*", "Celebrate years of love with us at", "Your blessings will mean the world to us. 💖"),
  "engagement": ENGAGE,
  "ring-ceremony": ENGAGE,
  "baby-shower": G("👶 *A Little One is on the Way!*", "Join us to celebrate at", "Come shower the parents-to-be with love! 🎀"),
  "naming-ceremony": G("👶 *Naming Ceremony*", "We joyfully invite you to the naming ceremony —", "Bless our little bundle of joy. 🙏"),
  "housewarming": G("🏡 *Griha Pravesh*", "We warmly invite you to our new home —", "Your blessings will make our home complete. 🪔"),
  "retirement-party": G("🎉 *Cheers to a New Chapter!*", "Join us to honour and celebrate at", "Come share your wishes and memories. 🥂"),
  "family-reunion": G("👨‍👩‍👧‍👦 *Family Reunion!*", "Let's reunite at", "Can't wait to make new memories together! ❤️"),
  // Wedding
  "save-the-date": G("💌 *Save The Date!*", "We're tying the knot —", "Formal invite to follow. Mark your calendar! 💕"),
  "haldi": G("💛 *Haldi Ceremony*", "Add colour to our celebration at the Haldi —", "Wear yellow and bring your smiles! 🌼"),
  "mehendi": G("🌿 *Mehendi Night*", "Join the Mehendi festivities —", "Music, mehendi and masti await! 💚"),
  "sangeet": G("🎶 *Sangeet Night!*", "Dance the night away with us at the Sangeet —", "Get your dancing shoes ready! 💃"),
  "wedding-ceremony": G("💍 *Wedding Invitation*", "Together with our families, we request your presence at", "Your presence will bless our union. 🙏"),
  "reception": G("🥂 *Reception Invite*", "Join us to celebrate at the reception —", "An evening of dinner, music and joy awaits. ✨"),
  "cocktail-party": G("🍸 *Cocktail Party*", "Raise a glass with us at", "Cheers to good times! 🥂"),
  "bachelor-bachelorette": G("🎉 *Last Night of Freedom!*", "Join the party at", "Let's make it one to remember! 🍻"),
  // Religious & cultural
  "satyanarayan-pooja": G("🙏 *Satyanarayan Pooja*", "We invite you with love to the Satyanarayan Pooja —", "Join us for pooja and prasad. 🪔"),
  "ganpati-celebration": G("🙏 *Ganpati Bappa Morya!*", "Join us for the Ganpati celebration —", "Come seek Bappa's blessings together. 🌺"),
  "navratri-event": G("🪔 *Navratri Nights!*", "Garba & Dandiya await you at", "Dress up and dance with us! 💃"),
  "diwali-party": G("🪔 *Happy Diwali!*", "Celebrate the festival of lights with us —", "Lights, sweets and joy await! ✨"),
  "eid-gathering": EID,
  "iftar-party": EID,
  "christmas-celebration": G("🎄 *Merry Christmas!*", "Join the Christmas celebration —", "Ho ho ho — see you there! 🎅"),
  "mata-ki-chowki": G("🙏 *Mata Ki Chowki*", "You are warmly invited to the Mata Ki Chowki —", "Come sing and seek blessings together. 🌺"),
  "bhajan-sandhya": G("🙏 *Bhajan Sandhya*", "Join us for an evening of devotion at", "Come immerse in bhajans and bhakti. 🪔"),
  // Social
  "house-party": G("🎉 *House Party!*", "Come chill with us at", "Good food, good vibes — just bring yourself! 🍕"),
  "weekend-get-together": G("🎉 *Weekend Plans!*", "Come hang out with us at", "Good food and great company await! 🍕"),
  "friends-meetup": G("👋 *Let's Meet Up!*", "Catch up with the gang at", "It's been too long — be there! 😄"),
  "kitty-party": G("💃 *Kitty Party!*", "Join the fun at", "Games, gossip and good food await! 💅"),
  "alumni-meetup": REUNION,
  "society-event": G("🏢 *Society Event*", "Our society warmly invites you to", "Let's come together as a community! 🤝"),
  "community-gathering": G("🤝 *Community Gathering*", "You're invited to join the community at", "Let's celebrate togetherness! 🎊"),
  "farewell-party": G("👋 *Farewell!*", "Let's give a warm send-off at", "Come share your wishes and memories. 🥹"),
  // Corporate
  "team-party": OFFICE,
  "corporate-meetup": OFFICE,
  "office-celebration": OFFICE,
  "product-launch": G("🚀 *Product Launch!*", "Be the first to witness our launch at", "Don't miss it — reserve your spot! ✨"),
  "networking-event": LEARN,
  "award-ceremony": G("🏆 *Award Ceremony*", "Join us to celebrate excellence at", "Come applaud the achievers! 👏"),
  "seminar": LEARN,
  "training-workshop": LEARN,
  // Kids & school
  "school-annual-day": G("🎈 *Annual Day!*", "Join us to celebrate our students at", "Come cheer for the young stars! 🌟"),
  "school-reunion": REUNION,
  "parent-meetup": G("👪 *Parent Meetup*", "You're invited to the parent meetup at", "Let's connect and share. 🤝"),
  // Entertainment
  "music-jam": STAGE,
  "open-mic": STAGE,
  "karaoke-night": G("🎤 *Karaoke Night!*", "Sing your heart out with us at", "Bring your voice and your crew! 🎶"),
  "gaming-tournament": G("🎮 *Game On!*", "Compete & conquer at", "May the best player win! 🏆"),
  "watch-party": G("🍿 *Watch Party!*", "Grab your snacks and join us at", "Big screen, big fun — be there! 📺"),
  "dance-workshop": G("💃 *Dance Workshop!*", "Move with us at", "No experience needed — just bring the energy! 🕺"),
  // Outdoor
  "trekking-group": TREK,
  "camping-event": TREK,
  "beach-party": G("🏖️ *Beach Party!*", "Sun, sand and fun at", "Don't forget your shades! 😎"),
  "picnic-event": G("🧺 *Picnic Time!*", "Join us for a fun picnic at", "Food, games and fresh air await! 🌳"),
  "bike-ride-meetup": RIDE,
  "road-trip-gathering": RIDE,
};

/**
 * Build an editable sample invite message tailored to the event's category and
 * sub-type (birthday reads differently from a wedding, a pooja, a trek, etc.).
 * Body only — the invite link is shown/appended separately.
 */
export const buildInviteMessage = (event) => {
  const cfg = MSG_BY_TYPE[event.eventType] || MSG_BY_CATEGORY[event.eventCategory] || MSG_BY_CATEGORY.celebration;
  const title = (event.title || "our celebration").trim();
  const host = (event.hostName || "").trim();
  return [
    cfg.hook,
    ``,
    `${cfg.intro} *${title}*`,
    host ? `Hosted by ${host}` : "",
    event.date ? `🗓️ ${event.date}${event.time ? ` at ${event.time}` : ""}` : "",
    event.venue ? `📍 ${event.venue}` : "",
    ``,
    cfg.close,
  ].filter(Boolean).join("\n");
};

/** Plain-text invite message — reused for WhatsApp deep links and the native/web share sheet. */
export const buildInviteShareText = (event, token) => {
  const url = buildInviteUrl(token);
  return [
    `*You're invited!* 🎉`,
    ``,
    `Join us for *${event.title}*`,
    event.date ? `🗓️ ${event.date}${event.time ? ` at ${event.time}` : ""}` : "",
    event.venue ? `📍 ${event.venue}` : "",
    ``,
    `Please confirm here: ${url}`,
  ].filter(Boolean).join("\n");
};

/** Pre-filled WhatsApp share message for an event (text only — wa.me cannot attach images). */
export const buildWhatsappShare = (event, token) =>
  `https://wa.me/?text=${encodeURIComponent(buildInviteShareText(event, token))}`;
