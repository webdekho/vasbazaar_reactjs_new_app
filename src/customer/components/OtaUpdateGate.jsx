import { useEffect, useState, useCallback } from "react";
import { otaService } from "../services/otaService";

/**
 * OtaUpdateGate
 * -------------
 * Mounts once at the root of the app. On startup it calls the OTA `/check`
 * endpoint on ALL platforms (native + PWA).
 *
 * Native (Android/iOS): FORCE UPDATE - automatically downloads and installs
 * without showing any popup. Android will show system installer dialog.
 * The download runs in BACKGROUND - independent of component lifecycle.
 *
 * PWA: Shows reload bar when new version available.
 */

// Skip update check for this many ms after the user dismisses a non-force update.
const SKIP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const PWA_SKIPPED_KEY = "vb_pwa_skipped_version";

// Module-level flag to ensure OTA check only runs ONCE per app session
let _otaCheckDone = false;
let _otaUpdatePromise = null; // Store the update promise to keep it alive

const pwaBar = {
  position: "fixed",
  left: 12,
  right: 12,
  top: "max(12px, env(safe-area-inset-top))",
  zIndex: 99998,
  background: "#111",
  color: "#fff",
  padding: "12px 14px",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  gap: 12,
  alignItems: "center",
  fontSize: 14,
};

const pwaReloadBtn = {
  marginLeft: "auto",
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#6C5CE7",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "#aaa",
  fontWeight: 600,
  cursor: "pointer",
};

const OtaUpdateGate = () => {
  const [pwaUpdate, setPwaUpdate] = useState(false);

  // ── Native OTA check (Android/iOS only) — FORCE UPDATE (no UI) ──
  // Runs completely in BACKGROUND - independent of component lifecycle
  useEffect(() => {
    // Use module-level flag to ensure only ONE call per session
    if (_otaCheckDone) {
      console.debug("[OTA] Check already done this session, skipping");
      return;
    }
    _otaCheckDone = true;

    if (!otaService.isNative()) return;

    // Background update function - runs independently of component
    const runBackgroundUpdate = async () => {
      // Wait for auth token with retry
      let hasToken = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        hasToken = !!localStorage.getItem("customerSessionToken");
        if (hasToken) break;
        console.debug(`[OTA] Attempt ${attempt}: No auth token yet, retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!hasToken) {
        console.debug("[OTA] No auth token after max attempts, skipping OTA check");
        return;
      }

      try {
        console.debug("[OTA] Checking for updates...", { platform: otaService.getPlatform() });
        const res = await otaService.checkUpdate();
        console.debug("[OTA] Check response:", res);

        if (!res?.success) {
          console.debug("[OTA] Check failed:", res?.message);
          return;
        }

        const info = res.data || {};
        if (!info.updateAvailable) {
          console.debug("[OTA] No update available");
          return;
        }

        console.debug("[OTA] Update available:", info.latestVersion, "- Starting BACKGROUND install...");

        // FORCE UPDATE: Download and install in BACKGROUND - no UI dependency
        const updateRes = await otaService.runUpdateFlow({
          onStage: (stage) => console.debug("[OTA] Stage:", stage),
          onProgress: (pct) => console.debug("[OTA] Progress:", pct + "%"),
        });

        if (!updateRes.success) {
          console.debug("[OTA] Update failed:", updateRes.message);
          return;
        }

        if (updateRes.requiresStoreRedirect) {
          console.debug("[OTA] iOS - Opening App Store...");
          window.open("https://apps.apple.com/app/vasbazaar/id0000000000", "_system");
        }

        console.debug("[OTA] Update completed:", updateRes);
      } catch (e) {
        console.debug("[OTA] Check error:", e.message);
      }
    };

    // Start background update after 2 seconds
    // Store promise at MODULE level so it survives component unmount
    setTimeout(() => {
      _otaUpdatePromise = runBackgroundUpdate();
    }, 2000);

    // NO cleanup - we WANT this to continue running even if component unmounts
  }, []);

  // ── PWA version check (non-native) — uses same server API as native ──
  useEffect(() => {
    if (otaService.isNative()) return;

    let cancelled = false;
    const checkPwa = async () => {
      try {
        const res = await otaService.checkUpdate();
        if (cancelled) return;
        if (!res?.success) return;

        const info = res.data || {};
        if (!info.updateAvailable) return;

        const forced = String(info.forceUpdate).toLowerCase() === "true";

        // Honor user "Later" choice unless it's a force update
        try {
          const skipped = JSON.parse(localStorage.getItem(PWA_SKIPPED_KEY) || "null");
          if (!forced && skipped && skipped.version === info.latestVersion) {
            if (Date.now() - (skipped.at || 0) < SKIP_COOLDOWN_MS) return;
          }
        } catch {}

        setPwaUpdate({
          version: info.latestVersion,
          forced,
          releaseNotes: info.releaseNotes
        });
      } catch (e) {
        // Silently ignore - network errors are expected offline
        console.debug("PWA version check skipped:", e.message);
      }
    };

    // Delay the check to let the app fully load first
    const timer = setTimeout(checkPwa, 3000);

    // Also listen for service-worker updates so refreshed SW can trigger the bar
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setPwaUpdate((v) => v || { version: "new" });
            }
          });
        });
      }).catch(() => {}); // Ignore SW registration errors
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const reloadPwa = useCallback(async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        // Ask the waiting SW to activate immediately.
        regs.forEach((r) => {
          if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
        });
        await Promise.all(regs.map((r) => r.update().catch(() => null)));
      }
    } catch {}
    window.location.reload();
  }, []);

  const dismissPwa = useCallback(() => {
    if (pwaUpdate?.version) {
      try {
        localStorage.setItem(
          PWA_SKIPPED_KEY,
          JSON.stringify({ version: pwaUpdate.version, at: Date.now() })
        );
      } catch {}
    }
    setPwaUpdate(false);
  }, [pwaUpdate]);

  // ── Render (PWA only - Native updates are silent) ──
  if (pwaUpdate) {
    const pwaForced = !!pwaUpdate.forced;
    return (
      <div style={pwaBar} role="status">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {pwaUpdate.version && pwaUpdate.version !== "new"
              ? `Version ${pwaUpdate.version} available`
              : "New version available"}
          </div>
          <div style={{ fontSize: 12, color: "#aaa" }}>
            {pwaForced ? "This update is required." : "Reload to get the latest update."}
          </div>
          {pwaUpdate.releaseNotes && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              {pwaUpdate.releaseNotes}
            </div>
          )}
        </div>
        <button style={pwaReloadBtn} onClick={reloadPwa}>Reload</button>
        {!pwaForced && (
          <button style={{ ...secondaryBtn, margin: 0, width: "auto", padding: "8px 12px" }} onClick={dismissPwa}>
            Later
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default OtaUpdateGate;
