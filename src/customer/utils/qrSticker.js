export const qrStickerBenefits = [
  { key: "recharge", title: "Instant Recharge", symbol: "⚡" },
  { key: "bills", title: "Bill Payments", symbol: "\u{1F4B3}" },
  { key: "rewards", title: "Cashback Rewards", symbol: "\u{1F381}" },
  { key: "support", title: "24×7 Support", symbol: "\u{1F4DE}" },
];

export const getQrStickerLink = (mobile) => `https://web.vasbazaar.com/?code=${mobile || ""}`;

export const getQrStickerUrl = (mobile, size = 720) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=H&margin=0&data=${encodeURIComponent(getQrStickerLink(mobile))}`;

export const getQrStickerFileName = (mobile) => `vasbazaar-qr-${mobile || "code"}.png`;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Failed to create QR sticker image."));
    }, "image/png");
  });

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Build a simple HTML view that mirrors the admin QrStickerCard. Used by the
// "open in new tab" flow and by the in-Capacitor full-window override.
export const buildQrStickerWindowHtml = ({ qrImg, mobile }) => {
  const benefitMarkup = qrStickerBenefits
    .map(
      (b) => `
        <div class="vb-benefit">
          <span class="vb-benefit-symbol">${escapeHtml(b.symbol)}</span>
          <p class="vb-benefit-label">${escapeHtml(b.title)}</p>
        </div>
      `
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>VasBazaar QR Sticker</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0; min-height: 100vh; padding: 24px;
          background: #f8fafc;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .vb-card {
          position: relative; width: 4in; min-height: 6in;
          padding: 0.34in 0.32in 0.28in;
          border-radius: 20px; overflow: hidden;
          background: #ffffff; border: 1px solid #e2e8f0;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
          color: #0f172a;
        }
        .vb-accent { position: absolute; top: 0; left: 0; right: 0; height: 6px;
          background: linear-gradient(90deg, #14B8A6 0%, #0EA5E9 50%, #14B8A6 100%); }
        .vb-content { position: relative; display: flex; flex-direction: column; gap: 14px; }
        .vb-brand { text-align: center; padding-top: 2px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
        .vb-brand-vas { color: #14B8A6; }
        .vb-brand-bazaar { color: #0f172a; }
        .vb-heading { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; margin-top: 2px; }
        .vb-eyebrow { margin: 0; font-size: 10px; font-weight: 700; color: #14B8A6;
          letter-spacing: 0.28em; text-transform: uppercase; }
        .vb-title { margin: 0; font-size: 32px; line-height: 1.05; font-weight: 900;
          letter-spacing: -0.035em; color: #0f172a; }
        .vb-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: #475569; max-width: 300px; }
        .vb-qr-frame { position: relative; align-self: center; padding: 14px; border-radius: 18px;
          background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); margin-top: 4px; }
        .vb-corner { position: absolute; width: 18px; height: 18px; pointer-events: none; }
        .vb-corner.tl { top: -1px; left: -1px; border-top: 3px solid #14B8A6; border-left: 3px solid #14B8A6; border-top-left-radius: 14px; }
        .vb-corner.tr { top: -1px; right: -1px; border-top: 3px solid #14B8A6; border-right: 3px solid #14B8A6; border-top-right-radius: 14px; }
        .vb-corner.bl { bottom: -1px; left: -1px; border-bottom: 3px solid #14B8A6; border-left: 3px solid #14B8A6; border-bottom-left-radius: 14px; }
        .vb-corner.br { bottom: -1px; right: -1px; border-bottom: 3px solid #14B8A6; border-right: 3px solid #14B8A6; border-bottom-right-radius: 14px; }
        .vb-qr { display: block; width: 210px; height: 210px; object-fit: contain; background: #ffffff; }
        .vb-benefits { margin-top: 4px; }
        .vb-divider { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; }
        .vb-divider-line { flex: 1; height: 1px; background: #e2e8f0; }
        .vb-divider-text { margin: 0; font-size: 9.5px; font-weight: 700; color: #475569; letter-spacing: 0.24em; text-transform: uppercase; }
        .vb-benefits-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 10px; row-gap: 8px; }
        .vb-benefit { display: flex; align-items: center; gap: 8px; }
        .vb-benefit-symbol { width: 22px; height: 22px; flex: 0 0 22px; display: inline-flex;
          align-items: center; justify-content: center; font-size: 13px; line-height: 1; }
        .vb-benefit-label { margin: 0; font-size: 11px; font-weight: 600; color: #0f172a; }
        @media print { body { background: #ffffff; padding: 0; } .vb-card { box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="vb-card">
        <div class="vb-accent"></div>
        <div class="vb-content">
          <div class="vb-brand">
            <span class="vb-brand-vas">Vas</span><span class="vb-brand-bazaar">Bazaar</span>
          </div>
          <div class="vb-heading">
            <p class="vb-eyebrow">Scan • Pay • Save</p>
            <h1 class="vb-title">Scan and Get Rewards</h1>
            <p class="vb-desc">Recharge, pay bills and earn cashback — all from a single scan.</p>
          </div>
          <div class="vb-qr-frame">
            <div class="vb-corner tl"></div>
            <div class="vb-corner tr"></div>
            <div class="vb-corner bl"></div>
            <div class="vb-corner br"></div>
            <img class="vb-qr" src="${escapeHtml(qrImg)}" alt="QR Code" crossorigin="anonymous" />
          </div>
          <div class="vb-benefits">
            <div class="vb-divider">
              <span class="vb-divider-line"></span>
              <p class="vb-divider-text">Why VasBazaar</p>
              <span class="vb-divider-line"></span>
            </div>
            <div class="vb-benefits-grid">${benefitMarkup}</div>
          </div>
        </div>
      </div>
    </body>
  </html>`;
};

