import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const STORAGE_KEY = "vb_marketplace_cart";

const MarketplaceCartContext = createContext(null);

// A cart line is keyed by item id plus the chosen variant label, so the same
// product in two sizes occupies two independent lines.
const lineKey = (itemId, variantLabel) =>
  variantLabel ? `${itemId}::${variantLabel}` : `${itemId}`;

const readCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persistCart = (cart) => {
  try {
    if (!cart) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch { /* ignore */ }
};

/**
 * Single-store cart. Adding an item from a different store prompts the caller
 * to either replace the existing cart or cancel — see addItem's `confirmReplace`.
 *
 * Cart shape:
 *   { storeId, storeName, deliveryCharges, minOrderValue, items: { [itemId]: { id, name, price, image, qty } } }
 */
export const MarketplaceCartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => readCart());

  useEffect(() => { persistCart(cart); }, [cart]);

  const totals = useMemo(() => {
    if (!cart || !cart.items) return { count: 0, subtotal: 0, total: 0, deliveryCharges: 0 };
    const items = Object.values(cart.items);
    const count = items.reduce((s, i) => s + (i.qty || 0), 0);
    const subtotal = items.reduce((s, i) => s + (Number(i.price) * Number(i.qty || 0)), 0);
    const deliveryCharges = Number(cart.deliveryCharges || 0);
    const total = subtotal + (subtotal > 0 ? deliveryCharges : 0);
    return { count, subtotal, total, deliveryCharges };
  }, [cart]);

  const startCart = useCallback((store) => {
    setCart({
      storeId: store.id,
      storeName: store.businessName,
      deliveryCharges: Number(store.deliveryCharges || 0),
      minOrderValue: Number(store.minOrderValue || 0),
      deliveryTimeMinutes: store.deliveryTimeMinutes || null,
      storeLatitude: store.latitude ?? null,
      storeLongitude: store.longitude ?? null,
      items: {},
    });
  }, []);

  // `variant` (optional): { label, price } — when present the line is priced at
  // the variant price and tracked separately from the plain item.
  const addItem = useCallback((store, item, { confirmReplace, variant } = {}) => {
    const vLabel = variant?.label || null;
    const unitPrice = vLabel
      ? Number(variant.price)
      : Number(item.offerPrice && Number(item.offerPrice) > 0 ? item.offerPrice : (item.sellingPrice || item.price || 0));
    const key = lineKey(item.id, vLabel);
    const makeLine = (qty) => ({
      id: item.id,
      name: item.name,
      price: unitPrice,
      image: item.imageUrl || null,
      variantLabel: vLabel,
      qty,
    });
    if (cart && cart.storeId !== store.id) {
      const ok = typeof confirmReplace === "function" ? confirmReplace() : window.confirm(
        "Your cart already has items from a different store. Replace cart with items from this store?"
      );
      if (!ok) return false;
      // Replace cart
      const next = {
        storeId: store.id,
        storeName: store.businessName,
        deliveryCharges: Number(store.deliveryCharges || 0),
        minOrderValue: Number(store.minOrderValue || 0),
        deliveryTimeMinutes: store.deliveryTimeMinutes || null,
      storeLatitude: store.latitude ?? null,
      storeLongitude: store.longitude ?? null,
        items: { [key]: makeLine(1) },
      };
      setCart(next);
      return true;
    }
    setCart((prev) => {
      const base = prev && prev.storeId === store.id ? prev : {
        storeId: store.id,
        storeName: store.businessName,
        deliveryCharges: Number(store.deliveryCharges || 0),
        minOrderValue: Number(store.minOrderValue || 0),
        deliveryTimeMinutes: store.deliveryTimeMinutes || null,
      storeLatitude: store.latitude ?? null,
      storeLongitude: store.longitude ?? null,
        items: {},
      };
      const existing = base.items[key];
      const nextQty = existing ? existing.qty + 1 : 1;
      return {
        ...base,
        items: { ...base.items, [key]: makeLine(nextQty) },
      };
    });
    return true;
  }, [cart]);

  const decrementItem = useCallback((itemId) => {
    setCart((prev) => {
      if (!prev || !prev.items[itemId]) return prev;
      const existing = prev.items[itemId];
      const nextQty = existing.qty - 1;
      const nextItems = { ...prev.items };
      if (nextQty <= 0) {
        delete nextItems[itemId];
      } else {
        nextItems[itemId] = { ...existing, qty: nextQty };
      }
      // If the cart is empty, clear it entirely
      if (Object.keys(nextItems).length === 0) return null;
      return { ...prev, items: nextItems };
    });
  }, []);

  const removeItem = useCallback((itemId) => {
    setCart((prev) => {
      if (!prev || !prev.items[itemId]) return prev;
      const nextItems = { ...prev.items };
      delete nextItems[itemId];
      if (Object.keys(nextItems).length === 0) return null;
      return { ...prev, items: nextItems };
    });
  }, []);

  const clearCart = useCallback(() => setCart(null), []);

  // Qty for a specific item+variant; pass no variantLabel for the plain line.
  const getItemQty = useCallback((itemId, variantLabel) => {
    if (!cart || !cart.items) return 0;
    return cart.items[lineKey(itemId, variantLabel)]?.qty || 0;
  }, [cart]);

  // Total qty across all variants of an item — used to show a combined badge.
  const getItemTotalQty = useCallback((itemId) => {
    if (!cart || !cart.items) return 0;
    return Object.values(cart.items)
      .filter((l) => l.id === itemId)
      .reduce((s, l) => s + (l.qty || 0), 0);
  }, [cart]);

  return (
    <MarketplaceCartContext.Provider
      value={{
        cart,
        totals,
        addItem,
        decrementItem,
        removeItem,
        clearCart,
        startCart,
        getItemQty,
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
