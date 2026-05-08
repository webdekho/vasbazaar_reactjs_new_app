import { useState, useEffect, useCallback } from "react";
import {
  FaPlus,
  FaTruck,
  FaChevronRight,
  FaPen,
  FaTrash,
  FaTimes,
  FaCheck,
  FaSpinner,
  FaExclamationCircle,
  FaArrowLeft,
} from "react-icons/fa";
import { savedVehicleService } from "../services/savedVehicleService";
import { sanitizeBackendMessage } from "../utils/userMessages";

const FAVICON_SRC = "/favicon.png";
const handleLogoError = (e) => {
  if (e.currentTarget.dataset.fallback === "1") return;
  e.currentTarget.dataset.fallback = "1";
  e.currentTarget.src = FAVICON_SRC;
};

/**
 * SavedVehicleList - Displays user's saved FASTag vehicles
 *
 * Props:
 * - vehicles: array - Pre-fetched vehicles list (optional, will fetch if not provided)
 * - isLoading: boolean - Loading state from parent (optional)
 * - onSelect: (vehicle) => void - Called when user selects a vehicle to recharge
 * - onAddNew: () => void - Called when user wants to add new vehicle
 * - onBack: () => void - Called when user presses back
 * - serviceName: string - Service name for header
 * - onRefresh: () => void - Called to refresh list from parent
 */
