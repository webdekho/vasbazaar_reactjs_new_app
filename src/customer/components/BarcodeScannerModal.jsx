import { useCallback, useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";

/**
 * Camera barcode scanner overlay for product barcodes (EAN / UPC / Code128 …).
 *
 * Uses the browser-native BarcodeDetector API (Chrome / Android WebView). When
 * it isn't available (iOS Safari, older Android) we fall back to a manual entry
 * field so the seller can still type the code.
 *
 * Props:
 *   onDetected(value)  — called once with the scanned/typed code, then closes.
 *   onClose()          — dismiss without a value.
 */
const BARCODE_FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e",
  "code_128", "code_39", "code_93", "codabar", "itf", "qr_code",
];

const BarcodeScannerModal = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningRef = useRef(false);
  const lockRef = useRef(false);

  const [supported, setSupported] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");

  const finish = useCallback((value) => {
    if (!value || lockRef.current) return;
    lockRef.current = true;
    scanningRef.current = false;
    onDetected(String(value).trim());
  }, [onDetected]);

  const scanLoop = useCallback(async () => {
    if (!scanningRef.current) return;
    try {
      if (videoRef.current && videoRef.current.readyState >= 2 && !lockRef.current) {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length > 0) finish(codes[0].rawValue);
      }
    } catch (_) { /* ignore frame errors */ }
    if (scanningRef.current) {
      requestAnimationFrame(() => setTimeout(scanLoop, 250));
    }
  }, [finish]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (typeof window === "undefined" || !("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        setSupported(false);
        return;
      }
      try {
        let formats = BARCODE_FORMATS;
        try {
          // eslint-disable-next-line no-undef
          const avail = await window.BarcodeDetector.getSupportedFormats();
          if (Array.isArray(avail) && avail.length) formats = BARCODE_FORMATS.filter((f) => avail.includes(f));
        } catch (_) { /* use default list */ }
        // eslint-disable-next-line no-undef
        detectorRef.current = new window.BarcodeDetector({ formats });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        scanningRef.current = true;
        scanLoop();
      } catch (e) {
        setCameraError(e?.message || "Could not access camera");
      }
    };
    start();
    return () => {
      cancelled = true;
      scanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [scanLoop]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, background: "var(--cm-bg, #fff)", borderRadius: 16, overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Scan barcode</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <FaTimes />
          </button>
        </div>

        {supported && !cameraError ? (
          <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#000" }}>
            <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {/* Aiming frame */}
            <div style={{ position: "absolute", inset: "28% 12%", border: "2px solid rgba(255,255,255,.9)", borderRadius: 10, boxShadow: "0 0 0 9999px rgba(0,0,0,.25)" }} />
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 12 }}>
              Point the camera at the product barcode
            </div>
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", marginBottom: 10 }}>
              {cameraError
                ? `Camera unavailable: ${cameraError}. Enter the barcode manually.`
                : "Live scanning isn't supported on this device. Enter the barcode manually."}
            </div>
          </div>
        )}

        {/* Manual fallback — always available below the camera. */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (manual.trim()) finish(manual.trim()); }}
          style={{ display: "flex", gap: 8, padding: 12 }}
        >
          <input
            className="mkt-input"
            style={{ flex: 1 }}
            inputMode="numeric"
            placeholder="Or type barcode manually"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button type="submit" className="mkt-btn mkt-btn--secondary" style={{ width: "auto", padding: "0 14px", fontSize: 13 }}>
            Use
          </button>
        </form>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
