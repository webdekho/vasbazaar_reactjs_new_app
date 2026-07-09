import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaBuilding, FaPen, FaSave } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { useToast } from "../../context/ToastContext";

const today = () => new Date().toISOString().slice(0, 10);

const formatINR = (n) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;

const emptyItem = () => ({ description: "", quantity: "1", rate: "" });

const CreateInvoiceScreen = () => {
  const navigate = useNavigate();
  const { customerId, invoiceId } = useParams();
  const isEdit = Boolean(invoiceId);
  const { showToast } = useToast();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(isEdit);
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

  // Organisation snapshot (seller's own details)
  const [includeOrg, setIncludeOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgGstNumber, setOrgGstNumber] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");

  // Outstanding linkage choice
  const [addAsOutstanding, setAddAsOutstanding] = useState(true);

  const setGstField = (key, field, value) =>
    setGst((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await outstandingService.getCustomerDetail(customerId, 0, 1);
      if (!active || !res.success) return;
      const cust = res.data?.customer || null;
      setCustomer(cust);
      // Carry the customer's saved GST number into new invoices automatically.
      if (!isEdit && cust?.gstNumber) {
        setGstNumber(cust.gstNumber);
        setB2b(true);
      }
    })();
    return () => { active = false; };
  }, [customerId, isEdit]);

  // Prefill organisation from the saved business profile (create mode only).
  useEffect(() => {
    if (isEdit) return;
    let active = true;
    (async () => {
      const res = await outstandingService.getBusinessProfile();
      if (!active || !res.success || !res.data) return;
      const p = res.data;
      setOrgName(p.orgName || "");
      setOrgAddress(p.address || "");
      setOrgGstNumber(p.gstNumber || "");
      setOrgLogoUrl(p.logoUrl || "");
      if (p.orgName || p.address || p.logoUrl) setIncludeOrg(true);
    })();
    return () => { active = false; };
  }, [isEdit]);

  // Edit mode: load the existing invoice and prefill all fields.
  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    (async () => {
      const res = await outstandingService.getInvoice(invoiceId);
      if (!active) return;
      if (!res.success || !res.data) {
        setError(res.message || "Invoice load करता आली नाही");
        setLoading(false);
        return;
      }
      const inv = res.data;
      if (inv.editable === false) {
        showToast("ही invoice आता edit करता येणार नाही", "info");
        navigate(`/customer/app/outstanding/${customerId}/invoices`, { replace: true });
        return;
      }
      setInvoiceDate(inv.invoiceDate ? String(inv.invoiceDate).slice(0, 10) : today());
      setDueDate(inv.dueDate ? String(inv.dueDate).slice(0, 10) : "");
      setItems((inv.items || []).length
        ? inv.items.map((it) => ({ description: it.description || "", quantity: String(it.quantity ?? "1"), rate: String(it.rate ?? "") }))
        : [emptyItem()]);
      setGst({
        SGST: { on: Number(inv.sgstPercent) > 0, pct: String(Number(inv.sgstPercent) || 9) },
        CGST: { on: Number(inv.cgstPercent) > 0, pct: String(Number(inv.cgstPercent) || 9) },
        IGST: { on: Number(inv.igstPercent) > 0, pct: String(Number(inv.igstPercent) || 18) },
      });
      setB2b(Boolean(inv.b2b));
      setGstNumber(inv.gstNumber || "");
      setNotes(inv.notes || "");
      setIncludeOrg(Boolean(inv.includeOrg));
      setOrgName(inv.orgName || "");
      setOrgAddress(inv.orgAddress || "");
      setOrgGstNumber(inv.orgGstNumber || "");
      setOrgLogoUrl(inv.orgLogoUrl || "");
      setAddAsOutstanding(Boolean(inv.addAsOutstanding));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [isEdit, invoiceId, customerId, navigate, showToast]);

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const [savingOrg, setSavingOrg] = useState(false);
  const saveOrg = async () => {
    if (!orgName.trim() && !orgAddress.trim() && !orgGstNumber.trim()) {
      showToast("Organisation details भरा", "info");
      return;
    }
    setSavingOrg(true);
    const res = await outstandingService.saveBusinessProfile({
      orgName: orgName.trim(),
      address: orgAddress.trim(),
      gstNumber: orgGstNumber.trim().toUpperCase(),
    });
    setSavingOrg(false);
    showToast(
      res.success ? "Organisation details सेव्ह झाले" : (res.message || "सेव्ह करता आले नाही"),
      res.success ? "success" : "error"
    );
  };

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
    const payload = {
      customerId: Number(customerId),
      invoiceDate,
      dueDate: dueDate || null,
      sgstPercent: compPct("SGST"),
      cgstPercent: compPct("CGST"),
      igstPercent: compPct("IGST"),
      b2b,
      gstNumber: b2b ? gstNumber.trim().toUpperCase() : null,
      notes: notes.trim() || null,
      includeOrg,
      orgName: includeOrg ? orgName.trim() || null : null,
      orgAddress: includeOrg ? orgAddress.trim() || null : null,
      orgGstNumber: includeOrg ? orgGstNumber.trim().toUpperCase() || null : null,
      orgLogoUrl: includeOrg ? orgLogoUrl || null : null,
      addAsOutstanding,
      items: validItems.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity || 1),
        rate: Number(it.rate || 0),
      })),
    };
    const res = isEdit
      ? await outstandingService.updateInvoice(invoiceId, payload)
      : await outstandingService.createInvoice(payload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.message || `Failed to ${isEdit ? "update" : "create"} invoice`);
      return;
    }
    showToast(isEdit ? "Invoice अपडेट झाली" : "Invoice तयार झाली", "success");
    navigate(`/customer/app/outstanding/${customerId}/invoices`, { replace: true });
  };

  if (loading) {
    return (
      <div className="ol-page ol-invoice-page">
        <div className="ol-list">{[0, 1, 2].map((i) => <div key={i} className="ol-item ol-skeleton" />)}</div>
      </div>
    );
  }

  return (
    <div className="ol-page ol-invoice-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name"><span className="ol-ledger-name-text">{isEdit ? "Edit Invoice" : "New Invoice"}</span></div>
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

        {/* ===== Organisation details ===== */}
        <div className="ol-inv-opt">
          <label className="ol-toggle-row">
            <span><FaBuilding style={{ marginRight: 8, opacity: 0.7 }} />Add organisation details</span>
            <input type="checkbox" checked={includeOrg} onChange={(e) => setIncludeOrg(e.target.checked)} />
          </label>
          {includeOrg ? (
            <div className="ol-org-fields">
              {orgLogoUrl ? (
                <div className="ol-org-logo-preview"><img src={orgLogoUrl} alt="Logo" /></div>
              ) : null}
              <input
                className="ol-inv-desc"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organisation name"
                maxLength={150}
              />
              <textarea
                className="ol-inv-desc"
                rows={2}
                value={orgAddress}
                onChange={(e) => setOrgAddress(e.target.value)}
                placeholder="Address"
                maxLength={255}
                style={{ marginTop: 8 }}
              />
              <input
                className="ol-inv-desc"
                type="text"
                value={orgGstNumber}
                onChange={(e) => setOrgGstNumber(e.target.value.toUpperCase())}
                placeholder="Your GST number (optional)"
                maxLength={20}
                style={{ marginTop: 8 }}
              />
              <div className="ol-org-actions">
                <button
                  type="button"
                  className="ol-org-edit-link"
                  onClick={() => navigate(`/customer/app/outstanding/business-profile`)}
                >
                  <FaPen /> Edit saved business profile &amp; logo
                </button>
                <button
                  type="button"
                  className="ol-org-save-link"
                  onClick={saveOrg}
                  disabled={savingOrg}
                >
                  <FaSave /> {savingOrg ? "Saving…" : "Save organisation"}
                </button>
              </div>
            </div>
          ) : (
            <div className="ol-b2c-hint">Invoice will be created without your organisation header.</div>
          )}
        </div>

        {/* ===== Customer (bill to) details ===== */}
        <div className="ol-inv-opt">
          <div className="ol-gst-title">Customer details</div>
          <input
            className="ol-inv-desc"
            type="text"
            value={customer?.customerName || ""}
            placeholder="Customer name"
            readOnly
          />
          <input
            className="ol-inv-desc"
            type="text"
            value={customer?.customerMobile || ""}
            placeholder="Mobile number"
            readOnly
            style={{ marginTop: 8 }}
          />

          {/* Customer GST number */}
          <label className="ol-toggle-row" style={{ marginTop: 8 }}>
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

        {/* ===== Outstanding vs paid invoice ===== */}
        <div className="ol-inv-opt">
          <div className="ol-gst-title">Save as</div>
          <div className="ol-seg">
            <button
              type="button"
              className={`ol-seg-btn ${addAsOutstanding ? "is-active" : ""}`}
              onClick={() => setAddAsOutstanding(true)}
            >
              Add to Outstanding (Without Payment / Credit)
            </button>
            <button
              type="button"
              className={`ol-seg-btn ${!addAsOutstanding ? "is-active" : ""}`}
              onClick={() => setAddAsOutstanding(false)}
            >
              Just an Invoice (With Payment)
            </button>
          </div>
          <div className="ol-b2c-hint">
            {addAsOutstanding
              ? "This invoice's total is added to the customer's outstanding balance as credit, and a registered customer can view it on their login."
              : "Records the sale and the payment in the customer's ledger without changing the outstanding balance."}
          </div>
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
          {submitting ? "Saving…" : `${isEdit ? "Update" : "Create"} invoice · ${formatINR(total)}`}
        </button>
      </form>
    </div>
  );
};

export default CreateInvoiceScreen;
