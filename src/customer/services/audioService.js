import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capacitor-community/native-audio";

// On native (Capacitor iOS/Android) the NativeAudio plugin plays through the
// AVAudioSession `.playback` category (configured in AppDelegate on iOS) and
// the media stream on Android, so the sound plays even when the device is
// silenced. On web we fall back to HTMLAudioElement which respects browser
// autoplay rules and OS volume.

// Two success sonics:
//  - "default"        → VasBazaar jingle, used for all non-bill-pay flows
//                       (Service Bazaar, Marketplace, RYBBO, AutoPay, …).
//  - "bharatconnect"  → mandated Bharat Connect (BBPS) MOGO sonic, used only
//                       for the bill-pay success screen.
const SOUNDS = {
  default: {
    assetId: "vb_success",
    assetPath: "public/assets/sounds/vasbazaar-success.mp3", // relative to webDir for native
    webPath: `${process.env.PUBLIC_URL || ""}/sounds/vasbazaar-success.mp3`,
  },
  bharatconnect: {
    assetId: "vb_success_bharatconnect",
    assetPath: "public/assets/sounds/BharatConnect_MOGO.mp3",
    webPath: `${process.env.PUBLIC_URL || ""}/sounds/BharatConnect_MOGO.mp3`,
  },
};

const nativePreloaded = new Set();
const nativePreloadInFlight = new Map();

const isNative = () => Capacitor.isNativePlatform?.() === true;

const resolveSound = (variant) => SOUNDS[variant] || SOUNDS.default;

const preloadNative = async (sound) => {
  if (nativePreloaded.has(sound.assetId)) return true;
  if (nativePreloadInFlight.has(sound.assetId)) return nativePreloadInFlight.get(sound.assetId);
  const inFlight = (async () => {
    try {
      await NativeAudio.preload({
        assetId: sound.assetId,
        assetPath: sound.assetPath,
        audioChannelNum: 1,
        isUrl: false,
        volume: 1.0,
      });
      nativePreloaded.add(sound.assetId);
      return true;
    } catch (err) {
      // Already preloaded by a prior mount or asset missing — try again on play
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("already")) {
        nativePreloaded.add(sound.assetId);
        return true;
      }
      console.warn("NativeAudio preload failed:", err);
      return false;
    } finally {
      nativePreloadInFlight.delete(sound.assetId);
    }
  })();
  nativePreloadInFlight.set(sound.assetId, inFlight);
  return inFlight;
};

/**
 * Play the transaction-success sonic.
 * @param {"default"|"bharatconnect"} [variant] which sound to play. Bill-pay
 *        (BBPS) success uses "bharatconnect"; everything else uses "default".
 */
export const playSuccessSound = async (variant = "default") => {
  const sound = resolveSound(variant);

  if (isNative()) {
    const ok = await preloadNative(sound);
    if (ok) {
      try {
        await NativeAudio.setVolume({ assetId: sound.assetId, volume: 1.0 });
        await NativeAudio.play({ assetId: sound.assetId });
        return { stop: () => NativeAudio.stop({ assetId: sound.assetId }).catch(() => {}) };
      } catch (err) {
        console.warn("NativeAudio play failed, falling back to HTMLAudio:", err);
      }
    }
  }

  // Web / fallback
  try {
    const audio = new Audio(sound.webPath);
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
