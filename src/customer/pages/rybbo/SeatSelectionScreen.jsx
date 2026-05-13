import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import { FaArrowLeft, FaMinus, FaPlus } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";
import DataState from "../../components/DataState";

const MAX_PER_CATEGORY = 8;

const SeatSelectionScreen = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const location = useLocation();
  const event = location.state?.event;
  const showtime = location.state?.showtime;
  const [counts, setCounts] = useState({});
  const [state, setState] = useState({ loading: true, error: "", categories: [] });

  useEffect(() => {
    if (!showtime?.id) return;
    let cancelled = false;
    (async () => {
      const r = await rybboService.getTicketCategoriesForShowtime(showtime.id);
      if (cancelled) return;
      setState({
        loading: false,
        error: r.success ? "" : (r.message || "Could not load tickets"),
        categories: r.data || [],
      });
    })();
    return () => { cancelled = true; };
  }, [showtime?.id]);

  const { totalQty, subtotal, lineItems } = useMemo(() => {
    const items = state.categories
      .filter((c) => counts[c.id] > 0)
      .map((c) => ({ id: c.id, name: c.name, price: Number(c.price), qty: counts[c.id], lineTotal: Number(c.price) * counts[c.id] }));
    const qty = items.reduce((a, b) => a + b.qty, 0);
    const sum = items.reduce((a, b) => a + b.lineTotal, 0);
    return { totalQty: qty, subtotal: sum, lineItems: items };
  }, [counts, state.categories]);

  if (!event) return <Navigate to={`/customer/app/rybbo/event/${slug}`} replace />;

  const setCount = (catId, delta) => {
    setCounts((prev) => {
      const next = { ...prev };
      const current = next[catId] || 0;
      const cat = state.categories.find((c) => c.id === catId);
      const limit = Math.min(MAX_PER_CATEGORY, cat?.available || 0);
      const target = Math.max(0, Math.min(limit, current + delta));
      if (target === 0) delete next[catId]; else next[catId] = target;
      return next;
    });
  };

  const handleProceed = () => {
    if (totalQty === 0) return;
    navigate(`/customer/app/rybbo/event/${slug}/summary`, {
      state: { event, showtime, lineItems, subtotal },
    });
  };

  return (
    <DataState loading={state.loading} error={state.error}>
      <div style={{ paddingBottom: 110, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
            <FaArrowLeft />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{event.title}</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{showtime?.date} · {showtime?.time} · {event.venue}</div>
          </div>
        </div>

        <div style={{ padding: "16px 14px" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 12px" }}>Select tickets</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {state.categories.map((cat) => {
              const qty = counts[cat.id] || 0;
              const soldOut = (cat.available || 0) <= 0;
              return (
                <div key={cat.id} style={{ padding: "14px", border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{cat.name}</div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>{soldOut ? "Sold out" : `${cat.available} left`}</div>
                    </div>
                    <strong style={{ color: "#007BFF", fontSize: 16 }}>₹{cat.price}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                    <button type="button" onClick={() => setCount(cat.id, -1)} disabled={qty === 0}
                      style={{ width: 36, height: 36, borderRadius: 18, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", cursor: qty === 0 ? "not-allowed" : "pointer", opacity: qty === 0 ? 0.4 : 1 }}>
                      <FaMinus size={11} />
                    </button>
                    <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{qty}</span>
                    <button type="button" onClick={() => setCount(cat.id, +1)} disabled={soldOut || qty >= MAX_PER_CATEGORY}
                      style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "#007BFF", color: "#fff", cursor: "pointer", opacity: soldOut ? 0.4 : 1 }}>
                      <FaPlus size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--cm-muted, #6B7280)" }}>
            Max {MAX_PER_CATEGORY} tickets per category. Backend reserves seats atomically on booking creation.
          </p>
        </div>

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 14px", background: "var(--cm-card, #FFFFFF)", borderTop: "1px solid var(--cm-line, #E5E7EB)", zIndex: 50 }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)" }}>{totalQty} ticket{totalQty === 1 ? "" : "s"}</div>
              <strong style={{ fontSize: 18 }}>₹{subtotal}</strong>
            </div>
            <button type="button" onClick={handleProceed} disabled={totalQty === 0}
              style={{ flex: 1, maxWidth: 240, padding: "13px 22px", borderRadius: 10, border: "none", background: totalQty === 0 ? "#444" : "#007BFF", color: "#fff", fontWeight: 700, fontSize: 15, cursor: totalQty === 0 ? "not-allowed" : "pointer" }}>
              Proceed
            </button>
          </div>
        </div>
      </div>
    </DataState>
  );
};

export default SeatSelectionScreen;
