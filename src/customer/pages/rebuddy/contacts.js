// ReBuddy contact-picker helpers. Reuses the same cross-platform approach as
// QrStickerScreen: Web Contacts Picker API first, then the Capacitor
// @capacitor-community/contacts plugin on native, with a graceful fallback.
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";

// Indian mobile normalisation: strip country code / leading zero, keep last 10.
export const normalizeMobile = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
};

export const isValidMobile = (num) => /^[6-9]\d{9}$/.test(num);

export const isUserCancelledError = (error) => {
  if (!error) return false;
  if (error.name === "AbortError" || error.name === "NotAllowedError") return true;
  const code = String(error.code || "").toLowerCase();
  if (code === "share_canceled" || code === "share_cancelled" || code === "user_cancelled") return true;
  const msg = String(error.message || "").toLowerCase();
  if (msg.includes("cancel") || msg.includes("abort") || msg.includes("dismiss")) return true;
  if (msg.includes("रद्द") || msg.includes("रद")) return true;
  return false;
};

const contactName = (contact) => {
  const name = contact?.name;
  if (typeof name === "string") return name;
  if (name?.display) return name.display;
  const parts = [name?.given, name?.middle, name?.family].filter(Boolean);
  return parts.join(" ").trim() || "Contact";
};

const contactPhones = (contact) => {
  if (Array.isArray(contact?.phones)) return contact.phones.map((p) => p.number || p.value || p);
  if (Array.isArray(contact?.tel)) return contact.tel;
  return [];
};

// Opens the device contact picker and returns a deduped list of
// { name, mobile } objects with valid 10-digit Indian mobile numbers.
// Returns [] if the user cancels or contacts are unavailable.
export const pickContacts = async () => {
  let mapped = [];

  // On native (Capacitor WebView) always use the plugin. The Web Contacts
  // Picker API (`navigator.contacts.select`) is exposed by the Android
  // Chromium WebView but only works in a top-level browsing context, so
  // calling it inside the app throws and never opens the picker.
  const useWebPicker =
    !Capacitor.isNativePlatform() &&
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    !!navigator.contacts?.select;

  if (useWebPicker) {
    const selected = await navigator.contacts.select(["name", "tel"], { multiple: true });
    mapped = selected.flatMap((item) =>
      contactPhones(item).map((phone) => ({
        name: Array.isArray(item.name) ? item.name[0] : item.name || "Contact",
        mobile: normalizeMobile(phone),
      }))
    );
  } else if (Capacitor.isNativePlatform()) {
    const permission = await Contacts.checkPermissions();
    if (permission.contacts !== "granted") {
      const requested = await Contacts.requestPermissions();
      if (requested.contacts !== "granted") {
        const err = new Error("Contacts permission denied");
        err.code = "permission_denied";
        throw err;
      }
    }
    const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
    mapped = (result?.contacts || []).flatMap((item) =>
      contactPhones(item).map((phone) => ({
        name: contactName(item),
        mobile: normalizeMobile(phone),
      }))
    );
  } else {
    const err = new Error("Contact picker unavailable");
    err.code = "unsupported";
    throw err;
  }

  const valid = mapped.filter((c) => isValidMobile(c.mobile));
  const seen = new Map();
  valid.forEach((c) => { if (!seen.has(c.mobile)) seen.set(c.mobile, c); });
  return Array.from(seen.values());
};
