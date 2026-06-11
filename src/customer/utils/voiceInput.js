// Voice entry for ReBill. Uses the native @capacitor-community/speech-recognition
// plugin on Android/iOS (real on-device recognition with hi-IN/mr-IN/en-IN), and
// falls back to the Web Speech API in browsers/PWA. Degrades gracefully:
// callers should check isVoiceSupported() before showing UI.

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

export const SUPPORTED_VOICE_LANGS = [
  { code: "en-IN", label: "EN" },
  { code: "hi-IN", label: "हि" },
  { code: "mr-IN", label: "मराठी" },
];

const isNative = () => Capacitor.isNativePlatform();

const getWebRecognitionCtor = () =>
  (typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export const isVoiceSupported = () => isNative() || !!getWebRecognitionCtor();

// ----- Native (Capacitor plugin) -----------------------------------------

const startNativeCapture = ({ lang, onResult, onError, onEnd }) => {
  let stopped = false;
  let listener = null;

  const cleanup = async () => {
    try { if (listener) await listener.remove(); } catch (_) { /* noop */ }
    try { await SpeechRecognition.removeAllListeners(); } catch (_) { /* noop */ }
  };

  (async () => {
    try {
      const avail = await SpeechRecognition.available();
      if (!(avail?.available ?? avail)) {
        onError?.(new Error("Voice recognition not available on this device"));
        return;
      }
      const perm = await SpeechRecognition.checkPermissions().catch(() => null);
      if (!perm || perm.speechRecognition !== "granted") {
        const req = await SpeechRecognition.requestPermissions().catch(() => null);
        if (!req || req.speechRecognition !== "granted") {
          onError?.(new Error("Microphone permission denied"));
          return;
        }
      }

      // Partial results stream as the user speaks.
      listener = await SpeechRecognition.addListener("partialResults", (data) => {
        const text = (data?.matches && data.matches[0]) || "";
        if (text) onResult?.(text.trim(), false);
      });

      await SpeechRecognition.start({
        language: lang,
        maxResults: 1,
        partialResults: true,
        popup: false,
      });

      // start() resolves with the final matches on platforms that return them.
    } catch (err) {
      if (!stopped) onError?.(err);
    }
  })();

  return async () => {
    stopped = true;
    try {
      const res = await SpeechRecognition.stop();
      const finalText = (res?.matches && res.matches[0]) || "";
      onEnd?.(finalText.trim());
    } catch (_) {
      onEnd?.("");
    } finally {
      await cleanup();
    }
  };
};

// ----- Web (Web Speech API) ----------------------------------------------

const startWebCapture = ({ lang, onResult, onError, onEnd }) => {
  const Ctor = getWebRecognitionCtor();
  if (!Ctor) {
    onError?.(new Error("Voice recognition not supported on this device"));
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let finalTranscript = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finalTranscript += chunk;
      else interim += chunk;
    }
    onResult?.((finalTranscript || interim).trim(), event.results[event.results.length - 1]?.isFinal);
  };
  recognition.onerror = (event) => onError?.(new Error(event.error || "Voice capture failed"));
  recognition.onend = () => onEnd?.(finalTranscript.trim());

  try {
    recognition.start();
  } catch (err) {
    onError?.(err);
  }

  return () => {
    try { recognition.stop(); } catch (_) { /* noop */ }
  };
};

// Starts a one-shot recognition session. Returns a stop() function.
export const startVoiceCapture = ({ lang = "en-IN", onResult, onError, onEnd } = {}) => {
  if (isNative()) return startNativeCapture({ lang, onResult, onError, onEnd });
  return startWebCapture({ lang, onResult, onError, onEnd });
};
