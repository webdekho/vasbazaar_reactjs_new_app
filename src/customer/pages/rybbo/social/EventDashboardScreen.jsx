import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaWhatsapp, FaCopy, FaEdit, FaBan, FaDownload, FaBell, FaUserPlus, FaQrcode, FaAddressBook, FaSearch, FaTimes, FaCheck, FaMagic } from "react-icons/fa";
import { rybboSocialService, buildInviteUrl, buildWhatsappShare, buildBannerAiUrl } from "../../../services/rybboSocialService";
import { pickContacts, isUserCancelledError } from "../../rebuddy/contacts";
import DataState from "../../../components/DataState";
import { useToast } from "../../../context/ToastContext";
import "./celebration.css";

const ACCENT = "#7C3AED";

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
  ACCEPT: { label: "Going", color: "#16a34a" },
  MAYBE: { label: "Maybe", color: "#f59e0b" },
  DECLINE: { label: "Declined", color: "#ef4444" },
};

const StatCard = ({ value, label, color }) => (
  <div style={{ flex: 1, minWidth: 70, textAlign: "center", padding: "12px 6px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12 }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 2 }}>{label}</div>
  </div>
);

const EventDashboardScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: "", event: null });
  const [inviteMobile, setInviteMobile] = useState("");
  const [inviting, setInviting] = useState(false);
  // Multi-select contact invite sheet
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [selectedMobiles, setSelectedMobiles] = useState(() => new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [bulkInviting, setBulkInviting] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);

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
  const inviteUrl = e ? buildInviteUrl(e.token) : "";

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); showToast("Invite link copied", "success"); }
    catch { showToast(inviteUrl, "info"); }
  };

  const copyReminder = async () => {
    const msg = `Gentle reminder: please confirm your presence for "${e.title}"${e.date ? ` on ${e.date}` : ""} so we can plan better. RSVP here: ${inviteUrl}`;
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
    let ok = 0, fail = 0;
    for (const m of mobiles) {
      try {
        const r = await rybboSocialService.inviteByMobile(id, m);
        if (r.success) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkInviting(false);
    setContactsOpen(false);
    setSelectedMobiles(new Set());
    showToast(`${ok} invite${ok === 1 ? "" : "s"} sent${fail ? `, ${fail} failed` : ""}`, ok ? "success" : "error");
    load();
  };

  const sendInvite = async () => {
    const m = inviteMobile.replace(/\D/g, "");
    if (m.length < 10) { showToast("Enter a valid 10-digit mobile", "error"); return; }
    setInviting(true);
    const r = await rybboSocialService.inviteByMobile(id, m);
    setInviting(false);
    if (!r.success) { showToast(r.message || "Could not send invite", "error"); return; }
    showToast(r.data?.message || "Invite processed", r.data?.isAppUser ? "success" : "info");
    setInviteMobile("");
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
              <div>🗓️ {e.date}{e.time ? ` · ${e.time}` : ""}</div>
              {e.venue && <div style={{ marginTop: 2 }}>📍 {e.venue}</div>}
              {e.foodPref && <div style={{ marginTop: 2, textTransform: "capitalize" }}>🍽️ {e.foodPref}</div>}
            </div>

            {/* Share invite */}
            <div style={{ border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Share your invite</div>
              <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", wordBreak: "break-all", marginBottom: 12 }}>{inviteUrl}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={buildWhatsappShare(e, e.token)} target="_blank" rel="noreferrer"
                  style={{ flex: 1, minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, background: "#25D366", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
                  <FaWhatsapp /> WhatsApp
                </a>
                <button type="button" onClick={copyLink}
                  style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: "pointer" }}>
                  <FaCopy /> Copy link
                </button>
              </div>
              {/* Invite by mobile — type a number or pick from the device contact list */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input value={inviteMobile} onChange={(ev) => setInviteMobile(ev.target.value)} type="tel" placeholder="Invite by mobile (track invitees)"
                  style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", fontSize: 13, outline: "none" }} />
                <button type="button" onClick={openContactPicker} disabled={contactsLoading || inviting}
                  aria-label="Invite from contacts" title="Invite from contacts"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 12px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <FaAddressBook /> {contactsLoading ? "…" : "Contacts"}
                </button>
                <button type="button" onClick={sendInvite} disabled={inviting}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <FaUserPlus /> {inviting ? "…" : "Invite"}
                </button>
              </div>
              {/* AI invite banner — lets the host pick Claude or ChatGPT, then opens it with a prompt pre-filled from this event's details */}
              <button type="button" onClick={() => setBannerOpen(true)}
                style={{ display: "inline-flex", width: "100%", boxSizing: "border-box", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", marginTop: 10, borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7C3AED, #EC4899)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                <FaMagic /> Create invite banner
              </button>
              <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", marginTop: 6, textAlign: "center" }}>
                Opens Claude with your event details ready — generate &amp; tweak a banner, then screenshot to share.
              </div>
            </div>

            {/* RSVP stats */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, margin: "0 2px 8px" }}>Responses</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatCard value={summary.accepted ?? 0} label="Going" color="#16a34a" />
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
                  No responses yet. Share the invite to get started.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {guests.map((g) => {
                    const meta = RESPONSE_META[g.response] || { label: g.response, color: "#6B7280" };
                    return (
                      <div key={g.id} style={{ display: "flex", gap: 10, padding: 12, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.guestName} {g.response === "ACCEPT" && g.partySize > 1 ? <span style={{ color: "var(--cm-muted, #6B7280)", fontWeight: 500 }}>+{g.partySize - 1}</span> : null}</div>
                          <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{g.guestMobile}{g.foodPref ? ` · ${g.foodPref}` : ""}</div>
                          {g.note && <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginTop: 2, fontStyle: "italic" }}>"{g.note}"</div>}
                          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            {g.contributionStatus === "PAID" && <span style={{ fontSize: 10, fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "2px 7px", borderRadius: 999 }}>Paid ₹{g.contributionAmount}</span>}
                            {g.checkedIn && <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: "#ede9fe", padding: "2px 7px", borderRadius: 999 }}>Checked in</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {e.status !== "CANCELLED" && (
                <button type="button" onClick={() => navigate(`/customer/app/rybbo/social/event/${id}/scan`)}
                  style={{ flex: 1, minWidth: 150, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  <FaQrcode /> Scan entries
                </button>
              )}
              <button type="button" onClick={copyReminder}
                style={{ flex: 1, minWidth: 150, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
                <FaBell /> Copy reminder
              </button>
              {e.status !== "CANCELLED" && (
                <button type="button" onClick={() => navigate(`/customer/app/rybbo/social/event/${id}/edit`)}
                  style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
                  <FaEdit /> Edit
                </button>
              )}
              {e.status !== "CANCELLED" && (
                <button type="button" onClick={cancelEvent}
                  style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, border: "1px solid #fecaca", background: "transparent", color: "#b91c1c", fontWeight: 600, cursor: "pointer" }}>
                  <FaBan /> Cancel
                </button>
              )}
            </div>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Create invite banner</div>
                  <button type="button" onClick={() => setBannerOpen(false)} aria-label="Close"
                    style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                    <FaTimes />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 16 }}>
                  Pick an AI — it opens with your event details ready. Generate the banner, then screenshot to share.
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
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DataState>
  );
};

export default EventDashboardScreen;
