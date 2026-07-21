// Hand-built PDF (no external lib) for ReBill invoices — branded header with the
// VasBazaar logo, status badge, line-item table and totals box. Mirrors ledgerPdf.
import {
  VASBAZAAR_LOGO_JPEG_BASE64,
  VASBAZAAR_LOGO_WIDTH,
  VASBAZAAR_LOGO_HEIGHT,
} from "./vasbazaarLogo";
import { formatDisplayDate } from "../../utils/dateFormat";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_W = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 15;
const BOTTOM_LIMIT = MARGIN + 40;

const C = {
  ink: "0F172A",
  slate: "475569",
  muted: "94A3B8",
  line: "E2E8F0",
  teal: "12B5B0",
  cardBg: "F8FAFC",
  headRow: "0F172A",
  zebra: "F1F5F9",
  white: "FFFFFF",
  draft: "64748B", draftBg: "EEF2F6",
  sent: "1C5FC0", sentBg: "EAF1FB",
  paid: "16A34A", paidBg: "ECFDF3",
};

const money = (value) => `Rs. ${Math.round(Math.abs(Number(value || 0))).toLocaleString("en-IN")}`;

// Indian-system rupees-to-words, e.g. 125080 -> "One Lakh Twenty Five Thousand Eighty".
export const amountToWords = (value) => {
  let num = Math.round(Math.abs(Number(value || 0)));
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigits = (n) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
  const threeDigits = (n) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return `${h ? ones[h] + " Hundred" + (r ? " " : "") : ""}${r ? twoDigits(r) : ""}`;
  };
  const parts = [];
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const hundred = num;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ").replace(/\s+/g, " ").trim();
};
const qtyText = (value) => {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};
const escapePdfText = (value = "") =>
  String(value).replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const safeFilePart = (value = "invoice") =>
  String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "invoice";
const textWidthApprox = (text, size) => String(text || "").length * size * 0.52;
const wrapText = (text, maxWidth, size) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (textWidthApprox(next, size) > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

export const getInvoicePdfFileName = (invoice) => `rebill-${safeFilePart(invoice?.invoiceNo || "invoice")}.pdf`;

export const getInvoiceShareText = ({ invoice, ownerName }) => {
  const name = invoice?.customer?.customerName || "Customer";
  return [
    `VasBazaar ReBill — invoice ${invoice?.invoiceNo || ""}`,
    ``,
    `Billed to: ${name}`,
    `Total: ${money(invoice?.total)}`,
    `${ownerName ? `From ${ownerName}. ` : ""}The invoice is attached as a PDF.`,
  ].join("\n");
};

// Loads an organisation logo URL into a JPEG base64 (via canvas) so it can be
// embedded in the hand-built PDF. Returns null on any failure (CORS / load error)
// so the PDF still renders without it.
const loadOrgLogoJpeg = async (url) => {
  if (!url || typeof document === "undefined") return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const maxW = 320;
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
    const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1] || "";
    if (!base64) return null;
    return { base64, width: w, height: h };
  } catch (e) {
    return null;
  }
};

