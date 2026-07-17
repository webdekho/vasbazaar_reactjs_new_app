import { useEffect, useRef, useState } from "react";

/**
 * Draw-your-signature canvas. Reports a PNG Blob to the parent, which uploads
 * it — this component never touches the network.
 *
 * Pointer Events cover finger, stylus and mouse in one path, so there is no
 * separate touch handler to drift out of sync.
 */
const SignaturePad = ({ onChange, disabled = false, height = 160 }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Size the backing store to the device pixel ratio, or strokes render soft on
  // phones. Done after mount because the canvas has no width until it lays out.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, [height]);

  const pointFrom = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    // Keep receiving moves even if the finger slides off the canvas.
    canvasRef.current.setPointerCapture?.(e.pointerId);
    const { x, y } = pointFrom(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const { x, y } = pointFrom(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setHasInk(true);
    }
  };

  const end = (e) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
    emit();
  };

  const emit = () => {
    if (!dirtyRef.current) { onChange?.(null); return; }
    canvasRef.current.toBlob((blob) => onChange?.(blob), "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    dirtyRef.current = false;
    setHasInk(false);
    onChange?.(null);
  };

  return (
    <div className="mkt-sign-wrap">
      <canvas
        ref={canvasRef}
        className="mkt-sign-canvas"
        style={{ height, opacity: disabled ? 0.5 : 1, touchAction: "none" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
      <div className="mkt-sign-foot">
        <span className="mkt-sign-hint">
          {hasInk ? "Signed" : "Draw your signature above"}
        </span>
        <button type="button" className="mkt-sign-clear" onClick={clear} disabled={disabled || !hasInk}>
          Clear
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
