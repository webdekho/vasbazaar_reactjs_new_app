import { useState } from "react";
import { FaTimes, FaAddressBook } from "react-icons/fa";
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";
import { outstandingService } from "../../../services/outstandingService";

const isNativePlatform = Capacitor.isNativePlatform();

const AddCustomerSheet = ({ onClose, onAdded }) => {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("REGULAR");
  const [creditLimit, setCreditLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pickingContact, setPickingContact] = useState(false);

  const pickFromContacts = async () => {
    if (pickingContact) return;
    setError("");
    setPickingContact(true);
    try {
      const perm = await Contacts.requestPermissions();
      if (perm.contacts !== "granted") {
        setError("Permission to access contacts was denied");
        return;
      }
      const result = await Contacts.pickContact({
        projection: { name: true, phones: true },
      });
      const picked = result?.contact;
      if (!picked) return;

      const rawPhone = picked.phones?.[0]?.number || "";
      const digits = rawPhone.replace(/\D/g, "").slice(-10);
      const displayName = picked.name?.display
        || [picked.name?.given, picked.name?.family].filter(Boolean).join(" ").trim();

      if (digits.length === 10) {
        setMobile(digits);
      } else {
        setError("Selected contact has no valid 10-digit number");
      }
      if (displayName) setName(displayName);
    } catch (err) {
      setError("Could not open contacts");
    } finally {
      setPickingContact(false);
    }
  };

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
      organisationName: organisationName.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      category,
      creditLimit: creditLimit.trim() === "" ? null : Number(creditLimit),
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
              {isNativePlatform && (
                <button
                  type="button"
                  className="ol-contact-btn"
                  onClick={pickFromContacts}
                  disabled={pickingContact || submitting}
                  aria-label="Pick from contacts"
                  title="Pick from contacts"
                >
                  <FaAddressBook />
                </button>
              )}
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
            <span>Customer Organisation name (optional)</span>
            <input
              type="text"
              value={organisationName}
              onChange={(e) => setOrganisationName(e.target.value)}
              placeholder="Business / company name"
              maxLength={150}
            />
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
