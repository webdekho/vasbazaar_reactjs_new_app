import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

// Public domain so shared product links open for anyone, on any device.
const PUBLIC_ORIGIN = "https://vasbazaar.com";

export const buildProductShareUrl = (storeId, itemId) =>
  `${PUBLIC_ORIGIN}/customer/app/marketplace/store/${storeId}?item=${itemId}`;

const effectivePrice = (item) => {
  const offer = Number(item?.offerPrice);
  if (offer > 0) return offer;
  const selling = Number(item?.sellingPrice ?? item?.price);
  return Number.isFinite(selling) && selling > 0 ? selling : null;
};

/**
 * Share a marketplace product (mirrors shareStore.js): native share sheet on
 * Capacitor, Web Share API on the web, clipboard fallback otherwise.
 */
export const shareProduct = async (store, item, { onCopied, onError } = {}) => {
  const storeId = store?.id ?? store?.storeId;
  if (storeId == null || !item || item.id == null) return;
  const url = buildProductShareUrl(storeId, item.id);
  const name = item.name || "this product";
  const price = effectivePrice(item);
  const storeName = store?.businessName || store?.storeName;
  const text = `Check out ${name}${price != null ? ` at ₹${price.toFixed(0)}` : ""}${
    storeName ? ` from ${storeName}` : ""
  } on VasBazaar Marketplace.\n${url}`;
  const payload = {
    title: name,
    text,
    url,
    dialogTitle: "Share product",
  };

  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share(payload);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: payload.title, text, url });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      onCopied?.(url);
      return;
    }
    onError?.(new Error("Share not supported"));
  } catch (err) {
    if (err?.name === "AbortError") return;
    onError?.(err);
  }
};
