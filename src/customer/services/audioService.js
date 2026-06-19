import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capacitor-community/native-audio";

// On native (Capacitor iOS/Android) the NativeAudio plugin plays through the
// AVAudioSession `.playback` category (configured in AppDelegate on iOS) and
// the media stream on Android, so the sound plays even when the device is
// silenced. On web we fall back to HTMLAudioElement which respects browser
// autoplay rules and OS volume.

const ASSET_ID = "vb_success";
const ASSET_PATH = "public/assets/sounds/vasbazaar-success.mp3"; // relative to webDir for native
const WEB_PATH = `${process.env.PUBLIC_URL || ""}/sounds/vasbazaar-success.mp3`;

let nativePreloaded = false;
let nativePreloadInFlight = null;

const isNative = () => Capacitor.isNativePlatform?.() === true;

const preloadNative = async () => {
  if (nativePreloaded) return true;
  if (nativePreloadInFlight) return nativePreloadInFlight;
  nativePreloadInFlight = (async () => {
    try {
      await NativeAudio.preload({
        assetId: ASSET_ID,
        assetPath: ASSET_PATH,
        audioChannelNum: 1,
        isUrl: false,
        volume: 1.0,
      });
      nativePreloaded = true;
      return true;
    } catch (err) {
      // Already preloaded by a prior mount or asset missing — try again on play
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("already")) {
        nativePreloaded = true;
        return true;
      }
      console.warn("NativeAudio preload failed:", err);
      return false;
    } finally {
      nativePreloadInFlight = null;
    }
  })();
  return nativePreloadInFlight;
};

export const playSuccessSound = async () => {
  if (isNative()) {
    const ok = await preloadNative();
    if (ok) {
      try {
        await NativeAudio.setVolume({ assetId: ASSET_ID, volume: 1.0 });
        await NativeAudio.play({ assetId: ASSET_ID });
        return { stop: () => NativeAudio.stop({ assetId: ASSET_ID }).catch(() => {}) };
      } catch (err) {
        console.warn("NativeAudio play failed, falling back to HTMLAudio:", err);
      }
    }
  }

  // Web / fallback
  try {
    const audio = new Audio(WEB_PATH);
    audio.volume = 1.0;
    audio.preload = "auto";

    // The success screen is usually reached via a payment-gateway redirect,
    // i.e. a fresh page load with NO user-activation. Browsers then block
    // audio.play() with NotAllowedError. When that happens, retry on the
    // user's first interaction with the page (they tap to scratch the reward
    // card moments later), then detach the listeners.
    const events = ["pointerdown", "touchstart", "click", "keydown"];
    const opts = { once: true, passive: true, capture: true };
    let detach = () => {};
    const onGesture = () => {
      detach();
      try { audio.currentTime = 0; } catch (_) { /* noop */ }
      audio.play().catch(() => {});
    };
    const armGestureRetry = () => {
      detach = () => events.forEach((e) => document.removeEventListener(e, onGesture, opts));
      events.forEach((e) => document.addEventListener(e, onGesture, opts));
    };

    audio.play().catch(() => { armGestureRetry(); });

    return {
      stop: () => {
        try { detach(); audio.pause(); audio.src = ""; } catch (_) { /* noop */ }
      },
    };
  } catch (_) {
    return { stop: () => {} };
  }
};
