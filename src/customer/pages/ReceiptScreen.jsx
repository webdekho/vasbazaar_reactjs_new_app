import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPrint, FaFileDownload, FaCheckCircle } from "react-icons/fa";
import { useCustomerModern } from "../context/CustomerModernContext";
import { generateBillReceiptPdfBlob, getBillReceiptFileName, normalizeCcf } from "../utils/billReceiptPdf";
import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateFormat";

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

const ReceiptScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useCustomerModern();
  const data = location.state || {};
  const [downloading, setDownloading] = useState(false);

  const vb = data.viewBillResponse || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (vb[k] !== undefined && vb[k] !== null && vb[k] !== "") return vb[k];
    }
    return "";
  };

  const amount = Number(data.amount || 0);
  const ccf = normalizeCcf(data.ccf ?? data.statusPayload?.ccf ?? 0);
  const total = amount + ccf;
  // B-Connect Txn ID = NPCI Bharat Connect txnReferenceId, persisted by the
  // backend in vendorRefId (apirefid). refId/referenceId holds the biller's
  // approvalRefNumber (shown separately as "Approved Number"), so prefer
  // vendorRefId here — otherwise the field renders blank for most billers.
  const bConnectTxnId = data.statusPayload?.vendorRefId || data.statusPayload?.apirefid || data.bConnectTxnId || data.statusPayload?.referenceId || data.statusPayload?.refId || data.statusPayload?.ref_id || "";
  const txnId = data.txnId || data.statusPayload?.txnId || "";
  const billerName = data.operatorName || data.label || "";
  const billerId = data.operatorId || pick("billerId", "biller_id") || "";
  const customerName = userData?.name || userData?.customerName || [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") || "";
  const mobile = String(data.field1 || data.mobile || userData?.mobile || userData?.mobileNumber || "");
  const category = data.category || data.serviceName || data.service || data.label || "";
  const approvedNumber = data.statusPayload?.field1 || data.statusPayload?.approvalRefNumber || txnId || "";
  const paymentMode = String(data.paymentType || "web").toUpperCase();
  const paymentChannel = data.paymentChannel || "VasBazaar";
  const dateTime = data.dateTime || formatDisplayDateTime(new Date());

  const billDate = pick("billDate", "bill_date", "billdate");
  const billPeriod = pick("billPeriod", "bill_period", "billperiod");
  const billNumber = pick("billNumber", "bill_number", "billnumber");
  const dueDate = pick("dueDate", "due_date", "duedate");

  const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const leftRows = [
    ["Biller Name", dash(billerName)],
    ["Biller Id", dash(billerId)],
    ["B-Connect Txn ID", dash(bConnectTxnId)],
    ["Customer Name", dash(customerName)],
    ["Mobile Number", dash(mobile)],
    ["Bill Date", dash(billDate && formatDisplayDate(billDate, ""))],
    ["Bill Period", dash(billPeriod)],
    ["Bill Number", dash(billNumber)],
    ["Due Date", dash(dueDate && formatDisplayDate(dueDate, ""))],
  ];
  const rightRows = [
    ["Biller Amount", money(amount)],
    ["CCF", money(ccf)],
    ["Total Amount", money(total)],
    ["Txn Date & Time", dash(dateTime)],
    ["Payment Channel", dash(paymentChannel)],
    ["Payment Mode", dash(paymentMode)],
    ["Transaction Status", "Successful"],
    ["Approved Number", dash(approvedNumber)],
  ];

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await generateBillReceiptPdfBlob({
        bConnectTxnId, txnId, billerName, category, consumerNo: mobile,
        amount, ccf, status: "Successful", paymentMode, dateTime,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getBillReceiptFileName({ bConnectTxnId, txnId });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      console.log("Receipt generation error:", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rcpt-page">
      <button className="rcpt-back rcpt-noprint" type="button" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>

      <div className="rcpt-card rcpt-print-area">
        {/* Header: title left, Be-Assured logo right corner */}
        <div className="rcpt-head">
          <div className="rcpt-head-titles">
            <h1 className="rcpt-title">BILL PAY RECEIPT</h1>
            <div className="rcpt-success">
              <FaCheckCircle /> Transaction Successful !
            </div>
          </div>
          <img
            src="/images/b-assured.png"
            alt="Be-Assured"
            className="rcpt-ba-logo"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>

        {/* Two-column field grid */}
        <div className="rcpt-grid">
          <div className="rcpt-col">
            {leftRows.map(([label, value]) => (
              <div className="rcpt-row" key={label}>
                <span className="rcpt-row-label">{label}</span>
                <span className="rcpt-row-value">{value}</span>
              </div>
            ))}
          </div>
          <div className="rcpt-col">
            {rightRows.map(([label, value]) => (
              <div className="rcpt-row" key={label}>
                <span className="rcpt-row-label">{label}</span>
                <span className={`rcpt-row-value${label === "Transaction Status" ? " rcpt-row-value--ok" : ""}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rcpt-foot">Powered by VasBazaar · Bharat Connect (BBPS)</div>
      </div>

      {/* Actions */}
      <div className="rcpt-actions rcpt-noprint">
        <button type="button" className="rcpt-btn rcpt-btn--ghost" onClick={handlePrint}>
          <FaPrint /> Print Receipt
        </button>
        <button type="button" className="rcpt-btn rcpt-btn--primary" onClick={handleDownload} disabled={downloading}>
          <FaFileDownload /> {downloading ? "Generating..." : "Download Receipt"}
        </button>
      </div>
    </div>
  );
};

export default ReceiptScreen;
