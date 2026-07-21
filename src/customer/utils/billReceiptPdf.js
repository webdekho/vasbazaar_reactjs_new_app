// Hand-built PDF (no external lib) for a Bharat Connect bill payment receipt.
// NPCI requirements covered:
//   - Bharat Connect "B" mnemonic + Be-Assured logo on the receipt
//   - "B-Connect TXN ID" terminology (not "Ref ID" / "BBPS Transaction ID")
//   - CCF (Customer Convenience Fee) shown, kept within the 0-25 range
//   - Bill category, biller, consumer no, amount, date all displayed
// Logos are loaded at runtime from /public/images via canvas so no base64 blob
// needs to live in the bundle. Missing logos degrade gracefully (PDF still renders).

import { formatDisplayDateTime } from "../../utils/dateFormat";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_W = PAGE_WIDTH - MARGIN * 2;

const C = {
  ink: "0F172A",
  slate: "475569",
  muted: "94A3B8",
  line: "E2E8F0",
  brand: "0B5FBA",     // Bharat Connect blue
  green: "16A34A",
  cardBg: "F8FAFC",
  white: "FFFFFF",
};

// Be-Assured / Bharat Connect logo asset URLs (place the official approved
// SVG/PNG files in public/images with these names).
const BHARAT_CONNECT_LOGO_URL = "/images/bbps.svg";
const BE_ASSURED_LOGO_URL = "/images/b-assured.png";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapePdfText = (value = "") =>
  String(value).replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const safeFilePart = (value = "receipt") =>
  String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "receipt";
const textWidthApprox = (text, size) => String(text || "").length * size * 0.52;

// Clamp the CCF strictly into the NPCI-mandated 0-25 range.
export const normalizeCcf = (value) => {
  const n = Number(value || 0);
  if (Number.isNaN(n) || n < 0) return 0;
  return n > 25 ? 25 : n;
};

export const getBillReceiptFileName = (receipt) =>
  `bharat-connect-receipt-${safeFilePart(receipt?.bConnectTxnId || receipt?.txnId || "receipt")}.pdf`;

// Loads a logo URL into a JPEG base64 (via canvas) so it can be embedded in the
// hand-built PDF. Returns null on any failure so the PDF still renders without it.
const loadLogoJpeg = async (url) => {
  if (!url || typeof document === "undefined") return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const maxW = 240;
    const naturalW = img.naturalWidth || maxW;
    const naturalH = img.naturalHeight || maxW;
    const scale = Math.min(1, maxW / naturalW);
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const base64 = (canvas.toDataURL("image/jpeg", 0.9).split(",")[1]) || "";
    return base64 ? { base64, width: w, height: h } : null;
  } catch (e) {
    return null;
  }
};

/**
 * receipt = {
 *   bConnectTxnId, txnId, billerName, category, consumerNo,
 *   amount, ccf, status, paymentMode, dateTime
 * }
 */
