#!/usr/bin/env node
/**
 * Fail the build if the four version markers have drifted apart.
 *
 * Runs from the `prebuild` / `prestart` npm hooks, so a mismatch is caught
 * before a bundle is produced instead of after an App Store rejection.
 * Fix a failure with `npm run bump` (never by hand-editing one file).
 */
const { readVersions } = require("./version-files");

const v = readVersions();
const problems = [];

const iosVersions = [...new Set(v.iosMarketing)];
const iosBuilds = [...new Set(v.iosBuild)];

if (iosVersions.length !== 1)
  problems.push(`iOS MARKETING_VERSION differs per config: ${v.iosMarketing.join(", ")}`);
if (iosBuilds.length !== 1)
  problems.push(`iOS CURRENT_PROJECT_VERSION differs per config: ${v.iosBuild.join(", ")}`);

const expected = iosVersions[0];
if (v.appVersion !== expected)
  problems.push(`src/utils/appVersion.js APP_VERSION=${v.appVersion} != iOS ${expected}`);
if (v.versionJson !== expected)
  problems.push(`public/version.json version=${v.versionJson} != iOS ${expected}`);
if (v.androidName !== expected)
  problems.push(`android versionName=${v.androidName} != iOS ${expected}`);

if (problems.length) {
  console.error("\n[check-version-sync] app version markers are out of sync:");
  problems.forEach((p) => console.error(`  - ${p}`));
  console.error("\nFix with:  npm run bump <patch|minor|major|x.y.z>\n");
  process.exit(1);
}

console.log(
  `[check-version-sync] OK — ${expected} (ios build ${iosBuilds[0]}, android code ${v.androidCode})`
);
