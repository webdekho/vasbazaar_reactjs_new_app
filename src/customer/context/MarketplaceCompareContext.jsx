import { createContext, useContext, useCallback, useMemo, useState } from "react";

/**
 * Lightweight "compare products" tray for the marketplace. Holds up to
 * COMPARE_LIMIT products selected from a store's item grid, and survives the
 * hop from the store screen to the dedicated CompareScreen (both consume this
 * context). Purely client-side — no backend, no cart, no money.
 *
 * Selected entries are the raw StoreItem objects (with an attached `storeId`)
 * so CompareScreen can render the spec table without re-fetching anything.
 */
export const COMPARE_LIMIT = 3;

const STORAGE_KEY = "vb_marketplace_compare";

const MarketplaceCompareContext = createContext(null);

const readInitial = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, COMPARE_LIMIT) : [];
  } catch {
    return [];
  }
};

const persist = (list) => {
  try {
    if (!list || list.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* ignore quota */ }
};

export const MarketplaceCompareProvider = ({ children }) => {
  const [items, setItems] = useState(readInitial);

  const commit = useCallback((next) => {
    setItems(next);
    persist(next);
  }, []);

  const isSelected = useCallback(
    (itemId) => items.some((i) => String(i.id) === String(itemId)),
    [items]
  );

  // Returns true when the item is now selected, false when it was removed or the
  // limit blocked the add (caller can toast on false-with-limit).
  const toggle = useCallback((item, storeId) => {
    if (!item || item.id == null) return false;
    let added = false;
    setItems((prev) => {
      const exists = prev.some((i) => String(i.id) === String(item.id));
      let next;
      if (exists) {
        next = prev.filter((i) => String(i.id) !== String(item.id));
      } else if (prev.length >= COMPARE_LIMIT) {
        next = prev; // at capacity — ignore the add
      } else {
        next = [...prev, { ...item, storeId: storeId ?? item.storeId ?? null }];
        added = true;
      }
      persist(next);
      return next;
    });
    return added;
  }, []);

  const remove = useCallback((itemId) => {
    setItems((prev) => {
      const next = prev.filter((i) => String(i.id) !== String(itemId));
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => commit([]), [commit]);

  const atLimit = items.length >= COMPARE_LIMIT;

  const value = useMemo(
    () => ({ items, count: items.length, atLimit, isSelected, toggle, remove, clear, limit: COMPARE_LIMIT }),
    [items, atLimit, isSelected, toggle, remove, clear]
  );

  return (
    <MarketplaceCompareContext.Provider value={value}>
      {children}
    </MarketplaceCompareContext.Provider>
  );
};

export const useMarketplaceCompare = () => {
  const ctx = useContext(MarketplaceCompareContext);
  if (!ctx) throw new Error("MarketplaceCompareProvider missing in tree");
  return ctx;
};
