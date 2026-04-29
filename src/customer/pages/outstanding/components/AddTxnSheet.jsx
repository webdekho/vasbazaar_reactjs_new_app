import { useState } from "react";
import { FaTimes, FaCamera, FaTrash } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";
import { captureBillPhoto } from "../../../utils/billPhoto";

const AddTxnSheet = ({ type, customer, transaction, onClose, onAdded }) => {
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!transaction?.id;
  const [amount, setAmount] = useState(transaction?.amount ? String(Math.round(Number(transaction.amount))) : "");
  const [date, setDate] = useState(transaction?.txnDate ? String(transaction.txnDate).slice(0, 10) : today);
  const [note, setNote] = useState(transaction?.note || "");
  const [notify, setNotify] = useState(!!customer?.isAppUser);
  const [billImage, setBillImage] = useState(transaction?.billImage || "");
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onCaptureBill = async (sourcePref) => {
    setError("");
    setCapturing(true);
    try {
      const dataUrl = await captureBillPhoto(sourcePref);
      if (dataUrl) setBillImage(dataUrl);
    } catch (ex) {
      setError(ex?.message || "Could not capture photo");
    } finally {
      setCapturing(false);
    }
  };

  const isGave = type === "GAVE";
  const heading = isEdit
    ? `Edit ${isGave ? "You Gave" : "You Got"}`
    : isGave ? `You Gave to ${customer.customerName}` : `You Got from ${customer.customerName}`;

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount greater than zero");
      return;
    }
    setSubmitting(true);
    const payload = {
      type,
      amount: amt,
      txnDate: date,
      note: note.trim() || null,
      notify,
      billImage: billImage || null,
    };
    const res = isEdit
      ? await outstandingService.updateTransaction(transaction.id, payload)
      : await outstandingService.addTransaction(customer.id, payload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.message || "Failed to record transaction");
      return;
    }
    onAdded?.(res.data);
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className={`cm-sheet is-open ol-sheet ${isGave ? "ol-sheet-gave" : "ol-sheet-got"}`}>
        <div className="cm-sheet-header">
          <h2>{heading}</h2>
          <button className="cm-sheet-close" type="button" onClick={onClose}><FaTimes /></button>
        </div>
        <form onSubmit={submit} className="ol-form">
          <label className="ol-field">
            <span>Amount *</span>
            <div className="ol-amount-input">
              <span>₹</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                required
              />
            </div>
          </label>

          <label className="ol-field">
            <span>Date</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="ol-field">
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. milk, sugar, advance"
              maxLength={255}
            />
          </label>

          <div className="ol-field">
            <span>Bill photo (optional)</span>
            {billImage ? (
              <div style={{ position: "relative", marginTop: 6 }}>
                <img
                  src={billImage}
                  alt="Bill"
                  style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, background: "#f4f4f4" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => onCaptureBill("prompt")}
                    disabled={capturing}
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <FaCamera /> Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillImage("")}
                    style={{ padding: "8px 12px", border: "1px solid #f3c7c7", background: "#fff5f5", color: "#c62828", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <FaTrash /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onCaptureBill("prompt")}
                disabled={capturing}
                style={{ marginTop: 6, padding: "12px", border: "1px dashed #bbb", background: "#fafafa", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#555" }}
              >
                <FaCamera /> {capturing ? "Opening camera…" : "Capture bill photo"}
              </button>
            )}
          </div>

          {!isEdit && (
            <label className="ol-checkbox">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>Notify customer (in-app + WhatsApp link)</span>
            </label>
          )}

          {error && <div className="ol-error">{error}</div>}

          <button type="submit" className={`cm-button ol-submit-${isGave ? "gave" : "got"}`} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save Changes" : "Save Entry"}
          </button>
        </form>
      </div>
    </>
  );
};

export default AddTxnSheet;
