import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaTrash, FaPlus } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";

const EventScannersScreen = () => {
  const { id } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();

  const [state, setState] = useState({ loading: true, error: "", scanners: [] });
  const [mobile, setMobile] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const load = async () => {
    setState((p) => ({ ...p, loading: true, error: "" }));
    const r = await rybboService.getEventScanners(eventId);
    setState({
      loading: false,
      error: r.success ? "" : (r.message || "Could not load scanners"),
      scanners: r.success ? (r.data || []) : [],
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const addScanner = async () => {
    setAddError("");
    const m = mobile.trim();
    if (!/^[0-9]{10}$/.test(m)) {
      setAddError("Enter a valid 10-digit mobile number");
      return;
    }
    setAdding(true);
    const r = await rybboService.addEventScanner(eventId, m);
    setAdding(false);
    if (!r.success) {
      setAddError(r.message || "Could not add scanner");
      return;
    }
    setMobile("");
    load();
  };

  const removeScanner = async (scannerId, name) => {
    if (!window.confirm(`Remove ${name || "this scanner"}?`)) return;
    const r = await rybboService.removeEventScanner(eventId, scannerId);
    if (!r.success) {
      alert(r.message || "Could not remove scanner");
      return;
    }
    load();
  };

  return (
    <div style={{ paddingBottom: 24, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
          <FaArrowLeft />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Manage scanners</div>
      </div>

      <div style={{ padding: "16px 14px" }}>
        <p style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", margin: "0 0 12px" }}>
          Add helpers who can scan attendee tickets at the venue. They must be VasBazaar users — add them by their registered mobile number.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            type="tel" inputMode="numeric" maxLength={10}
            value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
            placeholder="10-digit mobile"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontSize: 14 }}
          />
          <button type="button" onClick={addScanner} disabled={adding}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: adding ? "wait" : "pointer", opacity: adding ? 0.7 : 1 }}>
            <FaPlus /> {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {addError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{addError}</div>}

        <div style={{ marginTop: 16 }}>
          {state.loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cm-muted, #6B7280)" }}>Loading…</div>
          ) : state.error ? (
            <div style={{ padding: 12, background: "rgba(255,107,107,0.1)", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>{state.error}</div>
          ) : state.scanners.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cm-muted, #6B7280)" }}>No scanners added yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {state.scanners.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name || "—"}</div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{s.mobile}</div>
                  </div>
                  <button type="button" onClick={() => removeScanner(s.id, s.name)}
                    style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: 8 }}
                    aria-label="Remove scanner">
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventScannersScreen;
