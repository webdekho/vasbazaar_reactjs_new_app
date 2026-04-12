/**
 * Single source of truth for the application version.
 *
 * Keep this in sync with:
 *  - android/app/build.gradle (versionName + versionCode)
 *  - ios/App/App.xcodeproj Info.plist (CFBundleShortVersionString)
 *  - public/version.json (served to the PWA to detect new builds)
 *
 * The OTA service (otaService.checkUpdate) sends this value as
 * `currentVersion` to the backend on every app launch.
 */
export const APP_VERSION = "1.2.1";

// Build timestamp is embedded at build time via process.env if available;
// otherwise falls back to a compile-time constant.
export const APP_BUILD_TIME =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_BUILD_TIME) ||
  "dev";
