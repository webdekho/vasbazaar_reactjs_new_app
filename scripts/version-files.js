/**
 * Shared reader/writer for every place the app version lives.
 *
 * The app version is duplicated across four files; they MUST agree, otherwise
 * the PWA update bar, the Android release and the App Store build disagree
 * about what "the current version" is.
 *
 *   1. src/utils/appVersion.js  -> APP_VERSION (compiled into the bundle)
 *   2. public/version.json      -> version (served to the PWA)
 *   3. ios/App/App.xcodeproj/project.pbxproj -> MARKETING_VERSION + CURRENT_PROJECT_VERSION
 *   4. android/app/build.gradle -> versionName + versionCode
 *
 * Used by scripts/bump-version.js (writes) and scripts/check-version-sync.js
 * (reads, enforced on every build).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const FILES = {
  appVersion: path.join(root, "src", "utils", "appVersion.js"),
  versionJson: path.join(root, "public", "version.json"),
  pbxproj: path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj"),
  gradle: path.join(root, "android", "app", "build.gradle"),
};

const read = (p) => fs.readFileSync(p, "utf8");

/** Every version marker found on disk. Missing markers come back as null. */
function readVersions() {
  const js = read(FILES.appVersion);
  const pbx = read(FILES.pbxproj);
  const gradle = read(FILES.gradle);
  const vj = JSON.parse(read(FILES.versionJson));

  const pick = (src, re) => {
    const m = src.match(re);
    return m ? m[1] : null;
  };

  // iOS repeats MARKETING_VERSION / CURRENT_PROJECT_VERSION once per build
  // configuration — collect all of them so a half-applied edit is caught.
  const all = (src, re) => [...src.matchAll(re)].map((m) => m[1]);

  return {
    appVersion: pick(js, /APP_VERSION\s*=\s*"([^"]+)"/),
    versionJson: vj.version || null,
    iosMarketing: all(pbx, /MARKETING_VERSION = ([^;]+);/g),
    iosBuild: all(pbx, /CURRENT_PROJECT_VERSION = ([^;]+);/g),
    androidName: pick(gradle, /versionName\s+"([^"]+)"/),
    androidCode: pick(gradle, /versionCode\s+(\d+)/),
  };
}

/** Write `version` (and optionally new native build numbers) to all four files. */
function writeVersions({ version, iosBuild, androidCode }) {
  fs.writeFileSync(
    FILES.appVersion,
    read(FILES.appVersion).replace(
      /(APP_VERSION\s*=\s*")[^"]+(")/,
      `$1${version}$2`
    )
  );

  const vj = JSON.parse(read(FILES.versionJson));
  vj.version = version;
  fs.writeFileSync(FILES.versionJson, JSON.stringify(vj, null, 2) + "\n");

  let pbx = read(FILES.pbxproj)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${iosBuild};`
    );
  fs.writeFileSync(FILES.pbxproj, pbx);

  fs.writeFileSync(
    FILES.gradle,
    read(FILES.gradle)
      .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
      .replace(/versionCode\s+\d+/, `versionCode ${androidCode}`)
  );
}

/** "1.3.9" -> [1, 3, 9]; throws on anything that is not x.y.z. */
function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  if (!m) throw new Error(`Not a x.y.z version: "${v}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

module.exports = { FILES, readVersions, writeVersions, parseSemver };
