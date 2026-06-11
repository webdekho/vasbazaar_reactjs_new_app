import { useEffect, useState, useCallback } from "react";
import { otaService } from "../services/otaService";
import { BUILD_ID } from "../../generated/buildId";

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
// Build the user dismissed via "Later" — suppressed until a newer build ships.
const PWA_DISMISSED_BUILD_KEY = "vb_pwa_dismissed_build";
// Timestamp set right before a user-initiated reload, so the next mount can
// briefly ignore the transient service-worker state that a reload produces.
const PWA_RELOADING_KEY = "vb_pwa_reloading";
const PWA_RELOAD_SUPPRESS_MS = 5000;
// How often to re-check version.json for a fresh deploy.
const BUILD_POLL_MS = 10 * 60 * 1000; // 10 minutes

// Module-level flag to ensure OTA check only runs ONCE per app session
let _otaCheckDone = false;

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

    // Start background update after 2 seconds - runs independently
    setTimeout(() => {
      runBackgroundUpdate();
    }, 2000);

    // NO cleanup - we WANT this to continue running even if component unmounts
  }, []);

  // ── PWA version check (non-native) — uses same server API as native ──
  useEffect(() => {
    if (otaService.isNative()) return;

    let cancelled = false;

    // If we just performed a user-initiated reload, ignore the transient SW
    // "installed" event that can fire immediately afterwards (otherwise the bar
    // re-appears the instant the page comes back).
    let reloadedAt = 0;
    try {
      reloadedAt = Number(sessionStorage.getItem(PWA_RELOADING_KEY) || 0);
      sessionStorage.removeItem(PWA_RELOADING_KEY);
    } catch {}
    const recentlyReloaded = () => reloadedAt > 0 && Date.now() - reloadedAt < PWA_RELOAD_SUPPRESS_MS;
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

    // Deploy-driven check: compare the served version.json buildId to the one
    // compiled into THIS bundle. They differ only after a new deploy is live —
    // which is exactly when we want the "new version" bar. No server config
    // needed (every build auto-stamps a fresh buildId).
    const checkBuild = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data || !data.buildId || !BUILD_ID) return;
        if (String(data.buildId) === String(BUILD_ID)) return; // already on the latest build
        let dismissed = null;
        try { dismissed = localStorage.getItem(PWA_DISMISSED_BUILD_KEY); } catch {}
        if (dismissed && dismissed === String(data.buildId)) return; // user chose "Later" for this build
        setPwaUpdate((v) => v || { version: data.version || "new", buildId: String(data.buildId) });
      } catch {
        // offline / fetch failed — ignore, try again on the next tick
      }
    };

    // Delay the checks to let the app fully load first
    const timer = setTimeout(checkPwa, 3000);
    const buildTimer = setTimeout(checkBuild, 3500);
    const buildInterval = setInterval(checkBuild, BUILD_POLL_MS);
    // Re-check whenever the user returns to the tab/app (common after a deploy).
    const onVisible = () => { if (document.visibilityState === "visible") checkBuild(); };
    document.addEventListener("visibilitychange", onVisible);

    // Also listen for service-worker updates so refreshed SW can trigger the bar
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller &&
              !recentlyReloaded()
            ) {
              setPwaUpdate((v) => v || { version: "new" });
            }
          });
        });
      }).catch(() => {}); // Ignore SW registration errors
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(buildTimer);
      clearInterval(buildInterval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const reloadPwa = useCallback(async () => {
    setPwaUpdate(false);
    // Mark the moment we initiate an update so the post-reload mount does not
    // immediately re-show the bar from a transient service-worker state.
    try { sessionStorage.setItem(PWA_RELOADING_KEY, String(Date.now())); } catch {}

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const waiting = reg && reg.waiting;
        if (waiting) {
          // Activate the new worker, then reload exactly once when it takes
          // control. We do NOT unregister — unregistering forces a fresh worker
          // to install on the next load while an old controller is still present,
          // which re-fires `updatefound` and loops the "new version" bar forever.
          let reloaded = false;
          const doReload = () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          };
          navigator.serviceWorker.addEventListener("controllerchange", doReload);
          waiting.postMessage({ type: "SKIP_WAITING" });
          // Safety net in case controllerchange never fires.
          setTimeout(doReload, 2000);
          return;
        }
      }
    } catch {}

    // Build- or server-driven update with no waiting worker: a plain reload pulls
    // the fresh, network-first app shell and its new hashed assets.
    window.location.reload();
  }, []);

  const dismissPwa = useCallback(() => {
    if (pwaUpdate?.buildId) {
      // Suppress only THIS build; a newer deploy (new buildId) shows again.
      try { localStorage.setItem(PWA_DISMISSED_BUILD_KEY, String(pwaUpdate.buildId)); } catch {}
    }
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
