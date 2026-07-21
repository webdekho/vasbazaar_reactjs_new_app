import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBell, FaUserPlus } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const inr = (n) => `₹${Number(n || 0).toFixed(0)}`;

/**
 * Merchant Digital Khata — list of credit customers with outstanding balances,
 * with a per-customer statement, DEBIT/CREDIT entry posting and reminders.
 */
const StoreKhataScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ totalOutstanding: 0, records: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openKhata, setOpenKhata] = useState(null); // statement modal

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyStoreKhatas();
    setLoading(false);
    if (res.success) setData(res.data || { totalOutstanding: 0, records: [] });
    else setError(res.message || "Failed to load khata");
  }, []);

  useEffect(() => { load(); }, [load]);

  const records = Array.isArray(data.records) ? data.records : [];

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Khata / Credit</h1>
      </div>

      <div style={{ padding: "12px 14px 24px" }}>
        {/* Outstanding summary */}
        <div style={{ borderRadius: 16, padding: 16, background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "#fff", marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Total outstanding (you'll receive)</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{inr(data.totalOutstanding)}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{records.length} credit customer(s)</div>
        </div>

        <button className="mkt-btn mkt-btn--primary" onClick={() => setShowAdd(true)} style={{ marginBottom: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <FaUserPlus size={13} /> Add credit customer
          </span>
        </button>

        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : records.length === 0 ? (
          <div className="mkt-empty">No credit customers yet. Add one to start a khata.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {records.map((k) => (
              <div
                key={k.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenKhata(k)}
                onKeyDown={(e) => { if (e.key === "Enter") setOpenKhata(k); }}
                style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{k.customerName || k.customerMobile}</div>
                  <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{k.customerMobile}</div>
                  {k.lastActivityAt && <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>Last: {formatDisplayDateTime(k.lastActivityAt, "")}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: Number(k.balance) > 0 ? "#ef4444" : "#10b981" }}>{inr(k.balance)}</div>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{Number(k.balance) > 0 ? "due" : "settled"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onSaved={(k) => { setShowAdd(false); load(); setOpenKhata(k); }}
        />
      )}
      {openKhata && (
        <KhataStatementModal
          khataId={openKhata.id}
          onClose={() => { setOpenKhata(null); load(); }}
        />
      )}
    </div>
  );
};

const AddCustomerModal = ({ onClose, onSaved }) => {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!/^\d{10}$/.test(mobile)) { setError("Enter a valid 10-digit mobile"); return; }
    setError(null);
    setSaving(true);
    const res = await marketplaceService.createKhata({
      customerMobile: mobile,
      customerName: name.trim() || null,
      creditLimit: creditLimit ? Number(creditLimit) : 0,
    });
    setSaving(false);
    if (res.success) onSaved(res.data);
    else setError(res.message || "Failed to add customer");
  };

  return (
    <ModalShell title="Add credit customer" onClose={onClose}>
      <div className="mkt-field">
        <label className="mkt-field-label">Customer mobile <span className="mkt-req">*</span></label>
        <input className="mkt-input" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} />
      </div>
      <div className="mkt-field">
        <label className="mkt-field-label">Name</label>
        <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="mkt-field">
        <label className="mkt-field-label">Credit limit (₹, 0 = no limit)</label>
        <input className="mkt-input" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      {error && <div className="mkt-error-text">{error}</div>}
      <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? "Saving…" : "Save customer"}
      </button>
    </ModalShell>
  );
};

const KhataStatementModal = ({ khataId, onClose }) => {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("DEBIT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getKhataStatement(khataId);
    setLoading(false);
    if (res.success) setStatement(res.data);
    else setError(res.message || "Failed to load statement");
  }, [khataId]);

  useEffect(() => { load(); }, [load]);

  const postEntry = async () => {
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount"); return; }
    setError(null); setMsg(null);
    setSaving(true);
    const res = await marketplaceService.addKhataEntry(khataId, { type, amount: Number(amount), note: note.trim() || null });
    setSaving(false);
    if (res.success) { setStatement(res.data); setAmount(""); setNote(""); }
    else setError(res.message || "Failed to add entry");
  };

  const remind = async () => {
    setError(null); setMsg(null);
    setReminding(true);
    const res = await marketplaceService.remindKhata(khataId);
    setReminding(false);
    if (res.success) setMsg(res.message || "Reminder sent");
    else setError(res.message || "Could not send reminder");
  };

  const khata = statement?.khata;
  const entries = Array.isArray(statement?.entries) ? statement.entries : [];

  return (
    <ModalShell title={khata?.customerName || "Khata"} onClose={onClose}>
      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : (
        <>
          <div style={{ borderRadius: 12, padding: 12, background: "var(--cm-bg-secondary)", border: "1px solid var(--cm-line)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Outstanding</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: Number(khata?.balance) > 0 ? "#ef4444" : "#10b981" }}>{inr(khata?.balance)}</div>
            </div>
            <button className="mkt-btn mkt-btn--secondary" onClick={remind} disabled={reminding || Number(khata?.balance) <= 0} style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FaBell size={12} /> {reminding ? "Sending…" : "Remind"}
              </span>
            </button>
          </div>

          {/* Add entry */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setType("DEBIT")} className={`mkt-btn ${type === "DEBIT" ? "mkt-btn--primary" : "mkt-btn--secondary"}`} style={{ flex: 1, fontSize: 12 }}>Gave credit (+)</button>
            <button onClick={() => setType("CREDIT")} className={`mkt-btn ${type === "CREDIT" ? "mkt-btn--primary" : "mkt-btn--secondary"}`} style={{ flex: 1, fontSize: 12 }}>Received (−)</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="mkt-input" style={{ flex: 1 }} inputMode="decimal" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <input className="mkt-input" style={{ flex: 2 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <div className="mkt-error-text">{error}</div>}
          {msg && <div style={{ fontSize: 12, color: "#10b981", marginTop: 6 }}>{msg}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={postEntry} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Posting…" : "Post entry"}
          </button>

          {/* Statement */}
          <div className="mkt-form-section-title" style={{ marginTop: 16 }}>Statement</div>
          {entries.length === 0 ? (
            <div className="mkt-empty">No entries yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--cm-line)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: e.type === "DEBIT" ? "#ef4444" : "#10b981" }}>
                      {e.type === "DEBIT" ? "Credit given" : "Payment received"}
                    </div>
                    {e.note && <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{e.note}</div>}
                    <div style={{ fontSize: 10, color: "var(--cm-muted)" }}>{formatDisplayDateTime(e.createdAt, "")}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: e.type === "DEBIT" ? "#ef4444" : "#10b981" }}>
                      {e.type === "DEBIT" ? "+" : "−"}{inr(e.amount)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--cm-muted)" }}>bal {inr(e.balanceAfter)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
};

const ModalShell = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
      <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
        <button className="mkt-header-back" onClick={onClose}>×</button>
        <h1 className="mkt-header-title">{title}</h1>
      </div>
      <div className="mkt-form">{children}</div>
    </div>
  </div>
);

export default StoreKhataScreen;
