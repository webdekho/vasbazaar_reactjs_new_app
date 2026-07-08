import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const STORAGE_KEY = "vb_marketplace_cart";

const MarketplaceCartContext = createContext(null);

// A cart line is keyed by item id plus the chosen variant label, so the same
// product in two sizes occupies two independent lines.
const lineKey = (itemId, variantLabel) =>
  variantLabel ? `${itemId}::${variantLabel}` : `${itemId}`;

// ----- persistence -----------------------------------------------------------
// New schema: { stores: { [storeId]: bucket } }. We still read the legacy
// single-store shape ({ storeId, items }) and migrate it into a bucket so old
// carts survive an app update.
const readCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed) return {};
    if (parsed.stores) return parsed.stores;
    // Legacy single-store cart → migrate.
    if (parsed.storeId && parsed.items) {
      return { [parsed.storeId]: parsed };
    }
    return {};
  } catch {
    return {};
  }
};

const persistStores = (stores) => {
  try {
    if (!stores || Object.keys(stores).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ stores }));
  } catch { /* ignore quota */ }
};

const bucketMeta = (store) => ({
  storeId: store.id,
  storeName: store.businessName,
  deliveryCharges: Number(store.deliveryCharges || 0),
  minOrderValue: Number(store.minOrderValue || 0),
  deliveryTimeMinutes: store.deliveryTimeMinutes || null,
  storeLatitude: store.latitude ?? null,
  storeLongitude: store.longitude ?? null,
});

/**
 * Multi-store cart. Items from several stores coexist, each in its own bucket.
 * For backward compatibility the exposed `cart` is:
 *   - null                          when empty
 *   - the legacy single-store shape when exactly one store has items
 *       { storeId, storeName, deliveryCharges, minOrderValue, …, items: { [key]: line } }
 *   - { multi: true, stores, storeList } when more than one store has items
 * This lets the rich single-store CartScreen keep working untouched while a
 * dedicated multi-store checkout handles the combined case.
 */
