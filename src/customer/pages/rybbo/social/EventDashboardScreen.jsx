import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaWhatsapp, FaCopy, FaEdit, FaBan, FaDownload, FaBell, FaUserPlus, FaQrcode, FaAddressBook, FaSearch, FaTimes, FaCheck, FaMagic, FaImage, FaEye, FaUsers } from "react-icons/fa";
import { rybboSocialService, buildInviteUrl, buildInviteMessage, buildBannerAiUrl, buildCanvaPrompt, CANVA_BANNER_URL } from "../../../services/rybboSocialService";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { pickContacts, isUserCancelledError } from "../../rebuddy/contacts";
import DataState from "../../../components/DataState";
import { useToast } from "../../../context/ToastContext";
import "./celebration.css";
import { formatDisplayDate, formatDisplayTime } from "../../../../utils/dateFormat";

const ACCENT = "#7C3AED";
const MAX_IMAGES = 3;
const MAX_IMG_BYTES = 2 * 1024 * 1024;

const CONFETTI_COLORS = ["#7C3AED", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];
// Pre-computed confetti pieces — spread across width with varied speed/delay so
// the fall looks random without needing Math.random at runtime.
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 5.6 + (i % 3) * 3) % 100,
  delay: -((i * 0.7) % 6),
  duration: 6 + (i % 5) * 1.4,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

const CelebrationBg = () => (
  <div className="cel-bg" aria-hidden="true">
    <span className="cel-glow g1" />
    <span className="cel-glow g2" />
    <span className="cel-glow g3" />
    {CONFETTI.map((c, i) => (
      <span
        key={i}
        className="cel-confetti"
        style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
      />
    ))}
  </div>
);

const RESPONSE_META = {
  INVITED: { label: "Invited", color: "#7C3AED" },
  ACCEPT: { label: "Accepted", color: "#16a34a" },
  MAYBE: { label: "Maybe", color: "#f59e0b" },
  DECLINE: { label: "Declined", color: "#ef4444" },
};

const isValidEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
const inviteKey = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return isValidEmail(raw) ? `email:${raw}` : "";
  const mobile = raw.replace(/\D/g, "");
  return mobile.length >= 10 ? `mobile:${mobile}` : "";
};
const guestContact = (guest) => guest?.guestMobile || guest?.guestEmail || "";

