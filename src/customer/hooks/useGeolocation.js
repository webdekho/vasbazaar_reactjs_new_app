import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

/**
 * Hook for getting device geolocation with proper permission handling
 * Works on Android, iOS (via Capacitor) and Web (via browser API)
 *
 * @returns {Object} { coords, error, loading, requestLocation, permissionStatus }
 */
export const useGeolocation = (options = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 60000,
    autoRequest = true, // Auto-request location on mount
  } = options;

  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null); // 'granted' | 'denied' | 'prompt'

  const isNative = Capacitor.isNativePlatform();
  const hasRequestedRef = useRef(false); // Prevent duplicate auto-requests
  const isMountedRef = useRef(true); // Track if component is still mounted

  // Check current permission status
  const checkPermissions = useCallback(async () => {
    if (!isNative) {
      // For web, check via Permissions API if available
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          setPermissionStatus(result.state);
          return result.state;
        } catch {
          return "prompt";
        }
      }
      return "prompt";
    }

    try {
      const status = await Geolocation.checkPermissions();
      const locationStatus = status.location || status.coarseLocation;
      setPermissionStatus(locationStatus);
      return locationStatus;
    } catch (err) {
      console.log("Error checking permissions:", err);
      return "prompt";
    }
  }, [isNative]);

  // Request permissions (Android/iOS)
  const requestPermissions = useCallback(async () => {
    if (!isNative) {
      // Web doesn't have explicit permission request - it happens on getCurrentPosition
      return "prompt";
    }

    try {
      const status = await Geolocation.requestPermissions();
      const locationStatus = status.location || status.coarseLocation;
      setPermissionStatus(locationStatus);
      return locationStatus;
    } catch (err) {
      console.log("Error requesting permissions:", err);
      setError("Location permission denied");
      setPermissionStatus("denied");
      return "denied";
    }
  }, [isNative]);

  // Get current position using Capacitor (native) or browser API (web)
  const getCurrentPosition = useCallback(async () => {
    if (!isMountedRef.current) return null;
    setLoading(true);
    setError(null);

    try {
      if (isNative) {
        // Use Capacitor Geolocation for native platforms
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy,
          timeout,
          maximumAge,
        });

        if (!isMountedRef.current) return null;

        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setCoords(newCoords);
        setLoading(false);
        return newCoords;
      } else {
        // Use browser geolocation for web
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            const err = "Geolocation not supported";
            if (isMountedRef.current) {
              setError(err);
              setLoading(false);
            }
            reject(new Error(err));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!isMountedRef.current) {
                resolve(null);
                return;
              }
              const newCoords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              };
              setCoords(newCoords);
              setLoading(false);
              resolve(newCoords);
            },
            (err) => {
              if (!isMountedRef.current) {
                reject(new Error("Component unmounted"));
                return;
              }
              let errorMsg = "Unable to get location";
              if (err.code === 1) errorMsg = "Location permission denied";
              else if (err.code === 2) errorMsg = "Location unavailable";
              else if (err.code === 3) errorMsg = "Location request timeout";

              setError(errorMsg);
              setPermissionStatus(err.code === 1 ? "denied" : permissionStatus);
              setLoading(false);
              reject(new Error(errorMsg));
            },
            { enableHighAccuracy, timeout, maximumAge }
          );
        });
      }
    } catch (err) {
      if (!isMountedRef.current) return null;

      let errorMsg = "Unable to get location";

      // Handle Capacitor-specific errors
      if (err.message?.includes("denied") || err.code === 1) {
        errorMsg = "Location permission denied";
        setPermissionStatus("denied");
      } else if (err.message?.includes("unavailable") || err.code === 2) {
        errorMsg = "Location unavailable";
      } else if (err.message?.includes("timeout") || err.code === 3) {
        errorMsg = "Location request timeout";
      }

      setError(errorMsg);
      setLoading(false);
      throw new Error(errorMsg);
    }
  }, [isNative, enableHighAccuracy, timeout, maximumAge, permissionStatus]);

  // Main function to request location (checks/requests permissions first)
  const requestLocation = useCallback(async () => {
    if (!isMountedRef.current) return null;
    setLoading(true);
    setError(null);

    try {
      // Check current permission status
      let status = await checkPermissions();
      if (!isMountedRef.current) return null;

      // If not granted, request permissions
      if (status !== "granted") {
        status = await requestPermissions();
        if (!isMountedRef.current) return null;
      }

      // If still not granted, return with error
      if (status === "denied") {
        if (isMountedRef.current) {
          setError("Location permission denied. Please enable location in settings.");
          setCoords({ lat: null, lng: null });
          setLoading(false);
        }
        return null;
      }

      // Get current position
      return await getCurrentPosition();
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Unable to get location");
        setCoords({ lat: null, lng: null });
        setLoading(false);
      }
      return null;
    }
  }, [checkPermissions, requestPermissions, getCurrentPosition]);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-request location on mount if enabled (only once)
  useEffect(() => {
    if (autoRequest && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      requestLocation();
    }
  }, [autoRequest, requestLocation]);

  return {
    coords,
    error,
    loading,
    permissionStatus,
    requestLocation,
    checkPermissions,
    requestPermissions,
  };
};

/**
 * Open device location settings (Android/iOS only)
 * Useful when permission is denied and user needs to enable it manually
 */
export const openLocationSettings = async () => {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    // For web, we can't open settings - just show an alert
    alert("Please enable location permission in your browser settings.");
    return;
  }

  try {
    // Note: Capacitor doesn't have a direct API to open app settings
    // Show a message to guide the user
    if (Capacitor.getPlatform() === "android") {
      // Android doesn't have a direct API to open location settings from Capacitor
      // Show a message to guide the user
      alert("Please go to Settings > Apps > VasBazaar > Permissions > Location and enable location access.");
    } else {
      alert("Please go to Settings > VasBazaar > Location and enable location access.");
    }
  } catch (err) {
    console.log("Error opening settings:", err);
    alert("Please enable location permission in your device settings.");
  }
};

export default useGeolocation;
