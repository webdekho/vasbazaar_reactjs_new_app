import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheck, FaForward } from "react-icons/fa";
import { queueService } from "../../services/queueService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

/** Provider-side live queue console: open/close, call next, serve/skip tokens. */
export default function QueueManageScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avgMinutes, setAvgMinutes] = useState(10);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [useSlots, setUseSlots] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [slotCapacity, setSlotCapacity] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await queueService.getMyQueue();
    if (res.success) {
      setQueue(res.data);
      if (res.data?.avgServiceMinutes) setAvgMinutes(res.data.avgServiceMinutes);
      if (res.data?.opensAt) setOpensAt(String(res.data.opensAt).slice(0, 5));
      if (res.data?.closesAt) setClosesAt(String(res.data.closesAt).slice(0, 5));
      if (res.data?.slotMinutes) { setUseSlots(true); setSlotMinutes(res.data.slotMinutes); }
      if (res.data?.slotCapacity) setSlotCapacity(res.data.slotCapacity);
    } else showToast(res.message || "Could not load queue", "error");
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.success) { if (okMsg) showToast(okMsg, "success"); load(); }
    else showToast(res.message || "Action failed", "error");
  };

  // Opening + closing time are mandatory; slots (if enabled) must fit the window.
  const openOrSave = (okMsg) => {
    if (!opensAt || !closesAt) { showToast("Opening and closing time are required", "error"); return; }
    if (closesAt <= opensAt) { showToast("Closing time must be after opening time", "error"); return; }
    if (useSlots && (!slotMinutes || Number(slotMinutes) <= 0)) { showToast("Enter a valid slot length", "error"); return; }
    run(() => queueService.openQueue({
      avgMinutes: Number(avgMinutes) || undefined,
      opensAt,
      closesAt,
      slotMinutes: useSlots ? Number(slotMinutes) : undefined,
      slotCapacity: useSlots ? (Number(slotCapacity) || 1) : undefined,
    }), okMsg);
  };

  const open = queue?.exists && queue.status === "OPEN";
  const tokens = queue?.tokens || [];

  return (
    <div className="sb-page">
      <div className="sb-topbar" style={{ marginBottom: 8 }}>
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">Live Queue</h1>
      </div>

      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : (
        <>
          <div className="sb-section" style={{ marginTop: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p className="sb-card-name">Status: {queue?.exists ? queue.status : "Not started"}</p>
                <p className="sb-card-meta">Now serving #{queue?.nowServing ?? 0} • {queue?.waiting ?? 0} waiting</p>
              </div>
              <span className={`sb-status ${open ? "COMPLETED" : "PENDING"}`} style={{ fontSize: 10 }}>{open ? "OPEN" : "CLOSED"}</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div className="sb-field" style={{ flex: 1, marginBottom: 0 }}>
                <label>Opens at *</label>
                <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
              </div>
              <div className="sb-field" style={{ flex: 1, marginBottom: 0 }}>
                <label>Closes at *</label>
                <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 10 }}>
              <label>Avg minutes per customer</label>
              <input type="number" min={1} value={avgMinutes} onChange={(e) => setAvgMinutes(e.target.value)} />
            </div>

            <label className="sb-slot-toggle" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={useSlots} onChange={(e) => setUseSlots(e.target.checked)} />
              <span>Offer bookable appointment slots</span>
            </label>
            {useSlots && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <div className="sb-field" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Slot length (min)</label>
                  <input type="number" min={5} step={5} value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} />
                </div>
                <div className="sb-field" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Capacity per slot</label>
                  <input type="number" min={1} value={slotCapacity} onChange={(e) => setSlotCapacity(e.target.value)} />
                </div>
              </div>
            )}

            <div className="sb-cta-row" style={{ marginTop: 12 }}>
              {open ? (
                <>
                  <button className="sb-btn" disabled={busy} onClick={() => run(queueService.callNext, "Called next")}>Call next</button>
                  <button className="sb-btn ghost" disabled={busy} onClick={() => openOrSave("Updated")}>Save</button>
                  <button className="sb-btn danger" disabled={busy} onClick={() => run(queueService.closeQueue, "Queue closed")}>Close queue</button>
                </>
              ) : (
                <button className="sb-btn block" disabled={busy} onClick={() => openOrSave("Queue opened")}>Open today's queue</button>
              )}
            </div>
          </div>

          <div className="sb-results">
            {tokens.length === 0 ? (
              <div className="sb-empty">No tokens yet.</div>
            ) : tokens.map((t) => (
              <div className="sb-card" key={t.id}>
                <div className="sb-avatar">#{t.tokenNumber}</div>
                <div className="sb-card-body">
                  <p className="sb-card-name">{t.customerUserId?.name || "Customer"}</p>
                  <p className="sb-card-meta">{t.status}{t.slotTime ? ` • ${String(t.slotTime).slice(0, 5)}` : ""}{t.note ? ` • ${t.note}` : ""}</p>
                </div>
                {(t.status === "WAITING" || t.status === "SERVING") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button className="sb-btn sm" disabled={busy} onClick={() => run(() => queueService.updateToken(t.id, "DONE"), "Done")}><FaCheck /></button>
                    <button className="sb-btn ghost sm" disabled={busy} onClick={() => run(() => queueService.updateToken(t.id, "SKIPPED"), "Skipped")}><FaForward /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
