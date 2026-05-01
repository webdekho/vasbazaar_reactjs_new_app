import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaRegClock } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import "./marketplace.css";

const DAYS = [
  { key: "MON", label: "Monday" },
  { key: "TUE", label: "Tuesday" },
  { key: "WED", label: "Wednesday" },
  { key: "THU", label: "Thursday" },
  { key: "FRI", label: "Friday" },
  { key: "SAT", label: "Saturday" },
  { key: "SUN", label: "Sunday" },
];

const trim = (t) => (t ? String(t).slice(0, 5) : "");

const buildInitialSchedule = (store) => {
  // Parse stored weeklySchedule JSON if present, otherwise seed all 7 days
  // from the legacy single open/close window so the seller doesn't have to
  // start from scratch.
  let parsed = null;
  if (store?.weeklySchedule) {
    try { parsed = JSON.parse(store.weeklySchedule); } catch (_) { parsed = null; }
  }
  const baseOpen = trim(store?.openTime) || "09:00";
  const baseClose = trim(store?.closeTime) || "21:00";
  return DAYS.map(({ key }) => {
    const found = Array.isArray(parsed) ? parsed.find((p) => String(p.day).toUpperCase() === key) : null;
    if (found) {
      return {
        day: key,
        closed: !!found.closed,
        openTime: trim(found.openTime) || baseOpen,
        closeTime: trim(found.closeTime) || baseClose,
      };
    }
    return { day: key, closed: false, openTime: baseOpen, closeTime: baseClose };
  });
};

const StoreTimingsScreen = () => {
  const navigate = useNavigate();
  const [, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await marketplaceService.getMyStore();
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data?.id) {
        setStore(res.data);
        setAutoSchedule(!!res.data.autoSchedule);
        setSchedule(buildInitialSchedule(res.data));
      } else {
        navigate("/customer/app/marketplace/my-store", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const updateDay = (key, patch) => {
    setSchedule((prev) => prev.map((d) => (d.day === key ? { ...d, ...patch } : d)));
  };

  const copyToAll = (sourceKey) => {
    const source = schedule.find((d) => d.day === sourceKey);
    if (!source) return;
    setSchedule((prev) => prev.map((d) => ({
      ...d,
      closed: source.closed,
      openTime: source.openTime,
      closeTime: source.closeTime,
    })));
  };

  const todayKey = useMemo(() => {
    // ISO weekday: 1 (Mon) … 7 (Sun)
    const idx = ((new Date().getDay() + 6) % 7); // map JS Sun=0 to index 6
    return DAYS[idx].key;
  }, []);

  const todayClosed = useMemo(() => {
    const today = schedule.find((d) => d.day === todayKey);
    if (!autoSchedule || !today) return false;
    if (today.closed) return true;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = today.openTime.split(":").map(Number);
    const [ch, cm] = today.closeTime.split(":").map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    return close > open ? !(cur >= open && cur < close) : !(cur >= open || cur < close);
  }, [autoSchedule, schedule, todayKey]);

  const save = async () => {
    setMsg(null);
    if (autoSchedule) {
      // Validate all open days have valid windows
      for (const d of schedule) {
        if (d.closed) continue;
        if (!d.openTime || !d.closeTime) {
          setMsg({ type: "error", text: `Set open/close time for ${d.day} or mark it as Closed` });
          return;
        }
        if (d.openTime === d.closeTime) {
          setMsg({ type: "error", text: `Open and close time can't be the same on ${d.day}` });
          return;
        }
      }
    }
    setSaving(true);
    const res = await marketplaceService.updateMyStoreTimings({
      autoSchedule,
      weeklySchedule: JSON.stringify(schedule),
      // Keep legacy single-window in sync with Monday so older clients still work
      openTime: schedule.find((d) => d.day === "MON" && !d.closed)?.openTime || null,
      closeTime: schedule.find((d) => d.day === "MON" && !d.closed)?.closeTime || null,
    });
    setSaving(false);
    if (res.success) {
      setMsg({ type: "success", text: "Timings saved" });
    } else {
      setMsg({ type: "error", text: res.message || "Failed to save" });
    }
  };

  if (loading) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Store Timings</h1>
        </div>
        <div className="mkt-empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Store Timings</h1>
      </div>

      <div style={{ padding: "12px 14px 100px" }}>
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid var(--cm-line)",
            background: "var(--cm-card)",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FaRegClock size={14} color="#14b8a6" />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>Auto open / close</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 12 }}>
            We use these timings to auto-open and auto-close the store. Off-hours and holidays show "Closed" to customers.
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
            />
            <span style={{ fontSize: 13, color: "var(--cm-ink)" }}>Enable auto-schedule</span>
          </label>

          {autoSchedule && todayClosed && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.1)",
                color: "#dc2626",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Store is currently closed (off-hours / holiday).
            </div>
          )}
        </div>

        {schedule.map((d) => {
          const meta = DAYS.find((m) => m.key === d.key) || { label: d.day };
          const isToday = d.day === todayKey;
          return (
            <div
              key={d.day}
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${isToday ? "#14b8a6" : "var(--cm-line)"}`,
                background: "var(--cm-card)",
                marginBottom: 10,
                opacity: autoSchedule ? 1 : 0.55,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{meta.label}</div>
                  {isToday && (
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                        background: "rgba(20,184,166,0.12)", color: "#14b8a6",
                      }}
                    >
                      TODAY
                    </span>
                  )}
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--cm-muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={d.closed}
                    onChange={(e) => updateDay(d.day, { closed: e.target.checked })}
                    disabled={!autoSchedule}
                  />
                  Holiday / Closed
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>Opens</div>
                  <input
                    type="time"
                    className="mkt-input"
                    value={d.openTime}
                    onChange={(e) => updateDay(d.day, { openTime: e.target.value })}
                    disabled={!autoSchedule || d.closed}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>Closes</div>
                  <input
                    type="time"
                    className="mkt-input"
                    value={d.closeTime}
                    onChange={(e) => updateDay(d.day, { closeTime: e.target.value })}
                    disabled={!autoSchedule || d.closed}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => copyToAll(d.day)}
                  disabled={!autoSchedule}
                  style={{
                    padding: "8px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: "var(--cm-bg-secondary)", color: "var(--cm-ink)",
                    border: "1px solid var(--cm-line)", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                  title="Copy this day's times to all 7 days"
                >
                  Copy to all
                </button>
              </div>
            </div>
          );
        })}

        {msg && (
          <div
            style={{
              marginTop: 4, marginBottom: 8,
              fontSize: 12, fontWeight: 600,
              color: msg.type === "success" ? "#059669" : "#dc2626",
            }}
          >
            {msg.text}
          </div>
        )}
      </div>

      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
          background: "var(--cm-bg)", borderTop: "1px solid var(--cm-line)",
          zIndex: 30,
        }}
      >
        <button
          className="mkt-btn mkt-btn--primary"
          onClick={save}
          disabled={saving}
          style={{ width: "100%" }}
        >
          {saving ? "Saving…" : "Save Timings"}
        </button>
      </div>
    </div>
  );
};

export default StoreTimingsScreen;