export const generateInvoicePdfBlob = async ({ invoice, ownerName, ownerMobile }) => {
  const ops = [];
  let y = PAGE_HEIGHT - MARGIN;

  const orgImage = invoice?.includeOrg ? await loadOrgLogoJpeg(invoice?.orgLogoUrl) : null;

  const newPage = () => { ops.push({ t: "page" }); y = PAGE_HEIGHT - MARGIN; };
  const rect = (x, yy, w, h, color) => ops.push({ t: "rect", x, y: yy, w, h, color });
  const image = (x, yy, w, h, img = "Im0") => ops.push({ t: "image", x, y: yy, w, h, img });
  const hr = (yy, color = C.line) => ops.push({ t: "rule", x1: MARGIN, y1: yy, x2: PAGE_WIDTH - MARGIN, y2: yy, color });
  const text = (str, x, size, opt = {}) => {
    let tx = x;
    if (opt.align === "right") tx = x - textWidthApprox(str, size);
    else if (opt.align === "center") tx = x - textWidthApprox(str, size) / 2;
    ops.push({ t: "text", text: str, x: tx, y: opt.y != null ? opt.y : y, size, bold: !!opt.bold, color: opt.color || C.ink });
  };
  const flow = (str, x, size, opt = {}) => {
    if (y < BOTTOM_LIMIT) newPage();
    text(str, x, size, { ...opt, y });
    y -= opt.lineHeight || LINE_HEIGHT;
  };

  const status = (invoice?.status || "DRAFT").toUpperCase();
  const stColor = status === "PAID" ? C.paid : status === "SENT" ? C.sent : C.draft;
  const stBg = status === "PAID" ? C.paidBg : status === "SENT" ? C.sentBg : C.draftBg;

  // ---------- Header (org logo on the right; VasBazaar logo moves to footer) ----------
  const headerTop = PAGE_HEIGHT - 30;
  text("INVOICE", MARGIN, 22, { y: headerTop - 16, bold: true, color: C.ink });
  text(`#${invoice?.invoiceNo || ""}`, MARGIN, 9.5, { y: headerTop - 32, color: C.slate });
  if (orgImage) {
    let ow = 120;
    let oh = (orgImage.height / orgImage.width) * ow;
    const maxH = 52;
    if (oh > maxH) { oh = maxH; ow = (orgImage.width / orgImage.height) * oh; }
    image(PAGE_WIDTH - MARGIN - ow, headerTop - oh, ow, oh, "Im1");
  }
  const headRuleY = headerTop - 46;
  rect(MARGIN, headRuleY, CONTENT_W, 3, C.teal);
  y = headRuleY - 18;

  // ---------- From / Bill-to / status card ----------
  const useOrg = !!(invoice?.includeOrg && (invoice?.orgName || invoice?.orgAddress || invoice?.orgGstNumber || invoice?.orgAccountNumber || invoice?.orgBankName || invoice?.orgIfsc || invoice?.orgUpiHandle));
  const cardTop = y;
  const cardH = 88;
  rect(MARGIN, cardTop - cardH, CONTENT_W, cardH, C.cardBg);
  text("FROM", MARGIN + 14, 8, { y: cardTop - 16, bold: true, color: C.muted });
  let fromY = cardTop - 30;
  text(useOrg && invoice?.orgName ? invoice.orgName : (ownerName || "VasBazaar user"), MARGIN + 14, 11, { y: fromY, bold: true });
  fromY -= 13;
  if (useOrg) {
    if (invoice?.orgAddress) { text(String(invoice.orgAddress).slice(0, 46), MARGIN + 14, 9, { y: fromY, color: C.slate }); fromY -= 12; }
    if (invoice?.orgGstNumber) { text(`GSTIN: ${invoice.orgGstNumber}`, MARGIN + 14, 9, { y: fromY, color: C.ink, bold: true }); fromY -= 12; }
    else if (ownerMobile) { text(`+91 ${ownerMobile}`, MARGIN + 14, 9, { y: fromY, color: C.slate }); fromY -= 12; }
    if (invoice?.orgAccountNumber) { text(`A/c: ${invoice.orgAccountNumber}`, MARGIN + 14, 9, { y: fromY, color: C.ink, bold: true }); fromY -= 12; }
  } else if (ownerMobile) {
    text(`+91 ${ownerMobile}`, MARGIN + 14, 9, { y: fromY, color: C.slate });
  }

  const midX = MARGIN + CONTENT_W / 2 + 10;
  text("BILL TO", midX, 8, { y: cardTop - 16, bold: true, color: C.muted });
  let billY = cardTop - 30;
  text(invoice?.customer?.customerName || "Customer", midX, 11, { y: billY, bold: true });
  billY -= 13;
  if (invoice?.customer?.organisationName) {
    text(String(invoice.customer.organisationName).slice(0, 46), midX, 9, { y: billY, color: C.slate });
    billY -= 12;
  }
  if (invoice?.customer?.address) {
    text(String(invoice.customer.address).slice(0, 46), midX, 9, { y: billY, color: C.slate });
    billY -= 12;
  }
  if (invoice?.customer?.customerMobile) {
    text(`+91 ${invoice.customer.customerMobile}`, midX, 9, { y: billY, color: C.slate });
    billY -= 12;
  }
  const gstLine = invoice?.b2b && invoice?.gstNumber ? `GSTIN: ${invoice.gstNumber}` : "B2C (no GSTIN)";
  text(gstLine, midX, 9, { y: billY, color: invoice?.b2b ? C.ink : C.muted, bold: !!invoice?.b2b });

  // status pill (top-right of card)
  const pillW = textWidthApprox(status, 9) + 22;
  const pillX = PAGE_WIDTH - MARGIN - 14 - pillW;
  rect(pillX, cardTop - 26, pillW, 18, stBg);
  text(status, pillX + pillW / 2, 9, { y: cardTop - 20, align: "center", bold: true, color: stColor });

  // dates row inside card bottom
  const dateLine = `Invoice date: ${formatDisplayDate(invoice?.invoiceDate, "")}`
    + (invoice?.dueDate ? `     Due date: ${formatDisplayDate(invoice.dueDate, "")}` : "");
  text(dateLine, MARGIN + 14, 9, { y: cardTop - 76, color: C.slate });
  y = cardTop - cardH - 22;

  // ---------- Items table ----------
  const COL = { desc: MARGIN + 6, qty: MARGIN + 300, rate: MARGIN + 390, amt: PAGE_WIDTH - MARGIN - 12 };
  const drawHead = () => {
    rect(MARGIN, y - 16, CONTENT_W, 20, C.headRow);
    const ty = y - 11;
    text("ITEM", COL.desc, 8.5, { y: ty, bold: true, color: C.white });
    text("QTY", COL.qty, 8.5, { y: ty, align: "right", bold: true, color: C.white });
    text("RATE", COL.rate, 8.5, { y: ty, align: "right", bold: true, color: C.white });
    text("AMOUNT", COL.amt, 8.5, { y: ty, align: "right", bold: true, color: C.white });
    y -= 24;
  };
  drawHead();

  (invoice?.items || []).forEach((item, idx) => {
    const rowH = 22;
    if (y - rowH < BOTTOM_LIMIT) { newPage(); y -= 6; drawHead(); }
    if (idx % 2 === 1) rect(MARGIN, y - rowH + 8, CONTENT_W, rowH, C.zebra);
    const ty = y - 4;
    text(String(item.description || "").slice(0, 52), COL.desc, 9, { y: ty, color: C.ink });
    text(qtyText(item.quantity), COL.qty, 9, { y: ty, align: "right", color: C.slate });
    text(money(item.rate), COL.rate, 9, { y: ty, align: "right", color: C.slate });
    text(money(item.amount), COL.amt, 9, { y: ty, align: "right", bold: true, color: C.ink });
    y -= rowH;
    hr(y + 4, C.line);
  });

  // ---------- Totals box ----------
  y -= 12;
  const boxW = 220;
  const boxX = PAGE_WIDTH - MARGIN - boxW;
  const labelX = boxX + 12;
  const valX = PAGE_WIDTH - MARGIN - 12;
  text("Subtotal", labelX, 10, { y, color: C.slate });
  text(money(invoice?.subtotal), valX, 10, { y, align: "right", color: C.ink });
  y -= 16;
  const subAmt = Number(invoice?.subtotal || 0);
  [["SGST", invoice?.sgstPercent], ["CGST", invoice?.cgstPercent], ["IGST", invoice?.igstPercent]]
    .forEach(([label, pctRaw]) => {
      const pct = Number(pctRaw || 0);
      if (pct <= 0) return;
      const amt = Math.round(subAmt * pct) / 100;
      text(`${label} (${pct}%)`, labelX, 10, { y, color: C.slate });
      text(money(amt), valX, 10, { y, align: "right", color: C.ink });
      y -= 16;
    });
  rect(boxX, y - 22, boxW, 30, C.cardBg);
  text("TOTAL", labelX, 11, { y: y - 8, bold: true, color: C.ink });
  text(money(invoice?.total), valX, 14, { y: y - 9, align: "right", bold: true, color: C.teal });
  y -= 40;

  // ---------- Amount in words ----------
  if (y < BOTTOM_LIMIT + 24) newPage();
  y -= 6;
  hr(y); y -= 15;
  text("AMOUNT IN WORDS", MARGIN, 8.5, { y, bold: true, color: C.muted }); y -= 13;
  wrapText(`Indian Rupees ${amountToWords(invoice?.total)} Only`, CONTENT_W, 9.5)
    .forEach((ln) => flow(ln, MARGIN, 9.5, { color: C.ink, bold: true, lineHeight: 13 }));

  // ---------- Payment details (account number / UPI handle) ----------
  const payLines = [];
  if (invoice?.orgAccountNumber) payLines.push(`Account number: ${invoice.orgAccountNumber}`);
  if (invoice?.orgBankName) payLines.push(`Bank: ${invoice.orgBankName}`);
  if (invoice?.orgIfsc) payLines.push(`IFSC: ${invoice.orgIfsc}`);
  if (invoice?.orgUpiHandle) payLines.push(`UPI: ${invoice.orgUpiHandle}`);
  if (payLines.length) {
    if (y < BOTTOM_LIMIT + 24) newPage();
    y -= 6;
    text("PAYMENT DETAILS", MARGIN, 8.5, { y, bold: true, color: C.muted }); y -= 13;
    payLines.forEach((ln) => flow(ln, MARGIN, 9.5, { color: C.ink, lineHeight: 13 }));
  }

  // ---------- Signature block: caption + VasBazaar logo just below it ----------
  if (y < BOTTOM_LIMIT + 40) newPage();
  y -= 10;
  flow("Generated from VasBazaar ReBill.", MARGIN, 8, { color: C.muted, lineHeight: 12 });
  const gLogoW = 96;
  const gLogoH = (VASBAZAAR_LOGO_HEIGHT / VASBAZAAR_LOGO_WIDTH) * gLogoW;
  if (y - gLogoH < BOTTOM_LIMIT) newPage();
  image(MARGIN, y - gLogoH, gLogoW, gLogoH, "Im0");
  y -= gLogoH + 6;

  return assemble(ops, orgImage);
};

