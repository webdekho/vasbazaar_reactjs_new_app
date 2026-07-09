import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { FaArrowLeft, FaShareAlt } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { useToast } from "../../context/ToastContext";
import { useCustomerModern } from "../../context/CustomerModernContext";
import {
  generateInvoicePdfBlob,
  getInvoicePdfFileName,
  getInvoiceShareText,
  amountToWords,
} from "../../utils/invoicePdf";

const formatINR = (n) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;
const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const STATUS_META = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const InvoiceViewScreen = () => {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const { showToast } = useToast();
  const { userData } = useCustomerModern();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await outstandingService.getInvoice(invoiceId);
    setLoading(false);
    if (res.success) setInvoice(res.data);
    else showToast(res.message || "Failed to load invoice", "error");
  }, [invoiceId, showToast]);

  useEffect(() => { load(); }, [load]);

  const share = async () => {
    if (!invoice) return;
    setSharing(true);
    try {
      const ownerName = invoice.owner?.name || userData?.name || userData?.firstName || "";
      const ownerMobile = invoice.owner?.mobile || userData?.mobile || userData?.mobileNumber || "";
      const pdfBlob = await generateInvoicePdfBlob({ invoice, ownerName, ownerMobile });
      const fileName = getInvoicePdfFileName(invoice);
      const shareText = getInvoiceShareText({ invoice, ownerName });

      if (Capacitor.isNativePlatform()) {
        const data = await blobToBase64(pdfBlob);
        const w = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
        await Share.share({ title: `VasBazaar invoice ${invoice.invoiceNo || ""}`.trim(), text: shareText, url: w.uri, dialogTitle: "Share Invoice" });
        return;
      }
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ title: `VasBazaar invoice ${invoice.invoiceNo || ""}`.trim(), text: shareText, files: [pdfFile] });
        return;
      }
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast("PDF downloaded.", "info");
    } catch (err) {
      if (err?.name !== "AbortError") showToast("Could not share invoice", "error");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="ol-page ol-invoice-page">
        <div className="ol-list">{[0, 1, 2].map((i) => <div key={i} className="ol-item ol-skeleton" />)}</div>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="ol-page ol-invoice-page">
        <div className="ol-ledger-header">
          <button className="ol-back-btn" type="button" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
          <div className="ol-ledger-id"><div className="ol-ledger-name"><span className="ol-ledger-name-text">Invoice</span></div></div>
        </div>
        <div className="ol-inv-empty"><h3>Invoice not found</h3></div>
      </div>
    );
  }

  const items = invoice.items || [];

  return (
    <div className="ol-page ol-invoice-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name"><span className="ol-ledger-name-text">{invoice.invoiceNo}</span></div>
          <div className="ol-ledger-mobile">{formatDate(invoice.invoiceDate)} · {STATUS_META[invoice.status] || "Draft"}</div>
        </div>
      </div>

      <div className="ol-form">
        {invoice.includeOrg && (invoice.orgName || invoice.orgLogoUrl || invoice.orgAddress || invoice.orgGstNumber || invoice.orgAccountNumber || invoice.orgBankName || invoice.orgIfsc || invoice.orgUpiHandle) ? (
          <div className="ol-inv-opt ol-inv-view-org">
            {invoice.orgLogoUrl ? <div className="ol-org-logo-preview"><img src={invoice.orgLogoUrl} alt="Logo" /></div> : null}
            <div>
              {invoice.orgName ? <div className="ol-inv-view-org-name">{invoice.orgName}</div> : null}
              {invoice.orgAddress ? <div className="ol-inv-view-org-sub">{invoice.orgAddress}</div> : null}
              {invoice.orgGstNumber ? <div className="ol-inv-view-org-sub">GSTIN: {invoice.orgGstNumber}</div> : null}
              {invoice.orgAccountNumber ? <div className="ol-inv-view-org-sub">A/c: {invoice.orgAccountNumber}</div> : null}
              {invoice.orgBankName ? <div className="ol-inv-view-org-sub">Bank: {invoice.orgBankName}</div> : null}
              {invoice.orgIfsc ? <div className="ol-inv-view-org-sub">IFSC: {invoice.orgIfsc}</div> : null}
              {invoice.orgUpiHandle ? <div className="ol-inv-view-org-sub">UPI: {invoice.orgUpiHandle}</div> : null}
            </div>
          </div>
        ) : null}

        <div className="ol-inv-opt">
          <div className="ol-gst-title">Bill to</div>
          <div className="ol-inv-view-org-name">{invoice.customer?.customerName || "Customer"}</div>
          {invoice.customer?.organisationName ? <div className="ol-inv-view-org-sub">{invoice.customer.organisationName}</div> : null}
          {invoice.customer?.address ? <div className="ol-inv-view-org-sub">{invoice.customer.address}</div> : null}
          {invoice.customer?.customerMobile ? <div className="ol-inv-view-org-sub">{invoice.customer.customerMobile}</div> : null}
          <div className="ol-inv-view-org-sub">{invoice.customerType === "B2B" && invoice.gstNumber ? `GSTIN: ${invoice.gstNumber}` : "B2C (no GSTIN)"}</div>
        </div>

        <div className="ol-inv-opt">
          <div className="ol-gst-title">Items</div>
          {items.map((it) => (
            <div className="ol-inv-view-line" key={it.id}>
              <div className="ol-inv-view-line-desc">
                <span>{it.description}</span>
                <small>{Number(it.quantity)} × {formatINR(it.rate)}</small>
              </div>
              <div className="ol-inv-view-line-amt">{formatINR(it.amount)}</div>
            </div>
          ))}
        </div>

        <div className="ol-inv-totals">
          <div><span>Subtotal</span><b>{formatINR(invoice.subtotal)}</b></div>
          {Number(invoice.sgstPercent) > 0 && <div><span>SGST ({Number(invoice.sgstPercent)}%)</span><b>{formatINR(Number(invoice.subtotal) * Number(invoice.sgstPercent) / 100)}</b></div>}
          {Number(invoice.cgstPercent) > 0 && <div><span>CGST ({Number(invoice.cgstPercent)}%)</span><b>{formatINR(Number(invoice.subtotal) * Number(invoice.cgstPercent) / 100)}</b></div>}
          {Number(invoice.igstPercent) > 0 && <div><span>IGST ({Number(invoice.igstPercent)}%)</span><b>{formatINR(Number(invoice.subtotal) * Number(invoice.igstPercent) / 100)}</b></div>}
          <div className="ol-inv-total-line"><span>Total</span><b>{formatINR(invoice.total)}</b></div>
        </div>

        <div className="ol-inv-opt">
          <div className="ol-gst-title">Amount in words</div>
          <div className="ol-inv-view-org-name">Indian Rupees {amountToWords(invoice.total)} Only</div>
        </div>

        {(invoice.orgAccountNumber || invoice.orgBankName || invoice.orgIfsc || invoice.orgUpiHandle) ? (
          <div className="ol-inv-opt">
            <div className="ol-gst-title">Payment details</div>
            {invoice.orgAccountNumber ? <div className="ol-inv-view-org-sub">Account number: {invoice.orgAccountNumber}</div> : null}
            {invoice.orgBankName ? <div className="ol-inv-view-org-sub">Bank: {invoice.orgBankName}</div> : null}
            {invoice.orgIfsc ? <div className="ol-inv-view-org-sub">IFSC: {invoice.orgIfsc}</div> : null}
            {invoice.orgUpiHandle ? <div className="ol-inv-view-org-sub">UPI: {invoice.orgUpiHandle}</div> : null}
          </div>
        ) : null}

        {invoice.notes ? (
          <div className="ol-inv-opt">
            <div className="ol-gst-title">Notes</div>
            <div className="ol-inv-view-org-sub">{invoice.notes}</div>
          </div>
        ) : null}

        <button type="button" className="ol-inv-submit" onClick={share} disabled={sharing}>
          <FaShareAlt style={{ marginRight: 8 }} /> {sharing ? "Preparing…" : "Share as PDF"}
        </button>
      </div>
    </div>
  );
};

export default InvoiceViewScreen;
