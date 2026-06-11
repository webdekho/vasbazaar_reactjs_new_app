import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { useToast } from "../../context/ToastContext";

const today = () => new Date().toISOString().slice(0, 10);

const formatINR = (n) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;

const emptyItem = () => ({ description: "", quantity: "1", rate: "" });

const CreateInvoiceScreen = () => {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const { showToast } = useToast();
  const [customer, setCustomer] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [gst, setGst] = useState({
    SGST: { on: false, pct: "9" },
    CGST: { on: false, pct: "9" },
    IGST: { on: false, pct: "18" },
  });
  const [b2b, setB2b] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [notes, setNotes] = useState("");

  const setGstField = (key, field, value) =>
    setGst((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await outstandingService.getCustomerDetail(customerId, 0, 1);
      if (active && res.success) setCustomer(res.data?.customer || null);
    })();
    return () => { active = false; };
  }, [customerId]);

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const GST_TYPES = ["SGST", "CGST", "IGST"];
  const lineAmount = (it) => Number(it.quantity || 0) * Number(it.rate || 0);
  const subtotal = items.reduce((sum, it) => sum + lineAmount(it), 0);
  const compPct = (k) => (gst[k].on ? Number(gst[k].pct || 0) : 0);
  const compAmount = (k) => Math.round(subtotal * compPct(k)) / 100;
  const taxAmount = GST_TYPES.reduce((s, k) => s + compAmount(k), 0);
  const total = subtotal + taxAmount;

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    const validItems = items.filter((it) => it.description.trim() && Number(it.rate) >= 0);
    if (validItems.length === 0) {
      setError("Add at least one item with a description");
      return;
    }
    if (GST_TYPES.some((k) => gst[k].on && (!Number(gst[k].pct) || Number(gst[k].pct) <= 0))) {
      setError("Enter a valid % for the selected GST.");
      return;
    }
    if (b2b && !gstNumber.trim()) {
      setError("Enter the customer's GST number, or untick B2B.");
      return;
    }
    setSubmitting(true);
    const res = await outstandingService.createInvoice({
      customerId: Number(customerId),
      invoiceDate,
      dueDate: dueDate || null,
      sgstPercent: compPct("SGST"),
      cgstPercent: compPct("CGST"),
      igstPercent: compPct("IGST"),
      b2b,
      gstNumber: b2b ? gstNumber.trim().toUpperCase() : null,
      notes: notes.trim() || null,
      items: validItems.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity || 1),
        rate: Number(it.rate || 0),
      })),
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.message || "Failed to create invoice");
      return;
    }
    showToast("Invoice तयार झाली", "success");
    navigate(`/customer/app/outstanding/${customerId}/invoices`, { replace: true });
  };

  return (
    <div className="ol-page ol-invoice-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name"><span className="ol-ledger-name-text">New Invoice</span></div>
          {customer && <div className="ol-ledger-mobile">For {customer.customerName}</div>}
        </div>
      </div>

      <form onSubmit={submit} className="ol-form">
        <div className="ol-inv-dates">
          <label className="ol-field">
            <span>Invoice date</span>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
          <label className="ol-field">
            <span>Due date (optional)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        <div className="ol-section-head-row">
          <h3 className="ol-section-head">Items</h3>
        </div>

        {items.map((it, index) => (
          <div className="ol-inv-item" key={index}>
            <input
              className="ol-inv-desc"
              type="text"
              value={it.description}
              onChange={(e) => updateItem(index, "description", e.target.value)}
              placeholder="Item / service description"
              maxLength={255}
            />
            <div className="ol-inv-item-row">
              <label className="ol-inv-mini">
                <span>Qty</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={it.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                />
              </label>
              <label className="ol-inv-mini">
                <span>Rate ₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={it.rate}
                  onChange={(e) => updateItem(index, "rate", e.target.value)}
                  placeholder="0"
                />
              </label>
              <div className="ol-inv-amt">{formatINR(lineAmount(it))}</div>
              <button
                type="button"
                className="ol-inv-remove"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
                aria-label="Remove item"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="ol-inv-add" onClick={addItem}>
          <FaPlus /> Add item
        </button>

        <div className="ol-inv-opt">
          <div className="ol-gst-title">GST / Tax</div>
          {GST_TYPES.map((key) => (
            <div className="ol-gst-block" key={key}>
              <label className="ol-toggle-row">
                <span>{key}</span>
                <input type="checkbox" checked={gst[key].on} onChange={(e) => setGstField(key, "on", e.target.checked)} />
              </label>
              {gst[key].on && (
                <div className="ol-inv-tax-row">
                  <div className="ol-pct-input">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      value={gst[key].pct}
                      onChange={(e) => setGstField(key, "pct", e.target.value)}
                      placeholder="0"
                    />
                    <span>%</span>
                  </div>
                  <span className="ol-inv-tax-amt">= {formatINR(compAmount(key))}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ol-inv-opt">
          <label className="ol-toggle-row">
            <span>Customer has GST number (B2B)</span>
            <input type="checkbox" checked={b2b} onChange={(e) => setB2b(e.target.checked)} />
          </label>
          {b2b ? (
            <input
              className="ol-inv-desc"
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="Customer GSTIN (e.g. 27ABCDE1234F1Z5)"
              maxLength={20}
              style={{ marginTop: 8 }}
            />
          ) : (
            <div className="ol-b2c-hint">Billed as B2C (no GST number)</div>
          )}
        </div>

        <label className="ol-field">
          <span>Notes (optional)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Terms, thank-you note, etc." />
        </label>

        <div className="ol-inv-totals">
          <div><span>Subtotal</span><b>{formatINR(subtotal)}</b></div>
          {GST_TYPES.filter((k) => gst[k].on && compAmount(k) > 0).map((k) => (
            <div key={k}><span>{k} ({compPct(k)}%)</span><b>{formatINR(compAmount(k))}</b></div>
          ))}
          <div className="ol-inv-total-line"><span>Total</span><b>{formatINR(total)}</b></div>
        </div>

        {error && <div className="ol-error">{error}</div>}

        <button type="submit" className="ol-inv-submit" disabled={submitting}>
          {submitting ? "Saving…" : `Create invoice · ${formatINR(total)}`}
        </button>
      </form>
    </div>
  );
};

export default CreateInvoiceScreen;
