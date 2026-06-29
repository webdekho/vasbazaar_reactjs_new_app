import { authGet } from "./apiClient";
import { cachedFetch } from "./apiCache";

/**
 * Detect the current platform using Capacitor.
 * Returns 'web', 'android', or 'ios'.
 */
const getPlatform = () => {
  try {
    if (window.Capacitor && window.Capacitor.getPlatform) {
      return window.Capacitor.getPlatform(); // 'web' | 'android' | 'ios'
    }
  } catch {
    // Ignore errors
  }
  return 'web'; // Default to web if Capacitor is not available
};

/**
 * Get platform-specific query params for filtering services.
 * Returns { displayOnScreen: 1, web: 1 } or { displayOnScreen: 1, android: 1 } etc.
 */
const getPlatformParams = () => {
  const platform = getPlatform();
  const params = { displayOnScreen: 1 };
  if (platform === 'android') {
    params.android = 1;
  } else if (platform === 'ios') {
    params.ios = 1;
  } else {
    params.web = 1;
  }
  return params;
};

export const serviceService = {
  /**
   * PERF FIX: Service list rarely changes — cached for 24 hours.
   * Eliminates redundant fetches when navigating between Home and Services screens.
   * Now includes platform-specific filtering (web/android/ios).
   */
  getHomeServices: () => {
    const platform = getPlatform();
    return cachedFetch(
      `getHomeServices_${platform}`,
      () => authGet("/api/customer/service/allService", getPlatformParams()),
      86400000
    );
  },

  // Pass displayOnScreen + platform flag so the backend filters services
  // based on ON/OFF-SCREEN toggle and platform visibility.
  getAllServices: () => {
    const platform = getPlatform();
    return cachedFetch(
      `getAllServices_${platform}`,
      () => authGet("/api/customer/service/allService", getPlatformParams()),
      86400000
    );
  },

  // Operators list cached for 1 hour per service
  getOperatorsByService: (serviceId) =>
    cachedFetch(`operators_${serviceId}`, () => authGet("/api/customer/operator/getByServiceId", { serviceId }), 3600000),

  // Extra params cached for 24 hours per operator
  getExtraParamsByOperatorId: (operatorId) =>
    cachedFetch(`extraParams_${operatorId}`, () => authGet("/api/customer/extra_params/getByOperatorId", { id: operatorId }), 86400000),
};
