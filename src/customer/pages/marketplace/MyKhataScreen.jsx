import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStore } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const inr = (n) => `₹${Number(n || 0).toFixed(0)}`;

/** Customer view of their own credit (khata) accounts across stores. */
const MyKhataScreen = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ totalOutstanding: 0, records: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyKhatas();
    setLoading(false);
    if (res.success) setData(res.data || { totalOutstanding: 0, records: [] });
    else setError(res.message || "Failed to load");
  }, []);

  useEffect(() => { load(); }, [load]);

  const records = Array.isArray(data.records) ? data.records : [];

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Khata</h1>
      </div>

      <div style={{ padding: "12px 14px 24px" }}>
        <div style={{ borderRadius: 16, padding: 16, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Total you owe across stores</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{inr(data.totalOutstanding)}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{records.length} store account(s)</div>
        </div>

        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : records.length === 0 ? (
          <div className="mkt-empty">You don't have any store credit accounts.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {records.map((k) => (
              <div
                key={k.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpen(k)}
                onKeyDown={(e) => { if (e.key === "Enter") setOpen(k); }}
                style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--cm-bg-secondary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <FaStore size={15} color="var(--cm-muted)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{k.store?.businessName || "Store"}</div>
                    {k.lastActivityAt && <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>Last: {formatDisplayDateTime(k.lastActivityAt, "")}</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: Number(k.balance) > 0 ? "#ef4444" : "#10b981" }}>{inr(k.balance)}</div>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{Number(k.balance) > 0 ? "you owe" : "settled"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && <StatementModal khataId={open.id} storeName={open.store?.businessName} onClose={() => setOpen(null)} />}
    </div>
  );
};

const StatementModal = ({ khataId, storeName, onClose }) => {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await marketplaceService.getMyKhataStatement(khataId);
      if (alive) { setStatement(res.success ? res.data : null); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [khataId]);

  const khata = statement?.khata;
  const entries = Array.isArray(statement?.entries) ? statement.entries : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
          <button className="mkt-header-back" onClick={onClose}>×</button>
          <h1 className="mkt-header-title">{storeName || "Statement"}</h1>
        </div>
        <div className="mkt-form">
          {loading ? (
            <div className="mkt-empty">Loading…</div>
          ) : (
            <>
              <div style={{ borderRadius: 12, padding: 12, background: "var(--cm-bg-secondary)", border: "1px solid var(--cm-line)", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Outstanding</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: Number(khata?.balance) > 0 ? "#ef4444" : "#10b981" }}>{inr(khata?.balance)}</div>
              </div>
              {entries.length === 0 ? (
                <div className="mkt-empty">No entries yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {entries.map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--cm-line)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: e.type === "DEBIT" ? "#ef4444" : "#10b981" }}>
                          {e.type === "DEBIT" ? "Purchase on credit" : "Payment"}
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
        </div>
      </div>
    </div>
  );
};

export default MyKhataScreen;
