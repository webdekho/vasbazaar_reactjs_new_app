import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

const PUBLIC_ORIGIN = "https://app.vasbazaar.com";

export const buildStoreShareUrl = (storeId) => {
  // Native apps have no shareable browser origin — use the public domain.
  if (Capacitor.isNativePlatform()) {
    return `${PUBLIC_ORIGIN}/customer/app/marketplace/store/${storeId}`;
  }
  // Web: use current origin so dev (localhost), staging and prod each share their own URL.
  // Preserve any sub-path the app is hosted under (e.g. /someapp/customer/...).
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : PUBLIC_ORIGIN;
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const match = path.match(/^(\/[^/]+)\/customer\//);
  const basePath = match ? match[1] : "";
  return `${origin}${basePath}/customer/app/marketplace/store/${storeId}`;
};

export const shareStore = async (store, { onCopied, onError } = {}) => {
  if (!store || store.id == null) return;
  const url = buildStoreShareUrl(store.id);
  const name = store.businessName || "this store";
  const text = `Check out ${name} on VasBazaar Marketplace.\n${url}`;
  const payload = {
    title: name,
    text,
    url,
    dialogTitle: "Share store",
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