export const openQrStickerWindow = (mobile, size = 720) => {
  const qrImg = getQrStickerUrl(mobile, size);
  const isCapacitor = window.Capacitor?.isNativePlatform?.() || false;

  if (isCapacitor) {
    const html = buildQrStickerWindowHtml({ qrImg, mobile });
    document.open();
    document.write(html);
    document.close();
    return;
  }

  const qrWin = window.open("", "_blank", "width=420,height=600");
  if (!qrWin) {
    window.open(qrImg, "_blank");
    return;
  }
  qrWin.document.write(buildQrStickerWindowHtml({ qrImg, mobile }));
  qrWin.document.close();
};

const drawRoundedRect = (ctx, x, y, w, h, radius) => {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

// Render the same visual design as admin's QrStickerCard.tsx. The card is
// 4in x 6in; we render at 240dpi (960 x 1440) so it stays crisp when shared
// or printed as a sticker.
export const drawQrStickerCanvas = ({ ctx, width, height, qrImg }) => {
  const BRAND_TEAL = "#14B8A6";
  const SKY = "#0EA5E9";
  const INK = "#0f172a";
  const SUB_INK = "#475569";
  const HAIRLINE = "#e2e8f0";
  const FONT_STACK = "Inter, Arial, sans-serif";

  // Convert admin CSS px to canvas px. Admin uses 96dpi-ish sizing; canvas
  // is 240dpi, so multiply by 2.5.
  const S = width / 384; // 4in * 96 = 384

  // Background card
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Hairline border around the whole card
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = Math.max(1, S);
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Top accent bar
  const accentH = 6 * S;
  const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
  accentGrad.addColorStop(0, BRAND_TEAL);
  accentGrad.addColorStop(0.5, SKY);
  accentGrad.addColorStop(1, BRAND_TEAL);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, width, accentH);

  const padTop = 0.34 * 96 * S;
  const padSide = 0.32 * 96 * S;
  const cx = width / 2;

  let y = padTop + 4 * S; // brand row sits a little below the accent

  // Brand row "VasBazaar"
  ctx.font = `800 ${24 * S}px ${FONT_STACK}`;
  ctx.textBaseline = "alphabetic";
  const vasText = "Vas";
  const bazaarText = "Bazaar";
  const vasW = ctx.measureText(vasText).width;
  const bazaarW = ctx.measureText(bazaarText).width;
  const brandStartX = (width - (vasW + bazaarW)) / 2;
  const brandBaseline = y + 24 * S;
  ctx.textAlign = "left";
  ctx.fillStyle = BRAND_TEAL;
  ctx.fillText(vasText, brandStartX, brandBaseline);
  ctx.fillStyle = INK;
  ctx.fillText(bazaarText, brandStartX + vasW, brandBaseline);
  y = brandBaseline + 14 * S;

  // Eyebrow "SCAN • PAY • SAVE" — letter-spacing approximated by adding spaces
  ctx.font = `700 ${10 * S}px ${FONT_STACK}`;
  ctx.fillStyle = BRAND_TEAL;
  ctx.textAlign = "center";
  ctx.fillText("S C A N   •   P A Y   •   S A V E", cx, y + 10 * S);
  y += 10 * S + 8 * S;

  // Title
  ctx.font = `900 ${32 * S}px ${FONT_STACK}`;
  ctx.fillStyle = INK;
  ctx.fillText("Scan and Get Rewards", cx, y + 32 * S);
  y += 32 * S * 1.05 + 6 * S;

  // Description (single line, fits inside padding)
  ctx.font = `${12 * S}px ${FONT_STACK}`;
  ctx.fillStyle = SUB_INK;
  ctx.fillText("Recharge, pay bills and earn cashback —", cx, y + 12 * S);
  y += 12 * S * 1.5;
  ctx.fillText("all from a single scan.", cx, y + 12 * S);
  y += 12 * S * 1.5 + 6 * S;

  // QR frame
  const framePad = 14 * S;
  const qrSize = 210 * S;
  const frameSize = qrSize + framePad * 2;
  const frameX = (width - frameSize) / 2;
  const frameY = y;
  const frameRadius = 18 * S;

  // Frame background + hairline
  drawRoundedRect(ctx, frameX, frameY, frameSize, frameSize, frameRadius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, S);
  ctx.strokeStyle = HAIRLINE;
  ctx.stroke();

  // QR image
  if (qrImg) {
    ctx.drawImage(qrImg, frameX + framePad, frameY + framePad, qrSize, qrSize);
  }

  // Corner brackets (admin uses 18px length, 3px thick, 14px corner radius)
  const cornerLen = 18 * S;
  const cornerArc = 14 * S;
  const cornerThick = 3 * S;
  ctx.strokeStyle = BRAND_TEAL;
  ctx.lineWidth = cornerThick;
  ctx.lineCap = "round";

  const drawCorner = (x0, y0, dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + dy * cornerLen);
    ctx.lineTo(x0, y0 + dy * cornerArc);
    ctx.quadraticCurveTo(x0, y0, x0 + dx * cornerArc, y0);
    ctx.lineTo(x0 + dx * cornerLen, y0);
    ctx.stroke();
  };
  drawCorner(frameX, frameY, 1, 1);
  drawCorner(frameX + frameSize, frameY, -1, 1);
  drawCorner(frameX, frameY + frameSize, 1, -1);
  drawCorner(frameX + frameSize, frameY + frameSize, -1, -1);

  y = frameY + frameSize + 14 * S;

  // Benefits divider: hairline ─── WHY VASBAZAAR ───
  ctx.font = `700 ${9.5 * S}px ${FONT_STACK}`;
  ctx.fillStyle = SUB_INK;
  ctx.textAlign = "center";
  const dividerText = "W H Y   V A S B A Z A A R";
  const dividerTextW = ctx.measureText(dividerText).width;
  const dividerY = y + 5 * S;
  const sidePad = 10 * S;
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padSide, dividerY);
  ctx.lineTo(cx - dividerTextW / 2 - sidePad, dividerY);
  ctx.moveTo(cx + dividerTextW / 2 + sidePad, dividerY);
  ctx.lineTo(width - padSide, dividerY);
  ctx.stroke();
  ctx.fillText(dividerText, cx, dividerY + 4 * S);
  y = dividerY + 14 * S;

  // Benefits grid (2 cols x 2 rows)
  const colGap = 10 * S;
  const rowGap = 10 * S;
  const colWidth = (width - padSide * 2 - colGap) / 2;
  const itemHeight = 24 * S;

  qrStickerBenefits.forEach((b, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const itemX = padSide + col * (colWidth + colGap);
    const itemY = y + row * (itemHeight + rowGap);

    // Symbol box
    ctx.font = `${15 * S}px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, ${FONT_STACK}`;
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.fillText(b.symbol, itemX, itemY + 16 * S);

    // Label
    ctx.font = `600 ${11 * S}px ${FONT_STACK}`;
    ctx.fillStyle = INK;
    ctx.fillText(b.title, itemX + 30 * S, itemY + 15 * S);
  });
};

export const createQrStickerCanvas = async ({ mobile, width = 960, height = 1440, qrSize = 720 } = {}) => {
  const qrImg = await loadImage(getQrStickerUrl(mobile, qrSize));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  drawQrStickerCanvas({ ctx, width, height, qrImg });

  return canvas;
};

export const generateQrStickerBlob = async (options = {}) => {
  const canvas = await createQrStickerCanvas(options);
  return canvasToBlob(canvas);
};