const StatCard = ({ value, label, color, onClick }) => (
  <div onClick={onClick} role={onClick ? "button" : undefined}
    style={{ flex: 1, minWidth: 70, textAlign: "center", padding: "12px 6px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, cursor: onClick ? "pointer" : "default" }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 2 }}>{label}</div>
  </div>
);

const EventDashboardScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: "", event: null });
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviting, setInviting] = useState(false);
  const [coHostMobile, setCoHostMobile] = useState("");
  const [addingCoHost, setAddingCoHost] = useState(false);
  // Multi-select contact invite sheet
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [selectedMobiles, setSelectedMobiles] = useState(() => new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [bulkInviting, setBulkInviting] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  // Banner modal view: "choose" = upload vs AI, "ai" = pick Claude/ChatGPT/Canva
  const [bannerMode, setBannerMode] = useState("choose");
  // Two-step flow: 1 = create banner/cover, 2 = share & track responses
  const [step, setStep] = useState(1);
  // Cover images — editable from the dashboard; each change is persisted immediately
  const [coverImages, setCoverImages] = useState([]);
  const [savingImages, setSavingImages] = useState(false);
  const fileRef = useRef(null);
  // Editable, category-tailored invite message the host can tweak before sharing
  const [shareMessage, setShareMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    const r = await rybboSocialService.getEvent(id);
    setState({ loading: false, error: r.success ? "" : (r.message || "Could not load event"), event: r.success ? r.data : null });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await rybboSocialService.getEvent(id);
      if (cancelled) return;
      setState({ loading: false, error: r.success ? "" : (r.message || "Could not load event"), event: r.success ? r.data : null });
    })();
    return () => { cancelled = true; };
  }, [id]);

  const e = state.event;
  const summary = e?.summary || {};
  const guests = e?.guests || [];
  const invitedGuests = guests.filter((g) => g.guestMobile || g.guestEmail);
  const invitedKeys = new Set(invitedGuests.flatMap((g) => [inviteKey(g.guestMobile), inviteKey(g.guestEmail)]).filter(Boolean));
  const inviteUrl = e ? buildInviteUrl(e.token) : "";

  // Consolidated accepted report — head count, food split, kids, drinkers.
  const goingReport = () => {
    const going = guests.filter((g) => g.response === "ACCEPT");
    const heads = going.reduce((s, g) => s + (Number(g.partySize) || 1), 0);
    const kids = going.reduce((s, g) => s + (Number(g.kidsCount) || 0), 0);
    const drinkers = going.filter((g) => g.drinks).length;
    const food = {};
    going.forEach((g) => { const k = g.foodPref || "unspecified"; food[k] = (food[k] || 0) + (Number(g.partySize) || 1); });
    return { going, heads, kids, drinkers, nonDrinkers: going.length - drinkers, food };
  };

  const exportGoingReport = () => {
    const { going } = goingReport();
    const header = ["Guest name", "Mobile", "Head count", "Food", "Kids", "Drinks", "Note"];
    const rows = going.map((g) => [g.guestName, g.guestMobile, g.partySize ?? 1, g.foodPref || "", g.kidsCount ?? 0, g.drinks ? "Yes" : "No", (g.note || "").replace(/\n/g, " ")]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(e.title || "going-report").replace(/[^a-z0-9]+/gi, "_")}_going.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); showToast("Invite link copied", "success"); }
    catch { showToast(inviteUrl, "info"); }
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const wrapCanvasText = (ctx, text, maxWidth) => {
    const lines = [];
    String(text || "").split("\n").forEach((raw) => {
      if (!raw.trim()) {
        lines.push("");
        return;
      }
      const words = raw.split(/\s+/);
      let line = "";
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth) {
          line = next;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      });
      if (line) lines.push(line);
    });
    return lines;
  };

  const makeCaptionedInviteImage = async (banner, text) => {
    const img = await loadImage(banner);
    const width = Math.max(720, img.naturalWidth || img.width || 1080);
    const scale = width / (img.naturalWidth || img.width || width);
    const imageHeight = Math.round((img.naturalHeight || img.height || 1350) * scale);
    const pad = Math.round(width * 0.045);
    const fontSize = Math.max(26, Math.round(width * 0.032));
    const lineHeight = Math.round(fontSize * 1.38);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const lines = wrapCanvasText(ctx, text, width - pad * 2);
    const captionHeight = pad * 2 + Math.max(lineHeight, lines.length * lineHeight);
    canvas.width = width;
    canvas.height = imageHeight + captionHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, width, imageHeight);

    ctx.fillStyle = "#111827";
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    let y = imageHeight + pad;
    lines.forEach((line) => {
      if (line) ctx.fillText(line, pad, y);
      y += lineHeight;
    });

    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  };

  const shareCaptionedImageFallback = async (banner, text, dialogTitle) => {
    const blob = await makeCaptionedInviteImage(banner, text);
    if (!blob) throw new Error("Could not prepare invite image");
    const file = new File([blob], "invite-with-message.jpg", { type: "image/jpeg" });
    const data = { title: dialogTitle, files: [file] };
    if (typeof navigator !== "undefined" && navigator.canShare?.(data)) {
      await navigator.share(data);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invite-with-message.jpg";
    a.click();
    URL.revokeObjectURL(url);
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ }
    showToast("Invite image downloaded with message below it. Attach this image in WhatsApp.", "info");
  };

  // Shared WhatsApp share. On native, use `files` rather than `url` so WhatsApp
  // receives the banner as media and the text as the media caption. On web, use
  // Web Share when available; otherwise create one image with the message below
  // the banner so it is not sent as a separate WhatsApp text bubble.
  const shareToWhatsApp = async (text, { attachBanner = false, dialogTitle = "Share", copiedToast } = {}) => {
    const banner = attachBanner ? coverImages[0] : null;

    if (Capacitor.isNativePlatform()) {
      try {
        if (banner) {
          const base64 = banner.slice(banner.indexOf(",") + 1);
          const mime = (banner.slice(0, banner.indexOf(",")).match(/data:(.*?);/) || [])[1] || "image/jpeg";
          const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
          const res = await Filesystem.writeFile({ path: `invite-${e.token}.${ext}`, data: base64, directory: Directory.Cache });
          await Share.share({ text, files: [res.uri], dialogTitle });
        } else {
          await Share.share({ text, dialogTitle });
        }
        return;
      } catch (err) {
        if (/cancel/i.test(err?.message || "")) return;
        // fall through to the WhatsApp deep link
      }
    }

    // Web with a banner: Web Share can send the image + message together. It opens
    // the OS share sheet (WhatsApp is one tap away).
    if (banner && typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
      try {
        const blob = await (await fetch(banner)).blob();
        const ext = ((blob.type || "image/jpeg").split("/")[1] || "jpg").replace("jpeg", "jpg");
        const file = new File([blob], `invite.${ext}`, { type: blob.type || "image/jpeg" });
        const data = { title: dialogTitle, text, files: [file] };
        if (navigator.canShare(data)) { await navigator.share(data); return; }
      } catch (err) {
        if (err?.name === "AbortError") return;
        // fall through to the link
      }
    }

    if (banner) {
      try {
        await shareCaptionedImageFallback(banner, text, dialogTitle);
        return;
      } catch {
        // fall through to text-only as the last resort
      }
    }

    // Web fallback (no banner, or file-share unsupported): open WhatsApp directly
    // (api.whatsapp.com, NOT wa.me — wa.me's 301 redirect corrupts emojis). Copy the
    // text to the clipboard as a safety net if the prefill is dropped.
    try { await navigator.clipboard.writeText(text); if (copiedToast) showToast(copiedToast, "info"); } catch { /* clipboard may be blocked */ }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareInvite = async () => {
    setPreviewOpen(false);
    const body = (shareMessage || buildInviteMessage(e)).trim();
    await shareToWhatsApp(`${body}\n\n${inviteUrl}`, {
      attachBanner: true,
      dialogTitle: "Share invite",
      copiedToast: "Invite copied — if WhatsApp shows only the link, just paste it",
    });
  };

  // Send a gentle RSVP reminder over WhatsApp (with the banner attached on the app).
  const sendReminder = async () => {
    const text = `Gentle reminder: please confirm your presence for "${e.title}"${e.date ? ` on ${formatDisplayDate(e.date, "")}` : ""} so we can plan better.\n\nRSVP here: ${inviteUrl}`;
    await shareToWhatsApp(text, {
      attachBanner: true,
      dialogTitle: "Send reminder",
      copiedToast: "Reminder copied — if WhatsApp shows only the link, just paste it",
    });
  };

  const sendGuestReminder = async (guest) => {
    const mobile = String(guest?.guestMobile || "").replace(/\D/g, "");
    const name = guest?.guestName && !/^Guest \d{4}$/.test(guest.guestName) ? `${guest.guestName}, ` : "";
    const text = `${name}gentle reminder to RSVP for "${e.title}"${e.date ? ` on ${formatDisplayDate(e.date, "")}` : ""}.\n\nPlease confirm here: ${inviteUrl}`;
    if (mobile.length >= 10) {
      window.open(`https://api.whatsapp.com/send?phone=91${mobile.slice(-10)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (guest?.guestEmail) {
      const r = await rybboSocialService.inviteByEmail(id, {
        email: guest.guestEmail,
        inviteUrl,
        message: text,
        banner: coverImages[0] || null,
        reminder: true,
      });
      showToast(r.success ? (r.data?.message || "Reminder emailed") : (r.message || "Could not send reminder"), r.success ? "success" : "error");
      return;
    }
    showToast("Guest contact is missing", "error");
  };

  // Keep the local cover-image list + sample message in sync with the loaded event.
  useEffect(() => {
    if (!e) return;
    const imgs = Array.isArray(e.coverImages) && e.coverImages.length
      ? e.coverImages
      : [e.coverImage].filter(Boolean);
    setCoverImages(imgs.slice(0, MAX_IMAGES));
    // Seed the editable message once; don't clobber the host's edits on reload.
    setShareMessage((prev) => prev || buildInviteMessage(e));
  }, [state.event]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize + compress the picked image so big phone photos fit comfortably under the
  // 2 MB budget instead of being rejected. Returns a JPEG data URL.
  const compressImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // flatten any transparency so JPEG doesn't go black
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const estBytes = (durl) => Math.ceil((durl.length - durl.indexOf(",") - 1) * 0.75);
      let q = 0.85;
      let dataUrl = canvas.toDataURL("image/jpeg", q);
      while (estBytes(dataUrl) > MAX_IMG_BYTES && q > 0.4) {
        q -= 0.12;
        dataUrl = canvas.toDataURL("image/jpeg", q);
      }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable image")); };
    img.src = url;
  });

  // Persist the cover-image list right away — backend update is partial, so we
  // only send the image fields and leave the rest of the event untouched.
  const persistImages = async (next) => {
    setCoverImages(next);
    setSavingImages(true);
    const r = await rybboSocialService.updateEvent(id, { coverImages: next, coverImage: next[0] || null });
    setSavingImages(false);
    if (!r.success) { showToast(r.message || "Could not save images", "error"); load(); }
  };

  const onPickImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const slots = MAX_IMAGES - coverImages.length;
    if (slots <= 0) { showToast(`You can add up to ${MAX_IMAGES} images`, "error"); return; }
    if (files.some((f) => !f.type.startsWith("image/"))) { showToast("Please choose image files only", "error"); return; }
    if (files.length > slots) showToast(`Only ${slots} more image${slots > 1 ? "s" : ""} added (max ${MAX_IMAGES})`, "info");
    setSavingImages(true);
    try {
      const picked = await Promise.all(files.slice(0, slots).map(compressImage));
      persistImages([...coverImages, ...picked].slice(0, MAX_IMAGES));
    } catch {
      setSavingImages(false);
      showToast("Could not process that image — try another", "error");
    }
  };

  const removeImage = (i) => persistImages(coverImages.filter((_, idx) => idx !== i));

  // Canva has no prompt-prefill via URL, so copy a Canva-tailored prompt to the
  // clipboard and open Magic Media — the host just pastes it to generate the banner.
  const openCanva = async () => {
    try {
      await navigator.clipboard.writeText(buildCanvaPrompt(e, inviteUrl));
      showToast("Prompt copied — Canva opens with Magic Media, just paste & generate", "success");
    } catch {
      showToast("Could not copy the prompt — type your own in Canva", "info");
    }
    window.open(CANVA_BANNER_URL, "_blank", "noopener,noreferrer");
    setBannerOpen(false);
  };

  const copyReminder = async () => {
    const msg = `Gentle reminder: please confirm your presence for "${e.title}"${e.date ? ` on ${formatDisplayDate(e.date, "")}` : ""} so we can plan better. RSVP here: ${inviteUrl}`;
    try { await navigator.clipboard.writeText(msg); showToast("Reminder message copied", "success"); }
    catch { showToast("Could not copy", "error"); }
  };

  const downloadGuestList = () => {
    const header = ["Name", "Mobile", "Response", "Party size", "Food", "Note", "Responded at"];
    const rows = guests.map((g) => [g.guestName, g.guestMobile, g.response, g.partySize, g.foodPref || "", (g.note || "").replace(/\n/g, " "), g.respondedAt || ""]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(e.title || "guest-list").replace(/[^a-z0-9]+/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch the device contact list, then open the multi-select sheet so the host
  // can pick several people and invite them in one go.
  const openContactPicker = async () => {
    if (contactsLoading) return;
    setContactsLoading(true);
    try {
      const list = await pickContacts();
      if (!list.length) { showToast("No contacts with a valid mobile number found", "info"); return; }
      setAllContacts(list);
      setSelectedMobiles(new Set());
      setContactSearch("");
      setContactsOpen(true);
    } catch (err) {
      if (isUserCancelledError(err)) return;
      if (err?.code === "permission_denied") { showToast("Permission to access contacts was denied", "error"); return; }
      if (err?.code === "unsupported") { showToast("Contact picker isn't available on this device", "error"); return; }
      showToast("Could not open contacts", "error");
    } finally {
      setContactsLoading(false);
    }
  };

  const toggleMobile = (mobile) => {
    setSelectedMobiles((prev) => {
      const next = new Set(prev);
      if (next.has(mobile)) next.delete(mobile); else next.add(mobile);
      return next;
    });
  };

  // Invite every selected contact. Backend exposes only a single-mobile invite,
  // so we fan out one request per contact and report an aggregate result.
  const inviteSelected = async () => {
    const mobiles = Array.from(selectedMobiles);
    if (!mobiles.length) { showToast("Select at least one contact", "info"); return; }
    setBulkInviting(true);
    let ok = 0, fail = 0, duplicate = 0;
    for (const m of mobiles) {
      if (invitedKeys.has(inviteKey(m))) { duplicate++; continue; }
      try {
        const r = await rybboSocialService.inviteByMobile(id, m);
        if (r.success) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkInviting(false);
    setContactsOpen(false);
    setSelectedMobiles(new Set());
    showToast(`${ok} invite${ok === 1 ? "" : "s"} sent${duplicate ? `, ${duplicate} already invited` : ""}${fail ? `, ${fail} failed` : ""}`, ok ? "success" : duplicate ? "info" : "error");
    load();
  };

  const sendInvite = async () => {
    const target = inviteTarget.trim();
    const key = inviteKey(target);
    if (!key) { showToast("Enter a valid mobile number or email", "error"); return; }
    if (invitedKeys.has(key)) { showToast("This guest is already invited", "info"); return; }
    setInviting(true);
    const r = key.startsWith("email:")
      ? await rybboSocialService.inviteByEmail(id, {
          email: target,
          inviteUrl,
          message: (shareMessage || buildInviteMessage(e)).trim(),
          banner: coverImages[0] || null,
        })
      : await rybboSocialService.inviteByMobile(id, target);
    setInviting(false);
    if (!r.success) { showToast(r.message || "Could not send invite", "error"); return; }
    showToast(r.data?.message || "Invite processed", "success");
    setInviteTarget("");
    load();
  };

  // Co-hosts — owner grants up to 2 extra people full management of this event.
  const addCoHost = async () => {
    const m = coHostMobile.replace(/\D/g, "");
    if (m.length < 10) { showToast("Enter a valid 10-digit mobile", "error"); return; }
    setAddingCoHost(true);
    const r = await rybboSocialService.addCoHost(id, m);
    setAddingCoHost(false);
    if (!r.success) { showToast(r.message || "Could not add co-host", "error"); return; }
    showToast(r.data?.message || "Co-host added", "success");
    setCoHostMobile("");
    load();
  };

  const removeCoHost = async (coHost) => {
    const label = coHost.name || coHost.mobile || "this co-host";
    const pending = coHost.status === "PENDING" || !coHost.userId;
    if (!window.confirm(pending
      ? `Cancel the co-host invite for ${label}?`
      : `Remove ${label}? They will lose access to this event.`)) return;
    const r = pending
      ? await rybboSocialService.removePendingCoHost(id, coHost.mobile)
      : await rybboSocialService.removeCoHost(id, coHost.userId);
    if (!r.success) { showToast(r.message || "Could not remove co-host", "error"); return; }
    showToast(pending ? "Invite cancelled" : "Co-host removed", "success");
    load();
  };

  const cancelEvent = async () => {
    if (!window.confirm("Cancel this event? Guests who open the invite will see it as cancelled.")) return;
    const r = await rybboSocialService.cancelEvent(id);
    if (!r.success) { showToast(r.message || "Could not cancel", "error"); return; }
    showToast("Event cancelled", "success");
    load();
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      {e && (
        <div className="cel-wrap" style={{ width: "100%", padding: "0 0 28px" }}>
          <CelebrationBg />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
            <button type="button" onClick={() => navigate("/customer/app/rybbo/social")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
              <FaArrowLeft />
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 16 }}>
            {e.status === "CANCELLED" && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                This event is cancelled.
              </div>
            )}

            {/* When & where */}
            <div style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)" }}>
              <div>🗓️ {formatDisplayDate(e.date, "")}{e.time ? ` · ${formatDisplayTime(e.time, "")}` : ""}</div>
              {e.venue && <div style={{ marginTop: 2 }}>📍 {e.venue}</div>}
              {e.foodPref && <div style={{ marginTop: 2, textTransform: "capitalize" }}>🍽️ {e.foodPref}</div>}
            </div>

            {e.status !== "CANCELLED" && (
              <button type="button" onClick={() => navigate(`/customer/app/rybbo/social/event/${id}/edit`)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", padding: "8px 14px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <FaEdit /> Edit event
              </button>
            )}

            {/* Co-hosts — host can grant up to 2 more people full management of this event */}
            {(e.isOwner || (e.coHosts && e.coHosts.length > 0)) && (
              <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <FaUsers style={{ color: ACCENT }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Co-hosts</span>
                  <span style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>({(e.coHosts || []).length}/2)</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginBottom: 10 }}>
                  {e.isOwner
                    ? "Add up to 2 people who can co-manage this event — edit details, invite guests and scan entries. If they're not on VasBazaar yet, they'll become a co-host automatically once they sign up. Only you can cancel or delete it."
                    : "You're a co-host for this event and can help manage it."}
                </div>

                {(e.coHosts || []).length > 0 && (
                  <div style={{ display: "grid", gap: 8, marginBottom: e.isOwner ? 12 : 0 }}>
                    {e.coHosts.map((c) => (
                      <div key={c.userId || `pending-${c.mobile}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                            {c.name || c.mobile}
                            {c.status === "PENDING" && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>Invited</span>
                            )}
                          </div>
                          {c.name
                            ? <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{c.mobile}</div>
                            : c.status === "PENDING" && <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>Will join as co-host after sign-up</div>}
                        </div>
                        {e.isOwner && (
                          <button type="button" onClick={() => removeCoHost(c)} aria-label="Remove co-host"
                            style={{ border: "1px solid #fecaca", background: "transparent", color: "#b91c1c", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <FaTimes size={11} /> Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {e.isOwner && e.status !== "CANCELLED" && (e.coHosts || []).length < 2 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={coHostMobile} onChange={(ev) => setCoHostMobile(ev.target.value)} inputMode="numeric"
                      placeholder="Co-host mobile number" maxLength={10}
                      style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 13, outline: "none" }} />
                    <button type="button" onClick={addCoHost} disabled={addingCoHost}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: 13, cursor: addingCoHost ? "default" : "pointer", whiteSpace: "nowrap" }}>
                      <FaUserPlus /> {addingCoHost ? "Adding…" : "Add"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step indicator for the create → share → track flow (tap to jump) */}
            <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700 }}>
              {[{ n: 1, label: "1 · Banner" }, { n: 2, label: "2 · Share" }, { n: 3, label: "3 · Track" }].map((s) => (
                <button key={s.n} type="button" onClick={() => setStep(s.n)}
                  style={{ flex: 1, textAlign: "center", padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: step === s.n ? ACCENT : "var(--cm-bg, #F3F4F6)", color: step === s.n ? "#fff" : "var(--cm-muted, #6B7280)", fontWeight: 700, fontSize: 12 }}>
                  {s.label}
                </button>
              ))}
            </div>

            {step === 1 && (
            <>
            {/* Banner preview — uploads happen via the "Create invite banner" chooser below */}
            {coverImages.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, margin: "0 2px 8px" }}>
                  Your banner{coverImages.length > 1 ? "s" : ""} ({coverImages.length}/{MAX_IMAGES}){savingImages ? " · saving…" : ""}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                  {coverImages.map((img, i) => (
                    <div key={i} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                      <img src={img} alt="" onClick={() => setImagePreview(img)}
                        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10, background: "var(--cm-bg, #F3F4F6)", display: "block", cursor: "zoom-in" }} />
                      <button type="button" onClick={() => removeImage(i)} aria-label="Remove image" disabled={savingImages}
                        style={{ position: "absolute", top: 4, right: 4, width: 26, height: 26, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Hidden picker — triggered from the "Upload a banner" option in the chooser */}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(ev) => { onPickImages(ev.target.files); ev.target.value = ""; }} />

            {/* Invite banner — opens a chooser: upload your own, or generate one with AI */}
            <div>
              <button type="button" onClick={() => { setBannerMode("choose"); setBannerOpen(true); }}
                style={{ display: "inline-flex", width: "100%", boxSizing: "border-box", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7C3AED, #EC4899)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                <FaMagic /> Create &amp; upload invite banner
              </button>
              <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 6, textAlign: "center" }}>
                Upload your own banner, or generate one with Claude, ChatGPT or Canva — then share it with your invite.
              </div>
            </div>

            {/* Move on to sharing once the banner is ready */}
            <button type="button" onClick={() => setStep(2)}
              style={{ display: "inline-flex", width: "100%", boxSizing: "border-box", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Next: Share invite →
            </button>
            </>
            )}

            {step === 2 && (
            <>
            {/* Back to banner creation */}
            <button type="button" onClick={() => setStep(1)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 0", background: "transparent", border: "none", color: ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}>
              <FaArrowLeft /> Back to banner
            </button>

            {/* Share invite */}
            <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Share your invite</div>

              {/* Editable, category-tailored message — sent along with the link when sharing */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cm-muted, #6B7280)" }}>Invite message (tap to edit)</span>
                <button type="button" onClick={() => setShareMessage(buildInviteMessage(e))}
                  style={{ background: "transparent", border: "none", color: ACCENT, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                  Reset
                </button>
              </div>
              <textarea value={shareMessage} onChange={(ev) => setShareMessage(ev.target.value)} rows={6}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", fontSize: 13, lineHeight: 1.5, outline: "none", resize: "vertical", marginBottom: 12 }} />

              {coverImages.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginBottom: 10 }}>
                  Your banner is attached when you share from the app.
                </div>
              )}
              {/* Preview how the invite looks before sending */}
              <button type="button" onClick={() => setPreviewOpen(true)}
                style={{ width: "100%", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", marginBottom: 8, borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: "pointer" }}>
                <FaEye /> Preview invite
              </button>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={shareInvite}
                  style={{ flex: 1, minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  <FaWhatsapp /> WhatsApp
                </button>
                <button type="button" onClick={copyLink}
                  style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: "pointer" }}>
                  <FaCopy /> Copy link
                </button>
              </div>
              {/* Invite by mobile or email — type one contact, or pick mobiles from device contacts. */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <input value={inviteTarget} onChange={(ev) => setInviteTarget(ev.target.value)} type="text" placeholder="Invite by mobile or email"
                  style={{ flex: 1, minWidth: 160, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", fontSize: 13, outline: "none" }} />
                <button type="button" onClick={sendInvite} disabled={inviting}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <FaUserPlus /> {inviting ? "…" : "Invite"}
                </button>
                <button type="button" onClick={openContactPicker} disabled={contactsLoading || inviting}
                  aria-label="Invite from contacts" title="Invite from contacts"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 12px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <FaAddressBook /> {contactsLoading ? "…" : "Contacts"}
                </button>
              </div>

              <div style={{ marginTop: 14, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Invited guests</div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>
                      {summary.totalInvited ?? invitedGuests.length} invited • {summary.invited ?? 0} awaiting RSVP
                    </div>
                  </div>
                  <button type="button" onClick={() => setStep(3)}
                    style={{ border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                    View all
                  </button>
                </div>
                {invitedGuests.length === 0 ? (
                  <div style={{ padding: 14, color: "var(--cm-muted, #6B7280)", fontSize: 13 }}>
                    No invited guests yet. Add a mobile number/email or pick contacts.
                  </div>
                ) : (
                  <div>
                    {invitedGuests.slice(0, 6).map((g) => {
                      const meta = RESPONSE_META[g.response] || { label: g.response || "Invited", color: "#6B7280" };
                      return (
                        <div key={g.id || guestContact(g)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: "1px solid rgba(127,127,127,0.14)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.guestName || "Guest"}</div>
                            <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>{guestContact(g)}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, background: `${meta.color}18`, borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" }}>
                            {meta.label}
                          </span>
                          {g.response !== "ACCEPT" && (
                            <button type="button" onClick={() => sendGuestReminder(g)}
                              style={{ border: "none", background: "#25D366", color: "#fff", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                              Reminder
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Move on to tracking responses */}
            <button type="button" onClick={() => setStep(3)}
              style={{ display: "inline-flex", width: "100%", boxSizing: "border-box", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Next: Track responses →
            </button>
            </>
            )}

            {step === 3 && (
            <>
            {/* Back to sharing */}
            <button type="button" onClick={() => setStep(2)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 0", background: "transparent", border: "none", color: ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}>
              <FaArrowLeft /> Back to share
            </button>

            {/* RSVP stats */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, margin: "0 2px 8px" }}>Responses</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatCard value={summary.totalInvited ?? invitedGuests.length} label="Invited" color={ACCENT} />
                <StatCard value={summary.invited ?? 0} label="Awaiting" color="#7C3AED" />
                <StatCard value={summary.accepted ?? 0} label="Accepted" color="#16a34a" onClick={() => setReportOpen(true)} />
                <StatCard value={summary.maybe ?? 0} label="Maybe" color="#f59e0b" />
                <StatCard value={summary.declined ?? 0} label="Declined" color="#ef4444" />
                <StatCard value={summary.guestCount ?? 0} label="Head count" color={ACCENT} />
              </div>
            </div>

            {/* Food preference breakdown */}
            {e.foodPrefCounts && Object.keys(e.foodPrefCounts).length > 0 && (
              <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Food preferences (confirmed)</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                  {Object.entries(e.foodPrefCounts).map(([k, v]) => (
                    <span key={k} style={{ textTransform: "capitalize" }}><strong>{v}</strong> {k.replace("-", " ")}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Guest insights — kids, parking, accommodation, dress compliance */}
            {e.guestInsights && (e.guestInsights.acceptedGuests ?? 0) > 0 && (
              <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Guest insights (confirmed)</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                  <span>🧒 <strong>{e.guestInsights.kidsTotal ?? 0}</strong> kids</span>
                  <span>🅿️ <strong>{e.guestInsights.parkingNeeded ?? 0}</strong> need parking</span>
                  <span>🏨 <strong>{e.guestInsights.accommodationNeeded ?? 0}</strong> need stay</span>
                  {e.dressCode && <span>👗 <strong>{e.guestInsights.dressCompliancePct ?? 0}%</strong> dress confirmed</span>}
                </div>
                {Array.isArray(e.guestInsights.songRequests) && e.guestInsights.songRequests.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-muted, #6B7280)", marginBottom: 4 }}>🎵 Song requests</div>
                    <div style={{ display: "grid", gap: 3, fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
                      {e.guestInsights.songRequests.map((s, i) => (
                        <div key={i}><strong style={{ color: "inherit" }}>{s.song}</strong> — {s.guestName}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guest list */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 8px" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Guest list ({guests.length})</div>
                {guests.length > 0 && (
                  <button type="button" onClick={downloadGuestList}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <FaDownload size={11} /> CSV
                  </button>
                )}
              </div>
              {guests.length === 0 ? (
                <div className="cm-empty" style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--cm-muted, #6B7280)" }}>
                  No invited guests yet. Share the invite to get started.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {guests.map((g) => {
                    const meta = RESPONSE_META[g.response] || { label: g.response, color: "#6B7280" };
                    return (
                      <div key={g.id} style={{ display: "flex", gap: 10, padding: 12, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.guestName} {g.response === "ACCEPT" && g.partySize > 1 ? <span style={{ color: "var(--cm-muted, #6B7280)", fontWeight: 500 }}>+{g.partySize - 1}</span> : null}</div>
                          <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{guestContact(g)}{g.foodPref ? ` · ${g.foodPref}` : ""}</div>
                          {g.note && <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginTop: 2, fontStyle: "italic" }}>"{g.note}"</div>}
                          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            {g.contributionStatus === "PAID" && <span style={{ fontSize: 10, fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "2px 7px", borderRadius: 999 }}>Paid ₹{g.contributionAmount}</span>}
                            {g.checkedIn && <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: "#ede9fe", padding: "2px 7px", borderRadius: 999 }}>Checked in</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>
                          {g.response !== "ACCEPT" && (
                            <button type="button" onClick={() => sendGuestReminder(g)}
                              style={{ border: "none", background: "#25D366", color: "#fff", borderRadius: 999, padding: "6px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                              Reminder
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {e.contributionAmount > 0 && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f5f3ff", color: ACCENT, fontSize: 13, fontWeight: 700 }}>
                Collected ₹{(guests.filter((g) => g.contributionStatus === "PAID").length) * Number(e.contributionAmount)} of ₹{e.contributionAmount}/guest
              </div>
            )}

            {/* Host actions */}
            <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Host actions</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {e.status !== "CANCELLED" && (
                  <button type="button" onClick={sendReminder}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    <FaWhatsapp /> Send reminder
                  </button>
                )}
                {e.status !== "CANCELLED" && (
                  <button type="button" onClick={() => navigate(`/customer/app/rybbo/social/event/${id}/scan`)}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    <FaQrcode /> Scan entries
                  </button>
                )}
                <button type="button" onClick={copyReminder}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
                  <FaBell /> Copy reminder
                </button>
                {e.status !== "CANCELLED" && e.isOwner && (
                  <button type="button" onClick={cancelEvent}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid #fecaca", background: "transparent", color: "#b91c1c", fontWeight: 600, cursor: "pointer" }}>
                    <FaBan /> Cancel event
                  </button>
                )}
              </div>
            </div>
            </>
            )}
          </div>

          {/* Multi-select contact invite sheet */}
          {contactsOpen && (() => {
            const q = contactSearch.trim().toLowerCase();
            const filtered = q
              ? allContacts.filter((c) => (c.name || "").toLowerCase().includes(q) || c.mobile.includes(q))
              : allContacts;
            return (
              <div onClick={() => !bulkInviting && setContactsOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
                <div onClick={(ev) => ev.stopPropagation()}
                  style={{ width: "100%", maxWidth: 520, maxHeight: "82vh", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--cm-line, #E5E7EB)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Invite from contacts</div>
                    <button type="button" onClick={() => !bulkInviting && setContactsOpen(false)} aria-label="Close"
                      style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                      <FaTimes />
                    </button>
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)" }}>
                      <FaSearch style={{ color: "var(--cm-muted, #6B7280)" }} />
                      <input value={contactSearch} onChange={(ev) => setContactSearch(ev.target.value)} placeholder="Search name or number"
                        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "inherit", fontSize: 13 }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--cm-muted, #6B7280)" }}>No contacts found.</div>
                    ) : filtered.map((c) => {
                      const checked = selectedMobiles.has(c.mobile);
                      return (
                        <button key={c.mobile} type="button" onClick={() => toggleMobile(c.mobile)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", background: "transparent", border: "none", borderBottom: "1px solid var(--cm-line, #F3F4F6)", cursor: "pointer", textAlign: "left", color: "inherit" }}>
                          <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? ACCENT : "var(--cm-line, #D1D5DB)"}`, background: checked ? ACCENT : "transparent", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>
                            {checked ? <FaCheck /> : null}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                            <span style={{ display: "block", fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{c.mobile}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: "12px 16px", borderTop: "1px solid var(--cm-line, #E5E7EB)" }}>
                    <button type="button" onClick={inviteSelected} disabled={bulkInviting || selectedMobiles.size === 0}
                      style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, border: "none", background: selectedMobiles.size ? ACCENT : "var(--cm-line, #D1D5DB)", color: "#fff", fontWeight: 700, cursor: selectedMobiles.size ? "pointer" : "default" }}>
                      <FaUserPlus /> {bulkInviting ? "Inviting…" : `Invite ${selectedMobiles.size || ""} guest${selectedMobiles.size === 1 ? "" : "s"}`.replace(/\s+/g, " ").trim()}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Banner AI provider chooser */}
          {bannerOpen && (
            <div onClick={() => setBannerOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
              <div onClick={(ev) => ev.stopPropagation()}
                style={{ width: "100%", maxWidth: 380, background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {bannerMode === "ai" && (
                    <button type="button" onClick={() => setBannerMode("choose")} aria-label="Back"
                      style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>
                      <FaArrowLeft />
                    </button>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>
                    {bannerMode === "ai" ? "Generate with AI" : "Create invite banner"}
                  </div>
                  <button type="button" onClick={() => setBannerOpen(false)} aria-label="Close"
                    style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                    <FaTimes />
                  </button>
                </div>

                {bannerMode === "choose" ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 16 }}>
                      Add your own ready-made banner, or let AI design one for you.
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <button type="button" onClick={() => { setBannerOpen(false); fileRef.current?.click(); }}
                        disabled={coverImages.length >= MAX_IMAGES}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: coverImages.length >= MAX_IMAGES ? "default" : "pointer", opacity: coverImages.length >= MAX_IMAGES ? 0.5 : 1 }}>
                        <FaImage /> Upload a banner {coverImages.length >= MAX_IMAGES ? "(limit reached)" : ""}
                      </button>
                      <button type="button" onClick={() => setBannerMode("ai")}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7C3AED, #EC4899)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                        <FaMagic /> Create a banner with AI
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 16 }}>
                      Pick a tool — Claude &amp; ChatGPT open with your event details ready; Canva copies the prompt for you to paste. Generate the banner, then screenshot to share.
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <a href={buildBannerAiUrl("claude", e, inviteUrl)} target="_blank" rel="noreferrer" onClick={() => setBannerOpen(false)}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, background: "#D77655", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
                        <FaMagic /> Use Claude
                      </a>
                      <a href={buildBannerAiUrl("chatgpt", e, inviteUrl)} target="_blank" rel="noreferrer" onClick={() => setBannerOpen(false)}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, background: "#10A37F", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
                        <FaMagic /> Use ChatGPT
                      </a>
                      <button type="button" onClick={openCanva}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 10, border: "none", background: "#00C4CC", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                        <FaMagic /> Use Canva <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>(prompt copied)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Accepted — consolidated report */}
          {reportOpen && (() => {
            const rep = goingReport();
            const Stat = ({ label, value, color }) => (
              <div style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "10px 6px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: color || ACCENT }}>{value}</div>
                <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 2 }}>{label}</div>
              </div>
            );
            return (
              <div onClick={() => setReportOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
                <div onClick={(ev) => ev.stopPropagation()}
                  style={{ width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Accepted — consolidated report</div>
                    <button type="button" onClick={() => setReportOpen(false)} aria-label="Close"
                      style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                      <FaTimes />
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <Stat label="Accepted" value={rep.going.length} color="#16a34a" />
                    <Stat label="Head count" value={rep.heads} />
                    <Stat label="Kids" value={rep.kids} />
                    <Stat label="Drinkers" value={rep.drinkers} color="#b45309" />
                    <Stat label="Non-drinkers" value={rep.nonDrinkers} color="#6B7280" />
                  </div>

                  {Object.keys(rep.food).length > 0 && (
                    <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Food preference (head count)</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {Object.entries(rep.food).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "var(--cm-bg, #F3F4F6)", textTransform: "capitalize" }}>
                            {k}: <strong>{v}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 700, margin: "0 2px 8px" }}>Guest list ({rep.going.length})</div>
                  {rep.going.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--cm-muted, #6B7280)" }}>No one has confirmed yet.</div>
                  ) : (
                    <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr 0.6fr 0.7fr", gap: 0, fontSize: 11, fontWeight: 700, background: "var(--cm-bg, #F3F4F6)", padding: "8px 10px" }}>
                        <span>Name</span><span style={{ textAlign: "center" }}>Heads</span><span>Food</span><span style={{ textAlign: "center" }}>Kids</span><span style={{ textAlign: "center" }}>Drinks</span>
                      </div>
                      {rep.going.map((g) => (
                        <div key={g.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr 0.6fr 0.7fr", gap: 0, fontSize: 12, padding: "8px 10px", borderTop: "1px solid var(--cm-line, #F3F4F6)" }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.guestName}</span>
                          <span style={{ textAlign: "center" }}>{g.partySize ?? 1}</span>
                          <span style={{ textTransform: "capitalize", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.foodPref || "—"}</span>
                          <span style={{ textAlign: "center" }}>{g.kidsCount ?? 0}</span>
                          <span style={{ textAlign: "center" }}>{g.drinks ? "Yes" : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={exportGoingReport} disabled={rep.going.length === 0}
                    style={{ width: "100%", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", marginTop: 14, borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: rep.going.length ? "pointer" : "default", opacity: rep.going.length ? 1 : 0.6 }}>
                    <FaDownload /> Export report (CSV)
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Banner full-image lightbox */}
          {imagePreview && (
            <div onClick={() => setImagePreview(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1100, cursor: "zoom-out" }}>
              <img src={imagePreview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
              <button type="button" onClick={() => setImagePreview(null)} aria-label="Close"
                style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 20, cursor: "pointer" }}>
                <FaTimes />
              </button>
            </div>
          )}

          {/* Invite preview — shows the banner + formatted message as the guest will see it */}
          {previewOpen && (
            <div onClick={() => setPreviewOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
              <div onClick={(ev) => ev.stopPropagation()}
                style={{ width: "100%", maxWidth: 380, maxHeight: "85vh", overflowY: "auto", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Invite preview</div>
                  <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close"
                    style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                    <FaTimes />
                  </button>
                </div>
                {/* WhatsApp-style chat bubble */}
                <div style={{ background: "#0b141a", borderRadius: 12, padding: 12 }}>
                  <div style={{ background: "#005c4b", color: "#e9edef", borderRadius: 10, padding: 8, marginLeft: "auto", maxWidth: "92%", fontSize: 13, lineHeight: 1.5 }}>
                    {coverImages[0] && (
                      <img src={coverImages[0]} alt="" style={{ width: "100%", borderRadius: 8, display: "block", marginBottom: 6 }} />
                    )}
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {(shareMessage || buildInviteMessage(e)).split("\n").map((line, i) => (
                        <div key={i}>
                          {line.split(/(\*[^*]+\*)/g).map((seg, j) =>
                            seg.length > 2 && seg.startsWith("*") && seg.endsWith("*")
                              ? <strong key={j}>{seg.slice(1, -1)}</strong>
                              : <span key={j}>{seg}</span>
                          )}
                        </div>
                      ))}
                      <div style={{ marginTop: 6, color: "#53bdeb", wordBreak: "break-all" }}>{inviteUrl}</div>
                    </div>
                  </div>
                </div>
                {coverImages.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 8, textAlign: "center" }}>
                    No banner yet — add one from “Create &amp; upload invite banner”.
                  </div>
                )}
                <button type="button" onClick={shareInvite}
                  style={{ width: "100%", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", marginTop: 14, borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  <FaWhatsapp /> Send on WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DataState>
  );
};

export default EventDashboardScreen;
