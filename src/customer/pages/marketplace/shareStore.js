import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

const PUBLIC_ORIGIN = "https://app.vasbazaar.com";

export const buildStoreShareUrl = (storeId) =>
  `${PUBLIC_ORIGIN}/customer/app/marketplace/store/${storeId}`;

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
