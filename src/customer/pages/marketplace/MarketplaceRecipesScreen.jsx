import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUtensils, FaPlus, FaCheck, FaShoppingBasket } from "react-icons/fa";
import { marketplaceWave6Service } from "../../services/marketplaceWave6Service";
import { useMarketplaceCart } from "../../context/MarketplaceCartContext";
import { useToast } from "../../context/ToastContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import "./marketplace.css";

const SELECTED_LOC_KEY = "marketplaceSelectedLocation";
const readSelectedLocation = () => {
  try {
    const raw = localStorage.getItem(SELECTED_LOC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") return parsed;
    return null;
  } catch { return null; }
};

const productPrice = (p) => (p?.offerPrice != null ? Number(p.offerPrice) : Number(p?.sellingPrice || 0));

// Build the cart's store + item shells from a unified product-feed card, the
// same shape the home feed uses so add-to-cart behaves identically.
const cardToStore = (p) => ({
  id: p.storeId,
  businessName: p.storeName,
  deliveryCharges: p.deliveryCharges,
  minOrderValue: p.minOrderValue,
  deliveryTimeMinutes: p.deliveryTimeMinutes,
  latitude: p.storeLatitude,
  longitude: p.storeLongitude,
});
const cardToItem = (p) => ({
  id: p.id,
  name: p.name,
  sellingPrice: p.offerPrice != null ? p.offerPrice : p.sellingPrice,
  imageUrl: p.imageUrl,
});

const MarketplaceRecipesScreen = () => {
  const navigate = useNavigate();
  const { addItem, getStoreItemQty } = useMarketplaceCart();
  const { showToast } = useToast();
  const { coords: geoCoords } = useGeolocation();

  const coords = useMemo(() => {
    const sel = readSelectedLocation();
    if (sel) return { lat: sel.lat, lng: sel.lng };
    if (geoCoords) return { lat: geoCoords.lat, lng: geoCoords.lng };
    return { lat: null, lng: null };
  }, [geoCoords]);

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve panel state (open recipe → suggested cart).
  const [active, setActive] = useState(null); // { id, name }
  const [resolveLoading, setResolveLoading] = useState(false);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    marketplaceWave6Service.getRecipes().then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.success) setRecipes(Array.isArray(res.data) ? res.data : []);
      else setError(res.message || "Failed to load recipes");
    });
    return () => { alive = false; };
  }, []);

  const openRecipe = useCallback(async (recipe) => {
    setActive(recipe);
    setResolveLoading(true);
    setLines([]);
    const res = await marketplaceWave6Service.resolveRecipe(recipe.id, coords);
    setResolveLoading(false);
    setLines(res.success && Array.isArray(res.data) ? res.data : []);
  }, [coords]);

  const closeRecipe = () => { setActive(null); setLines([]); };

  const addLine = (line, silent = false) => {
    const p = line.matchedItem;
    if (!p) return false;
    if (p.storeOpen === false) {
      if (!silent) showToast("That store is currently closed", "error");
      return false;
    }
    const times = Math.max(1, Number(line.suggestedQty) || 1);
    let ok = false;
    for (let i = 0; i < times; i++) ok = addItem(cardToStore(p), cardToItem(p)) || ok;
    if (ok && !silent) showToast(`${p.name} added to cart`, "success");
    return ok;
  };

  const addAll = () => {
    let added = 0;
    lines.forEach((line) => { if (line.matched && line.matchedItem) { if (addLine(line, true)) added += 1; } });
    if (added > 0) showToast(`${added} ingredient${added > 1 ? "s" : ""} added to cart`, "success");
    else showToast("No available ingredients to add", "error");
  };

  const matchedCount = lines.filter((l) => l.matched && l.matchedItem).length;

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Recipes</h1>
      </div>

      <div style={{ padding: "12px 14px 90px" }}>
        <div style={{ fontSize: 12, color: "var(--cm-muted)", marginBottom: 14 }}>
          Pick a recipe and add every ingredient to your cart in one tap — matched to buyable stores near you.
        </div>

        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="mkt-empty">Loading recipes…</div>
        ) : recipes.length === 0 ? (
          <div className="mkt-empty">No recipes available yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {recipes.map((r) => (
              <article
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openRecipe(r)}
                onKeyDown={(e) => { if (e.key === "Enter") openRecipe(r); }}
                style={{
                  borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)",
                  overflow: "hidden", cursor: "pointer",
                }}
              >
                <div style={{ height: 104, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cm-line)", overflow: "hidden" }}>
                  {r.imageUrl
                    ? <img src={r.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <FaUtensils size={22} color="var(--cm-muted)" />}
                </div>
                <div style={{ padding: "10px 12px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)", lineHeight: 1.3, minHeight: 34, overflow: "hidden" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                    {[r.cuisine, r.servings ? `${r.servings} servings` : null, r.ingredientCount != null ? `${r.ingredientCount} items` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Resolve sheet */}
      {active && (
        <div className="mkt-vsheet-overlay" onClick={closeRecipe}>
          <div className="mkt-vsheet" onClick={(e) => e.stopPropagation()}>
            <div className="mkt-vsheet-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mkt-vsheet-title">{active.name}</div>
                <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 2 }}>Shopping list</div>
              </div>
              <button className="mkt-header-back" onClick={closeRecipe} aria-label="Close">✕</button>
            </div>

            <div style={{ padding: "6px 14px 14px", maxHeight: "60vh", overflowY: "auto" }}>
              {resolveLoading ? (
                <div className="mkt-empty">Matching ingredients…</div>
              ) : lines.length === 0 ? (
                <div className="mkt-empty">No ingredients to show.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lines.map((line, idx) => {
                    const p = line.matchedItem;
                    const inCart = p ? getStoreItemQty(p.storeId, p.id) : 0;
                    return (
                      <div key={`${line.keyword}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)", opacity: line.matched ? 1 : 0.6 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--cm-line)", overflow: "hidden", flexShrink: 0 }}>
                          {p?.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaShoppingBasket size={14} color="var(--cm-muted)" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)", textTransform: "capitalize" }}>{line.keyword}</div>
                          <div style={{ fontSize: 11, color: "var(--cm-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {line.matched && p
                              ? `${p.name} · ${p.storeName}`
                              : "Not available near you"}
                            {line.requestedQty || line.unit ? ` · ${[line.requestedQty, line.unit].filter(Boolean).join(" ")}` : ""}
                          </div>
                        </div>
                        {line.matched && p && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cm-ink)" }}>₹{productPrice(p).toFixed(0)}</span>
                            <button
                              type="button"
                              onClick={() => addLine(line)}
                              aria-label={`Add ${p.name}`}
                              style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: inCart > 0 ? "#10b981" : "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}
                            >
                              {inCart > 0 ? <FaCheck size={10} /> : <FaPlus size={10} />}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!resolveLoading && matchedCount > 0 && (
              <div style={{ padding: "10px 14px 16px", borderTop: "1px solid var(--cm-line)", display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={addAll}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff" }}
                >
                  Add all {matchedCount} ingredient{matchedCount > 1 ? "s" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/customer/app/marketplace/cart")}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)", color: "var(--cm-ink)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Cart
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceRecipesScreen;
