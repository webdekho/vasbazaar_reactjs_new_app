import { useRef, useState } from "react";
import { FaTimes, FaCamera, FaTrash, FaMicrophone, FaStop } from "react-icons/fa";
import { outstandingService } from "../../../services/outstandingService";
import { captureBillPhoto } from "../../../utils/billPhoto";
import { isVoiceSupported, startVoiceCapture, SUPPORTED_VOICE_LANGS } from "../../../utils/voiceInput";
import { parseVoiceTransaction } from "../../../utils/parseVoiceTransaction";

const AddTxnSheet = ({ type, customer, transaction, onClose, onAdded }) => {
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!transaction?.id;
  const initialPaymentMode = transaction?.paymentMode || (type === "GOT" ? "UPI" : "CASH");
  const [amount, setAmount] = useState(transaction?.amount ? String(Math.round(Number(transaction.amount))) : "");
  const [date, setDate] = useState(transaction?.txnDate ? String(transaction.txnDate).slice(0, 10) : today);
  const [note, setNote] = useState(transaction?.note || "");
  const [paymentMode, setPaymentMode] = useState(initialPaymentMode);
  const [paymentReference, setPaymentReference] = useState(transaction?.paymentReference || "");
  const [notify, setNotify] = useState(!!customer?.isAppUser);
  const [billImage, setBillImage] = useState(transaction?.billImage || "");
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const voiceSupported = isVoiceSupported();
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const stopVoiceRef = useRef(null);

  const applyTranscript = (text) => {
    const parsed = parseVoiceTransaction(text);
    if (parsed.amount != null) setAmount(String(parsed.amount));
    // Always take the latest transcript's note — speech recognisers refine
    // their guess as you speak (e.g. "बीस" → "बिस्किट"), so the first interim
    // must NOT stick. Only overwrite when this transcript yields a note.
    if (parsed.note) setNote(parsed.note);
  };

  const toggleVoice = () => {
    if (listening) {
      stopVoiceRef.current?.();
      return;
    }
    setError("");
    setTranscript("");
    setListening(true);
    stopVoiceRef.current = startVoiceCapture({
      lang: voiceLang,
      onResult: (text) => {
        setTranscript(text);
        applyTranscript(text);
      },
      onError: (err) => {
        setListening(false);
        setError(err?.message || "Voice capture failed");
      },
      onEnd: (finalText) => {
        setListening(false);
        if (finalText) applyTranscript(finalText);
      },
    });
  };

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
  const showPaymentReference = paymentMode === "UPI" || paymentMode === "ONLINE_TRANSFER";

  const creditLimit = customer?.creditLimit != null ? Number(customer.creditLimit) : null;
  const currentBalance = Number(customer?.balance || 0);
  const projectedBalance = isGave ? currentBalance + Number(amount || 0) : currentBalance;
  const creditPct = creditLimit && creditLimit > 0
    ? Math.round((Math.max(0, projectedBalance) / creditLimit) * 100)
    : null;
  const creditExceeded = isGave && creditLimit != null && projectedBalance > creditLimit;
  const creditWarning = isGave && creditPct != null && creditPct >= 80 && Number(amount) > 0;
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
      paymentMode,
      paymentReference: showPaymentReference ? paymentReference.trim() || null : null,
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
          {voiceSupported && (
            <div className="ol-voice-box">
              <div className="ol-voice-row">
                <div className="ol-voice-copy">
                  <b>{listening ? "Listening…" : "Speak the entry"}</b>
                  <small>{transcript ? `“${transcript}”` : "e.g. \"500 doodh\" / \"पाचशे उधार\""}</small>
                </div>
                <div className="ol-voice-langs">
                  {SUPPORTED_VOICE_LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`ol-voice-lang${voiceLang === l.code ? " is-active" : ""}`}
                      onClick={() => setVoiceLang(l.code)}
                      disabled={listening}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`ol-voice-mic${listening ? " is-listening" : ""}`}
                  onClick={toggleVoice}
                  aria-label={listening ? "Stop voice entry" : "Start voice entry"}
                >
                  {listening ? <FaStop /> : <FaMicrophone />}
                </button>
              </div>
            </div>
          )}

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

          {creditWarning && (
            <div className={`ol-credit-warn${creditExceeded ? " is-exceeded" : ""}`}>
              {creditExceeded
                ? `This entry crosses the ₹${Math.round(creditLimit).toLocaleString("en-IN")} credit limit (${creditPct}% used).`
                : `Heads up: this customer will be at ${creditPct}% of the ₹${Math.round(creditLimit).toLocaleString("en-IN")} credit limit.`}
            </div>
          )}

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
            <span>Collection mode</span>
            <div className="ol-payment-mode-grid" role="radiogroup" aria-label="Collection mode">
              {[
                ["CASH", "Cash"],
                ["UPI", "UPI"],
                ["ONLINE_TRANSFER", "Online Transfer"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`ol-payment-mode${paymentMode === value ? " is-active" : ""}`}
                  onClick={() => {
                    setPaymentMode(value);
                    if (value === "CASH") setPaymentReference("");
                  }}
                  aria-pressed={paymentMode === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showPaymentReference && (
            <label className="ol-field">
              <span>UTR / Bank reference (optional)</span>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR1234567890"
                maxLength={100}
              />
            </label>
          )}

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
