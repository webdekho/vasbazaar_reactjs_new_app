export const qrStickerBenefits = [
  {
    key: "recharge",
    title: "Instant Recharge",
    description: "Quick mobile & DTH recharge",
    gradient: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
  },
  {
    key: "bills",
    title: "Bill Payments",
    description: "Electricity, water & utility bills",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
  },
  {
    key: "rewards",
    title: "Earn Rewards",
    description: "Rewards on every transaction",
    gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
  },
  {
    key: "support",
    title: "24/7 Support",
    description: "Round-the-clock assistance",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
  },
];

export const getQrStickerLink = (mobile) => `https://web.vasbazaar.com?code=${mobile || ""}`;

export const getQrStickerUrl = (mobile, size = 360) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getQrStickerLink(mobile))}`;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getBenefitIconSvg = (key) => {
  const common = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

  if (key === "recharge") {
    return `<svg ${common}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>`;
  }

  if (key === "bills") {
    return `<svg ${common}><path d="M8 3h8l4 4v14H8z"/><path d="M16 3v5h5"/><path d="M11 13h6"/><path d="M11 17h6"/></svg>`;
  }

  if (key === "rewards") {
    return `<svg ${common}><path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 20V7"/><path d="M12 7H8.5a2.5 2.5 0 1 1 0-5c3 0 3.5 5 3.5 5Z"/><path d="M12 7h3.5a2.5 2.5 0 1 0 0-5c-3 0-3.5 5-3.5 5Z"/></svg>`;
  }

  if (key === "support") {
    return `<svg ${common}><path d="M4 12a8 8 0 0 1 16 0"/><path d="M4 12v4a2 2 0 0 0 2 2h2v-6H6a2 2 0 0 0-2 2Z"/><path d="M20 12v4a2 2 0 0 1-2 2h-2v-6h2a2 2 0 0 1 2 2Z"/><path d="M12 18v2"/><path d="M10 22h4"/></svg>`;
  }

  return "";
};

/** Convert inline SVG to a base64 data URI for html2canvas compatibility */
const getBenefitIconDataUri = (key) => {
  const svg = getBenefitIconSvg(key);
  if (!svg) return "";
  const colored = svg.replace('stroke="currentColor"', 'stroke="white"');
  return `data:image/svg+xml;base64,${btoa(colored)}`;
};