export const MarketplaceCartProvider = ({ children }) => {
  const [stores, setStores] = useState(() => readCart());

  useEffect(() => { persistStores(stores); }, [stores]);

  // Drop empty buckets so counts/derivations stay clean.
  const pruned = useMemo(() => {
    const out = {};
    Object.entries(stores || {}).forEach(([id, b]) => {
      if (b && b.items && Object.keys(b.items).length > 0) out[id] = b;
    });
    return out;
  }, [stores]);

  const storeList = useMemo(() => Object.values(pruned), [pruned]);

  // Backward-compatible `cart` view.
  const cart = useMemo(() => {
    if (storeList.length === 0) return null;
    if (storeList.length === 1) return storeList[0];
    return { multi: true, stores: pruned, storeList };
  }, [pruned, storeList]);

  // Combined totals across every store bucket.
  const totals = useMemo(() => {
    if (storeList.length === 0) return { count: 0, subtotal: 0, total: 0, deliveryCharges: 0 };
    let count = 0, subtotal = 0, deliveryCharges = 0;
    storeList.forEach((b) => {
      const lines = Object.values(b.items || {});
      const sub = lines.reduce((s, i) => s + Number(i.price) * Number(i.qty || 0), 0);
      count += lines.reduce((s, i) => s + (i.qty || 0), 0);
      subtotal += sub;
      if (sub > 0) deliveryCharges += Number(b.deliveryCharges || 0);
    });
    return { count, subtotal, total: subtotal + deliveryCharges, deliveryCharges };
  }, [storeList]);

  // Add one unit. `variant` (optional): { label, price }. `note`/`imageUrl`
  // (optional): per-line customization (e.g. cake message + reference photo),
  // sent to the backend as the line's note/imageUrl. No store-replace prompt
  // anymore — different stores simply coexist in their own buckets.
  const addItem = useCallback((store, item, { variant, note, imageUrl } = {}) => {
    const vLabel = variant?.label || null;
    const unitPrice = vLabel
      ? Number(variant.price)
      : Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : (item.sellingPrice || item.price || 0));
    const key = lineKey(item.id, vLabel);
    // Per-item order-quantity limits (configured by the merchant). min defaults
    // to 1; max null = unlimited. Stored on the line so decrement can respect min
    // and so cart-screen re-adds (which rebuild a bare item) keep the limits.
    const itemHasLimits = item.minOrderQty != null || item.maxOrderQty != null;
    const itemMinQty = Math.max(1, Number(item.minOrderQty) || 1);
    const itemMaxQty = Number(item.maxOrderQty) > 0 ? Number(item.maxOrderQty) : null;
    setStores((prev) => {
      const base = prev[store.id] || { ...bucketMeta(store), items: {} };
      const existing = base.items[key];
      // Prefer limits from the item; fall back to the existing line's stored
      // limits when the caller rebuilt a bare item (e.g. the cart stepper).
      const minQty = itemHasLimits ? itemMinQty : Math.max(1, Number(existing?.minQty) || 1);
      const maxQty = itemHasLimits ? itemMaxQty : (Number(existing?.maxQty) > 0 ? Number(existing.maxQty) : null);
      let nextQty = existing ? existing.qty + 1 : minQty;
      if (maxQty != null && nextQty > maxQty) nextQty = maxQty; // never exceed the cap
      // Category-flow flag: item requires a prescription on the order. Falls
      // back to the existing line's flag when the caller rebuilt a bare item
      // (e.g. the cart stepper), same as the qty limits above.
      const requiresPrescription = item.requiresPrescription != null
        ? !!item.requiresPrescription
        : !!existing?.requiresPrescription;
      const line = {
        id: item.id,
        name: item.name,
        price: unitPrice,
        image: item.imageUrl || null,
        variantLabel: vLabel,
        minQty,
        maxQty,
        qty: nextQty,
        requiresPrescription,
        // Per-line customization — new value wins, otherwise keep what the
        // line already carried (increments shouldn't wipe the cake message).
        note: note !== undefined ? (note || null) : (existing?.note || null),
        noteImageUrl: imageUrl !== undefined ? (imageUrl || null) : (existing?.noteImageUrl || null),
      };
      return {
        ...prev,
        [store.id]: { ...base, ...bucketMeta(store), items: { ...base.items, [key]: line } },
      };
    });
    return true;
  }, []);

  // Decrement a specific store+line; removes the line at 0 and the bucket when
  // it empties.
  const decrementLine = useCallback((storeId, key) => {
    setStores((prev) => {
      const b = prev[storeId];
      if (!b || !b.items[key]) return prev;
      const line = b.items[key];
      const lineMin = Math.max(1, Number(line.minQty) || 1);
      const nextQty = line.qty - 1;
      const items = { ...b.items };
      // Going below the minimum removes the line entirely — a partial order
      // under the merchant's minimum isn't allowed.
      if (nextQty < lineMin) delete items[key];
      else items[key] = { ...items[key], qty: nextQty };
      const next = { ...prev };
      if (Object.keys(items).length === 0) delete next[storeId];
      else next[storeId] = { ...b, items };
      return next;
    });
  }, []);

  // Update a line's customization (note / reference image) in place without
  // touching its quantity.
  const updateLineExtras = useCallback((storeId, key, { note, imageUrl } = {}) => {
    setStores((prev) => {
      const b = prev[storeId];
      if (!b || !b.items[key]) return prev;
      const line = b.items[key];
      const next = {
        ...line,
        ...(note !== undefined ? { note: note || null } : {}),
        ...(imageUrl !== undefined ? { noteImageUrl: imageUrl || null } : {}),
      };
      return { ...prev, [storeId]: { ...b, items: { ...b.items, [key]: next } } };
    });
  }, []);

  const removeLine = useCallback((storeId, key) => {
    setStores((prev) => {
      const b = prev[storeId];
      if (!b || !b.items[key]) return prev;
      const items = { ...b.items };
      delete items[key];
      const next = { ...prev };
      if (Object.keys(items).length === 0) delete next[storeId];
      else next[storeId] = { ...b, items };
      return next;
    });
  }, []);

  const clearStore = useCallback((storeId) => {
    setStores((prev) => {
      if (!prev[storeId]) return prev;
      const next = { ...prev };
      delete next[storeId];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setStores({}), []);

  // --- Legacy single-store helpers (used by the existing CartScreen) ----------
  // These operate on whichever bucket holds the key; in single-store mode that
  // is unambiguous.
  const findStoreForKey = useCallback((key) => {
    const hit = Object.values(pruned).find((b) => b.items[key]);
    return hit ? hit.storeId : null;
  }, [pruned]);

  const decrementItem = useCallback((key) => {
    const sid = findStoreForKey(key);
    if (sid != null) decrementLine(sid, key);
  }, [findStoreForKey, decrementLine]);

  const removeItem = useCallback((key) => {
    const sid = findStoreForKey(key);
    if (sid != null) removeLine(sid, key);
  }, [findStoreForKey, removeLine]);

  // Qty for an item+variant within a specific store bucket.
  const getStoreItemQty = useCallback((storeId, itemId, variantLabel) => {
    const b = pruned[storeId];
    if (!b) return 0;
    return b.items[lineKey(itemId, variantLabel)]?.qty || 0;
  }, [pruned]);

  // Legacy: qty across all buckets for an item+variant (single-store callers).
  const getItemQty = useCallback((itemId, variantLabel) => {
    const k = lineKey(itemId, variantLabel);
    return Object.values(pruned).reduce((s, b) => s + (b.items[k]?.qty || 0), 0);
  }, [pruned]);

  const getItemTotalQty = useCallback((itemId) => {
    return Object.values(pruned).reduce(
      (s, b) => s + Object.values(b.items).filter((l) => l.id === itemId).reduce((a, l) => a + (l.qty || 0), 0),
      0
    );
  }, [pruned]);

  return (
    <MarketplaceCartContext.Provider
      value={{
        cart,
        totals,
        storeList,
        addItem,
        decrementItem,
        removeItem,
        decrementLine,
        removeLine,
        updateLineExtras,
        clearStore,
        clearCart,
        getItemQty,
        getStoreItemQty,
        getItemTotalQty,
        lineKeyOf: (line) => lineKey(line.id, line.variantLabel),
      }}
    >
      {children}
    </MarketplaceCartContext.Provider>
  );
};

export const useMarketplaceCart = () => {
  const ctx = useContext(MarketplaceCartContext);
  if (!ctx) throw new Error("MarketplaceCartProvider missing in tree");
  return ctx;
};
