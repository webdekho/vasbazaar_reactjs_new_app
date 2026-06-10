const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const LINE_HEIGHT = 15;

const money = (value) => {
  const n = Number(value || 0);
  return `Rs. ${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
};

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTime = (txnDate, createdAt) => {
  const date = formatDate(txnDate || createdAt);
  if (!createdAt) return date;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return date;
  return `${date}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
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
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "ledger";

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

export const getLedgerShareText = ({ customer, balance, readOnly }) => {
  const name = customer?.customerName || "Customer";
  const amount = money(balance);
  const status = Number(balance || 0) > 0
    ? readOnly ? "you owe" : "outstanding"
    : Number(balance || 0) < 0
      ? "advance"
      : "settled";
  return `ReBill ledger for ${name}. Current status: ${status}, amount: ${amount}. PDF ledger is attached.`;
};

export const generateLedgerPdfBlob = ({ data, customer, transactions, balance, readOnly, dateRange }) => {
  const lines = [];
  let y = PAGE_HEIGHT - MARGIN;

  const addPage = () => {
    lines.push({ type: "pageBreak" });
    y = PAGE_HEIGHT - MARGIN;
  };

  const addText = (text, x, size = 10, options = {}) => {
    if (y < MARGIN + 40) addPage();
    lines.push({ type: "text", text, x, y, size, bold: Boolean(options.bold), color: options.color || "000000" });
    y -= options.lineHeight || LINE_HEIGHT;
  };

  const addRule = () => {
    if (y < MARGIN + 20) addPage();
    lines.push({ type: "rule", x1: MARGIN, y, x2: PAGE_WIDTH - MARGIN, y2: y, color: "D1D5DB" });
    y -= 12;
  };

  const addWrapped = (text, x, width, size = 10, options = {}) => {
    wrapText(text, width, size).forEach((line) => addText(line, x, size, options));
  };

  const signedBalance = Number(balance || 0);
  const balanceLabel = signedBalance > 0
    ? readOnly ? "You owe" : "Outstanding"
    : signedBalance < 0
      ? "Advance"
      : "Settled";

  addText("VasBazaar ReBill Ledger", MARGIN, 18, { bold: true, lineHeight: 22, color: "0F172A" });
  addText(`Generated: ${formatDateTime(new Date().toISOString(), new Date().toISOString())}`, MARGIN, 9, { color: "64748B" });
  addRule();

  addText(customer?.customerName || "Customer", MARGIN, 15, { bold: true, lineHeight: 20 });
  addText(`Mobile: +91 ${customer?.customerMobile || ""}`, MARGIN, 10, { color: "475569" });
  addText(`Period: ${formatDate(dateRange?.dateFrom)} to ${formatDate(dateRange?.dateTo)}`, MARGIN, 10, { color: "475569" });
  y -= 4;
  addText(`${balanceLabel}: ${money(signedBalance)}`, MARGIN, 14, {
    bold: true,
    lineHeight: 20,
    color: signedBalance === 0 ? "16A34A" : signedBalance > 0 ? "DC2626" : "0F766E",
  });
  addText(`${readOnly ? "You received" : "You gave"}: ${money(data?.totalGave)}    ${readOnly ? "You paid" : "You got"}: ${money(data?.totalGot)}`, MARGIN, 10);
  addRule();

  addText("Transactions", MARGIN, 13, { bold: true, lineHeight: 20 });
  addText("Date                 Type             Amount        Balance After", MARGIN, 9, { bold: true, color: "334155" });
  addRule();

  if (!transactions?.length) {
    addText("No entries for this period.", MARGIN, 10, { color: "64748B" });
  } else {
    transactions.forEach((txn) => {
      const amount = Number(txn.amount || 0);
      const balanceAfter = Number(txn.balanceAfter || 0);
      const type = readOnly
        ? txn.type === "GAVE" ? "You Received" : "You Paid"
        : txn.type === "GAVE" ? "You Gave" : "You Got";
      const row = `${formatDateTime(txn.txnDate, txn.createdAt).padEnd(20)} ${type.padEnd(16)} ${money(amount).padEnd(13)} ${money(balanceAfter)}`;
      addText(row, MARGIN, 9, { color: txn.type === "GAVE" ? "B91C1C" : "047857" });
      const paymentLine = `Mode: ${formatPaymentMode(txn.paymentMode)}${txn.paymentReference ? ` | Ref: ${txn.paymentReference}` : ""}`;
      addWrapped(paymentLine, MARGIN + 12, PAGE_WIDTH - MARGIN * 2 - 12, 8, { color: "475569", lineHeight: 12 });
      if (txn.note) addWrapped(`Note: ${txn.note}`, MARGIN + 12, PAGE_WIDTH - MARGIN * 2 - 12, 8, { color: "64748B", lineHeight: 12 });
      y -= 3;
    });
  }

  y = Math.max(y, MARGIN + 30);
  addRule();
  addWrapped("This ledger was generated from VasBazaar ReBill. Please verify entries before making payment.", MARGIN, PAGE_WIDTH - MARGIN * 2, 8, { color: "64748B", lineHeight: 12 });

  const pages = [[]];
  lines.forEach((item) => {
    if (item.type === "pageBreak") pages.push([]);
    else pages[pages.length - 1].push(item);
  });

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("__PAGES__");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  pages.forEach((pageLines, index) => {
    const content = [
      "q",
      "1 1 1 rg",
      `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`,
      "Q",
    ];
    pageLines.forEach((item) => {
      if (item.type === "rule") {
        content.push(`0.82 0.84 0.86 RG ${item.x1} ${item.y} m ${item.x2} ${item.y2} l S`);
        return;
      }
      const color = item.color || "000000";
      const r = parseInt(color.slice(0, 2), 16) / 255;
      const g = parseInt(color.slice(2, 4), 16) / 255;
      const b = parseInt(color.slice(4, 6), 16) / 255;
      content.push("BT");
      content.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      content.push(`/${item.bold ? "F2" : "F1"} ${item.size} Tf`);
      content.push(`${item.x} ${item.y} Td`);
      content.push(`(${escapePdfText(item.text)}) Tj`);
      content.push("ET");
    });
    content.push("BT /F1 8 Tf 0.40 0.45 0.55 rg 500 24 Td");
    content.push(`(Page ${index + 1} of ${pages.length}) Tj ET`);

    const stream = content.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
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
