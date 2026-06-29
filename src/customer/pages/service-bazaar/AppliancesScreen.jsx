import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { FaArrowLeft, FaPlus, FaTrash, FaShieldAlt } from "react-icons/fa";
import { applianceService } from "../../services/applianceService";
import { walletService } from "../../services/walletService";
import { savePaymentContext, extractPaymentUrl } from "../../services/juspayService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

const APPLIANCE_TYPES = ["AC", "Refrigerator", "Washing Machine", "RO", "TV", "Geyser", "Inverter", "Microwave", "Other"];

const buildReturnUrl = () => {
  if (Capacitor.isNativePlatform()) return "vasbazaar://payment-callback?flow=amc";
  const origin = window.location.origin;
  const match = window.location.pathname.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/service-bazaar/payment-callback`;
};

const openPaymentGateway = async (paymentUrl) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: paymentUrl });
      return;
    } catch (_) { /* fall through */ }
  }
  window.location.href = paymentUrl;
};

const emptyAppliance = { applianceType: "AC", brand: "", model: "", serialNo: "", purchaseDate: "", warrantyExpiry: "", notes: "" };

export default function AppliancesScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tab, setTab] = useState("appliances"); // appliances | plans | amcs
  const [appliances, setAppliances] = useState([]);
  const [plans, setPlans] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // appliance form
  const [buying, setBuying] = useState(null); // plan being purchased
  const [walletBalance, setWalletBalance] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, p, m] = await Promise.all([
      applianceService.getMyAppliances(),
      applianceService.getAmcPlans(),
      applianceService.getMyAmcs({ pageSize: 50 }),
    ]);
    if (a.success) setAppliances(Array.isArray(a.data) ? a.data : []);
    if (p.success) setPlans(Array.isArray(p.data) ? p.data : []);
    if (m.success) setAmcs(m.data?.records || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!buying) return;
    let cancelled = false;
    walletService.getWalletBalance().then((res) => {
      if (!cancelled && res.success) setWalletBalance(Number(res.data?.balance ?? 0));
    });
    return () => { cancelled = true; };
  }, [buying]);

  const saveAppliance = async () => {
    if (!editing.applianceType) { showToast("Choose an appliance type", "error"); return; }
    setBusy(true);
    const res = await applianceService.saveAppliance(editing);
    setBusy(false);
    if (res.success) { showToast("Appliance saved", "success"); setEditing(null); load(); }
    else showToast(res.message || "Could not save", "error");
  };

  const removeAppliance = async (id) => {
    if (!window.confirm("Remove this appliance?")) return;
    const res = await applianceService.deleteAppliance(id);
    if (res.success) { showToast("Removed", "success"); load(); }
    else showToast(res.message || "Could not remove", "error");
  };

  const buyAmc = async (paymentMethod) => {
    if (!buying) return;
    setBusy(true);
    const payload = {
      planId: buying.id,
      applianceId: buying._applianceId || undefined,
      paymentMethod,
      ...(paymentMethod === "ONLINE" ? { returnUrl: buildReturnUrl() } : {}),
    };
    const res = await applianceService.purchaseAmc(payload);
    if (!res.success) { setBusy(false); showToast(res.message || "Could not start AMC", "error"); return; }
    const data = res.data || {};
    setBuying(null);
    setBusy(false);
    if (paymentMethod === "WALLET" || data.paymentStatus === "PAID") {
      showToast("AMC activated", "success");
      setTab("amcs");
      load();
      return;
    }
    const paymentUrl = extractPaymentUrl(res) || data.paymentUrl;
    if (paymentUrl) {
      await savePaymentContext({ flow: "amc", amcId: data.amcId, amcNo: data.amcNo, amount: data.price });
      await openPaymentGateway(paymentUrl);
      return;
    }
    showToast("Couldn't start payment. Please try again.", "error");
  };

  return (
    <div className="sb-page">
      <div className="sb-topbar" style={{ marginBottom: 8 }}>
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">Appliances & AMC</h1>
      </div>

      <div className="sb-chips">
        <button className={`sb-chip ${tab === "appliances" ? "active" : ""}`} onClick={() => setTab("appliances")}>My Appliances</button>
        <button className={`sb-chip ${tab === "plans" ? "active" : ""}`} onClick={() => setTab("plans")}>AMC Plans</button>
        <button className={`sb-chip ${tab === "amcs" ? "active" : ""}`} onClick={() => setTab("amcs")}>My AMCs</button>
      </div>

      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : tab === "appliances" ? (
        <div className="sb-results">
          <button className="sb-btn block" style={{ marginBottom: 10 }} onClick={() => setEditing({ ...emptyAppliance })}>
            <FaPlus style={{ marginRight: 6 }} /> Add appliance
          </button>
          {appliances.length === 0 ? (
            <div className="sb-empty">No appliances yet. Add one to track warranty and buy an AMC.</div>
          ) : appliances.map((a) => (
            <div className="sb-card" key={a.id}>
              <div className="sb-card-body">
                <p className="sb-card-name">{[a.brand, a.applianceType].filter(Boolean).join(" ")}</p>
                <p className="sb-card-meta">{a.model || "—"}{a.serialNo ? ` • SN ${a.serialNo}` : ""}</p>
                {a.warrantyExpiry && <p className="sb-card-meta">Warranty till {a.warrantyExpiry}</p>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <button className="sb-btn sm" onClick={() => setEditing({ ...a, purchaseDate: a.purchaseDate || "", warrantyExpiry: a.warrantyExpiry || "" })}>Edit</button>
                <button className="sb-share" style={{ color: "#ef4444" }} onClick={() => removeAppliance(a.id)} aria-label="Remove"><FaTrash /></button>
              </div>
            </div>
          ))}
        </div>
      ) : tab === "plans" ? (
        <div className="sb-results">
          {plans.length === 0 ? (
            <div className="sb-empty">No AMC plans available right now.</div>
          ) : plans.map((p) => (
            <div className="sb-section" key={p.id} style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p className="sb-card-name"><FaShieldAlt style={{ marginRight: 6, color: "#10b981" }} />{p.name}</p>
                  <p className="sb-card-meta">{p.description}</p>
                  <p className="sb-card-meta">{p.durationMonths} months • {p.visitsIncluded} visits</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="sb-price">₹{Number(p.price || 0).toFixed(0)}</div>
                  <button className="sb-btn sm" style={{ marginTop: 6 }} onClick={() => setBuying({ ...p, _applianceId: appliances[0]?.id })}>Buy</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sb-results">
          {amcs.length === 0 ? (
            <div className="sb-empty">No AMCs yet. Buy a plan to protect your appliances.</div>
          ) : amcs.map((m) => (
            <div className="sb-card" key={m.id}>
              <div className="sb-card-body">
                <p className="sb-card-name">{m.planId?.name || "AMC"}</p>
                <p className="sb-card-meta">#{m.amcNo} • {m.startDate} → {m.endDate}</p>
                <div className="sb-badges">
                  <span className={`sb-status ${m.status === "ACTIVE" ? "COMPLETED" : "PENDING"}`} style={{ fontSize: 10 }}>{m.status}</span>
                  <span className="sb-badge">{m.paymentStatus}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Appliance add/edit modal */}
      {editing && (
        <div className="sb-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{editing.id ? "Edit appliance" : "Add appliance"}</h3>
            <div className="sb-field">
              <label>Type</label>
              <select value={editing.applianceType} onChange={(e) => setEditing({ ...editing, applianceType: e.target.value })}>
                {APPLIANCE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="sb-field"><label>Brand</label><input value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
            <div className="sb-field"><label>Model</label><input value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></div>
            <div className="sb-field"><label>Serial number</label><input value={editing.serialNo} onChange={(e) => setEditing({ ...editing, serialNo: e.target.value })} /></div>
            <div className="sb-field"><label>Purchase date</label><input type="date" value={editing.purchaseDate} onChange={(e) => setEditing({ ...editing, purchaseDate: e.target.value })} /></div>
            <div className="sb-field"><label>Warranty expiry</label><input type="date" value={editing.warrantyExpiry} onChange={(e) => setEditing({ ...editing, warrantyExpiry: e.target.value })} /></div>
            <button className="sb-btn block" disabled={busy} onClick={saveAppliance}>{busy ? "Saving…" : "Save"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* AMC purchase modal */}
      {buying && (
        <div className="sb-modal-backdrop" onClick={() => setBuying(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{buying.name}</h3>
            <p className="sb-price" style={{ marginBottom: 10 }}>₹{Number(buying.price || 0).toFixed(0)}</p>
            {appliances.length > 0 && (
              <div className="sb-field">
                <label>Appliance</label>
                <select value={buying._applianceId || ""} onChange={(e) => setBuying({ ...buying, _applianceId: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Not linked</option>
                  {appliances.map((a) => <option key={a.id} value={a.id}>{[a.brand, a.applianceType].filter(Boolean).join(" ")}</option>)}
                </select>
              </div>
            )}
            <button className="sb-btn block" disabled={busy} onClick={() => buyAmc("ONLINE")}>{busy ? "Please wait…" : `Pay ₹${Number(buying.price || 0).toFixed(0)} online`}</button>
            {(() => {
              const price = Number(buying.price || 0);
              const canWallet = walletBalance != null && walletBalance >= price;
              return (
                <button className="sb-btn ghost block" style={{ marginTop: 8 }} disabled={busy || !canWallet} onClick={() => buyAmc("WALLET")}>
                  {walletBalance == null ? "Checking wallet…" : canWallet ? `Pay from wallet (₹${walletBalance.toFixed(0)})` : `Wallet too low (₹${walletBalance.toFixed(0)})`}
                </button>
              );
            })()}
            <button className="sb-btn ghost block" style={{ marginTop: 8, border: "none" }} onClick={() => setBuying(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
