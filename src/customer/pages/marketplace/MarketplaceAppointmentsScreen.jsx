import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarCheck, FaCheck, FaTimes, FaStore, FaClock, FaUser } from "react-icons/fa";
import { marketplaceWave4Service } from "../../services/marketplaceWave4Service";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const PURPOSES = [
  { key: "JEWELLERY_VISIT", label: "Jewellery visit" },
  { key: "TECHNICIAN", label: "Technician" },
  { key: "VET", label: "Vet" },
  { key: "INSTALLATION", label: "Installation" },
  { key: "LOCKER_PICKUP", label: "Locker pickup" },
  { key: "TRIAL", label: "Trial" },
];
const STATUS_COLOR = {
  REQUESTED: "#f59e0b",
  CONFIRMED: "#10b981",
  DONE: "#6366f1",
  CANCELLED: "#ef4444",
};
const purposeLabel = (p) => (PURPOSES.find((x) => x.key === p) || {}).label || p;
const pad2 = (n) => String(n).padStart(2, "0");
const defaultSlot = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T11:00`;
};

const StatusPill = ({ status }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[status] || "#888", background: `${STATUS_COLOR[status] || "#888"}1f`, borderRadius: 999, padding: "3px 10px" }}>
    {status}
  </span>
);

const MarketplaceAppointmentsScreen = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showToast } = useToast();

  const prefStoreId = params.get("storeId");
  const prefItemId = params.get("itemId");
  const prefPurpose = params.get("purpose");
  const openBook = params.get("book") === "1";

  const [tab, setTab] = useState("mine"); // mine | seller
  const [hasStore, setHasStore] = useState(false);

  const [mine, setMine] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // book form
  const [open, setOpen] = useState(openBook);
  const [purpose, setPurpose] = useState(prefPurpose || "JEWELLERY_VISIT");
  const [slotAt, setSlotAt] = useState(defaultSlot());
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMine = useCallback(async () => {
    const res = await marketplaceWave4Service.getMyAppointments();
    if (res.success) setMine(Array.isArray(res.data) ? res.data : (res.data?.records || []));
  }, []);

  const loadInbox = useCallback(async () => {
    const res = await marketplaceWave4Service.getSellerAppointments();
    if (res.success) setInbox(Array.isArray(res.data) ? res.data : (res.data?.records || []));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const storeRes = await marketplaceService.getMyStore();
      const owns = storeRes.success && storeRes.data && storeRes.data.id;
      setHasStore(!!owns);
      await loadMine();
      if (owns) await loadInbox();
      setLoading(false);
    })();
  }, [loadMine, loadInbox]);

  const submit = async () => {
    if (!prefStoreId) { showToast("Open a store to book an appointment", "error"); return; }
    if (!slotAt) { showToast("Pick a slot", "error"); return; }
    setSaving(true);
    const payload = {
      storeId: Number(prefStoreId),
      ...(prefItemId ? { itemId: Number(prefItemId) } : {}),
      purpose,
      slotAt,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(contact.trim() ? { contactMobile: contact.trim() } : {}),
    };
    const res = await marketplaceWave4Service.bookAppointment(payload);
    setSaving(false);
    if (res.success) {
      showToast("Appointment requested", "success");
      setOpen(false);
      loadMine();
    } else {
      showToast(res.message || "Could not book", "error");
    }
  };

  const act = async (appt, action) => {
    setBusyId(appt.id);
    let res;
    if (action === "confirm") res = await marketplaceWave4Service.confirmAppointment(appt.id);
    else if (action === "done") res = await marketplaceWave4Service.completeAppointment(appt.id);
    else res = await marketplaceWave4Service.cancelAppointment(appt.id);
    setBusyId(null);
    if (res.success) { showToast("Updated", "success"); loadInbox(); }
    else showToast(res.message || "Could not update", "error");
  };

  const list = tab === "mine" ? mine : inbox;

  const Card = ({ a, seller }) => (
    <div style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--cm-ink)" }}>{purposeLabel(a.purpose)}</div>
        <StatusPill status={a.status} />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--cm-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <FaClock size={11} /> {formatDisplayDateTime(a.slotAt, "—")}
      </div>
      {(a.storeName || a.itemName) && (
        <div style={{ fontSize: 12.5, color: "var(--cm-muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
          {seller ? <FaUser size={11} /> : <FaStore size={11} />}
          {seller ? (a.customerName || a.contactMobile || "Customer") : (a.storeName || `Store #${a.storeId}`)}
          {a.itemName ? ` · ${a.itemName}` : ""}
        </div>
      )}
      {a.note && <div style={{ fontSize: 12, color: "var(--cm-ink)", marginTop: 6, whiteSpace: "pre-wrap" }}>{a.note}</div>}
      {a.cancelReason && <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>Reason: {a.cancelReason}</div>}
      {seller && (a.status === "REQUESTED" || a.status === "CONFIRMED") && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {a.status === "REQUESTED" && (
            <button className="mkt-btn mkt-btn--primary" disabled={busyId === a.id} style={{ flex: 1 }} onClick={() => act(a, "confirm")}>
              <FaCheck size={11} /> Confirm
            </button>
          )}
          {a.status === "CONFIRMED" && (
            <button className="mkt-btn mkt-btn--primary" disabled={busyId === a.id} style={{ flex: 1 }} onClick={() => act(a, "done")}>
              <FaCheck size={11} /> Mark done
            </button>
          )}
          <button className="mkt-btn mkt-btn--secondary" disabled={busyId === a.id} style={{ flex: 1 }} onClick={() => act(a, "cancel")}>
            <FaTimes size={11} /> Cancel
          </button>
        </div>
      )}
    </div>
  );

  const tabs = useMemo(() => hasStore ? ["mine", "seller"] : ["mine"], [hasStore]);

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Appointments</h1>
        {prefStoreId && (
          <button className="mkt-header-back" onClick={() => setOpen(true)} aria-label="Book"><FaCalendarCheck /></button>
        )}
      </div>

      <div style={{ padding: "12px 14px 32px" }}>
        {tabs.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button className={`mkt-vopt${tab === "mine" ? " mkt-vopt--active" : ""}`} onClick={() => setTab("mine")}>My bookings</button>
            <button className={`mkt-vopt${tab === "seller" ? " mkt-vopt--active" : ""}`} onClick={() => setTab("seller")}>Store inbox</button>
          </div>
        )}

        {prefStoreId && tab === "mine" && (
          <button className="mkt-btn mkt-btn--primary" style={{ width: "100%", marginBottom: 14 }} onClick={() => setOpen(true)}>
            <FaCalendarCheck size={12} /> Book new appointment
          </button>
        )}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : list.length === 0 ? (
          <div className="mkt-empty" style={{ display: "grid", placeItems: "center", gap: 8, padding: "32px 12px" }}>
            <FaCalendarCheck size={30} style={{ opacity: 0.4 }} />
            <div>{tab === "mine" ? "No appointments yet." : "No appointment requests."}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((a) => <Card key={a.id} a={a} seller={tab === "seller"} />)}
          </div>
        )}
      </div>

      {open && (
        <div className="mkt-vsheet-overlay" onClick={() => setOpen(false)}>
          <div className="mkt-vsheet" onClick={(e) => e.stopPropagation()}>
            <div className="mkt-vsheet-head">
              <div style={{ flex: 1 }}><div className="mkt-vsheet-title">Book appointment</div></div>
              <button className="mkt-header-back" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            {!prefStoreId ? (
              <div className="mkt-empty">Open a store product to book an appointment.</div>
            ) : (
              <>
                <div className="mkt-isheet-sec">
                  <div className="mkt-isheet-sec-title">Purpose</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {PURPOSES.map((p) => (
                      <button key={p.key} type="button" className={`mkt-vopt${purpose === p.key ? " mkt-vopt--active" : ""}`} onClick={() => setPurpose(p.key)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mkt-isheet-sec">
                  <div className="mkt-isheet-sec-title">Preferred slot</div>
                  <input className="mkt-input" type="datetime-local" value={slotAt} onChange={(e) => setSlotAt(e.target.value)} />
                </div>
                <div className="mkt-isheet-sec">
                  <div className="mkt-isheet-sec-title">Contact mobile (optional)</div>
                  <input className="mkt-input" type="tel" maxLength={15} placeholder="Mobile for the store to reach you" value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
                <div className="mkt-isheet-sec">
                  <div className="mkt-isheet-sec-title">Note (optional)</div>
                  <textarea className="mkt-textarea" maxLength={200} placeholder="Anything the store should know" value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 56 }} />
                </div>
                <button className="mkt-btn mkt-btn--primary" disabled={saving} style={{ width: "100%", marginTop: 8 }} onClick={submit}>
                  {saving ? "Booking…" : "Request appointment"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceAppointmentsScreen;
