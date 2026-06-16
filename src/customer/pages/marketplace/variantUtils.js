// Shared helpers for marketplace product variants / grouped options.
//
// A store item's `variants` column is a JSON array of purchasable options.
// Each variant looks like:
//   { label, price, mrp?, stock?, image?, options?: { Size: "1 kg", Colour: "Red" } }
//
// `label` stays the authoritative key the backend matches on (resolveVariantPrice).
// `options` is what powers Amazon-style grouped selectors (one chip group per
// dimension). Legacy variants without `options` still work as a flat chip list.

export function parseVariants(raw) {
  if (!raw) return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter((x) => x && x.label != null && String(x.label).trim() !== "") : [];
  } catch {
    return [];
  }
}

export function hasVariants(rawOrItem) {
  if (!rawOrItem) return false;
  const raw = typeof rawOrItem === "object" && "variants" in rawOrItem ? rawOrItem.variants : rawOrItem;
  return parseVariants(raw).length > 0;
}

// Ordered list of dimension names, first-seen order across all variants.
export function variantDimensions(variants) {
  const dims = [];
  variants.forEach((v) => {
    if (v && v.options && typeof v.options === "object") {
      Object.keys(v.options).forEach((k) => {
        if (k && !dims.includes(k)) dims.push(k);
      });
    }
  });
  return dims;
}

// Distinct values for a dimension, in first-seen order.
export function dimensionValues(variants, dim) {
  const vals = [];
  variants.forEach((v) => {
    const val = v?.options?.[dim];
    if (val != null && val !== "" && !vals.includes(val)) vals.push(val);
  });
  return vals;
}

export function findVariantByOptions(variants, dims, selection) {
  return (
    variants.find((v) =>
      dims.every((d) => String(v?.options?.[d] ?? "") === String(selection?.[d] ?? ""))
    ) || null
  );
}

export function findVariantByLabel(variants, label) {
  if (label == null) return null;
  const target = String(label).trim().toLowerCase();
  return variants.find((v) => String(v.label).trim().toLowerCase() === target) || null;
}

// Lowest variant price — used for "From ₹X" display on cards.
export function minVariantPrice(variants) {
  const prices = variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}
