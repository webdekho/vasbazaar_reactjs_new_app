import { useState, useEffect, useCallback } from "react";

const STORAGE_KEYS = {
  PWA_INSTALLED: "vb_pwa_installed",
  PWA_TRIGGER: "vb_pwa_trigger",
  PWA_DISMISSED_AT: "vb_pwa_dismissed_at",
};

// Capture the beforeinstallprompt event globally (must happen early)
let deferredPrompt = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent("pwaPromptReady"));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    localStorage.setItem(STORAGE_KEYS.PWA_INSTALLED, "true");
  });
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [visible, setVisible] = useState(false);

  // Detect standalone mode / installed / native app
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone;

    // Also detect Capacitor / Cordova native wrappers
    const isNativeApp = !!(
      (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      window.cordova ||
      document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1
    );

    // Check if opened from home screen (TWA / WebAPK)
    const isTWA = document.referrer.includes("android-app://");

    if (standalone || isNativeApp || isTWA || localStorage.getItem(STORAGE_KEYS.PWA_INSTALLED) === "true") {
      setIsInstalled(true);
      return;
    }

    const onReady = () => setCanInstall(true);
    window.addEventListener("pwaPromptReady", onReady);

    // Check if trigger was set (after login)
    const checkTrigger = () => {
      if (localStorage.getItem(STORAGE_KEYS.PWA_TRIGGER) === "true") {
        // Check cooldown — don't show again within 1 hour of dismissal
        const dismissedAt = localStorage.getItem(STORAGE_KEYS.PWA_DISMISSED_AT);
        if (dismissedAt && Date.now() - Number(dismissedAt) < 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEYS.PWA_TRIGGER);
          return;
        }
        setVisible(true);
        localStorage.removeItem(STORAGE_KEYS.PWA_TRIGGER);
      }
    };

    checkTrigger();
    const interval = setInterval(checkTrigger, 2000);

    return () => {
      window.removeEventListener("pwaPromptReady", onReady);
      clearInterval(interval);
    };
  }, []);

  const installPWA = useCallback(async () => {
    const prompt = deferredPrompt;
    if (!prompt) return false;

    try {
      const result = await prompt.prompt();
      if (result.outcome === "accepted") {
        localStorage.setItem(STORAGE_KEYS.PWA_INSTALLED, "true");
        setIsInstalled(true);
        setCanInstall(false);
        deferredPrompt = null;
        setVisible(false);
        return true;
      }
    } catch (e) {
      console.warn("PWA install error:", e);
    }
    setVisible(false);
    return false;
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.PWA_DISMISSED_AT, Date.now().toString());
    setVisible(false);
  }, []);

  const deviceType = /iPad|iPhone|iPod/.test(navigator.userAgent)
    ? "ios"
    : /Android/.test(navigator.userAgent)
    ? "android"
    : "desktop";

  const showPrompt = useCallback(() => {
    if (isInstalled) return;
    setVisible(true);
  }, [isInstalled]);

  return { canInstall, isInstalled, visible, installPWA, dismiss, deviceType, showPrompt };
}

/** Call this after successful login to trigger the install prompt */
export function triggerPWAInstall() {
  if (localStorage.getItem(STORAGE_KEYS.PWA_INSTALLED) === "true") return;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone;
  const isNativeApp = !!(
    (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
    window.cordova
  );
  if (standalone || isNativeApp) return;
  localStorage.setItem(STORAGE_KEYS.PWA_TRIGGER, "true");
}

export default usePWAInstall;