const assemble = (ops, orgImage) => {
  const pages = [[]];
  ops.forEach((op) => { if (op.t === "page") pages.push([]); else pages[pages.length - 1].push(op); });

  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("__PAGES__");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const logoBin = typeof atob === "function"
    ? atob(VASBAZAAR_LOGO_JPEG_BASE64)
    : Buffer.from(VASBAZAAR_LOGO_JPEG_BASE64, "base64").toString("binary");
  const imageId = addObject(
    `<< /Type /XObject /Subtype /Image /Width ${VASBAZAAR_LOGO_WIDTH} /Height ${VASBAZAAR_LOGO_HEIGHT}`
    + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBin.length} >>\n`
    + `stream\n${logoBin}\nendstream`);

  let orgImageId = null;
  if (orgImage && orgImage.base64) {
    const orgBin = typeof atob === "function"
      ? atob(orgImage.base64)
      : Buffer.from(orgImage.base64, "base64").toString("binary");
    orgImageId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${orgImage.width} /Height ${orgImage.height}`
      + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${orgBin.length} >>\n`
      + `stream\n${orgBin}\nendstream`);
  }

  const pageIds = [];
  const hexToRgb = (hex) => {
    const h = hex || "000000";
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  };

  pages.forEach((pageOps, index) => {
    const content = ["q", "1 1 1 rg", `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`, "Q"];
    pageOps.forEach((op) => {
      if (op.t === "rule") {
        const [r, g, b] = hexToRgb(op.color);
        content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG 0.7 w ${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S`);
      } else if (op.t === "rect") {
        const [r, g, b] = hexToRgb(op.color);
        content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${op.x} ${op.y} ${op.w} ${op.h} re f`);
      } else if (op.t === "image") {
        const imName = op.img === "Im1" && orgImageId ? "Im1" : "Im0";
        content.push(`q ${op.w} 0 0 ${op.h} ${op.x} ${op.y} cm /${imName} Do Q`);
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
    // ---------- Footer: page number only (VasBazaar logo now sits in the
    // signature block just below "Generated from VasBazaar ReBill.") ----------
    content.push("BT /F1 8 Tf 0.58 0.64 0.72 rg 300 26 Td");
    content.push(`(Page ${index + 1} of ${pages.length} - VasBazaar ReBill) Tj ET`);

    const stream = content.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const xobjRes = `/Im0 ${imageId} 0 R` + (orgImageId ? ` /Im1 ${orgImageId} 0 R` : "");
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`
      + ` /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`
      + ` /XObject << ${xobjRes} >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

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