export const generateBillReceiptPdfBlob = async (receipt = {}) => {
  const ops = [];
  const ccf = normalizeCcf(receipt.ccf);
  const amount = Number(receipt.amount || 0);
  const total = amount + ccf;

  const [bcLogo, baLogo] = await Promise.all([
    loadLogoJpeg(BHARAT_CONNECT_LOGO_URL),
    loadLogoJpeg(BE_ASSURED_LOGO_URL),
  ]);

  const rect = (x, y, w, h, color) => ops.push({ t: "rect", x, y, w, h, color });
  const image = (x, y, w, h, name) => ops.push({ t: "image", x, y, w, h, img: name });
  const hr = (y, color = C.line) => ops.push({ t: "rule", x1: MARGIN, y1: y, x2: PAGE_WIDTH - MARGIN, y2: y, color });
  const text = (str, x, size, opt = {}) => {
    let tx = x;
    if (opt.align === "right") tx = x - textWidthApprox(str, size);
    else if (opt.align === "center") tx = x - textWidthApprox(str, size) / 2;
    ops.push({ t: "text", text: str, x: tx, y: opt.y, size, bold: !!opt.bold, color: opt.color || C.ink });
  };

  // ---------- Header: title (left) + Be-Assured logo (right corner) ----------
  const headerTop = PAGE_HEIGHT - 30;
  text("BILL PAY RECEIPT", MARGIN, 22, { y: headerTop - 16, bold: true, color: C.ink });
  text("Transaction Successful !", MARGIN, 9.5, { y: headerTop - 32, color: C.green, bold: true });
  if (baLogo) {
    let w = 70;
    let h = (baLogo.height / baLogo.width) * w;
    const maxH = 56;
    if (h > maxH) { h = maxH; w = (baLogo.width / baLogo.height) * h; }
    image(PAGE_WIDTH - MARGIN - w, headerTop - h + 6, w, h, "ImBA");
  }
  const ruleY = headerTop - 48;
  rect(MARGIN, ruleY, CONTENT_W, 3, C.brand);

  // ---------- Success badge ----------
  let y = ruleY - 26;
  const status = String(receipt.status || "SUCCESS").toUpperCase();
  const badgeW = textWidthApprox(`PAYMENT ${status}`, 10) + 26;
  rect(MARGIN, y - 16, badgeW, 22, "ECFDF3");
  text(`PAYMENT ${status}`, MARGIN + 13, 10, { y: y - 10, bold: true, color: C.green });
  text(money(total), PAGE_WIDTH - MARGIN, 18, { y: y - 12, align: "right", bold: true, color: C.ink });
  y -= 44;

  // ---------- Details card ----------
  const rows = [
    ["B-Connect TXN ID", receipt.bConnectTxnId || "-"],
    ["Transaction ID", receipt.txnId || "-"],
    ["Biller Name", receipt.billerName || "-"],
    ["Category", receipt.category || "-"],
    ["Consumer No", receipt.consumerNo || "-"],
    ["Date & Time", formatDisplayDateTime(receipt.dateTime)],
    ["Payment Mode", receipt.paymentMode || "-"],
  ];
  const cardH = rows.length * 24 + 20;
  rect(MARGIN, y - cardH, CONTENT_W, cardH, C.cardBg);
  let ry = y - 22;
  rows.forEach(([label, value]) => {
    text(label, MARGIN + 16, 9.5, { y: ry, color: C.muted });
    text(String(value), PAGE_WIDTH - MARGIN - 16, 10, { y: ry, align: "right", bold: true, color: C.ink });
    ry -= 24;
  });
  y = y - cardH - 20;

  // ---------- Amount + CCF breakdown ----------
  hr(y); y -= 22;
  text("Bill Amount", MARGIN + 4, 10.5, { y, color: C.slate });
  text(money(amount), PAGE_WIDTH - MARGIN - 4, 10.5, { y, align: "right", color: C.ink });
  y -= 20;
  // CCF (Customer Convenience Fee) — NPCI requires it shown, within 0-25.
  text("CCF (Customer Convenience Fee)", MARGIN + 4, 10.5, { y, color: C.slate });
  text(`${money(ccf)}  (Submitted)`, PAGE_WIDTH - MARGIN - 4, 10.5, { y, align: "right", color: C.ink });
  y -= 24;
  rect(MARGIN, y - 22, CONTENT_W, 32, "EAF1FB");
  text("TOTAL PAID", MARGIN + 14, 12, { y: y - 8, bold: true, color: C.ink });
  text(money(total), PAGE_WIDTH - MARGIN - 14, 15, { y: y - 9, align: "right", bold: true, color: C.brand });
  y -= 54;

  // ---------- Assurance text (Be-Assured logo already in the header) ----------
  text("This transaction is protected under the Bharat Connect Be-Assured", MARGIN, 8.5, { y, color: C.slate });
  y -= 14;
  text("grievance & dispute resolution framework.", MARGIN, 8.5, { y, color: C.slate });
  y -= 20;

  hr(y); y -= 16;
  text("Generated from VasBazaar - powered by Bharat Connect (BBPS).", MARGIN, 8, { y, color: C.muted });

  return assemble(ops, { ImBC: bcLogo, ImBA: baLogo });
};

const assemble = (ops, images) => {
  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("__PAGES__");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const imageIds = {};
  Object.entries(images || {}).forEach(([name, img]) => {
    if (!img || !img.base64) return;
    const bin = typeof atob === "function" ? atob(img.base64) : Buffer.from(img.base64, "base64").toString("binary");
    imageIds[name] = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height}`
      + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\n`
      + `stream\n${bin}\nendstream`);
  });

  const hexToRgb = (hex) => {
    const h = hex || "000000";
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  };

  const content = ["q", "1 1 1 rg", `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`, "Q"];
  ops.forEach((op) => {
    if (op.t === "rule") {
      const [r, g, b] = hexToRgb(op.color);
      content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG 0.7 w ${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S`);
    } else if (op.t === "rect") {
      const [r, g, b] = hexToRgb(op.color);
      content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${op.x} ${op.y} ${op.w} ${op.h} re f`);
    } else if (op.t === "image" && imageIds[op.img]) {
      content.push(`q ${op.w} 0 0 ${op.h} ${op.x} ${op.y} cm /${op.img} Do Q`);
    } else if (op.t === "text") {
      const [r, g, b] = hexToRgb(op.color);
      content.push("BT");
      content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      content.push(`/${op.bold ? "F2" : "F1"} ${op.size} Tf`);
      content.push(`${op.x} ${op.y} Td`);
      content.push(`(${escapePdfText(op.text)}) Tj`);
      content.push("ET");
    }
  });

  const stream = content.join("\n");
  const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const xobjRes = Object.entries(imageIds).map(([name, id]) => `/${name} ${id} 0 R`).join(" ");
  const pageId = addObject(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`
    + ` /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`
    + (xobjRes ? ` /XObject << ${xobjRes} >>` : "")
    + ` >> /Contents ${contentId} 0 R >>`);

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
};
