import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUndoAlt, FaExchangeAlt, FaBoxOpen, FaMotorcycle, FaCheck, FaTimes } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { marketplaceLogisticsAiService } from "../../services/marketplaceLogisticsAiService";
import { formatDisplayDateTime } from "../../../utils/dateFormat";
import "./marketplace.css";

const STATUS_FILTER = ["All", "REQUESTED", "APPROVED", "PICKED_UP", "REFUNDED", "REPLACED", "REJECTED", "CLOSED"];

const STATUS_TONE = {
  REQUESTED: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  APPROVED: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" },
  PICKED_UP: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" },
  REFUNDED: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  REPLACED: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444" },
  CLOSED: { bg: "rgba(148, 163, 184, 0.18)", color: "#64748b" },
};

const inr = (n) => `₹${Number(n || 0).toFixed(2)}`;

const StoreReturnsScreen = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [riders, setRiders] = useState([]);
  // Rider-assign sheet: { id } of the RMA awaiting a reverse-pickup rider/AWB.
  const [assignSheet, setAssignSheet] = useState(null);
  const [awb, setAwb] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    marketplaceService.getMyStoreReturns({ status: filter === "All" ? undefined : filter, pageSize: 100 }).then((res) => {
      setLoading(false);
      if (res.success) {
        const data = res.data || {};
        const rows = Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []);
        setReturns(rows);
      } else {
        setError(res.message || "Couldn't load returns. Please try again.");
      }
    });
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    marketplaceLogisticsAiService.getMyRiders().then((res) => {
      if (res.success) setRiders(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  const runAction = useCallback(async (id, fn, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (res.success) {
      load();
    } else {
      window.alert(res.message || "Action failed. Please try again.");
    }
  }, [load]);

  const approve = (r) => runAction(r.id, () => marketplaceService.approveReturn(r.id));
  const reject = (r) => {
    const reason = window.prompt("Reason for rejecting this request?");
    if (reason == null) return;
    runAction(r.id, () => marketplaceService.rejectReturn(r.id, reason));
  };
  const markPicked = (r) => runAction(r.id, () => marketplaceService.markReturnPicked(r.id), "Confirm the item has been picked up from the customer?");
  const complete = (r) => runAction(
    r.id,
    () => marketplaceService.completeReturn(r.id),
    r.type === "REPLACEMENT"
      ? "Mark this replacement as reshipped? The order is closed with no refund."
      : "Complete this return? The refund will be issued to the customer now."
  );

  const assignRider = async (riderId) => {
    const id = assignSheet.id;
    setAssignSheet(null);
    await runAction(id, () => marketplaceService.assignReverseRider(id, { riderId }));
  };
  const assignAwb = async () => {
    const id = assignSheet.id;
    const code = awb.trim();
    if (!code) return;
    setAssignSheet(null);
    setAwb("");
    await runAction(id, () => marketplaceService.assignReverseRider(id, { awb: code }));
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Returns &amp; Replacements</h1>
      </div>

      <div className="mkt-categories">
        {STATUS_FILTER.map((f) => (
          <button
            key={f}
            className={`mkt-cat-chip${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : error ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaBoxOpen /></div>
          <div>{error}</div>
          <button onClick={load} style={{ marginTop: 14, background: "var(--cm-primary, #14b8a6)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Retry</button>
        </div>
      ) : returns.length === 0 ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaUndoAlt /></div>
          <div>No return requests{filter !== "All" ? ` in ${filter.replace(/_/g, " ")}` : ""}</div>
        </div>
      ) : (
        <div style={{ padding: "8px 14px 24px" }}>
          {returns.map((r) => {
            const tone = STATUS_TONE[r.status] || { bg: "rgba(148,163,184,0.18)", color: "#64748b" };
            const buyer = r.userId || {};
            const order = r.orderId || {};
            const busy = busyId === r.id;
            let photos = [];
            try { photos = r.photosJson ? JSON.parse(r.photosJson) : []; } catch { photos = []; }
            return (
              <div key={r.id} style={{ background: "var(--cm-card)", border: "1px solid var(--cm-line)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14 }}>
                      {r.type === "REPLACEMENT" ? <FaExchangeAlt size={12} /> : <FaUndoAlt size={12} />}
                      {r.type === "REPLACEMENT" ? "Replacement" : "Return"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>
                      {buyer.name || "Customer"}{order.orderNo ? ` · ${order.orderNo}` : ""} · {formatDisplayDateTime(r.createdAt, "")}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: tone.bg, color: tone.color }}>
                    {(r.status || "").replace(/_/g, " ")}
                  </span>
                </div>

                {r.reason && <div style={{ fontSize: 13, color: "var(--cm-ink)", marginTop: 8 }}>{r.reason}</div>}

                {photos.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {photos.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--cm-line)" }} />
                      </a>
                    ))}
                  </div>
                )}

                {(r.reversePickupRiderId != null || r.reversePickupAwb) && (
                  <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FaMotorcycle size={11} /> Reverse pickup: {r.reversePickupAwb || `Rider #${r.reversePickupRiderId}`}
                  </div>
                )}

                {/* On COD the seller holds the customer's cash, so this is an
                    instruction to pay — not a receipt. The generic line below says
                    "refunded", which would read as "already handled" and is exactly
                    how a customer ends up out of pocket. */}
                {Number(r.refundAmount) > 0 && r.refundStatus === "SELLER_CASH_DUE" && (
                  <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, marginTop: 8 }}>
                    Return {inr(r.refundAmount)} in cash to the customer
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginTop: 2 }}>
                      Cash on Delivery order — VasBazaar never held this money, so it is not refunded automatically.
                    </div>
                  </div>
                )}

                {Number(r.refundAmount) > 0 && r.refundStatus !== "SELLER_CASH_DUE" && (
                  <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700, marginTop: 8 }}>
                    {inr(r.refundAmount)} refunded{r.refundStatus ? ` · ${r.refundStatus.replace(/_/g, " ")}` : ""}
                  </div>
                )}

                {/* Seller actions by status */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {r.status === "REQUESTED" && (
                    <>
                      <button disabled={busy} onClick={() => approve(r)} style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #14b8a6, #10b981)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <FaCheck size={11} /> Approve
                      </button>
                      <button disabled={busy} onClick={() => reject(r)} style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.5)", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <FaTimes size={11} /> Reject
                      </button>
                    </>
                  )}
                  {r.status === "APPROVED" && (
                    <>
                      <button disabled={busy} onClick={() => setAssignSheet({ id: r.id })} style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card)", color: "var(--cm-ink)", fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <FaMotorcycle size={11} /> Reverse pickup
                      </button>
                      <button disabled={busy} onClick={() => markPicked(r)} style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer" }}>
                        Mark picked up
                      </button>
                    </>
                  )}
                  {r.status === "PICKED_UP" && (
                    <button disabled={busy} onClick={() => complete(r)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #14b8a6, #10b981)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer" }}>
                      {busy ? "Processing…" : r.type === "REPLACEMENT" ? "Mark reshipped" : "Complete & refund"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reverse-pickup rider / AWB assign sheet */}
      {assignSheet && (
        <div onClick={() => setAssignSheet(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "var(--cm-card, #fff)", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Assign reverse pickup</div>
              <button onClick={() => setAssignSheet(null)} className="mkt-header-back" aria-label="Close">×</button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6 }}>Pick a rider</div>
            {riders.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                No riders yet. <button onClick={() => navigate("/customer/app/marketplace/my-store/riders")} style={{ background: "none", border: "none", color: "var(--cm-primary, #14b8a6)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Add a rider</button>.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {riders.map((rider) => (
                  <button key={rider.id} onClick={() => assignRider(rider.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--cm-line)", background: "transparent", color: "var(--cm-ink)", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                    <FaMotorcycle size={13} style={{ color: "#8b5cf6" }} />
                    <span style={{ fontWeight: 700 }}>{rider.name}</span>
                    <span style={{ color: "var(--cm-muted)", marginLeft: "auto" }}>{rider.mobile}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>Or courier AWB</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                placeholder="Reverse pickup AWB / tracking no."
                style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--cm-line)", background: "var(--cm-card, rgba(255,255,255,0.04))", color: "var(--cm-ink)", fontSize: 13, boxSizing: "border-box" }}
              />
              <button onClick={assignAwb} disabled={!awb.trim()} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: awb.trim() ? "linear-gradient(135deg, #14b8a6, #10b981)" : "var(--cm-line)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: awb.trim() ? "pointer" : "default" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreReturnsScreen;
