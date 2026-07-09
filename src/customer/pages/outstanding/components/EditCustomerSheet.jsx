import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";

const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");

const EditCustomerSheet = ({ customer, onClose, onSaved }) => {
  const [name, setName] = useState(customer?.customerName || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [category, setCategory] = useState(customer?.category || "REGULAR");
  const [creditLimit, setCreditLimit] = useState(
    customer?.creditLimit != null ? String(Math.round(Number(customer.creditLimit))) : ""
  );
  const [dueDate, setDueDate] = useState(toDateInput(customer?.dueDate));
  const [promiseDate, setPromiseDate] = useState(toDateInput(customer?.promiseToPayDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }
    setSubmitting(true);
    const res = await outstandingService.updateCustomer(customer.id, {
      customerName: name.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      category,
      creditLimit: creditLimit.trim() === "" ? null : Number(creditLimit),
      dueDate: dueDate || null,
      promiseToPayDate: promiseDate || null,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.message || "Failed to update customer");
      return;
    }
    onSaved?.(res.data);
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className="cm-sheet is-open ol-sheet">
        <div className="cm-sheet-header">
          <h2>Customer settings</h2>
          <button className="cm-sheet-close" type="button" onClick={onClose}><FaTimes /></button>
        </div>
        <form onSubmit={submit} className="ol-form">
          <label className="ol-field">
            <span>Customer Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </label>

          <label className="ol-field">
            <span>Customer category</span>
            <div className="ol-category-grid" role="radiogroup" aria-label="Customer category">
              {[
                ["REGULAR", "Regular"],
                ["RISKY", "Risky"],
                ["VIP", "VIP"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`ol-category-chip ol-cat-${value.toLowerCase()}${category === value ? " is-active" : ""}`}
                  onClick={() => setCategory(value)}
                  aria-pressed={category === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>

          <label className="ol-field">
            <span>Customer address (optional)</span>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Billing address"
              maxLength={255}
            />
          </label>

          <label className="ol-field">
            <span>Credit limit (optional)</span>
            <div className="ol-amount-input">
              <span>₹</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="No limit"
              />
            </div>
          </label>

          <label className="ol-field">
            <span>Due date (optional)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>

          <label className="ol-field">
            <span>Promise to pay date (optional)</span>
            <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
          </label>

          <label className="ol-field">
            <span>Notes (optional)</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. shop reference, address"
            />
          </label>

          {error && <div className="ol-error">{error}</div>}

          <div className="ol-form-actions">
            <button type="button" className="cm-button-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="cm-button" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default EditCustomerSheet;
