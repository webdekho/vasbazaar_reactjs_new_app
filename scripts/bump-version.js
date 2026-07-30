#!/usr/bin/env node
/**
 * Bump the app version in ONE place for all four version files.
 *
 *   npm run bump            -> patch bump  (1.3.9 -> 1.3.10)
 *   npm run bump minor      -> 1.3.9 -> 1.4.0
 *   npm run bump major      -> 1.3.9 -> 2.0.0
 *   npm run bump 1.4.2      -> explicit version
 *   npm run bump -- --build-only   -> keep the version, bump iOS/Android build numbers only
 *
 * Native build numbers (iOS CURRENT_PROJECT_VERSION, Android versionCode)
 * always advance, because App Store Connect and Play both reject a build
 * number that has been uploaded before.
 *
 * IMPORTANT: App Store Connect also rejects a CFBundleShortVersionString that
 * is <= an already-approved version ("Invalid Pre-Release Train", error 90186).
 * So for a new App Store submission you need a real version bump, not just
 * --build-only. See scripts/ios-release.sh, which refuses to re-archive a
 * version+build pair it has already uploaded.
 */
const { readVersions, writeVersions, parseSemver } = require("./version-files");

const args = process.argv.slice(2).filter((a) => a !== "--");
const buildOnly = args.includes("--build-only");
const target = args.find((a) => a !== "--build-only") || "patch";

const cur = readVersions();

// The current version is whatever iOS says, but only if everything agrees.
const iosVersions = [...new Set(cur.iosMarketing)];
if (iosVersions.length !== 1) {
  console.error(
    `[bump-version] iOS build configs disagree: ${cur.iosMarketing.join(", ")}`
  );
  process.exit(1);
}
const current = iosVersions[0];

let next = current;
if (!buildOnly) {
  const [maj, min, pat] = parseSemver(current);
  if (target === "patch") next = `${maj}.${min}.${pat + 1}`;
  else if (target === "minor") next = `${maj}.${min + 1}.0`;
  else if (target === "major") next = `${maj + 1}.0.0`;
  else {
    parseSemver(target); // validate
    next = target;
  }
}

const nextIosBuild = Math.max(...cur.iosBuild.map(Number)) + 1;
const nextAndroidCode = Number(cur.androidCode) + 1;

writeVersions({
  version: next,
  iosBuild: nextIosBuild,
  androidCode: nextAndroidCode,
});

console.log(
  `[bump-version] ${current} (ios ${Math.max(
    ...cur.iosBuild.map(Number)
  )} / android ${cur.androidCode})  ->  ${next} (ios ${nextIosBuild} / android ${nextAndroidCode})`
);
console.log(
  "[bump-version] updated: appVersion.js, public/version.json, project.pbxproj, android/app/build.gradle"
);
