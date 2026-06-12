import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaWhatsapp, FaCopy, FaEdit, FaBan, FaDownload, FaBell, FaUserPlus, FaQrcode } from "react-icons/fa";
import { rybboSocialService, buildInviteUrl, buildWhatsappShare } from "../../../services/rybboSocialService";
import DataState from "../../../components/DataState";
import { useToast } from "../../../context/ToastContext";

const ACCENT = "#7C3AED";

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
        <div style={{ width: "100%", padding: "0 0 28px" }}>
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
              {/* Invite an app user directly by mobile */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input value={inviteMobile} onChange={(ev) => setInviteMobile(ev.target.value)} type="tel" placeholder="Invite by mobile (VasBazaar user)"
                  style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "var(--cm-card, #fff)", color: "var(--cm-ink, inherit)", fontSize: 13, outline: "none" }} />
                <button type="button" onClick={sendInvite} disabled={inviting}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <FaUserPlus /> {inviting ? "…" : "Invite"}
                </button>
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
        </div>
      )}
    </DataState>
  );
};

export default EventDashboardScreen;
