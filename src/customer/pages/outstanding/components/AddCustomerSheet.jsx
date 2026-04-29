import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";

const AddCustomerSheet = ({ onClose, onAdded }) => {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!/^[0-9]{10}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }
    setSubmitting(true);
    const res = await outstandingService.addCustomer({
      customerMobile: mobile,
      customerName: name.trim(),
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.message || "Failed to add customer");
      return;
    }
    onAdded?.(res.data);
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className="cm-sheet is-open ol-sheet">
        <div className="cm-sheet-header">
          <h2>Add Customer</h2>
          <button className="cm-sheet-close" type="button" onClick={onClose}><FaTimes /></button>
        </div>
        <form onSubmit={submit} className="ol-form">
          <label className="ol-field">
            <span>Mobile Number *</span>
            <div className="ol-mobile-input">
              <span className="ol-mobile-prefix">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{10}"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile"
                required
              />
            </div>
          </label>

          <label className="ol-field">
            <span>Customer Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              maxLength={120}
              required
            />
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

export default AddCustomerSheet;
