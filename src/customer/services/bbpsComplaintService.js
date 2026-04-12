import { authGet, authPost } from "./apiClient";

/**
 * BBPS Complaint Service
 * Handles BBPS-specific complaints for bill payment transactions
 */
export const bbpsComplaintService = {
  /**
   * Register a new BBPS complaint for a transaction
   * @param {string} bConnectId - The bConnect transaction ID
   * @returns {Promise} Complaint registration response with trackingId
   */
  registerComplaint: (bConnectId) =>
    authPost(`/api/customer/bbps_complaint/registerComplaint?bConnectId=${encodeURIComponent(bConnectId)}`),

  /**
   * Get list of user's BBPS complaints with pagination and filters
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (0-indexed)
   * @param {number} params.pageSize - Number of records per page
   * @param {string} params.searchValue - Optional search value (consumer number, tracking ID, etc.)
   * @param {string} params.status - Optional status filter (PENDING, SUCCESS, FAILED)
   * @returns {Promise} Paginated list of complaints
   */
  getMyComplaints: (pageNumber = 0, pageSize = 10, searchValue = "", status = "") => {
    const params = { pageNumber, pageSize };
    if (searchValue) params.searchValue = searchValue;
    if (status) params.status = status;
    return authGet("/api/customer/bbps_complaint/getMyComplaints", params);
  },

  /**
   * Track/refresh status of a BBPS complaint
   * @param {number} complaintId - The complaint ID from our system
   * @returns {Promise} Updated complaint status from BBPS
   */
  trackComplaint: (complaintId) =>
    authPost(`/api/customer/bbps_complaint/trackComplaint?complaintId=${complaintId}`),
};