export const buildQrStickerWindowHtml = ({ qrImg, mobile, returnUrl = '/' }) => {
  const benefitMarkup = qrStickerBenefits
    .map(
      (benefit) => `
        <div class="vb-benefit-card">
          <div class="vb-benefit-icon" style="background: ${benefit.gradient}">
            <img class="vb-benefit-icon-img" src="${getBenefitIconDataUri(benefit.key)}" alt="" />
          </div>
          <div class="vb-benefit-title">${escapeHtml(benefit.title)}</div>
          <div class="vb-benefit-description">${escapeHtml(benefit.description)}</div>
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
          margin: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #ffffff;
          font-family: Inter, Arial, sans-serif;
          color: #0f172a;
        }
        .vb-sticker {
          position: relative;
          width: 4in;
          min-height: 6in;
          padding: 0.28in;
          border-radius: 24px;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border: 1px solid rgba(14, 165, 233, 0.14);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .vb-orb-one,
        .vb-orb-two,
        .vb-orb-three {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
        }
        .vb-orb-one {
          top: -60px;
          right: -40px;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.14) 0%, rgba(59, 130, 246, 0) 65%);
          filter: blur(20px);
        }
        .vb-orb-two {
          bottom: 120px;
          left: -50px;
          width: 160px;
          height: 160px;
          background: radial-gradient(circle, rgba(45, 212, 191, 0.14) 0%, rgba(45, 212, 191, 0) 65%);
          filter: blur(18px);
        }
        .vb-orb-three {
          top: 40%;
          right: -30px;
          width: 120px;
          height: 120px;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, rgba(14, 165, 233, 0) 65%);
          filter: blur(14px);
        }
        .vb-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          height: 100%;
        }
        .vb-close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.08);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s;
        }
        .vb-close-btn:hover {
          background: rgba(15, 23, 42, 0.15);
        }
        .vb-close-btn svg {
          width: 18px;
          height: 18px;
          stroke: #475569;
          stroke-width: 2.5;
        }
        .vb-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .vb-logo {
          width: 180px;
          height: auto;
          display: block;
        }
        .vb-logo-text {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }
        .vb-title {
          margin: 0;
          font-size: 26px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
        }
        .vb-description {
          margin: 6px 0 0;
          font-size: 12px;
          line-height: 1.5;
          color: #475569;
          letter-spacing: 0.01em;
        }
        .vb-qr-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 20px;
          background: linear-gradient(180deg, #f8fbff 0%, #edf7ff 100%);
          border: 1px solid rgba(14, 165, 233, 0.12);
          box-shadow: 0 12px 28px rgba(14, 165, 233, 0.08);
        }
        .vb-qr-frame {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .vb-qr-corner {
          position: absolute;
          width: 22px;
          height: 22px;
          pointer-events: none;
        }
        .vb-qr-corner--tl {
          top: -1px;
          left: -1px;
          border-top: 3px solid #6366f1;
          border-left: 3px solid #6366f1;
          border-top-left-radius: 16px;
        }
        .vb-qr-corner--tr {
          top: -1px;
          right: -1px;
          border-top: 3px solid #6366f1;
          border-right: 3px solid #6366f1;
          border-top-right-radius: 16px;
        }
        .vb-qr-corner--bl {
          bottom: -1px;
          left: -1px;
          border-bottom: 3px solid #6366f1;
          border-left: 3px solid #6366f1;
          border-bottom-left-radius: 16px;
        }
        .vb-qr-corner--br {
          bottom: -1px;
          right: -1px;
          border-bottom: 3px solid #6366f1;
          border-right: 3px solid #6366f1;
          border-bottom-right-radius: 16px;
        }
        .vb-qr-image {
          width: 100%;
          max-width: 210px;
          aspect-ratio: 1 / 1;
          object-fit: contain;
          border-radius: 10px;
          background: #ffffff;
        }
        .vb-scan {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          border-radius: 999px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
        }
        .vb-scan-pulse {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
          display: inline-block;
        }
        .vb-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(14, 165, 233, 0.22) 50%, transparent 100%);
          border: none;
          margin: 2px 0;
        }
        .vb-benefits {
          margin-top: auto;
          padding: 14px;
          border-radius: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border: 1px solid rgba(14, 165, 233, 0.12);
        }
        .vb-benefits-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .vb-benefits-accent {
          width: 3px;
          height: 18px;
          border-radius: 4px;
          background: linear-gradient(180deg, #6366f1 0%, #0ea5e9 100%);
        }
        .vb-benefits-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }
        .vb-benefits-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .vb-benefit-card {
          padding: 10px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid rgba(14, 165, 233, 0.08);
          min-height: 90px;
        }
        .vb-benefit-icon {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
        .vb-benefit-icon svg {
          display: block;
        }
        .vb-benefit-icon-img {
          width: 18px;
          height: 18px;
          display: block;
        }
        .vb-benefit-title {
          margin-top: 8px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.3;
          color: #0f172a;
        }
        .vb-benefit-description {
          margin-top: 3px;
          font-size: 9px;
          line-height: 1.45;
          color: #64748b;
        }
        .vb-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding-top: 2px;
        }
        .vb-footer-text {
          margin: 0;
          font-size: 8px;
          font-weight: 600;
          color: #475569;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .vb-footer-dot {
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: #6366f1;
          display: inline-block;
        }
        .vb-btn-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .vb-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 160px;
          border: none;
          border-radius: 999px;
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .vb-btn--download {
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.22);
        }
        .vb-btn--share {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #ffffff;
          box-shadow: 0 16px 28px rgba(99, 102, 241, 0.3);
        }
        .vb-btn svg { width: 14px; height: 14px; }
        @media print {
          body { background: #ffffff; padding: 0; }
          .vb-sticker { box-shadow: none; }
          .vb-btn-row { display: none; }
          .vb-close-btn { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="vb-sticker">
        <div class="vb-orb-one"></div>
        <div class="vb-orb-two"></div>
        <div class="vb-orb-three"></div>
        <div class="vb-content">
          <button class="vb-close-btn" id="vb-close-btn" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="vb-header">
            <img class="vb-logo" src="https://web.vasbazaar.com/images/vasbazaar-light.png" alt="VasBazaar" crossorigin="anonymous" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';" />
            <span class="vb-logo-text" style="display:none;">VasBazaar</span>
          </div>
          <div>
            <h1 class="vb-title">Scan & Discover</h1>
            <p class="vb-description">Your gateway to instant recharges, bill payments & rewards.</p>
          </div>
          <div class="vb-qr-shell">
            <div class="vb-qr-frame">
              <div class="vb-qr-corner vb-qr-corner--tl"></div>
              <div class="vb-qr-corner vb-qr-corner--tr"></div>
              <div class="vb-qr-corner vb-qr-corner--bl"></div>
              <div class="vb-qr-corner vb-qr-corner--br"></div>
              <img class="vb-qr-image" src="${escapeHtml(qrImg)}" alt="QR Code" crossorigin="anonymous" />
            </div>
            <div class="vb-scan"><span class="vb-scan-pulse"></span> Scan to get started</div>
          </div>
          <div class="vb-divider"></div>
          <div class="vb-benefits">
            <div class="vb-benefits-header">
              <div class="vb-benefits-accent"></div>
              <div class="vb-benefits-title">Why VasBazaar?</div>
            </div>
            <div class="vb-benefits-grid">${benefitMarkup}</div>
          </div>
          <div class="vb-footer">
            <span class="vb-footer-text">www.vasbazaar.com</span>
            <span class="vb-footer-dot"></span>
            <span class="vb-footer-text">Powered by VasBazaar</span>
          </div>
        </div>
      </div>
      <div class="vb-btn-row">
        <button class="vb-btn vb-btn--download" id="vb-download-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
        <button class="vb-btn vb-btn--share" id="vb-share-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js">${"</"}script>
      <script>
        var stickerEl = document.querySelector('.vb-sticker');
        var mobile = '${escapeHtml(mobile || "")}';
        var returnUrl = '${escapeHtml(returnUrl)}';

        // Close button handler - works for popup windows and Capacitor apps
        document.getElementById('vb-close-btn').addEventListener('click', function() {
          // Try window.close() first (for popup windows)
          try {
            if (window.opener) {
              window.close();
              return;
            }
          } catch(e) {}

          // Navigate to root - this will reload the app correctly
          // The app's routing will handle showing the correct page
          window.location.href = '/';
        });

        /* Convert all external images to base64 data URIs so html2canvas can render them */
        function convertImagesToBase64() {
          var imgs = stickerEl.querySelectorAll('img');
          var promises = [];
          imgs.forEach(function(img) {
            if (img.src && img.src.startsWith('http') && img.complete && img.naturalWidth > 0) {
              promises.push(new Promise(function(resolve) {
                try {
                  var c = document.createElement('canvas');
                  c.width = img.naturalWidth;
                  c.height = img.naturalHeight;
                  var cx = c.getContext('2d');
                  cx.drawImage(img, 0, 0);
                  img.src = c.toDataURL('image/png');
                } catch(e) { /* CORS blocked, try fetch */ }
                resolve();
              }));
            } else if (img.src && img.src.startsWith('http') && !img.complete) {
              promises.push(new Promise(function(resolve) {
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                  try {
                    var c = document.createElement('canvas');
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    var cx = c.getContext('2d');
                    cx.drawImage(img, 0, 0);
                    img.src = c.toDataURL('image/png');
                  } catch(e) {}
                  resolve();
                };
                img.onerror = resolve;
              }));
            }
          });
          return Promise.all(promises);
        }

        function captureSticker() {
          return convertImagesToBase64().then(function() {
            return html2canvas(stickerEl, { scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#f8fbff' });
          });
        }

        document.getElementById('vb-download-btn').addEventListener('click', function() {
          var fileName = 'vasbazaar-qr-' + (mobile || 'code') + '.png';
          var qrImageUrl = document.querySelector('.vb-qr-image').src;

          // Fetch the QR image and convert to blob for sharing/download
          fetch(qrImageUrl)
            .then(function(response) { return response.blob(); })
            .then(function(blob) {
              var file = new File([blob], fileName, { type: 'image/png' });

              // Check if we can share files (mobile/Capacitor)
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                  title: 'VasBazaar QR Code',
                  text: 'Save this QR code image',
                  files: [file]
                }).catch(function() {});
                return;
              }

              // Fallback: Create blob URL and download (for web browsers)
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            })
            .catch(function(err) {
              // If fetch fails, open the QR image directly
              window.open(qrImageUrl, '_blank');
            });
        });

        document.getElementById('vb-share-btn').addEventListener('click', function() {
          var shareUrl = 'https://app.vasbazaar.com/?code=' + mobile;
          var shareText = 'Scan this QR code to get started with VasBazaar!\\n' + shareUrl;

          captureSticker().then(function(canvas) {
            canvas.toBlob(function(blob) {
              var file = new File([blob], 'vasbazaar-qr-' + (mobile || 'code') + '.png', { type: 'image/png' });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({ title: 'VasBazaar QR Code', text: shareText, files: [file] });
              } else if (navigator.share) {
                navigator.share({ title: 'VasBazaar QR Code', text: shareText });
              } else {
                window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank');
              }
            }, 'image/png');
          });
        });
      ${"</"}script>
    </body>
  </html>`;
};

export const openQrStickerWindow = (mobile, size = 360) => {
  const qrImg = getQrStickerUrl(mobile, size);
  const returnUrl = window.location.href;

  // Check if running in Capacitor
  const isCapacitor = window.Capacitor?.isNativePlatform?.() || false;

  if (isCapacitor) {
    // For Capacitor, navigate in same window (no popup)
    const html = buildQrStickerWindowHtml({ qrImg, mobile, returnUrl: '/' });
    document.open();
    document.write(html);
    document.close();
    return;
  }

  // For web browsers, use popup window
  const qrWin = window.open("", "_blank", "width=420,height=600");

  if (!qrWin) {
    // If popup blocked, just open the QR image directly
    window.open(qrImg, "_blank");
    return;
  }

  qrWin.document.write(buildQrStickerWindowHtml({ qrImg, mobile, returnUrl }));
  qrWin.document.close();
};

const drawWrappedText = ({ ctx, text, x, y, maxWidth, lineHeight }) => {
  const words = String(text || "").split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i += 1) {
    const nextLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
};

const drawRoundedRect = (ctx, x, y, w, h, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const chip = (ctx, x, y, w, h, radius, fill, stroke) => {
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};

const drawBenefitIcon = (ctx, key, x, y) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (key === "recharge") {
    ctx.beginPath();
    ctx.moveTo(6, 2);
    ctx.lineTo(-2, 14);
    ctx.lineTo(5, 14);
    ctx.lineTo(1, 28);
    ctx.lineTo(14, 12);
    ctx.lineTo(7, 12);
    ctx.lineTo(12, 2);
    ctx.stroke();
  } else if (key === "bills") {
    ctx.beginPath();
    ctx.rect(2, 2, 22, 28);
    ctx.moveTo(16, 2);
    ctx.lineTo(24, 10);
    ctx.lineTo(16, 10);
    ctx.lineTo(16, 2);
    ctx.moveTo(7, 16);
    ctx.lineTo(19, 16);
    ctx.moveTo(7, 22);
    ctx.lineTo(19, 22);
    ctx.stroke();
  } else if (key === "rewards") {
    ctx.beginPath();
    ctx.rect(3, 12, 22, 16);
    ctx.moveTo(14, 12);
    ctx.lineTo(14, 28);
    ctx.moveTo(3, 12);
    ctx.lineTo(25, 12);
    ctx.moveTo(3, 8);
    ctx.lineTo(25, 8);
    ctx.moveTo(9, 8);
    ctx.bezierCurveTo(3, 8, 4, 1, 10, 3);
    ctx.moveTo(19, 8);
    ctx.bezierCurveTo(25, 8, 24, 1, 18, 3);
    ctx.stroke();
  } else if (key === "support") {
    ctx.beginPath();
    ctx.arc(14, 13, 10, Math.PI, 0);
    ctx.moveTo(4, 14);
    ctx.lineTo(4, 22);
    ctx.lineTo(9, 22);
    ctx.lineTo(9, 14);
    ctx.moveTo(24, 14);
    ctx.lineTo(24, 22);
    ctx.lineTo(19, 22);
    ctx.lineTo(19, 14);
    ctx.moveTo(14, 24);
    ctx.lineTo(14, 28);
    ctx.moveTo(10, 30);
    ctx.lineTo(18, 30);
    ctx.stroke();
  }

  ctx.restore();
};

export const drawQrStickerCanvas = ({ ctx, width, height, logoImg, qrImg }) => {
  const bgGrad = ctx.createLinearGradient(0, 0, width * 0.6, height);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(1, "#f8fbff");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Mesh orbs
  const drawOrb = (x, y, radius, innerColor) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  drawOrb(width - 80, 80, 200, "rgba(59, 130, 246, 0.14)");
  drawOrb(80, height - 300, 180, "rgba(45, 212, 191, 0.14)");
  drawOrb(width - 60, height * 0.4, 140, "rgba(14, 165, 233, 0.1)");

  // Logo
  if (logoImg) {
    const logoHeight = 98;
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    ctx.drawImage(logoImg, (width - logoWidth) / 2, 58, logoWidth, logoHeight);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 64px Arial";
  ctx.fillText("Scan & Discover", width / 2, 220);

  ctx.fillStyle = "#475569";
  ctx.font = "26px Arial";
  ctx.fillText("Your gateway to instant recharges,", width / 2, 278);
  ctx.fillText("bill payments & rewards.", width / 2, 312);

  chip(ctx, 70, 360, width - 140, 540, 40, "rgba(248,251,255,0.98)", "rgba(14,165,233,0.12)");

  chip(ctx, 108, 400, width - 216, 380, 32, "#ffffff");

  const cornerSize = 40;
  const cornerThickness = 5;
  const fx = 108;
  const fy = 400;
  const fw = width - 216;
  const fh = 380;
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = cornerThickness;
  ctx.lineCap = "round";

  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(fx, fy + cornerSize);
  ctx.lineTo(fx, fy + 16);
  ctx.quadraticCurveTo(fx, fy, fx + 16, fy);
  ctx.lineTo(fx + cornerSize, fy);
  ctx.stroke();

  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(fx + fw - cornerSize, fy);
  ctx.lineTo(fx + fw - 16, fy);
  ctx.quadraticCurveTo(fx + fw, fy, fx + fw, fy + 16);
  ctx.lineTo(fx + fw, fy + cornerSize);
  ctx.stroke();

  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(fx, fy + fh - cornerSize);
  ctx.lineTo(fx, fy + fh - 16);
  ctx.quadraticCurveTo(fx, fy + fh, fx + 16, fy + fh);
  ctx.lineTo(fx + cornerSize, fy + fh);
  ctx.stroke();

  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(fx + fw - cornerSize, fy + fh);
  ctx.lineTo(fx + fw - 16, fy + fh);
  ctx.quadraticCurveTo(fx + fw, fy + fh, fx + fw, fy + fh - 16);
  ctx.lineTo(fx + fw, fy + fh - cornerSize);
  ctx.stroke();

  if (qrImg) {
    const qrSize = Math.min(fw - 80, fh - 80);
    const qrX = fx + (fw - qrSize) / 2;
    const qrY = fy + (fh - qrSize) / 2;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  const badgeW = 380;
  const badgeH = 52;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 816;
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  badgeGrad.addColorStop(0, "#6366f1");
  badgeGrad.addColorStop(1, "#8b5cf6");
  chip(ctx, badgeX, badgeY, badgeW, badgeH, 26, badgeGrad);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(badgeX + 30, badgeY + badgeH / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SCAN TO GET STARTED", width / 2 + 10, badgeY + 34);

  const divGrad = ctx.createLinearGradient(70, 0, width - 70, 0);
  divGrad.addColorStop(0, "rgba(99, 102, 241, 0)");
  divGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.3)");
  divGrad.addColorStop(1, "rgba(99, 102, 241, 0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(70, 900, width - 140, 2);

  chip(ctx, 70, 922, width - 140, 620, 36, "#ffffff", "rgba(14,165,233,0.12)");

  const accentGrad = ctx.createLinearGradient(100, 958, 100, 994);
  accentGrad.addColorStop(0, "#6366f1");
  accentGrad.addColorStop(1, "#0ea5e9");
  chip(ctx, 100, 958, 6, 36, 3, accentGrad);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Why VasBazaar?", 120, 988);

  const cardWidth = 410;
  const cardHeight = 170;
  const startX = 100;
  const startY = 1030;
  const gap = 16;

  const gradients = [
    ["#f97316", "#fb923c"],
    ["#8b5cf6", "#a78bfa"],
    ["#10b981", "#34d399"],
    ["#0ea5e9", "#38bdf8"],
  ];

  qrStickerBenefits.forEach((benefit, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const cardX = startX + col * (cardWidth + gap);
    const cardY = startY + row * (cardHeight + gap);

    chip(ctx, cardX, cardY, cardWidth, cardHeight, 28, "#ffffff", "rgba(14,165,233,0.08)");

    const iconGrad = ctx.createLinearGradient(cardX + 18, cardY + 18, cardX + 78, cardY + 78);
    iconGrad.addColorStop(0, gradients[index][0]);
    iconGrad.addColorStop(1, gradients[index][1]);
    chip(ctx, cardX + 18, cardY + 18, 52, 52, 16, iconGrad);
    drawBenefitIcon(ctx, benefit.key, cardX + 28, cardY + 28);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 22px Arial";
    ctx.fillText(benefit.title, cardX + 18, cardY + 102);

    ctx.fillStyle = "#64748b";
    ctx.font = "18px Arial";
    drawWrappedText({
      ctx,
      text: benefit.description,
      x: cardX + 18,
      y: cardY + 128,
      maxWidth: cardWidth - 36,
      lineHeight: 24,
    });
  });

  ctx.fillStyle = "#475569";
  ctx.font = "600 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("www.vasbazaar.com", width / 2 - 60, height - 40);

  // Footer dot
  ctx.fillStyle = "#6366f1";
  ctx.beginPath();
  ctx.arc(width / 2, height - 44, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#475569";
  ctx.fillText("Powered by VasBazaar", width / 2 + 70, height - 40);
};
