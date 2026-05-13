import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaCamera } from "react-icons/fa";
import { rybboService } from "../../services/rybboService";

/**
 * Customer-side venue entry scanner.
 *
 * Uses the browser-native BarcodeDetector API when available (Chrome / WebView on
 * Android 11+). When unavailable, falls back to a manual paste field so the
 * gate flow still works on iOS Safari and older Android.
 *
 * On a successful scan we call POST /api/customer/rybbo/checkin which validates
 * the signed token and admits one ticket-unit from the booking's remaining qty.
 */
const QrScannerScreen = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningRef = useRef(false);
  const lockRef = useRef(false);

  const [supported, setSupported] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleToken = useCallback(async (token) => {
    if (!token || lockRef.current) return;
    lockRef.current = true;
    setSubmitting(true);
    const deviceInfo = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null;
    const r = await rybboService.checkIn({ qrToken: token, deviceInfo });
    setResult(r.success
      ? { ok: true, data: r.data }
      : { ok: false, message: r.message || "Check-in failed" });
    setSubmitting(false);
    scanningRef.current = false;
  }, []);

  const scanLoop = useCallback(async () => {
    if (!scanningRef.current) return;
    try {
      if (videoRef.current && videoRef.current.readyState >= 2 && !lockRef.current) {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length > 0) {
          await handleToken(codes[0].rawValue);
        }
      }
    } catch (_) { /* ignore frame errors */ }
    if (scanningRef.current) {
      requestAnimationFrame(() => setTimeout(scanLoop, 250));
    }
  }, [handleToken]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (typeof window === "undefined" || !("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        setSupported(false);
        return;
      }
      try {
        // eslint-disable-next-line no-undef
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
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

  const resume = () => {
    setResult(null);
    setManualToken("");
    lockRef.current = false;
    scanningRef.current = true;
    scanLoop();
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (manualToken.trim()) handleToken(manualToken.trim());
  };

  return (
    <div style={{ width: "100%", padding: "0 0 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--cm-line, #E5E7EB)" }}>
        <button type="button" onClick={() => navigate(-1)}
          style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Scan Ticket QR</div>
      </div>

      <div style={{ padding: 16, maxWidth: 560, margin: "0 auto" }}>
        {result ? (
          <ResultCard result={result} onAgain={resume} onDone={() => navigate("/customer/app/rybbo/my-bookings")} />
        ) : supported ? (
          <>
            <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#000", borderRadius: 14, overflow: "hidden" }}>
              <video ref={videoRef} muted playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{
                position: "absolute", inset: "10%",
                border: "2px solid rgba(255,255,255,0.9)", borderRadius: 14,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)"
              }} />
              {submitting && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  Verifying…
                </div>
              )}
            </div>
            {cameraError && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(239,68,68,0.12)", borderRadius: 10, fontSize: 13, color: "#ef4444" }}>
                {cameraError}
              </div>
            )}
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--cm-muted, #6B7280)", textAlign: "center" }}>
              Point the camera at the customer's ticket QR.
            </div>
          </>
        ) : (
          <div style={{ padding: 16, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontWeight: 700 }}>
              <FaCamera /> Camera scanning unavailable
            </div>
            <p style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", marginTop: 0 }}>
              Your browser does not support live QR scanning. Paste the ticket token below to admit the guest manually.
            </p>
            <form onSubmit={submitManual} style={{ display: "grid", gap: 10 }}>
              <textarea value={manualToken} onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste ticket token (the value encoded in the QR)" rows={4}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontFamily: "monospace", fontSize: 12 }} />
              <button type="submit" disabled={submitting || !manualToken.trim()}
                style={{ padding: 12, borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {submitting ? "Verifying…" : "Admit guest"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const ResultCard = ({ result, onAgain, onDone }) => {
  if (result.ok) {
    const d = result.data || {};
    return (
      <div style={{ padding: 18, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 14, textAlign: "center" }}>
        <FaCheckCircle size={56} color="#22c55e" style={{ margin: "8px auto" }} />
        <h3 style={{ margin: "8px 0 4px", fontWeight: 800 }}>Admitted</h3>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{d.eventTitle}</div>
        <div style={{ fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 10 }}>
          {d.venue} · {d.showDate} {d.showTime}
        </div>
        <div style={{ display: "grid", gap: 6, textAlign: "left", padding: "10px 14px", background: "rgba(34,197,94,0.08)", borderRadius: 10, marginBottom: 12 }}>
          <Row label="Booking" value={d.bookingCode} />
          <Row label="Guest" value={d.attendeeName} />
          <Row label="Ticket" value={d.ticketName} />
          <Row label="Used / total" value={`${d.usedQty} / ${d.totalQty}`} />
          <Row label="Remaining" value={String(d.remainingQty ?? "-")} />
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <button type="button" onClick={onAgain}
            style={{ padding: 12, borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Scan another
          </button>
          <button type="button" onClick={onDone}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--cm-line, #E5E7EB)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
            Done
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: 18, border: "1px solid var(--cm-line, #E5E7EB)", borderRadius: 14, textAlign: "center" }}>
      <FaTimesCircle size={56} color="#ef4444" style={{ margin: "8px auto" }} />
      <h3 style={{ margin: "8px 0 4px", fontWeight: 800 }}>Entry rejected</h3>
      <div style={{ fontSize: 13, color: "var(--cm-muted, #6B7280)", marginBottom: 14 }}>{result.message}</div>
      <button type="button" onClick={onAgain}
        style={{ padding: 12, borderRadius: 10, border: "none", background: "#007BFF", color: "#fff", fontWeight: 700, cursor: "pointer", width: "100%" }}>
        Try again
      </button>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
    <span style={{ color: "var(--cm-muted, #6B7280)" }}>{label}</span>
    <span style={{ fontWeight: 600 }}>{value || "-"}</span>
  </div>
);

export default QrScannerScreen;
