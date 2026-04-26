import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FaArrowLeft, FaDownload, FaSearch, FaShareAlt, FaSpinner, FaUserPlus, FaUsers } from "react-icons/fa";
import {
  generateQrStickerBlob,
  getQrStickerFileName,
  getQrStickerLink,
} from "../utils/qrSticker";
import { useCustomerModern } from "../context/CustomerModernContext";
import { useToast } from "../context/ToastContext";
import { userService } from "../services/userService";

// Detect "user cancelled the share/save sheet" across native + web + locales.
// Native plugins surface this error in the device's system locale (Hindi /
// Marathi / etc.) so a literal "cancel" substring check is not enough — we
// also look at the standard DOMException name + plugin error code.
const isUserCancelledError = (error) => {
  if (!error) return false;
  if (error.name === "AbortError" || error.name === "NotAllowedError") return true;
  const code = String(error.code || "").toLowerCase();
  if (code === "share_canceled" || code === "share_cancelled" || code === "user_cancelled") return true;
  const msg = String(error.message || "").toLowerCase();
  // English/system patterns
  if (msg.includes("cancel") || msg.includes("abort") || msg.includes("dismiss")) return true;
  // Hindi / Marathi patterns we have observed from Capacitor plugins on
  // devices with Indian language UIs. Best-effort, append more if needed.
  if (msg.includes("रद्द") || msg.includes("रद")) return true;
  return false;
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      // Extract base64 data without the data URL prefix
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const writeFileToDevice = async (blob, fileName) => {
  const base64Data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Cache,
  });
  return result.uri;
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const normalizeMobile = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
};

const isValidMobile = (num) => /^[6-9]\d{9}$/.test(num);

const contactName = (contact) => {
  const name = contact?.name;
  if (typeof name === "string") return name;
  if (name?.display) return name.display;
  const parts = [name?.given, name?.middle, name?.family].filter(Boolean);
  return parts.join(" ").trim() || "Contact";
};

const contactPhones = (contact) => {
  if (Array.isArray(contact?.phones)) return contact.phones.map((phone) => phone.number || phone.value || phone);
  if (Array.isArray(contact?.tel)) return contact.tel;
  return [];
};

const QrStickerScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useCustomerModern();
  const { showToast } = useToast();
  const [stickerBlob, setStickerBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const mobile = useMemo(
    () => userData?.mobile || userData?.mobileNumber || location.state?.mobile || "",
    [location.state?.mobile, userData?.mobile, userData?.mobileNumber]
  );

  const fileName = useMemo(() => getQrStickerFileName(mobile), [mobile]);
  const shareLink = useMemo(() => getQrStickerLink(mobile), [mobile]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(q) || contact.mobileNumber.includes(q)
    );
  }, [contactSearch, contacts]);

  const selectedList = useMemo(
    () => Object.values(selectedContacts),
    [selectedContacts]
  );

  const allFilteredSelected = filteredContacts.length > 0
    && filteredContacts.every((contact) => selectedContacts[contact.mobileNumber]);

  useEffect(() => {
    let revokedUrl = "";
    let isMounted = true;

    const prepareSticker = async () => {
      setLoading(true);
      try {
        const blob = await generateQrStickerBlob({ mobile });
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        revokedUrl = url;
        setStickerBlob(blob);
        setPreviewUrl(url);
      } catch (error) {
        console.error("Failed to generate QR sticker:", error);
        if (isMounted) {
          showToast("Failed to generate QR card. Please try again.", "error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    prepareSticker();

    return () => {
      isMounted = false;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [mobile, showToast]);

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate("/customer/app/profile");
  };

  const handleDownload = async () => {
    if (!stickerBlob) return;

    setAction("download");
    try {
      if (Capacitor.isNativePlatform()) {
        // Write to cache then open the OS save/share sheet so the user can
        // pick "Save to Files / Photos / Drive" etc.
        const fileUri = await writeFileToDevice(stickerBlob, fileName);
        await Share.share({
          title: "Save VasBazaar QR Card",
          text: "Save this VasBazaar QR card image.",
          url: fileUri,
          dialogTitle: "Save VasBazaar QR Card",
        });
        showToast("Save sheet opened.", "success");
        return;
      }

      downloadBlob(stickerBlob, fileName);
      showToast("QR card download started.", "success");
    } catch (error) {
      // Always log the raw error in English for debugging — never surface it
      // to the user, since native plugins return locale-specific messages.
      console.error("QR download failed:", error?.message || error);
      if (isUserCancelledError(error)) return;
      showToast("Download failed. Please try again.", "error");
    } finally {
      setAction("");
    }
  };

  const handleShare = async () => {
    if (!stickerBlob) return;

    setAction("share");
    const shareText = `Scan this VasBazaar QR card to get started.\n${shareLink}`;

    try {
      if (Capacitor.isNativePlatform()) {
        const fileUri = await writeFileToDevice(stickerBlob, fileName);
        await Share.share({
          title: "VasBazaar QR Card",
          text: shareText,
          url: fileUri,
          dialogTitle: "Share VasBazaar QR Card",
        });
        return;
      }

      // Web: try Web Share API with file, then with link, then WhatsApp deep
      // link as a hard fallback so the action always completes for the user.
      const file = new File([stickerBlob], fileName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "VasBazaar QR Card",
          text: shareText,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: "VasBazaar QR Card",
          text: shareText,
          url: shareLink,
        });
        return;
      }

      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    } catch (error) {
      console.error("QR share failed:", error?.message || error);
      if (isUserCancelledError(error)) return;
      // Last-ditch fallback so the user can still complete the share even if
      // the system share sheet errored out (e.g. file URI not readable by
      // chosen target app). Opens WhatsApp web with the link prefilled.
      try {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
        showToast("Opened WhatsApp share as fallback.", "info");
        return;
      } catch (_) { /* ignore — falls through to error toast */ }
      showToast("Share failed. Please try again.", "error");
    } finally {
      setAction("");
    }
  };

  const openReferralContacts = async () => {
    setContactModalOpen(true);
    if (contacts.length) return;

    setContactsLoading(true);
    try {
      if ("contacts" in navigator && "select" in navigator.contacts) {
        const selected = await navigator.contacts.select(["name", "tel"], { multiple: true });
        const mapped = selected
          .flatMap((item) => contactPhones(item).map((phone) => ({
            name: Array.isArray(item.name) ? item.name[0] : item.name || "Contact",
            mobileNumber: normalizeMobile(phone),
          })))
          .filter((item) => isValidMobile(item.mobileNumber) && item.mobileNumber !== mobile);
        setContacts(dedupeContacts(mapped));
        return;
      }

      if (Capacitor.isNativePlatform()) {
        const permission = await Contacts.checkPermissions();
        if (permission.contacts !== "granted") {
          const requested = await Contacts.requestPermissions();
          if (requested.contacts !== "granted") {
            showToast("Contacts permission is required to refer from your phonebook.", "error");
            return;
          }
        }
        const result = await Contacts.getContacts({
          projection: { name: true, phones: true },
        });
        const mapped = (result?.contacts || [])
          .flatMap((item) => contactPhones(item).map((phone) => ({
            name: contactName(item),
            mobileNumber: normalizeMobile(phone),
          })))
          .filter((item) => isValidMobile(item.mobileNumber) && item.mobileNumber !== mobile);
        setContacts(dedupeContacts(mapped));
        return;
      }

      showToast("Contact selection is available on supported mobile browsers or the VasBazaar app.", "error");
    } catch (error) {
      console.error("Contact selection failed:", error?.message || error);
      if (isUserCancelledError(error)) return;
      showToast("Could not open contacts. Please try again.", "error");
    } finally {
      setContactsLoading(false);
    }
  };

  const dedupeContacts = (items) => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.mobileNumber)) map.set(item.mobileNumber, item);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleContact = (contact) => {
    setSelectedContacts((prev) => {
      const next = { ...prev };
      if (next[contact.mobileNumber]) delete next[contact.mobileNumber];
      else next[contact.mobileNumber] = contact;
      return next;
    });
  };

  const toggleSelectAllContacts = () => {
    setSelectedContacts((prev) => {
      const next = { ...prev };
      if (allFilteredSelected) {
        filteredContacts.forEach((contact) => {
          delete next[contact.mobileNumber];
        });
        return next;
      }

      filteredContacts.forEach((contact) => {
        next[contact.mobileNumber] = contact;
      });
      return next;
    });
  };

  const submitReferralContacts = async () => {
    if (!selectedList.length) {
      showToast("Select at least one contact to refer.", "error");
      return;
    }

    setAction("contacts");
    const result = await userService.referContacts(selectedList);
    setAction("");
    if (!result.success) {
      // Surface only ASCII / English backend messages; otherwise fall back
      // to a hard-coded English line so we never echo a locale-specific
      // backend string to the user.
      const backendMsg = typeof result.message === "string" && /^[\x20-\x7E]+$/.test(result.message)
        ? result.message
        : "";
      showToast(backendMsg || "Failed to save referral contacts.", "error");
      return;
    }
    const saved = result.data?.saved ?? selectedList.length;
    showToast(`${saved} referral contact${saved === 1 ? "" : "s"} submitted.`, "success");
    setContactModalOpen(false);
    setSelectedContacts({});
  };

  return (
    <div className="cm-page-animate qr-page">
      <div className="qr-page-header">
        <button type="button" className="qr-page-back" onClick={handleBack}>
          <FaArrowLeft />
        </button>
        <div>
          <h1 className="qr-page-title">Scan, Download & Share</h1>
          <p className="qr-page-subtitle">Download and share full QR card image from here.</p>
        </div>
      </div>

      <div className="qr-page-preview-shell">
        {loading ? (
          <div className="qr-page-loading">
            <FaSpinner className="qr-page-loading-icon" />
            <span>Generating QR card...</span>
          </div>
        ) : (
          <img src={previewUrl} alt="VasBazaar QR Card" className="qr-page-preview" />
        )}
      </div>

      <div className="qr-page-actions">
        <button
          type="button"
          className="qr-page-action qr-page-action--download"
          onClick={handleDownload}
          disabled={!stickerBlob || action === "download"}
        >
          {action === "download" ? <FaSpinner className="qr-page-action-spin" /> : <FaDownload />}
          <span>{Capacitor.isNativePlatform() ? "Save / Download" : "Download"}</span>
        </button>
        <button
          type="button"
          className="qr-page-action qr-page-action--share"
          onClick={handleShare}
          disabled={!stickerBlob || action === "share"}
        >
          {action === "share" ? <FaSpinner className="qr-page-action-spin" /> : <FaShareAlt />}
          <span>Share</span>
        </button>
        <button
          type="button"
          className="qr-page-action qr-page-action--contacts"
          onClick={openReferralContacts}
          disabled={action === "contacts"}
        >
          {action === "contacts" ? <FaSpinner className="qr-page-action-spin" /> : <FaUserPlus />}
          <span>Refer Contacts</span>
        </button>
      </div>

      {contactModalOpen && (
        <div className="qr-contact-modal-overlay" onClick={() => setContactModalOpen(false)}>
          <div className="qr-contact-modal" onClick={(event) => event.stopPropagation()}>
            <div className="qr-contact-modal-head">
              <div>
                <h2>Refer your contacts</h2>
                <p>{selectedList.length} selected</p>
              </div>
              <button type="button" className="qr-contact-close" onClick={() => setContactModalOpen(false)}>x</button>
            </div>

            <div className="qr-contact-search">
              <FaSearch />
              <input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search contacts or mobile"
              />
            </div>

            <div className="qr-contact-selectbar">
              <span>{filteredContacts.length} contact{filteredContacts.length === 1 ? "" : "s"} shown</span>
              <button
                type="button"
                className="qr-contact-selectall"
                onClick={toggleSelectAllContacts}
                disabled={!filteredContacts.length || contactsLoading}
              >
                {allFilteredSelected ? "Clear Shown" : "Select All"}
              </button>
            </div>

            <div className="qr-contact-list">
              {contactsLoading ? (
                <div className="qr-contact-empty">
                  <FaSpinner className="qr-page-action-spin" />
                  <span>Opening contacts...</span>
                </div>
              ) : filteredContacts.length ? (
                filteredContacts.map((contact) => {
                  const checked = Boolean(selectedContacts[contact.mobileNumber]);
                  return (
                    <button
                      key={contact.mobileNumber}
                      type="button"
                      className={`qr-contact-row${checked ? " is-selected" : ""}`}
                      onClick={() => toggleContact(contact)}
                    >
                      <div className="qr-contact-avatar">{contact.name.charAt(0).toUpperCase()}</div>
                      <div className="qr-contact-info">
                        <strong>{contact.name}</strong>
                        <span>{contact.mobileNumber.replace(/(\d{5})(\d{5})/, "$1 $2")}</span>
                      </div>
                      <span className="qr-contact-check">{checked ? "✓" : ""}</span>
                    </button>
                  );
                })
              ) : (
                <div className="qr-contact-empty">
                  <FaUsers />
                  <span>No contacts found.</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="qr-contact-submit"
              onClick={submitReferralContacts}
              disabled={!selectedList.length || action === "contacts"}
            >
              {action === "contacts" ? <FaSpinner className="qr-page-action-spin" /> : <FaUserPlus />}
              Submit Referrals
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QrStickerScreen;
