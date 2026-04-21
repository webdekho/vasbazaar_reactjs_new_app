import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FaArrowLeft, FaDownload, FaShareAlt, FaSpinner } from "react-icons/fa";
import {
  generateQrStickerBlob,
  getQrStickerFileName,
  getQrStickerLink,
} from "../utils/qrSticker";
import { useCustomerModern } from "../context/CustomerModernContext";
import { useToast } from "../context/ToastContext";

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

const QrStickerScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useCustomerModern();
  const { showToast } = useToast();
  const [stickerBlob, setStickerBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");

  const mobile = useMemo(
    () => userData?.mobile || userData?.mobileNumber || location.state?.mobile || "",
    [location.state?.mobile, userData?.mobile, userData?.mobileNumber]
  );

  const fileName = useMemo(() => getQrStickerFileName(mobile), [mobile]);
  const shareLink = useMemo(() => getQrStickerLink(mobile), [mobile]);

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
        // Write the file to cache directory first
        const fileUri = await writeFileToDevice(stickerBlob, fileName);

        // Share the file so user can save it
        await Share.share({
          title: "Save VasBazaar QR Card",
          text: "Save this full VasBazaar QR card image.",
          url: fileUri,
          dialogTitle: "Save VasBazaar QR Card",
        });
        showToast("Save/share sheet opened successfully.", "success");
        return;
      }

      downloadBlob(stickerBlob, fileName);
      showToast("QR card download started.", "success");
    } catch (error) {
      console.error("QR download failed:", error);
      // User cancelled the share sheet - not an error
      if (error?.message?.includes("cancel") || error?.message?.includes("Cancel")) {
        return;
      }
      showToast("Download failed. Please try again.", "error");
    } finally {
      setAction("");
    }
  };

  const handleShare = async () => {
    if (!stickerBlob) return;

    setAction("share");
    try {
      const shareText = `Scan this VasBazaar QR card to get started.\n${shareLink}`;

      if (Capacitor.isNativePlatform()) {
        // Write the file to cache directory first
        const fileUri = await writeFileToDevice(stickerBlob, fileName);

        await Share.share({
          title: "VasBazaar QR Card",
          text: shareText,
          url: fileUri,
          dialogTitle: "Share VasBazaar QR Card",
        });
        return;
      }

      // Web fallback with Web Share API
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
      console.error("QR share failed:", error);
      // User cancelled the share sheet - not an error
      if (error?.message?.includes("cancel") || error?.message?.includes("Cancel")) {
        return;
      }
      showToast("Share failed. Please try again.", "error");
    } finally {
      setAction("");
    }
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
      </div>
    </div>
  );
};

export default QrStickerScreen;
