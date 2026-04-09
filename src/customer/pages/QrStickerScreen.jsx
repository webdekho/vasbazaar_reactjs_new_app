import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { FaArrowLeft, FaDownload, FaShareAlt, FaSpinner } from "react-icons/fa";
import {
  generateQrStickerBlob,
  getQrStickerFileName,
  getQrStickerLink,
} from "../utils/qrSticker";
import { useCustomerModern } from "../context/CustomerModernContext";
import { useToast } from "../context/ToastContext";

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

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
          showToast("QR card generate nahi ho paya. Please try again.", "error");
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
        const file = new File([stickerBlob], fileName, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Save VasBazaar QR Card",
            text: "Save this full VasBazaar QR card image.",
            files: [file],
          });
          showToast("Save/share sheet open ho gaya.", "success");
          return;
        }

        const dataUrl = await blobToDataUrl(stickerBlob);
        await Share.share({
          title: "Save VasBazaar QR Card",
          text: "Save this full VasBazaar QR card image.",
          url: dataUrl,
          dialogTitle: "Save VasBazaar QR Card",
        });
        showToast("Save/share sheet open ho gaya.", "success");
        return;
      }

      downloadBlob(stickerBlob, fileName);
      showToast("QR card download start ho gaya.", "success");
    } catch (error) {
      console.error("QR download failed:", error);
      showToast("Download complete nahi ho paya. Please try again.", "error");
    } finally {
      setAction("");
    }
  };

  const handleShare = async () => {
    if (!stickerBlob) return;

    setAction("share");
    try {
      const file = new File([stickerBlob], fileName, { type: "image/png" });
      const shareText = `Scan this VasBazaar QR card to get started.\n${shareLink}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "VasBazaar QR Card",
          text: shareText,
          files: [file],
        });
        return;
      }

      if (Capacitor.isNativePlatform()) {
        const dataUrl = await blobToDataUrl(stickerBlob);
        await Share.share({
          title: "VasBazaar QR Card",
          text: shareText,
          url: dataUrl,
          dialogTitle: "Share VasBazaar QR Card",
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
      showToast("Share complete nahi ho paya. Please try again.", "error");
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
          <p className="qr-page-subtitle">Full QR card image yahin se download aur share hogi.</p>
        </div>
      </div>

      <div className="qr-page-preview-shell">
        {loading ? (
          <div className="qr-page-loading">
            <FaSpinner className="qr-page-loading-icon" />
            <span>QR card generate ho rahi hai...</span>
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