export default function SavedVehicleList({
  vehicles: propVehicles,
  isLoading: propLoading,
  onSelect,
  onAddNew,
  onBack,
  serviceName = "FASTag",
  onRefresh,
}) {
  const [localVehicles, setLocalVehicles] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState("");

  // Use prop vehicles if provided, otherwise use local state
  const vehicles = propVehicles || localVehicles;
  const loading = propLoading !== undefined ? propLoading : localLoading;

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVehicles = useCallback(async () => {
    // If parent provides vehicles, use onRefresh instead
    if (propVehicles !== undefined && onRefresh) {
      onRefresh();
      return;
    }
    setLocalLoading(true);
    setError("");
    const res = await savedVehicleService.getSavedVehicles();
    if (res.success) {
      const list = res.data?.records || res.data?.content || (Array.isArray(res.data) ? res.data : []);
      setLocalVehicles(list);
    } else {
      setError(sanitizeBackendMessage(res.message, "Failed to load saved vehicles"));
    }
    setLocalLoading(false);
  }, [propVehicles, onRefresh]);

  // Only fetch if no vehicles prop provided
  useEffect(() => {
    if (propVehicles === undefined) {
      fetchVehicles();
    }
  }, [propVehicles, fetchVehicles]);

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setNickname(vehicle.nickname || "");
    setEditError("");
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingVehicle(null);
    setNickname("");
    setEditError("");
  };

  const handleSaveNickname = async () => {
    if (!editingVehicle) return;
    setSubmitting(true);
    setEditError("");
    const res = await savedVehicleService.updateVehicle({
      id: editingVehicle.id,
      nickname: nickname.trim(),
    });
    setSubmitting(false);
    if (res.success) {
      closeEditModal();
      fetchVehicles();
    } else {
      setEditError(sanitizeBackendMessage(res.message, "Failed to update nickname"));
    }
  };

  const handleDeleteClick = (vehicle) => {
    setDeletingVehicle(vehicle);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingVehicle(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingVehicle) return;
    setDeleting(true);
    const res = await savedVehicleService.deleteVehicle(deletingVehicle.id);
    setDeleting(false);
    if (res.success) {
      closeDeleteConfirm();
      fetchVehicles();
    } else {
      setError(sanitizeBackendMessage(res.message, "Failed to delete vehicle"));
      closeDeleteConfirm();
    }
  };

  return (
    <div className="bf-step">
      {/* Header */}
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <h1>My {serviceName} Vehicles</h1>
      </div>

      <div className="cm-vehicle-tab">
        {/* Add New Button */}
        <div className="cm-vehicle-header">
          <span className="cm-vehicle-subtitle">Select a vehicle to recharge</span>
          <button type="button" className="cm-vehicle-add-btn" onClick={onAddNew}>
            <FaPlus /> Add New
          </button>
        </div>

      {/* Vehicle List */}
      {loading ? (
        <div className="cm-contact-empty">
          <span className="cm-contact-loading" />
          <p>Loading saved vehicles...</p>
        </div>
      ) : error ? (
        <div className="cm-contact-empty">
          <FaExclamationCircle className="cm-contact-empty-icon" style={{ color: "#ef4444" }} />
          <p className="cm-contact-empty-desc">{error}</p>
          <button className="cm-button" type="button" onClick={fetchVehicles} style={{ marginTop: 12, maxWidth: 140 }}>
            Retry
          </button>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="cm-contact-empty">
          <FaTruck className="cm-contact-empty-icon" />
          <p className="cm-contact-empty-title">No saved vehicles</p>
          <p className="cm-contact-empty-desc">Add a FASTag vehicle for quick recharges</p>
          <button className="cm-button" type="button" onClick={onAddNew} style={{ marginTop: 16 }}>
            <FaPlus style={{ marginRight: 6 }} /> Add Vehicle
          </button>
        </div>
      ) : (
        <div className="cm-vehicle-list">
          {vehicles.map((vehicle, i) => {
            // operatorId is an object (OperatorEntity) from backend
            const opLogo = vehicle.operatorId?.logo || vehicle.operatorLogo;
            const opName = vehicle.operatorId?.operatorName || vehicle.operatorId?.name || vehicle.operatorName || "FASTag";
            return (
            <div
              key={vehicle.id || i}
              className="cm-vehicle-card"
              onClick={() => onSelect(vehicle)}
            >
              <div className="cm-vehicle-card-header">
                <div className="cm-vehicle-card-info">
                  {opLogo ? (
                    <img
                      src={opLogo}
                      alt=""
                      className="cm-vehicle-card-logo"
                      onError={handleLogoError}
                    />
                  ) : (
                    <div className="cm-vehicle-card-logo-placeholder">
                      <FaTruck />
                    </div>
                  )}
                  <div>
                    <div className="cm-vehicle-number">{vehicle.vehicleNumber}</div>
                    {vehicle.nickname && (
                      <div className="cm-vehicle-nickname">"{vehicle.nickname}"</div>
                    )}
                    <div className="cm-vehicle-provider">{opName}</div>
                  </div>
                </div>
                <FaChevronRight className="cm-vehicle-arrow" />
              </div>

              {/* Actions */}
              <div className="cm-vehicle-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="cm-vehicle-action-btn cm-vehicle-recharge-btn"
                  onClick={() => onSelect(vehicle)}
                >
                  Recharge
                </button>
                <button
                  type="button"
                  className="cm-vehicle-action-btn cm-vehicle-edit-btn"
                  onClick={() => handleEdit(vehicle)}
                >
                  <FaPen />
                </button>
                <button
                  type="button"
                  className="cm-vehicle-action-btn cm-vehicle-delete-btn"
                  onClick={() => handleDeleteClick(vehicle)}
                >
                  <FaTrash />
                </button>
              </div>

              {vehicle.lastRechargeDate && (
                <div className="cm-vehicle-last-recharge">
                  Last recharged: {vehicle.lastRechargeDate}
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}
      </div>

      {/* Edit Nickname Modal */}
      {editModalOpen && (
        <div className="cm-modal-overlay" onClick={closeEditModal}>
          <div className="cm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <h4>Edit Nickname</h4>
              <button type="button" className="cm-modal-close" onClick={closeEditModal}>
                <FaTimes />
              </button>
            </div>
            <div className="cm-modal-body">
              <div className="cm-vehicle-edit-info">
                <FaTruck className="cm-vehicle-edit-icon" />
                <span>{editingVehicle?.vehicleNumber}</span>
              </div>
              <div className="cm-form-group">
                <label>Nickname</label>
                <input
                  type="text"
                  placeholder="e.g., Family Car, Office Vehicle"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={30}
                  disabled={submitting}
                />
                <span className="cm-form-hint">{nickname.length}/30 characters</span>
              </div>
              {editError && <p className="cm-form-error">{editError}</p>}
            </div>
            <div className="cm-modal-footer">
              <button
                type="button"
                className="cm-button"
                onClick={handleSaveNickname}
                disabled={submitting}
              >
                {submitting ? <FaSpinner className="cm-spin" /> : <FaCheck />}
                Save
              </button>
              <button
                type="button"
                className="cm-button-ghost"
                onClick={closeEditModal}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="cm-modal-overlay" onClick={closeDeleteConfirm}>
          <div className="cm-modal-content cm-modal-content--sm" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
              <FaTrash style={{ fontSize: 40, color: "#ef4444", marginBottom: 12 }} />
              <h4 style={{ margin: "0 0 8px" }}>Delete Vehicle?</h4>
              <p style={{ color: "var(--cm-muted)", fontSize: 13, margin: 0 }}>
                Remove <strong>{deletingVehicle?.vehicleNumber}</strong> from saved vehicles?
              </p>
            </div>
            <div className="cm-modal-footer">
              <button
                type="button"
                className="cm-button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{ background: "#ef4444" }}
              >
                {deleting ? <FaSpinner className="cm-spin" /> : <FaTrash />}
                Delete
              </button>
              <button
                type="button"
                className="cm-button-ghost"
                onClick={closeDeleteConfirm}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
