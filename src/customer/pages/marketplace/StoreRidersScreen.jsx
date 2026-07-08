import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaMotorcycle, FaPhoneAlt, FaTrashAlt } from "react-icons/fa";
import { marketplaceLogisticsAiService } from "../../services/marketplaceLogisticsAiService";
import "./marketplace.css";

const MAX_RIDERS = 20;

/**
 * Seller rider management (Logistics v1) — list / add / deactivate the store's
 * delivery riders (max 20 active). Riders are assigned to DELIVERY orders from
 * the Store Orders screen; removal is soft, so past assignments keep their
 * name/mobile snapshots.
 *
 * Route: /customer/app/marketplace/my-store/riders
 */
const StoreRidersScreen = () => {
  const navigate = useNavigate();
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceLogisticsAiService.getMyRiders();
    setLoading(false);
    if (res.success) setRiders(Array.isArray(res.data) ? res.data : []);
    else setError(res.message || "Could not load riders");
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRider = async (e) => {
    e.preventDefault();
    setError("");
    const n = name.trim();
    const m = mobile.trim();
    if (!n) { setError("Enter the rider's name"); return; }
    if (!/^\d{10}$/.test(m)) { setError("Enter a valid 10-digit mobile number"); return; }
    setAdding(true);
    const res = await marketplaceLogisticsAiService.addRider(n, m);
    setAdding(false);
    if (res.success && res.data) {
      setRiders((r) => [res.data, ...r]);
      setName("");
      setMobile("");
    } else {
      setError(res.message || "Could not add the rider");
    }
  };

  const removeRider = async (rider) => {
    if (!window.confirm(`Remove ${rider.name}? They can no longer be assigned to new orders; past orders keep their details.`)) return;
    setRemovingId(rider.id);
    const res = await marketplaceLogisticsAiService.removeRider(rider.id);
    setRemovingId(null);
    if (res.success) setRiders((r) => r.filter((x) => x.id !== rider.id));
    else setError(res.message || "Could not remove the rider");
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Delivery Riders</h1>
      </div>

      <div style={{ padding: "0 14px 24px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", margin: "4px 0 12px" }}>
          Riders you add here can be assigned to delivery orders from Store Orders.
          The customer sees the rider's name and number. {riders.length}/{MAX_RIDERS} active.
        </div>

        {/* Add rider */}
        <form
          onSubmit={addRider}
          style={{ background: "var(--cm-card)", borderRadius: 14, padding: 14, border: "1px solid var(--cm-line)", marginBottom: 14 }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <FaMotorcycle color="#8b5cf6" /> Add a rider
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              className="mkt-input"
              placeholder="Rider name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: "1 1 150px", minWidth: 0 }}
            />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="mkt-input"
              placeholder="10-digit mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              style={{ flex: "1 1 130px", minWidth: 0 }}
            />
            <button
              type="submit"
              disabled={adding || riders.length >= MAX_RIDERS}
              className="mkt-btn mkt-btn--primary"
              style={{ width: "auto", padding: "9px 18px", fontSize: 13, opacity: adding || riders.length >= MAX_RIDERS ? 0.6 : 1 }}
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
          {riders.length >= MAX_RIDERS && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#f59e0b" }}>
              You've reached the {MAX_RIDERS}-rider limit — remove one to add another.
            </div>
          )}
          {error && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>{error}</div>}
        </form>

        {/* Rider list */}
        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : riders.length === 0 ? (
          <div className="mkt-empty">
            <div className="mkt-empty-icon"><FaMotorcycle /></div>
            No riders yet — add your first rider above.
          </div>
        ) : (
          riders.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--cm-card)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--cm-line)", marginBottom: 8 }}
            >
              <div
                style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}
              >
                <FaMotorcycle size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cm-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <FaPhoneAlt size={9} /> {r.mobile}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRider(r)}
                disabled={removingId === r.id}
                aria-label={`Remove ${r.name}`}
                title="Remove rider"
                style={{ background: "none", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, color: "#ef4444", padding: "8px 10px", cursor: "pointer", opacity: removingId === r.id ? 0.6 : 1 }}
              >
                <FaTrashAlt size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StoreRidersScreen;
