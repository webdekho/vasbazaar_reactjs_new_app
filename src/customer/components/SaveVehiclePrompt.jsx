import { useState } from "react";
import { FaTruck, FaCheck, FaTimes, FaSpinner, FaBookmark } from "react-icons/fa";
import { savedVehicleService } from "../services/savedVehicleService";
import { sanitizeBackendMessage } from "../utils/userMessages";

/**
 * SaveVehiclePrompt - Prompts user to save vehicle after FASTag form submission
 *
 * Props:
 * - vehicleNumber: string - The vehicle registration number
 * - operatorId: number - The FASTag provider/operator ID
 * - operatorName: string - Provider name for display
 * - operatorLogo: string - Provider logo URL
 * - onSaved: () => void - Called after successfully saving
 * - onSkip: () => void - Called when user skips saving
 * - onClose: () => void - Called to close the prompt
 */
export default function SaveVehiclePrompt({
  vehicleNumber,
  operatorId,
  operatorName,
  operatorLogo,
  onSaved,
  onSkip,
  onClose,
}) {
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const res = await savedVehicleService.addVehicle({
      vehicleNumber: vehicleNumber.toUpperCase().replace(/\s|-/g, ""),
      operatorId: { id: operatorId }, // Backend expects OperatorEntity with id
      nickname: nickname.trim() || null,
    });

    setSaving(false);

    if (res.success) {
      onSaved?.();
    } else {
      const msg = res.message || "";
      // Check for duplicate error
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists")) {
        setError("This vehicle is already saved");
      } else {
        setError(sanitizeBackendMessage(msg, "Failed to save vehicle"));
      }
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <div className="cm-save-vehicle-prompt">
      <div className="cm-save-vehicle-prompt-header">
        <FaBookmark className="cm-save-vehicle-prompt-icon" />
        <h4 className="cm-save-vehicle-prompt-title">Save this vehicle?</h4>
      </div>

      <p className="cm-save-vehicle-prompt-desc">
        Save for quick recharges next time
      </p>

      <div className="cm-save-vehicle-prompt-info">
        <div className="cm-save-vehicle-prompt-row">
          <span className="cm-save-vehicle-prompt-label">Vehicle:</span>
          <span className="cm-save-vehicle-prompt-value">{vehicleNumber}</span>
        </div>
        <div className="cm-save-vehicle-prompt-row">
          <span className="cm-save-vehicle-prompt-label">Provider:</span>
          <span className="cm-save-vehicle-prompt-value">{operatorName || "FASTag"}</span>
        </div>
      </div>

      <div className="cm-form-group" style={{ marginTop: 12 }}>
        <label>Nickname (optional)</label>
        <input
          type="text"
          placeholder="e.g., Family Car, Office Vehicle"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          disabled={saving}
          className="cm-save-vehicle-input"
        />
      </div>

      {error && <p className="cm-form-error">{error}</p>}

      <div className="cm-save-vehicle-prompt-actions">
        <button
          type="button"
          className="cm-button cm-save-vehicle-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <FaSpinner className="cm-spin" /> : <FaCheck />}
          Save & Continue
        </button>
        <button
          type="button"
          className="cm-button-ghost cm-save-vehicle-skip-btn"
          onClick={handleSkip}
          disabled={saving}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

/**
 * SaveVehicleModal - Full modal version of the save prompt
 */
export function SaveVehicleModal({
  isOpen,
  vehicleNumber,
  operatorId,
  operatorName,
  operatorLogo,
  onSaved,
  onSkip,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal-content cm-modal-content--sm" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <h4>Save Vehicle</h4>
          <button type="button" className="cm-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="cm-modal-body">
          <SaveVehiclePromptContent
            vehicleNumber={vehicleNumber}
            operatorId={operatorId}
            operatorName={operatorName}
            operatorLogo={operatorLogo}
            onSaved={onSaved}
            onSkip={onSkip}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * SaveVehiclePromptContent - Just the content without the prompt card wrapper
 * Used inside modals or other containers
 */
function SaveVehiclePromptContent({
  vehicleNumber,
  operatorId,
  operatorName,
  onSaved,
  onSkip,
}) {
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const res = await savedVehicleService.addVehicle({
      vehicleNumber: vehicleNumber.toUpperCase().replace(/\s|-/g, ""),
      operatorId: { id: operatorId }, // Backend expects OperatorEntity with id
      nickname: nickname.trim() || null,
    });

    setSaving(false);

    if (res.success) {
      onSaved?.();
    } else {
      const msg = res.message || "";
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists")) {
        setError("This vehicle is already saved");
      } else {
        setError(sanitizeBackendMessage(msg, "Failed to save vehicle"));
      }
    }
  };

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <FaTruck style={{ fontSize: 40, color: "var(--cm-accent)", marginBottom: 8 }} />
        <p style={{ margin: 0, fontWeight: 600 }}>{vehicleNumber}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--cm-muted)" }}>{operatorName}</p>
      </div>

      <div className="cm-form-group">
        <label>Nickname (optional)</label>
        <input
          type="text"
          placeholder="e.g., Family Car"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          disabled={saving}
        />
      </div>

      {error && <p className="cm-form-error" style={{ marginTop: 8 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          className="cm-button"
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? <FaSpinner className="cm-spin" /> : <FaCheck />}
          Save
        </button>
        <button
          type="button"
          className="cm-button-ghost"
          onClick={onSkip}
          disabled={saving}
          style={{ flex: 1 }}
        >
          Skip
        </button>
      </div>
    </>
  );
}
