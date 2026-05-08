import { authGet, authPost, authPut, authDelete } from "./apiClient";

/**
 * Service for managing saved FASTag vehicles.
 * Allows users to save vehicle details for quick repeat recharges.
 */
export const savedVehicleService = {
  /**
   * Get all saved vehicles for the current user.
   * Response includes operator details (name, logo) via backend JOIN.
   */
  getSavedVehicles: (pageNumber = 0, pageSize = 20) =>
    authGet("/api/customer/saved_vehicle/all", { pageNumber, pageSize }),

  /**
   * Add a new saved vehicle.
   * @param {Object} payload - { vehicleNumber, operatorId, nickname? }
   */
  addVehicle: (payload) =>
    authPost("/api/customer/saved_vehicle/add", payload),

  /**
   * Update a saved vehicle (nickname only).
   * @param {Object} payload - { id, nickname }
   */
  updateVehicle: (payload) =>
    authPut("/api/customer/saved_vehicle/update", payload),

  /**
   * Delete a saved vehicle.
   * @param {number} id - Vehicle ID to delete
   */
  deleteVehicle: (id) =>
    authDelete(`/api/customer/saved_vehicle/${id}`),

  /**
   * Get recharge history for a specific saved vehicle.
   * @param {number} vehicleId - Saved vehicle ID
   */
  getVehicleHistory: (vehicleId, pageNumber = 0, pageSize = 10) =>
    authGet(`/api/customer/saved_vehicle/history/${vehicleId}`, { pageNumber, pageSize }),

  /**
   * Check if a vehicle number already exists for the current user.
   * Useful for duplicate prevention on frontend.
   * @param {string} vehicleNumber - Vehicle registration number
   */
  checkDuplicate: (vehicleNumber) =>
    authGet("/api/customer/saved_vehicle/check", { vehicleNumber }),
};

export default savedVehicleService;
