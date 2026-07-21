// Hand-built PDF (no external lib) for the ReBill ledger — branded header with
// the VasBazaar logo, a status badge, summary band and a zebra-striped table.
import {
  VASBAZAAR_LOGO_JPEG_BASE64,
  VASBAZAAR_LOGO_WIDTH,
  VASBAZAAR_LOGO_HEIGHT,
} from "./vasbazaarLogo";
import { formatDisplayDate, formatDisplayTime } from "../../utils/dateFormat";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_W = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 15;
const BOTTOM_LIMIT = MARGIN + 40;

// Brand palette
const C = {
  ink: "0F172A",
  slate: "475569",
  muted: "94A3B8",
  line: "E2E8F0",
  teal: "12B5B0",
  cardBg: "F8FAFC",
  headRow: "0F172A",
  zebra: "F1F5F9",
  red: "DC2626",
  redSoft: "FEF2F2",
  green: "16A34A",
  greenSoft: "ECFDF3",
  tealSoft: "E6FBFA",
  white: "FFFFFF",
};

const money = (value) => `Rs. ${Math.round(Math.abs(Number(value || 0))).toLocaleString("en-IN")}`;

const formatDateTime = (txnDate, createdAt) => {
  const date = formatDisplayDate(txnDate || createdAt, "");
  if (!createdAt) return date;
  return `${date} ${formatDisplayTime(createdAt, "")}`.trim();
};

const formatPaymentMode = (mode) => {
  switch (mode) {
    case "UPI": return "UPI";
    case "ONLINE_TRANSFER": return "Online Transfer";
    case "CASH":
    default: return "Cash";
  }
};

const escapePdfText = (value = "") =>
  String(value)
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const safeFilePart = (value = "ledger") =>
  String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "ledger";

const textWidthApprox = (text, size) => String(text || "").length * size * 0.52;

