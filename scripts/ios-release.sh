#!/usr/bin/env bash
# VasBazaar iOS release — build web, sync Capacitor, archive, export, upload to App Store Connect.
#
# Usage:
#   ./scripts/ios-release.sh [--bump patch|minor|major|x.y.z] [--version 1.3.9] [--build 10]
#                            [--skip-web] [--no-upload] [--force]
#
# Prefer --bump: it advances the version in ALL four version files at once
# (appVersion.js, public/version.json, project.pbxproj, android/build.gradle)
# via scripts/bump-version.js. --version/--build stay for one-off overrides.
#
# The script records every successful upload in .uploaded-ios.json and refuses
# to archive a version+build pair already uploaded (App Store Connect rejects
# those with error 90062 / 90186). Override with --force only if you know the
# earlier upload never reached Apple.
#
# Credentials (App Store Connect API key) are read from ~/.appstoreconnect/vasbazaar.env:
#   ASC_KEY_ID=XXXXXXXXXX
#   ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# and the key file must exist at ~/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8

set -euo pipefail

# --- resolve the CORRECT project root (never the stale Documents/ copies) ---------------
APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$APP_ROOT/ios/App"
WORKSPACE="$IOS_DIR/App.xcworkspace"
PBXPROJ="$IOS_DIR/App.xcodeproj/project.pbxproj"
EXPORT_OPTS="$IOS_DIR/ExportOptions.plist"
BUILD_DIR="$APP_ROOT/build-ios"
ARCHIVE="$BUILD_DIR/App.xcarchive"

UPLOAD_LOG="$APP_ROOT/.uploaded-ios.json"

NEW_VERSION=""
NEW_BUILD=""
BUMP=""
SKIP_WEB=0
DO_UPLOAD=1
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bump)      BUMP="$2";        shift 2 ;;
    --version)   NEW_VERSION="$2"; shift 2 ;;
    --build)     NEW_BUILD="$2";   shift 2 ;;
    --skip-web)  SKIP_WEB=1;       shift ;;
    --no-upload) DO_UPLOAD=0;      shift ;;
    --force)     FORCE=1;          shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "==> Project root: $APP_ROOT"
[[ -f "$WORKSPACE/contents.xcworkspacedata" ]] || { echo "ERROR: workspace not found at $WORKSPACE" >&2; exit 1; }

# --- 1. version bump ---------------------------------------------------------------------
cur_version() { grep -m1 -E '^\s*MARKETING_VERSION = ' "$PBXPROJ" | sed -E 's/.*= (.*);/\1/'; }
cur_build()   { grep -m1 -E '^\s*CURRENT_PROJECT_VERSION = ' "$PBXPROJ" | sed -E 's/.*= (.*);/\1/'; }

if [[ -n "$BUMP" ]]; then
  echo "==> npm run bump $BUMP (syncs all four version files)"
  ( cd "$APP_ROOT" && node scripts/bump-version.js "$BUMP" )
fi

if [[ -n "$NEW_VERSION" ]]; then
  /usr/bin/sed -i '' -E "s/MARKETING_VERSION = .*;/MARKETING_VERSION = ${NEW_VERSION};/g" "$PBXPROJ"
fi
if [[ -n "$NEW_BUILD" ]]; then
  /usr/bin/sed -i '' -E "s/CURRENT_PROJECT_VERSION = .*;/CURRENT_PROJECT_VERSION = ${NEW_BUILD};/g" "$PBXPROJ"
fi

VERSION="$(cur_version)"
BUILD="$(cur_build)"
echo "==> Version $VERSION ($BUILD)"

# refuse to rebuild something Apple has already accepted — that upload always
# fails with 90062 (version not higher) or 90186 (train closed), after a full
# archive has been burnt.
if [[ -f "$UPLOAD_LOG" && "$FORCE" -eq 0 ]]; then
  if grep -q "\"${VERSION} (${BUILD})\"" "$UPLOAD_LOG"; then
    echo "ERROR: $VERSION ($BUILD) was already uploaded (see $UPLOAD_LOG)." >&2
    echo "       App Store Connect will reject it. Run:" >&2
    echo "         ./scripts/ios-release.sh --bump patch     # or minor / major" >&2
    echo "       Use --force only if that earlier upload never reached Apple." >&2
    exit 1
  fi
