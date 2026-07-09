import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { FaArrowLeft, FaPlus, FaShareAlt, FaTrash, FaCheckCircle, FaFileInvoice, FaEye, FaPen, FaLink, FaBuilding } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { useToast } from "../../context/ToastContext";
import { useCustomerModern } from "../../context/CustomerModernContext";
import {
  generateInvoicePdfBlob,
  getInvoicePdfFileName,
  getInvoiceShareText,
} from "../../utils/invoicePdf";

const formatINR = (n) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;
const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const STATUS_META = {
  DRAFT: { label: "Draft", cls: "is-draft" },
  SENT: { label: "Sent", cls: "is-sent" },
  PAID: { label: "Paid", cls: "is-paid" },
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const InvoiceListScreen = () => {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const { showToast } = useToast();
  const { userData } = useCustomerModern();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await outstandingService.listInvoices(customerId);
    setLoading(false);
    if (res.success) setInvoices(res.data || []);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const shareInvoice = async (id) => {
    setBusyId(id);
    try {
      const res = await outstandingService.getInvoice(id);
      if (!res.success) {
        showToast(res.message || "Failed to load invoice", "error");
        return;
      }
      const invoice = res.data;
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
      showToast("PDF downloaded. Attach it in WhatsApp/Email.", "info");
    } catch (err) {
      if (err?.name !== "AbortError") showToast("Could not share invoice", "error");
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (inv) => {
    setBusyId(inv.id);
    const res = await outstandingService.updateInvoiceStatus(inv.id, inv.status === "PAID" ? "SENT" : "PAID");
    setBusyId(null);
    if (res.success) load();
    else showToast(res.message || "Update failed", "error");
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    setBusyId(id);
    const res = await outstandingService.deleteInvoice(id);
    setBusyId(null);
    if (res.success) load();
    else showToast(res.message || "Delete failed", "error");
  };

  const editInvoice = (inv, invCustomerId) => {
    if (inv.linked && !window.confirm("This invoice is already linked to the customer's ledger. Editing it will recompute the outstanding balance with the new amount. Continue?")) return;
    navigate(`/customer/app/outstanding/${invCustomerId}/invoice/${inv.id}/edit`);
  };

  const linkOutstanding = async (id) => {
    if (!window.confirm("Add this invoice to the customer's outstanding balance?")) return;
    setBusyId(id);
    const res = await outstandingService.linkInvoiceToOutstanding(id);
    setBusyId(null);
    if (res.success) {
      showToast("Linked to outstanding", "success");
      load();
    } else {
      showToast(res.message || "Link failed", "error");
    }
  };

  return (
    <div className="ol-page ol-invoice-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name"><span className="ol-ledger-name-text">{customerId ? "Invoices" : "All Invoices"}</span></div>
          <div className="ol-ledger-mobile">{customerId ? "Create & share GST-ready bills" : "Every invoice you've created"}</div>
        </div>
      </div>

      {customerId && (
        <button
          className="ol-inv-new-btn"
          type="button"
          onClick={() => navigate(`/customer/app/outstanding/${customerId}/invoice/new`)}
        >
          <span className="ol-inv-new-ic"><FaPlus /></span>
          <span className="ol-inv-new-copy">
            <b>New invoice</b>
            <small>Bill this customer in seconds</small>
          </span>
        </button>
      )}

      <button
        type="button"
        className="ol-org-edit-link"
        style={{ margin: "0 4px 12px" }}
        onClick={() => navigate(`/customer/app/outstanding/business-profile`)}
      >
        <FaBuilding /> Business profile &amp; logo
      </button>

      {loading ? (
        <div className="ol-list">{[0, 1].map((i) => <div key={i} className="ol-item ol-skeleton" />)}</div>
      ) : invoices.length === 0 ? (
        <div className="ol-inv-empty">
          <div className="ol-inv-empty-ic"><FaFileInvoice /></div>
          <h3>No invoices yet</h3>
          <p>Create your first invoice and share it as a branded PDF with your customer.</p>
        </div>
      ) : (
        <div className="ol-inv-list">
          {invoices.map((inv) => {
            const sm = STATUS_META[inv.status] || STATUS_META.DRAFT;
            const invCustomerId = customerId || inv.customerId;
            return (
              <div className={`ol-inv-card ${sm.cls}`} key={inv.id}>
                <div className="ol-inv-card-top">
                  <div>
                    <div className="ol-inv-no">{inv.invoiceNo}</div>
                    {!customerId && inv.customerName ? (
                      <div className="ol-inv-sub"><b>{inv.customerName}</b></div>
                    ) : null}
                    <div className="ol-inv-sub">{formatDate(inv.invoiceDate)}{inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ""}</div>
                  </div>
                  <div className="ol-inv-card-right">
                    <div className="ol-inv-total">{formatINR(inv.total)}</div>
                    <span className={`ol-inv-status ${sm.cls}`}>{sm.label}</span>
                    {inv.linked && <span className="ol-inv-status is-outstanding">Outstanding</span>}
                  </div>
                </div>
                <div className="ol-inv-actions">
                  <button type="button" onClick={() => navigate(`/customer/app/outstanding/${invCustomerId}/invoice/${inv.id}`)} disabled={busyId === inv.id}>
                    <FaEye /> View
                  </button>
                  {inv.editable && (
                    <button type="button" onClick={() => editInvoice(inv, invCustomerId)} disabled={busyId === inv.id}>
                      <FaPen /> Edit
                    </button>
                  )}
                  <button type="button" onClick={() => shareInvoice(inv.id)} disabled={busyId === inv.id}>
                    <FaShareAlt /> Share
                  </button>
                  {!inv.linked && (
                    <button type="button" onClick={() => linkOutstanding(inv.id)} disabled={busyId === inv.id}>
                      <FaLink /> Link
                    </button>
                  )}
                  <button type="button" onClick={() => markPaid(inv)} disabled={busyId === inv.id} className={inv.status === "PAID" ? "is-active" : ""}>
                    <FaCheckCircle /> {inv.status === "PAID" ? "Paid" : "Mark paid"}
                  </button>
                  <button type="button" onClick={() => remove(inv.id)} disabled={busyId === inv.id} className="ol-inv-del">
                    <FaTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InvoiceListScreen;
