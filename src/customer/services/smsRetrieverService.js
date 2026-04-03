import { Capacitor, registerPlugin } from "@capacitor/core";

const SmsRetriever = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
  ? registerPlugin("SmsRetriever")
  : null;

/**
 * Starts the Android SMS Retriever API listener.
 * Returns { started: true } on success, or { started: false } on non-Android / failure.
 * Automatically falls back gracefully — never throws.
 */
export async function startSmsListening() {
  if (!SmsRetriever) return { started: false };
  try {
    const result = await SmsRetriever.isAvailable();
    if (!result.available) return { started: false };
    return await SmsRetriever.startListening();
  } catch {
    return { started: false };
  }
}

/**
 * Stops the SMS Retriever listener and cleans up the BroadcastReceiver.
 */
export async function stopSmsListening() {
  if (!SmsRetriever) return;
  try {
    await SmsRetriever.stopListening();
  } catch {
    // Silently ignore — receiver may already be unregistered
  }
}

/**
 * Registers a callback for when an OTP SMS is received.
 * Returns a cleanup function to remove the listener.
 * @param {(data: { otp: string, message: string }) => void} callback
 */
export function onOtpReceived(callback) {
  if (!SmsRetriever) return () => {};
  const handle = SmsRetriever.addListener("otpReceived", callback);
  return () => handle.remove();
}

/**
 * Gets the 11-character app hash needed for SMS Retriever API.
 * Backend must include this hash at the end of the OTP SMS.
 */
export async function getAppHash() {
  if (!SmsRetriever) return null;
  try {
    const result = await SmsRetriever.getAppHash();
    return result.hash || null;
  } catch {
    return null;
  }
}
