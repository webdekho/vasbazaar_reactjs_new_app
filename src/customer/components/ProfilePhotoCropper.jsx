import { useCallback, useEffect, useRef, useState } from "react";
import { FaCheck, FaCrop, FaTimes } from "react-icons/fa";

// Reusable 1:1 circular cropper for profile photos.
// Props:
//   open       — boolean, controls visibility
//   imageSrc   — source image (data: URL or blob URL)
//   onCancel() — user dismissed without saving
//   onConfirm({ dataUrl, blob, file }) — called with the cropped 400x400 JPEG.
//                The caller handles upload + persistence.
const ProfilePhotoCropper = ({ open, imageSrc, onCancel, onConfirm }) => {
  const [pos, setPos] = useState({ x: 0, y: 0, scale: 1 });
  const [working, setWorking] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (open) setPos({ x: 0, y: 0, scale: 1 });
  }, [open, imageSrc]);

  const handleConfirm = useCallback(() => {
    if (!imageSrc || working) return;
    setWorking(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.arc(200, 200, 200, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const sx = (img.width - size) / 2 + (pos.x * size / 200);
      const sy = (img.height - size) / 2 + (pos.y * size / 200);
      const sSize = size / pos.scale;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 400, 400);
      canvas.toBlob((blob) => {
        if (!blob) { setWorking(false); return; }
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const file = new File([blob], `profile_${Date.now()}.jpg`, { type: "image/jpeg" });
        setWorking(false);
        onConfirm?.({ dataUrl, blob, file });
      }, "image/jpeg", 0.9);
    };
    img.onerror = () => setWorking(false);
    img.src = imageSrc;
  }, [imageSrc, onConfirm, pos, working]);

  if (!open) return null;

  return (
    <div className="pf-crop-overlay">
      <div className="pf-crop-modal">
        <div className="pf-crop-header">
          <h3><FaCrop /> Crop Photo</h3>
          <button type="button" className="pf-crop-close" onClick={onCancel} aria-label="Close"><FaTimes /></button>
        </div>
        <div className="pf-crop-preview">
          <div className="pf-crop-circle">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="pf-crop-img"
              style={{ transform: `scale(${pos.scale}) translate(${pos.x}px, ${pos.y}px)` }}
              draggable={false}
            />
          </div>
          <p className="pf-crop-hint">Use slider to zoom</p>
        </div>
        <div className="pf-crop-controls">
          <span className="pf-crop-zoom-label">Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={pos.scale}
            onChange={(e) => setPos((p) => ({ ...p, scale: parseFloat(e.target.value) }))}
            className="pf-crop-slider"
          />
        </div>
        <div className="pf-crop-actions">
          <button type="button" className="pf-crop-cancel" onClick={onCancel} disabled={working}>Cancel</button>
          <button type="button" className="pf-crop-confirm" onClick={handleConfirm} disabled={working}>
            <FaCheck /> {working ? "Processing..." : "Use Photo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePhotoCropper;
