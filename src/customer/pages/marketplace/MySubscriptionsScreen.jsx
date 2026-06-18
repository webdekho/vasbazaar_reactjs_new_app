import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaClock, FaPause, FaPlay, FaTrash, FaStore, FaSyncAlt, FaCalendarAlt, FaPen } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import "./marketplace.css";

const PAY_LABEL = { WALLET: "Wallet", COD: "Cash on Delivery", AUTOPAY: "Autopay (HDFC)" };
const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const today = () => new Date().toISOString().slice(0, 10);

const cadenceText = (s) => {
  if (s.frequency === "WEEKLY") {
    const days = String(s.daysOfWeek || "")
      .split(",")
      .filter(Boolean)
      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      .map((d) => d[0] + d.slice(1).toLowerCase())
      .join(", ");
    return `Weekly · ${days || "—"}`;
  }
  if (s.frequency === "MONTHLY") return `Monthly · day ${s.dayOfMonth || "—"}`;
  if (s.frequency === "INTERVAL") return `Every ${s.intervalDays || "—"} days`;
  return "Every day";
};

const timeText = (t) => (t ? String(t).slice(0, 5) : "--:--");
const dateText = (d) => (d ? String(d).slice(0, 10) : null);

const MySubscriptionsScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Reschedule modal state
  const [rSub, setRSub] = useState(null);
  const [rDate, setRDate] = useState("");
  const [rTime, setRTime] = useState("09:00");

  // Modify modal state
  const [eSub, setESub] = useState(null);
  const [eFreq, setEFreq] = useState("DAILY");
  const [eDays, setEDays] = useState([]);
  const [eInterval, setEInterval] = useState(15);
  const [eTime, setETime] = useState("09:00");
  const [ePay, setEPay] = useState("WALLET");
  const [eEnd, setEEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMySubscriptions();
    setLoading(false);
    if (res.success) setSubs(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (sub) => {
    setBusyId(sub.id);
    const next = !sub.active;
    const res = await marketplaceService.toggleSubscription(sub.id, next);
    setBusyId(null);
    if (res.success) {
      showToast(next ? "Subscription resumed" : "Subscription paused", next ? "success" : "info");
      load();
    } else {
      showToast(res.message || "Could not update", "error");
    }
  };

  const cancel = async (sub) => {
    if (!window.confirm("Cancel this subscription? Future auto-orders will stop.")) return;
    setBusyId(sub.id);
    const res = await marketplaceService.cancelSubscription(sub.id);
    setBusyId(null);
    if (res.success) {
      showToast("Subscription cancelled", "info");
      setSubs((p) => p.filter((s) => s.id !== sub.id));
    } else {
      showToast(res.message || "Could not cancel", "error");
    }
  };

  // ----- Reschedule -----
  const openReschedule = (sub) => {
    setRSub(sub);
    setRDate(dateText(sub.nextRunAt) || today());
    setRTime(timeText(sub.deliveryTime) || "09:00");
  };
  const submitReschedule = async () => {
    if (!rDate) { showToast("Pick a date", "error"); return; }
    setSaving(true);
    const res = await marketplaceService.rescheduleSubscription(rSub.id, { date: rDate, time: rTime });
    setSaving(false);
    if (res.success) {
      showToast("Next delivery rescheduled", "success");
      setRSub(null);
      load();
    } else {
      showToast(res.message || "Could not reschedule", "error");
    }
  };

  // ----- Modify -----
  const openModify = (sub) => {
    setESub(sub);
    setEFreq(sub.frequency || "DAILY");
    setEDays(String(sub.daysOfWeek || "").split(",").filter(Boolean));
    setEInterval(sub.intervalDays || 15);
    setETime(timeText(sub.deliveryTime) || "09:00");
    setEPay(sub.paymentMethod || "WALLET");
    setEEnd(dateText(sub.endDate) || "");
  };
  const toggleEDay = (d) =>
    setEDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const submitModify = async () => {
    if (eFreq === "WEEKLY" && eDays.length === 0) { showToast("Pick at least one weekday", "error"); return; }
    if (eFreq === "INTERVAL" && (!Number(eInterval) || Number(eInterval) < 1)) { showToast("Enter a valid gap in days", "error"); return; }
    setSaving(true);
    const payload = {
      frequency: eFreq,
      deliveryTime: eTime,
      paymentMethod: ePay,
      endDate: eEnd || "",
      ...(eFreq === "WEEKLY" ? { daysOfWeek: eDays } : {}),
      ...(eFreq === "INTERVAL" ? { intervalDays: Number(eInterval) } : {}),
    };
    const res = await marketplaceService.updateSubscription(eSub.id, payload);
    setSaving(false);
    if (res.success) {
      showToast("Subscription updated", "success");
      setESub(null);
      load();
    } else {
      showToast(res.message || "Could not update", "error");
    }
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Subscriptions</h1>
      </div>

      <div style={{ padding: "8px 14px 90px" }}>
        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="mkt-empty-v2" style={{ marginTop: 12 }}>
            <div className="mkt-empty-icon-v2"><FaSyncAlt /></div>
            <div className="mkt-empty-title">No subscriptions yet</div>
            <div className="mkt-empty-sub">Add items to cart and choose “Subscribe” at checkout to set up recurring delivery.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {subs.map((s) => {
              const paused = !s.active;
              return (
                <div key={s.id} style={{
                  border: "1px solid var(--cm-line)", borderRadius: 16, padding: 14, background: "var(--cm-card)",
                  opacity: paused ? 0.7 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <FaStore size={13} color="var(--cm-muted)" />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: "var(--cm-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.storeId?.businessName || "Store"}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                      background: paused ? "rgba(245,158,11,0.16)" : "rgba(16,185,129,0.16)",
                      color: paused ? "#f59e0b" : "#10b981",
                    }}>
                      {paused ? "Paused" : "Active"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--cm-ink)", marginBottom: 4 }}>
                    <FaClock size={11} color="#007BFF" /> {cadenceText(s)} at {timeText(s.deliveryTime)}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--cm-muted)", marginBottom: 2 }}>
                    Pay via {PAY_LABEL[s.paymentMethod] || s.paymentMethod} · {s.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}
                  </div>
                  {s.nextRunAt && !paused && (
                    <div style={{ fontSize: 11.5, color: "var(--cm-muted)" }}>
                      Next order: {String(s.nextRunAt).replace("T", " ").slice(0, 16)}
                    </div>
                  )}
                  {dateText(s.endDate) && (
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>Ends {dateText(s.endDate)}</div>
                  )}
                  {s.lastError && (
                    <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Last run: {s.lastError}</div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => openReschedule(s)} disabled={busyId === s.id}
                      className="mkt-btn mkt-btn--secondary" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5 }}>
                      <FaCalendarAlt size={11} style={{ marginRight: 6 }} /> Reschedule
                    </button>
                    <button type="button" onClick={() => openModify(s)} disabled={busyId === s.id}
                      className="mkt-btn mkt-btn--secondary" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5 }}>
                      <FaPen size={11} style={{ marginRight: 6 }} /> Modify
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => toggle(s)} disabled={busyId === s.id}
                      className="mkt-btn mkt-btn--secondary" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5 }}>
                      {paused ? <><FaPlay size={11} style={{ marginRight: 6 }} /> Resume</> : <><FaPause size={11} style={{ marginRight: 6 }} /> Pause</>}
                    </button>
                    <button type="button" onClick={() => cancel(s)} disabled={busyId === s.id}
                      className="mkt-btn mkt-btn--secondary" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5, color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }}>
                      <FaTrash size={11} style={{ marginRight: 6 }} /> Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Reschedule modal ===== */}
      {rSub && (
        <div className="mkt-modal-backdrop" onClick={() => !saving && setRSub(null)}>
          <div className="mkt-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mkt-modal-title">Reschedule next delivery</div>
            <div style={{ fontSize: 11.5, color: "var(--cm-muted)", marginBottom: 12 }}>
              Moves only the next auto-order. Your regular schedule continues afterwards.
            </div>
            <div className="mkt-field" style={{ margin: "0 0 10px" }}>
              <label className="mkt-field-label">Date</label>
              <input type="date" className="mkt-input" value={rDate} min={today()} onChange={(e) => setRDate(e.target.value)} />
            </div>
            <div className="mkt-field" style={{ margin: "0 0 14px" }}>
              <label className="mkt-field-label">Time</label>
              <input type="time" className="mkt-input" value={rTime} onChange={(e) => setRTime(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="mkt-btn mkt-btn--secondary" style={{ flex: 1 }} disabled={saving} onClick={() => setRSub(null)}>Cancel</button>
              <button type="button" className="mkt-btn" style={{ flex: 1 }} disabled={saving} onClick={submitReschedule}>{saving ? "Saving…" : "Reschedule"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modify modal ===== */}
      {eSub && (
        <div className="mkt-modal-backdrop" onClick={() => !saving && setESub(null)}>
          <div className="mkt-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mkt-modal-title">Modify subscription</div>

            <label className="mkt-field-label" style={{ display: "block", marginBottom: 6 }}>Frequency</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
              {[{ k: "DAILY", l: "Daily" }, { k: "WEEKLY", l: "Weekly" }, { k: "MONTHLY", l: "Monthly" }, { k: "INTERVAL", l: "Custom" }].map((f) => {
                const on = eFreq === f.k;
                return (
                  <button key={f.k} type="button" onClick={() => setEFreq(f.k)}
                    style={{
                      padding: "8px 4px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: on ? "1px solid #007BFF" : "1px solid var(--cm-line)",
                      background: on ? "rgba(0,123,255,0.1)" : "transparent",
                      color: on ? "#007BFF" : "var(--cm-ink)",
                    }}>
                    {f.l}
                  </button>
                );
              })}
            </div>

            {eFreq === "WEEKLY" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {DAY_ORDER.map((d) => {
                  const on = eDays.includes(d);
                  return (
                    <button key={d} type="button" onClick={() => toggleEDay(d)}
                      style={{
                        width: 38, height: 34, borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        border: on ? "1px solid transparent" : "1px solid var(--cm-line)",
                        background: on ? "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)" : "transparent",
                        color: on ? "#fff" : "var(--cm-muted)",
                      }}>
                      {d[0] + d[1].toLowerCase()}
                    </button>
                  );
                })}
              </div>
            )}

            {eFreq === "INTERVAL" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>Repeat every</span>
                <input type="number" min={1} max={365} inputMode="numeric" className="mkt-input"
                  style={{ width: 72, textAlign: "center", height: 40, padding: "0 8px" }}
                  value={eInterval} onChange={(e) => setEInterval(e.target.value.replace(/[^0-9]/g, ""))} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>days</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                <label className="mkt-field-label">Time</label>
                <input type="time" className="mkt-input" value={eTime} onChange={(e) => setETime(e.target.value)} />
              </div>
              <div className="mkt-field" style={{ flex: 1, margin: 0 }}>
                <label className="mkt-field-label">End (optional)</label>
                <input type="date" className="mkt-input" value={eEnd} min={today()} onChange={(e) => setEEnd(e.target.value)} />
              </div>
            </div>

            <label className="mkt-field-label" style={{ display: "block", marginBottom: 6 }}>Auto-pay using</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[{ k: "WALLET", l: "Wallet" }, { k: "COD", l: "Cash" }, { k: "AUTOPAY", l: "Autopay" }].map((p) => {
                const on = ePay === p.k;
                return (
                  <button key={p.k} type="button" onClick={() => setEPay(p.k)}
                    style={{
                      flex: 1, padding: "8px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: on ? "1px solid #007BFF" : "1px solid var(--cm-line)",
                      background: on ? "rgba(0,123,255,0.1)" : "transparent",
                      color: on ? "#007BFF" : "var(--cm-ink)",
                    }}>
                    {p.l}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="mkt-btn mkt-btn--secondary" style={{ flex: 1 }} disabled={saving} onClick={() => setESub(null)}>Cancel</button>
              <button type="button" className="mkt-btn" style={{ flex: 1 }} disabled={saving} onClick={submitModify}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySubscriptionsScreen;