fi

# keep the JS-side version markers in sync with the native one
if [[ -n "$NEW_VERSION" ]]; then
  /usr/bin/sed -i '' -E "s/(export const APP_VERSION = \")[^\"]*(\";)/\1${NEW_VERSION}\2/" "$APP_ROOT/src/utils/appVersion.js"
  /usr/bin/sed -i '' -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")/\1${NEW_VERSION}\2/" "$APP_ROOT/public/version.json"
  echo "==> Synced appVersion.js and public/version.json to $NEW_VERSION"
fi

# --- 2. web build + capacitor sync --------------------------------------------------------
if [[ "$SKIP_WEB" -eq 0 ]]; then
  echo "==> npm run build"
  ( cd "$APP_ROOT" && npm run build )
  echo "==> npx cap sync ios"
  ( cd "$APP_ROOT" && npx cap sync ios )
else
  echo "==> Skipping web build (--skip-web)"
fi

# --- 3. archive ---------------------------------------------------------------------------
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
echo "==> Archiving (this takes a few minutes)…"
xcodebuild -workspace "$WORKSPACE" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  clean archive | tee "$BUILD_DIR/archive.log" | grep -E '^\*\*|error:|warning: .*(version|signing)' || true

[[ -d "$ARCHIVE" ]] || { echo "ERROR: archive failed — see $BUILD_DIR/archive.log" >&2; exit 1; }

# verify what actually landed in the archive
ARCH_VER=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleShortVersionString" "$ARCHIVE/Info.plist")
ARCH_BUILD=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" "$ARCHIVE/Info.plist")
echo "==> Archive contains $ARCH_VER ($ARCH_BUILD)"
if [[ "$ARCH_VER" != "$VERSION" || "$ARCH_BUILD" != "$BUILD" ]]; then
  echo "ERROR: archive version $ARCH_VER ($ARCH_BUILD) != project $VERSION ($BUILD)" >&2
  exit 1
fi

# --- 4. export ipa -------------------------------------------------------------------------
echo "==> Exporting .ipa"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$BUILD_DIR/export" \
  -exportOptionsPlist "$EXPORT_OPTS" \
  -allowProvisioningUpdates | tee "$BUILD_DIR/export.log" | grep -E '^\*\*|error:' || true

IPA="$(find "$BUILD_DIR/export" -name '*.ipa' -maxdepth 1 | head -1)"
[[ -n "$IPA" ]] || { echo "ERROR: no .ipa produced — see $BUILD_DIR/export.log" >&2; exit 1; }
echo "==> IPA: $IPA"

if [[ "$DO_UPLOAD" -eq 0 ]]; then
  echo "==> --no-upload set. Done. Upload manually or re-run without the flag."
  exit 0
fi

# --- 5. upload -----------------------------------------------------------------------------
ENV_FILE="$HOME/.appstoreconnect/vasbazaar.env"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: missing $ENV_FILE (need ASC_KEY_ID and ASC_ISSUER_ID)" >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${ASC_KEY_ID:?ASC_KEY_ID not set in $ENV_FILE}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set in $ENV_FILE}"

KEY_FILE="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
[[ -f "$KEY_FILE" ]] || { echo "ERROR: key file not found at $KEY_FILE" >&2; exit 1; }

echo "==> Validating with App Store Connect"
xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

echo "==> Uploading $VERSION ($BUILD) to App Store Connect"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

# record it so a repeat run of the same version+build is blocked up front
node -e '
  const fs = require("fs");
  const p = process.argv[1], tag = process.argv[2];
  let log = [];
  try { log = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
  if (!log.includes(tag)) log.push(tag);
  fs.writeFileSync(p, JSON.stringify(log, null, 2) + "\n");
' "$UPLOAD_LOG" "$VERSION ($BUILD)"

echo "==> Uploaded $VERSION ($BUILD). Processing takes ~5-15 min before it shows in TestFlight."
echo "==> Recorded in $UPLOAD_LOG — next release: ./scripts/ios-release.sh --bump patch"
