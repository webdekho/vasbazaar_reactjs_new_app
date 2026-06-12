import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { FaCheckCircle, FaQuestionCircle, FaTimesCircle, FaMapMarkerAlt, FaCalendarPlus, FaWallet, FaMobileAlt, FaQrcode, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { rybboSocialService, buildContributionReturnUrl } from "../../../services/rybboSocialService";
import DataState from "../../../components/DataState";

const ACCENT = "#7C3AED";
const PAY_KEY = "rybbo_social_pay";

const FOOD_PREFS = ["", "veg", "non-veg", "jain", "vegan", "eggless"];

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10,
  border: "1px solid #E5E7EB", background: "#fff", color: "#1A1A2E", fontSize: 14, outline: "none",
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6 };

const RESPONSES = [
  { key: "ACCEPT", label: "Going", icon: FaCheckCircle, color: "#16a34a" },
  { key: "MAYBE", label: "Maybe", icon: FaQuestionCircle, color: "#f59e0b" },
  { key: "DECLINE", label: "Can't make it", icon: FaTimesCircle, color: "#ef4444" },
];

// Short human date for the extra dates of a multi-day event.
const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

/** Public, login-free invite + RSVP page. Rendered OUTSIDE the AuthGuard. */
const GuestRsvpScreen = () => {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: "", event: null });
  const [form, setForm] = useState({
    guestName: "", guestMobile: "", response: "ACCEPT", partySize: 1, foodPref: "", note: "",
    allergies: "", dressConfirm: false, arrivalTime: "", parkingNeeded: false,
    kidsCount: 0, accommodationNeeded: false, songRequest: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { message, response }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await rybboSocialService.getPublicInvite(token);
      if (cancelled) return;
      setState({ loading: false, error: r.success ? "" : (r.message || "Invite not found"), event: r.success ? r.data : null });

      // Resume after returning from the UPI gateway (?pay=success|failed|pending).
      const pay = new URLSearchParams(window.location.search).get("pay");
      if (pay) {
        let saved = {};
        try { saved = JSON.parse(sessionStorage.getItem(PAY_KEY) || "{}"); } catch { saved = {}; }
        if (saved.token === token && saved.mobile) {
          setForm((p) => ({ ...p, guestName: saved.name || p.guestName, guestMobile: saved.mobile }));
          setDone({ response: "ACCEPT", message: "Welcome back!", resumePay: pay });
        }
        sessionStorage.removeItem(PAY_KEY);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const e = state.event;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const mapsUrl = e && e.venueLat && e.venueLng
    ? `https://www.google.com/maps/search/?api=1&query=${e.venueLat},${e.venueLng}`
    : e && e.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue)}` : null;

  const calendarUrl = () => {
    if (!e?.eventAt) return null;
    const start = new Date(e.eventAt);
    if (isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: e.title || "Event",
      dates: `${fmt(start)}/${fmt(end)}`,
      details: e.hostMessage || "",
      location: e.venue || "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const submit = async () => {
    if (!form.guestName.trim()) { alert("Please enter your name"); return; }
    if (!/^\d{10,}$/.test(form.guestMobile.replace(/\D/g, ""))) { alert("Please enter a valid mobile number"); return; }
    setSubmitting(true);
    const accessToken = localStorage.getItem("customerSessionToken") || "";
    const r = await rybboSocialService.submitRsvp(token, { ...form, accessToken });
    setSubmitting(false);
    if (!r.success) { alert(r.message || "Could not submit your RSVP"); return; }
    setDone({ message: r.data?.message || "Your RSVP has been recorded.", response: form.response });
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      {e && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 0 40px", minHeight: "100vh", background: "#fff", color: "#1A1A2E" }}>
          {/* Cover */}
          <div style={{ position: "relative", height: 180, background: e.coverImage ? `url(${e.coverImage}) center/cover` : `linear-gradient(135deg, ${ACCENT}, #5B21B6)` }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.05))" }} />
            <div style={{ position: "absolute", bottom: 12, left: 16, right: 16, color: "#fff" }}>
              <div style={{ fontSize: 12, opacity: 0.9, textTransform: "capitalize" }}>{e.eventType} invitation</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{e.title}</div>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            {e.cancelled ? (
              <div style={{ padding: 16, borderRadius: 12, background: "#fee2e2", color: "#b91c1c", textAlign: "center", fontWeight: 700 }}>
                This event has been cancelled by the host.
              </div>
            ) : (
              <>
                {/* You're invited */}
                <div style={{ textAlign: "center", margin: "4px 0 16px" }}>
                  <div style={{ fontSize: 14, color: ACCENT, fontWeight: 700 }}>You're invited! 🎉</div>
                  {e.hostName && <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>Hosted by {e.hostName}</div>}
                </div>

                {/* Details */}
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, display: "grid", gap: 8, fontSize: 14 }}>
                  <div>🗓️ <strong>{e.date}</strong>{e.time ? ` · ${e.time}` : ""}</div>
                  {Array.isArray(e.eventDates) && e.eventDates.length > 1 && (
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                      Also on: {e.eventDates.slice(1).map((d) => fmtDate(d)).filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {e.venue && <div>📍 {e.venue}</div>}
                  {e.parkingInfo && <div>🅿️ {e.parkingInfo}</div>}
                  {e.dressCode && <div>👗 Dress code: {e.dressCode}</div>}
                  {e.foodPref && <div style={{ textTransform: "capitalize" }}>🍽️ {e.foodPref}</div>}
                  {e.ageRestriction && <div>🔞 {e.ageRestriction}</div>}
                  {e.kidsAllowed != null && <div>{e.kidsAllowed ? "🧒 Kids are welcome" : "🚫 No kids, please"}</div>}
                  {e.plusOneAllowed && <div>➕ You may bring a plus-one</div>}
                  {e.description && <div style={{ color: "#374151", marginTop: 4 }}>{e.description}</div>}
                  {e.hostMessage && <div style={{ color: "#374151", fontStyle: "italic", marginTop: 4 }}>"{e.hostMessage}"</div>}
                </div>

                {e.hostAudio && <AudioInvite src={e.hostAudio} />}

                {e.rsvpClosed && !done && (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#fef3c7", color: "#92400e", textAlign: "center", fontSize: 13, fontWeight: 700 }}>
                    RSVPs for this event have closed.
                  </div>
                )}

                {/* Quick links */}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, border: "1px solid #E5E7EB", color: "#1A1A2E", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                      <FaMapMarkerAlt color={ACCENT} /> Location
                    </a>
                  )}
                  {calendarUrl() && (
                    <a href={calendarUrl()} target="_blank" rel="noreferrer" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, border: "1px solid #E5E7EB", color: "#1A1A2E", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                      <FaCalendarPlus color={ACCENT} /> Add to calendar
                    </a>
                  )}
                </div>

                {done ? (
                  <PostRsvp event={e} token={token} guest={form} done={done} onChange={() => setDone(null)} />
                ) : (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Will you join us?</div>

                    {/* Response choice */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      {RESPONSES.map((r) => {
                        const Icon = r.icon;
                        const active = form.response === r.key;
                        return (
                          <button key={r.key} type="button" onClick={() => set("response", r.key)}
                            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${active ? r.color : "#E5E7EB"}`, background: active ? `${r.color}14` : "transparent", color: active ? r.color : "#374151", fontWeight: 700, fontSize: 12 }}>
                            <Icon size={20} /> {r.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Your name *</label>
                        <input style={inputStyle} value={form.guestName} onChange={(e2) => set("guestName", e2.target.value)} placeholder="Full name" />
                      </div>
                      <div>
                        <label style={labelStyle}>Mobile number *</label>
                        <input style={inputStyle} type="tel" value={form.guestMobile} onChange={(e2) => set("guestMobile", e2.target.value)} placeholder="10-digit mobile" />
                      </div>

                      {form.response !== "DECLINE" && (
                        <>
                          <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>How many coming?{e.maxPerInvitee ? ` (max ${e.maxPerInvitee})` : ""}</label>
                              <input style={inputStyle} type="number" min="1" max={e.maxPerInvitee || undefined} value={form.partySize}
                                onChange={(e2) => {
                                  let n = Math.max(1, Number(e2.target.value) || 1);
                                  if (e.maxPerInvitee) n = Math.min(n, e.maxPerInvitee);
                                  set("partySize", n);
                                }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>Food preference</label>
                              <select style={inputStyle} value={form.foodPref} onChange={(e2) => set("foodPref", e2.target.value)}>
                                {FOOD_PREFS.map((f) => <option key={f || "any"} value={f}>{f ? f.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Any"}</option>)}
                              </select>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>Allergies / dietary notes</label>
                              <input style={inputStyle} value={form.allergies} onChange={(e2) => set("allergies", e2.target.value)} placeholder="e.g. Nut allergy" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>Arrival time</label>
                              <input style={inputStyle} value={form.arrivalTime} onChange={(e2) => set("arrivalTime", e2.target.value)} placeholder="e.g. 7:30 PM" />
                            </div>
                          </div>

                          {e.kidsAllowed && (
                            <div>
                              <label style={labelStyle}>Kids in your group</label>
                              <input style={inputStyle} type="number" min="0" value={form.kidsCount} onChange={(e2) => set("kidsCount", Math.max(0, Number(e2.target.value) || 0))} placeholder="0" />
                            </div>
                          )}

                          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                            <input type="checkbox" checked={form.parkingNeeded} onChange={(e2) => set("parkingNeeded", e2.target.checked)} />
                            I'll need parking for a vehicle
                          </label>

                          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                            <input type="checkbox" checked={form.accommodationNeeded} onChange={(e2) => set("accommodationNeeded", e2.target.checked)} />
                            I'll need accommodation
                          </label>

                          {e.dressCode && (
                            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                              <input type="checkbox" checked={form.dressConfirm} onChange={(e2) => set("dressConfirm", e2.target.checked)} />
                              I'll follow the dress code ({e.dressCode})
                            </label>
                          )}

                          <div>
                            <label style={labelStyle}>Song request (optional)</label>
                            <input style={inputStyle} value={form.songRequest} onChange={(e2) => set("songRequest", e2.target.value)} placeholder="A song you'd love to hear" />
                          </div>
                        </>
                      )}

                      <div>
                        <label style={labelStyle}>Note to host (optional)</label>
                        <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={form.note} onChange={(e2) => set("note", e2.target.value)} placeholder="Anything you'd like the host to know" />
                      </div>

                      <button type="button" onClick={submit} disabled={submitting || e.rsvpClosed}
                        style={{ padding: "13px", borderRadius: 12, border: "none", background: ACCENT, color: "#fff", fontWeight: 800, fontSize: 15, cursor: (submitting || e.rsvpClosed) ? "default" : "pointer", opacity: (submitting || e.rsvpClosed) ? 0.6 : 1 }}>
                        {e.rsvpClosed ? "RSVPs closed" : submitting ? "Sending…" : "Send RSVP"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ textAlign: "center", marginTop: 22, fontSize: 11, color: "#9CA3AF" }}>
              Powered by RYBBO · VasBazaar
            </div>
          </div>
        </div>
      )}
    </DataState>
  );
};

/**
 * Host's voice note on the invite. Tries to auto-play on open; browsers that block
 * autoplay-with-sound show a "tap to play" state. A toggle lets the guest mute/unmute.
 */
const AudioInvite = ({ src }) => {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Attempt to start playback with sound as soon as the clip mounts.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = false;
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => setBlocked(true));
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (blocked) {
      // First gesture after a blocked autoplay → start playing with sound.
      el.muted = false;
      el.play().then(() => { setBlocked(false); setMuted(false); }).catch(() => {});
      return;
    }
    const next = !muted;
    el.muted = next;
    setMuted(next);
    if (!next && el.paused) el.play().catch(() => {});
  };

  const label = blocked ? "Tap to play host's voice"
    : muted ? "Muted — tap to unmute" : "Playing — tap to mute";

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${ACCENT}33`, background: "#f5f3ff" }}>
      <audio ref={audioRef} src={src} autoPlay playsInline preload="auto" />
      <button type="button" onClick={toggle} aria-label={label}
        style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 999, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {muted || blocked ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
      </button>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#4c1d95" }}>🎙️ A voice note from your host</div>
      <div style={{ marginLeft: "auto", fontSize: 11, color: "#6B7280" }}>{label}</div>
    </div>
  );
};

/**
 * Shown after a guest submits their RSVP (or returns from the payment gateway).
 * Handles the optional contribution payment, then the QR entry pass.
 */
const PostRsvp = ({ event, token, guest, done, onChange }) => {
  const needsContribution = done.response === "ACCEPT" && Number(event.contributionAmount) > 0;
  const [paid, setPaid] = useState(done.resumePay === "success");
  const [busy, setBusy] = useState(false);
  const [payMsg, setPayMsg] = useState(
    done.resumePay === "failed" ? "Payment didn't go through. Please try again."
      : done.resumePay === "pending" ? "Payment is being confirmed…" : ""
  );
  const [pass, setPass] = useState(null);
  const [passErr, setPassErr] = useState("");

  // If we came back from the gateway as pending, poll the contribution status.
  useEffect(() => {
    if (done.resumePay !== "pending") return;
    let tries = 0, cancelled = false;
    const poll = async () => {
      // We don't keep the payment code client-side after redirect, so re-derive
      // status by attempting to fetch the pass; a PAID guest gets a pass.
      const r = await rybboSocialService.getPass(token, guest.guestMobile);
      if (cancelled) return;
      if (r.success) { setPaid(true); setPass(r.data); setPayMsg(""); return; }
      if (++tries < 6) setTimeout(poll, 3000);
      else setPayMsg("Still confirming your payment. Refresh in a moment.");
    };
    poll();
    return () => { cancelled = true; };
  }, [done.resumePay, token, guest.guestMobile]);

  const payWallet = async () => {
    setBusy(true); setPayMsg("");
    const accessToken = localStorage.getItem("customerSessionToken") || "";
    const r = await rybboSocialService.contribute(token, { guestMobile: guest.guestMobile, paymentMode: "wallet", accessToken });
    setBusy(false);
    if (r.success && r.data?.status === "CONFIRMED") { setPaid(true); setPayMsg(""); }
    else setPayMsg(r.message || "Wallet payment failed.");
  };

  const payUpi = async () => {
    setBusy(true); setPayMsg("");
    sessionStorage.setItem(PAY_KEY, JSON.stringify({ token, mobile: guest.guestMobile, name: guest.guestName }));
    const r = await rybboSocialService.contribute(token, {
      guestMobile: guest.guestMobile, paymentMode: "upi", returnUrl: buildContributionReturnUrl(),
    });
    if (r.success && r.data?.paymentUrl) { window.location.href = r.data.paymentUrl; return; }
    setBusy(false);
    setPayMsg(r.message || "Could not start payment.");
  };

  const showPass = async () => {
    setBusy(true); setPassErr("");
    const r = await rybboSocialService.getPass(token, guest.guestMobile);
    setBusy(false);
    if (r.success) setPass(r.data);
    else setPassErr(r.message || "Could not load your pass.");
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ padding: 18, borderRadius: 14, background: "#f5f3ff", textAlign: "center" }}>
        <FaCheckCircle size={34} color={ACCENT} />
        <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>{done.message}</div>
        {done.response === "ACCEPT" && <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>We can't wait to see you!</div>}
      </div>

      {/* Contribution */}
      {needsContribution && !paid && (
        <div style={{ marginTop: 16, padding: 16, border: `1px solid ${ACCENT}33`, borderRadius: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Contribution: ₹{event.contributionAmount}</div>
          <div style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 12px" }}>The host requests a contribution for this event.</div>
          {payMsg && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{payMsg}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={payWallet} disabled={busy}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", color: "#1A1A2E", fontWeight: 700, cursor: "pointer" }}>
              <FaWallet color={ACCENT} /> Wallet
            </button>
            <button type="button" onClick={payUpi} disabled={busy}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              <FaMobileAlt /> UPI / Card
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>Wallet requires you to be logged in to VasBazaar.</div>
        </div>
      )}

      {needsContribution && paid && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
          ✓ Contribution of ₹{event.contributionAmount} received. Thank you!
        </div>
      )}

      {/* Entry pass */}
      {done.response === "ACCEPT" && (!needsContribution || paid) && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #E5E7EB", borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FaQrcode color={ACCENT} /> Your entry pass
          </div>
          {pass ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB" }}>
                <QRCodeSVG value={pass.qrToken} size={200} level="H" includeMargin={false} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>{pass.guestName}{pass.partySize > 1 ? ` · ${pass.partySize} people` : ""}</div>
              {pass.checkedIn && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 4 }}>✓ Already checked in</div>}
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Show this QR at the entrance.</div>
            </div>
          ) : (
            <>
              {passErr && <div style={{ fontSize: 12, color: "#ef4444", margin: "8px 0" }}>{passErr}</div>}
              <button type="button" onClick={showPass} disabled={busy}
                style={{ marginTop: 12, padding: "10px 18px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 700, cursor: "pointer" }}>
                {busy ? "Loading…" : "Show my pass"}
              </button>
            </>
          )}
        </div>
      )}

      <button type="button" onClick={onChange}
        style={{ marginTop: 16, width: "100%", padding: "9px 18px", borderRadius: 10, border: "1px solid #E5E7EB", background: "transparent", color: "#374151", fontWeight: 600, cursor: "pointer" }}>
        Change my response
      </button>
    </div>
  );
};

export default GuestRsvpScreen;
