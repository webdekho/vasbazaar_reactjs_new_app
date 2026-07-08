import { authPost, authPut } from "./apiClient";

// Advanced delivery controls for recurring marketplace subscriptions
// (skip next, vacation hold, deliver once now, temporary address).
// Kept separate from marketplaceService.js — that file is owned by another
// workstream; this one follows the same authGet/authPost helper pattern.
export const marketplaceSubscriptionService = {
  // One-tap: the next due run is skipped and nextRunAt advances one cycle.
  skipNextDelivery: (id) =>
    authPost(`/api/customer/marketplace/subscriptions/${id}/skip-next`, {}),

  // Vacation hold: runs inside [pausedFrom, pausedTo] are skipped, auto-resumes after.
  setVacationHold: (id, { pausedFrom, pausedTo }) =>
    authPut(`/api/customer/marketplace/subscriptions/${id}/vacation`, { pausedFrom, pausedTo }),

  clearVacationHold: (id) =>
    authPut(`/api/customer/marketplace/subscriptions/${id}/vacation`, {}),

  // Extra delivery now — same payment method as the schedule, nextRunAt unchanged.
  deliverOnceNow: (id) =>
    authPost(`/api/customer/marketplace/subscriptions/${id}/deliver-now`, {}),

  // Temporary address for runs inside [tempAddressFrom, tempAddressTo].
  setTempAddress: (id, { tempAddress, tempAddressFrom, tempAddressTo }) =>
    authPut(`/api/customer/marketplace/subscriptions/${id}/temp-address`, {
      tempAddress,
      tempAddressFrom,
      tempAddressTo,
    }),

  clearTempAddress: (id) =>
    authPut(`/api/customer/marketplace/subscriptions/${id}/temp-address`, {}),
};

export default marketplaceSubscriptionService;
