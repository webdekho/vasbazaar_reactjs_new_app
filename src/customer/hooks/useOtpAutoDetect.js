import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Hook for automatic OTP detection on Android and iOS
 *
 * Android: Uses SMS Retriever API via Capacitor plugin (no permissions required)
 * iOS: Uses Web OTP API and textContentType="oneTimeCode" on inputs
 * Web: Falls back to Web OTP API if supported
 *
 * @param {Function} onOtpReceived - Callback when OTP is auto-detected
 * @param {number} otpLength - Expected OTP length (default: 6)
 */
export const useOtpAutoDetect = (onOtpReceived, otpLength = 6) => {
  const abortControllerRef = useRef(null);
  const isListeningRef = useRef(false);

  // Extract OTP from SMS body
  const extractOtp = useCallback((text) => {
    if (!text) return null;
    // Match a sequence of digits of the expected length
    const regex = new RegExp(`\\b(\\d{${otpLength}})\\b`);
    const match = text.match(regex);
    return match ? match[1] : null;
  }, [otpLength]);

  // Start listening for OTP
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
    isListeningRef.current = true;

    const platform = Capacitor.getPlatform();

    // Android: Use SMS Retriever plugin
    if (platform === "android") {
      try {
        const { CapacitorSmsRetriever } = await import("@aalzehla/capacitor-sms-retriever");

        const result = await CapacitorSmsRetriever.startListening();
        if (result?.body) {
          const otp = extractOtp(result.body);
          if (otp) {
            onOtpReceived(otp);
          }
        }
      } catch (error) {
        console.log("SMS Retriever not available or error:", error);
      }
      return;
    }

    // iOS: Use Web OTP API (also works on some browsers)
    if (platform === "ios" || platform === "web") {
      // Check if Web OTP API is supported
      if ("OTPCredential" in window) {
        try {
          abortControllerRef.current = new AbortController();
          const content = await navigator.credentials.get({
            otp: { transport: ["sms"] },
            signal: abortControllerRef.current.signal,
          });
          if (content?.code) {
            onOtpReceived(content.code);
          }
        } catch (error) {
          // AbortError is expected when user cancels or navigates away
          if (error.name !== "AbortError") {
            console.log("Web OTP API error:", error);
          }
        }
      }
    }
  }, [extractOtp, onOtpReceived]);

  // Stop listening for OTP
  const stopListening = useCallback(async () => {
    isListeningRef.current = false;

    // Abort Web OTP API request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop SMS Retriever on Android
    const platform = Capacitor.getPlatform();
    if (platform === "android") {
      try {
        const { CapacitorSmsRetriever } = await import("@aalzehla/capacitor-sms-retriever");
        await CapacitorSmsRetriever.stopListening();
      } catch (error) {
        // Ignore errors when stopping
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { startListening, stopListening };
};

/**
 * Get the app hash for SMS Retriever API (Android only)
 * This hash should be included in the SMS from your server
 * Format: "Your OTP is 123456\n\nFA+9qCX9VSu" (hash at the end)
 *
 * @returns {Promise<string|null>} App hash or null if not on Android
 */
export const getAppHash = async () => {
  const platform = Capacitor.getPlatform();
  if (platform !== "android") return null;

  try {
    // Note: Some plugins provide getHashCode, but @aalzehla/capacitor-sms-retriever doesn't
    // You may need to generate this hash using Android's AppSignatureHelper
    // Or use a different plugin that provides this functionality
    console.log("App hash generation requires native Android implementation");
    return null;
  } catch (error) {
    console.log("Error getting app hash:", error);
    return null;
  }
};

export default useOtpAutoDetect;