const wrapText = (text, maxWidth, size) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (textWidthApprox(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

export const getLedgerPdfFileName = (customer) =>
  `rebill-ledger-${safeFilePart(customer?.customerName || customer?.customerMobile)}.pdf`;

export const getLedgerShareText = ({ customer, balance, readOnly, data }) => {
  const name = customer?.customerName || "there";
  const rupee = (v) => `₹${Math.round(Math.abs(Number(v || 0))).toLocaleString("en-IN")}`;
  const signed = Number(balance || 0);
  const gave = data?.totalGave;
  const got = data?.totalGot;

  const lines = [];
  lines.push(`Hi ${name},`);
  lines.push("");

  if (readOnly) {
    // The debtor is sharing a ledger they owe on.
    lines.push("Here is the account statement from VasBazaar ReBill.");
    lines.push("");
    if (signed > 0) lines.push(`• Amount payable: ${rupee(signed)}`);
    else if (signed < 0) lines.push(`• Advance with them: ${rupee(signed)}`);
    else lines.push("• Status: all settled ✅");
  } else {
    lines.push("Here is your latest account statement from VasBazaar ReBill.");
    lines.push("");
    if (signed > 0) lines.push(`• Outstanding balance: ${rupee(signed)}`);
    else if (signed < 0) lines.push(`• Advance balance: ${rupee(signed)}`);
    else lines.push("• Status: all settled ✅");
  }

  if (gave != null && got != null) {
    lines.push(`• ${readOnly ? "Total received" : "You gave"}: ${rupee(gave)}  |  ${readOnly ? "Total paid" : "You got"}: ${rupee(got)}`);
  }

  lines.push("");
  if (signed > 0 && !readOnly) {
    lines.push("Kindly review the entries and clear the outstanding amount at your convenience.");
  } else {
    lines.push("The complete statement is attached as a PDF for your records.");
  }
  lines.push("Please verify all entries before making any payment.");
  lines.push("");
  lines.push("— Sent securely via VasBazaar ReBill");
  return lines.join("\n");
};

export const generateLedgerPdfBlob = ({ data, customer, transactions, balance, readOnly, dateRange }) => {
  const ops = []; // drawing primitives across pages
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => { ops.push({ t: "page" }); y = PAGE_HEIGHT - MARGIN; };
  const rect = (x, yy, w, h, color) => ops.push({ t: "rect", x, y: yy, w, h, color });
  const image = (x, yy, w, h) => ops.push({ t: "image", x, y: yy, w, h });
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

  const signed = Number(balance || 0);
  const isOut = signed > 0;
  const isAdv = signed < 0;
  const statusLabel = isOut ? (readOnly ? "YOU OWE" : "OUTSTANDING") : isAdv ? "ADVANCE" : "SETTLED";
  const accent = isOut ? C.red : isAdv ? C.teal : C.green;
  const accentSoft = isOut ? C.redSoft : isAdv ? C.tealSoft : C.greenSoft;

  // ---------- Header ----------
  const logoW = 150;
  const logoH = (VASBAZAAR_LOGO_HEIGHT / VASBAZAAR_LOGO_WIDTH) * logoW;
  const headerTop = PAGE_HEIGHT - 30;
  image(MARGIN, headerTop - logoH, logoW, logoH);
  text("REBILL LEDGER", PAGE_WIDTH - MARGIN, 11, { y: headerTop - 8, align: "right", bold: true, color: C.slate });
  text(`Generated ${formatDateTime(new Date().toISOString(), new Date().toISOString())}`,
    PAGE_WIDTH - MARGIN, 8.5, { y: headerTop - 22, align: "right", color: C.muted });
  rect(MARGIN, headerTop - logoH - 12, CONTENT_W, 3, C.teal); // accent strip
  y = headerTop - logoH - 30;

  // ---------- Customer + status card ----------
  const cardTop = y;
  const cardH = 58;
  rect(MARGIN, cardTop - cardH, CONTENT_W, cardH, C.cardBg);
  text(customer?.customerName || "Customer", MARGIN + 14, 14, { y: cardTop - 22, bold: true });
  text(`+91 ${customer?.customerMobile || ""}`, MARGIN + 14, 9.5, { y: cardTop - 37, color: C.slate });
  text(`Period: ${formatDisplayDate(dateRange?.dateFrom, "")} to ${formatDisplayDate(dateRange?.dateTo, "")}`,
    MARGIN + 14, 9, { y: cardTop - 49, color: C.muted });
  // status pill
  const pillW = textWidthApprox(statusLabel, 9) + 22;
  const pillX = PAGE_WIDTH - MARGIN - 14 - pillW;
  rect(pillX, cardTop - 30, pillW, 18, accentSoft);
  text(statusLabel, pillX + pillW / 2, 9, { y: cardTop - 24, align: "center", bold: true, color: accent });
  y = cardTop - cardH - 22;

  // ---------- Amount hero ----------
  text(isOut ? (readOnly ? "You owe" : "Outstanding") : isAdv ? "Advance" : "All settled",
    MARGIN, 10, { y, color: C.slate });
  y -= 26;
  text(money(signed), MARGIN, 30, { y, bold: true, color: accent });
  // gave / got on the right
  const colR = PAGE_WIDTH - MARGIN;
  const colMid = PAGE_WIDTH - MARGIN - 130;
  text(readOnly ? "You received" : "You gave", colMid, 8.5, { y: y + 14, color: C.muted });
  text(money(data?.totalGave), colMid, 12, { y, bold: true, color: C.ink });
  text(readOnly ? "You paid" : "You got", colR, 8.5, { y: y + 14, align: "right", color: C.muted });
  text(money(data?.totalGot), colR, 12, { y, align: "right", bold: true, color: C.ink });
  y -= 22;
  hr(y); y -= 22;

  // ---------- Transactions table ----------
  const COL = { date: MARGIN + 6, type: MARGIN + 170, amt: MARGIN + 320, bal: PAGE_WIDTH - MARGIN - 12 };
  const drawTableHeader = () => {
    rect(MARGIN, y - 16, CONTENT_W, 20, C.headRow);
    const ty = y - 11;
    text("DATE", COL.date, 8.5, { y: ty, bold: true, color: C.white });
    text("TYPE", COL.type, 8.5, { y: ty, bold: true, color: C.white });
    text("AMOUNT", COL.amt, 8.5, { y: ty, align: "right", bold: true, color: C.white });
    text("BALANCE", COL.bal, 8.5, { y: ty, align: "right", bold: true, color: C.white });
    y -= 24;
  };

  text("TRANSACTIONS", MARGIN, 11, { y, bold: true, color: C.ink });
  y -= 18;
  drawTableHeader();

  const list = transactions || [];
  if (!list.length) {
    flow("No entries for this period.", MARGIN + 6, 10, { color: C.muted });
  } else {
    list.forEach((txn, idx) => {
      const rowH = txn.note ? 34 : 26;
      if (y - rowH < BOTTOM_LIMIT) {
        newPage();
        y -= 6;
        drawTableHeader();
      }
      const amount = Number(txn.amount || 0);
      const balanceAfter = Number(txn.balanceAfter || 0);
      const isGave = txn.type === "GAVE";
      const typeLabel = readOnly
        ? (isGave ? "You Received" : "You Paid")
        : (isGave ? "You Gave" : "You Got");
      const rowColor = isGave ? C.red : C.green;

      if (idx % 2 === 1) rect(MARGIN, y - rowH + 8, CONTENT_W, rowH, C.zebra);
      const ty = y - 4;
      text(formatDateTime(txn.txnDate, txn.createdAt), COL.date, 9, { y: ty, color: C.ink });
      text(typeLabel, COL.type, 9, { y: ty, bold: true, color: rowColor });
      text(`${isGave ? "+" : "-"}${money(amount)}`, COL.amt, 9, { y: ty, align: "right", bold: true, color: rowColor });
      text(money(balanceAfter), COL.bal, 9, { y: ty, align: "right", color: C.slate });
      if (txn.note || txn.paymentMode) {
        const sub = `${formatPaymentMode(txn.paymentMode)}${txn.paymentReference ? ` · Ref ${txn.paymentReference}` : ""}${txn.note ? ` · ${txn.note}` : ""}`;
        text(sub.slice(0, 90), COL.date, 8, { y: ty - 12, color: C.muted });
      }
      y -= rowH;
      hr(y + 4, C.line);
    });
  }

  // ---------- Footer note ----------
  if (y < BOTTOM_LIMIT + 30) newPage();
  y -= 10;
  wrapText("This ledger was generated from VasBazaar ReBill. Please verify all entries before making any payment.",
    CONTENT_W, 8).forEach((ln) => flow(ln, MARGIN, 8, { color: C.muted, lineHeight: 11 }));

  return assemble(ops);
};

// ---------- PDF assembler ----------
const assemble = (ops) => {
  const pages = [[]];
  ops.forEach((op) => {
    if (op.t === "page") pages.push([]);
    else pages[pages.length - 1].push(op);
  });

  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("__PAGES__");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  // Logo image XObject (raw JPEG via DCTDecode)
  const logoBin = typeof atob === "function"
    ? atob(VASBAZAAR_LOGO_JPEG_BASE64)
    : Buffer.from(VASBAZAAR_LOGO_JPEG_BASE64, "base64").toString("binary");
  const imageId = addObject(
    `<< /Type /XObject /Subtype /Image /Width ${VASBAZAAR_LOGO_WIDTH} /Height ${VASBAZAAR_LOGO_HEIGHT}`
    + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBin.length} >>\n`
    + `stream\n${logoBin}\nendstream`);

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
        content.push(`q ${op.w} 0 0 ${op.h} ${op.x} ${op.y} cm /Im0 Do Q`);
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
    content.push("BT /F1 8 Tf 0.58 0.64 0.72 rg 270 24 Td");
    content.push(`(Page ${index + 1} of ${pages.length} - VasBazaar ReBill) Tj ET`);

    const stream = content.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`
      + ` /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`
      + ` /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
};
