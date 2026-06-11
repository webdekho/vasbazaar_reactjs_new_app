import { useState } from "react";
import { FaTimes } from "react-icons/fa";

const initials = (name = "") =>
  name.trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const formatINR = (n) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;

const SettlePaymentSheet = ({ payeeName, selfName, defaultAmount, onClose, onPayAndSettle, onManual, busy }) => {
  const [amount, setAmount] = useState(
    defaultAmount && Number(defaultAmount) > 0 ? String(Math.round(Number(defaultAmount))) : ""
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const guard = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount.");
      return null;
    }
    setError("");
    return { amount: amt, note: note.trim() };
  };

  const pay = () => {
    const p = guard();
    if (p) onPayAndSettle(p);
  };
  const manual = () => {
    const p = guard();
    if (p) onManual(p);
  };

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={busy ? undefined : onClose} />
      <div className="cm-sheet is-open ol-sheet">
        <div className="cm-sheet-header">
          <h2>Record a payment</h2>
          <button className="cm-sheet-close" type="button" onClick={onClose} disabled={busy}><FaTimes /></button>
        </div>

        <div className="ol-settle-parties">
          <span className="ol-settle-avatar">{initials(selfName)}</span>
          <span className="ol-settle-names">
            <b>{selfName || "You"}</b> <span className="ol-settle-pays">pays</span> <b>{payeeName}</b>
          </span>
          <span className="ol-settle-avatar">{initials(payeeName)}</span>
        </div>

        <div className="ol-form">
          <label className="ol-field">
            <span>Amount (INR)</span>
            <div className="ol-amount-input">
              <span>₹</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                disabled={busy}
              />
            </div>
          </label>

          <label className="ol-field">
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UPI, cash, bank transfer…"
              maxLength={200}
              disabled={busy}
            />
          </label>

          <div className="ol-settle-banner">
            Pay online and {payeeName} gets it in their VasBazaar wallet instantly — no confirmation needed.
          </div>

          {error && <div className="ol-error">{error}</div>}

          <button type="button" className="cm-button ol-settle-pay-btn" onClick={pay} disabled={busy}>
            {busy ? "Starting…" : `Pay ${formatINR(amount)} & settle`}
          </button>
          <button type="button" className="cm-button-ghost ol-settle-manual-btn" onClick={manual} disabled={busy}>
            Record manually instead
          </button>
        </div>
      </div>
    </>
  );
};

export default SettlePaymentSheet;
