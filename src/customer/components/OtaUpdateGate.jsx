import { useEffect, useState, useCallback } from "react";
import { otaService } from "../services/otaService";
import { BUILD_ID, BUILD_TIME } from "../../generated/buildId";

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

// Module-level flag to ensure OTA check only runs ONCE per app session (web only)
// Native apps should check every time for force update scenarios
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

// Native update progress bar styles
const nativeProgressBar = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 99999,
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  padding: "12px 16px",
  paddingTop: "max(12px, env(safe-area-inset-top))",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
};

const STAGE_LABELS = {
  checking: "Checking for updates...",
  token: "Preparing download...",
  downloading: "Downloading update...",
  verifying: "Verifying update...",
  saving: "Saving update...",
  installing: "Installing update...",
  redirecting: "Redirecting to store...",
};

// Module-level state setter for background updates
let _setNativeProgress = null;

const OtaUpdateGate = () => {
  const [pwaUpdate, setPwaUpdate] = useState(false);
  const [nativeProgress, setNativeProgress] = useState({ visible: false, stage: "", progress: 0, version: "" });

  // Store setter in module-level variable so background update can use it
  _setNativeProgress = setNativeProgress;

  // ── Native OTA check (Android/iOS only) — FORCE UPDATE ──
  // Runs on every app load for native platforms
  useEffect(() => {
    const isNativePlatform = otaService.isNative();

    // Report this build's deploy time to the backend (all platforms, best-effort).
    void otaService.reportDeployTime(BUILD_TIME);

    // For web, skip if already checked this session
    if (!isNativePlatform) {
      if (_otaCheckDone) {
        console.debug("[OTA] Web: Check already done this session, skipping");
        return;
      }
      _otaCheckDone = true;
      return; // Web uses version.json check instead
    }

    // Native: Always check on app load (force update scenario)
    console.debug("[OTA] Native platform detected, starting version check...");

    // Background update function - runs independently of component
    const runBackgroundUpdate = async () => {
      const showProgress = (stage, progress = 0, version = "") => {
        if (_setNativeProgress) {
          _setNativeProgress({ visible: true, stage, progress, version });
        }
      };

      const hideProgress = () => {
        if (_setNativeProgress) {
          _setNativeProgress({ visible: false, stage: "", progress: 0, version: "" });
        }
      };

      // Show progress immediately
      showProgress("checking", 0);

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
        hideProgress();
        return;
      }

      try {
        console.debug("[OTA] Checking for updates...", { platform: otaService.getPlatform() });
        const res = await otaService.checkUpdate();
        console.debug("[OTA] Check response:", res);

        if (!res?.success) {
          console.debug("[OTA] Check failed:", res?.message);
          hideProgress();
          return;
        }

        const info = res.data || {};
        if (!info.updateAvailable) {
          console.debug("[OTA] No update available");
          hideProgress();
          return;
        }

        console.debug("[OTA] Update available:", info.latestVersion);

        // If isRedirect is true, redirect to app store instead of downloading APK
        if (info.isRedirect) {
          const platform = otaService.getPlatform();
          let storeUrl = null;
          if (platform === "android" && info.android) {
            storeUrl = info.android;
          } else if (platform === "ios" && info.ios) {
            storeUrl = info.ios;
          }

          if (storeUrl) {
            showProgress("redirecting", 100, info.latestVersion);
            console.debug("[OTA] Redirecting to store:", storeUrl);
            await new Promise(r => setTimeout(r, 1000)); // Show message briefly
            window.open(storeUrl, "_system");
            hideProgress();
            return;
          }
          console.debug("[OTA] isRedirect=true but no store URL for platform:", platform);
        }

        console.debug("[OTA] Starting BACKGROUND install...");

        // FORCE UPDATE: Download and install with progress bar
        const updateRes = await otaService.runUpdateFlow({
          onStage: (stage) => {
            console.debug("[OTA] Stage:", stage);
            showProgress(stage, stage === "downloading" ? 0 : undefined, info.latestVersion);
          },
          onProgress: (pct) => {
            console.debug("[OTA] Progress:", pct + "%");
            showProgress("downloading", pct, info.latestVersion);
          },
        });

        if (!updateRes.success) {
          console.debug("[OTA] Update failed:", updateRes.message);
          hideProgress();
          return;
        }

        if (updateRes.requiresStoreRedirect) {
          // Fallback: iOS without isRedirect (uses hardcoded URL)
          const info2 = res.data || {};
          const iosUrl = info2.ios || "https://apps.apple.com/in/app/vasbazaar/id6776498373";
          showProgress("redirecting", 100, info.latestVersion);
          console.debug("[OTA] iOS - Opening App Store...", iosUrl);
          await new Promise(r => setTimeout(r, 1000));
          window.open(iosUrl, "_system");
        }

        console.debug("[OTA] Update completed:", updateRes);
        hideProgress();
      } catch (e) {
        console.debug("[OTA] Check error:", e.message);
        if (_setNativeProgress) {
          _setNativeProgress({ visible: false, stage: "", progress: 0, version: "" });
        }
      }
    };

    // Start immediately (small delay for component mount)
    setTimeout(() => {
      runBackgroundUpdate();
    }, 500);

    // NO cleanup - we WANT this to continue running even if component unmounts
  }, []);

  // ── PWA version check (non-native) — only uses version.json, no OTA API ──
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

    // Web platform: No OTA API call needed - just check version.json for new builds
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

    // Delay the check to let the app fully load first
    const buildTimer = setTimeout(checkBuild, 3000);
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

  // ── Render: Native progress bar (Android/iOS) ──
  if (nativeProgress.visible) {
    const stageLabel = STAGE_LABELS[nativeProgress.stage] || "Updating...";
    const progressPct = nativeProgress.progress || 0;

    return (
      <div style={nativeProgressBar} role="status">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4ade80",
              animation: "pulse 1.5s infinite",
            }} />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
              {stageLabel}
            </span>
          </div>
          {nativeProgress.version && (
            <span style={{ color: "#9ca3af", fontSize: 11 }}>
              v{nativeProgress.version}
            </span>
          )}
        </div>
        <div style={{
          height: 4,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: nativeProgress.stage === "downloading" ? `${progressPct}%` : "100%",
            background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
            borderRadius: 2,
            transition: "width 0.3s ease",
            animation: nativeProgress.stage !== "downloading" ? "indeterminate 1.5s infinite" : "none",
          }} />
        </div>
        {nativeProgress.stage === "downloading" && progressPct > 0 && (
          <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 6, textAlign: "right" }}>
            {progressPct}%
          </div>
        )}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  // ── Render: PWA reload bar (Web only) ──
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
