#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
output_directory="$project_root/release/android"
output_path="$output_directory/Hydrus-Web-Android.apk"
keystore_path=""

cleanup() {
  if [[ -n "$keystore_path" ]]; then
    rm -f "$keystore_path"
  fi
}

trap cleanup EXIT

cd "$project_root"

npm install --no-audit --no-fund
npm run android:sync

export HYDRUS_APP_VERSION
HYDRUS_APP_VERSION="$(node -p "require('./package.json').version")"
export HYDRUS_ANDROID_VERSION_CODE
HYDRUS_ANDROID_VERSION_CODE="$(node -e "const [major=0,minor=0,patch=0]=require('./package.json').version.split('.').map(Number); console.log(major*1000000+minor*1000+patch)")"

if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" &&
      -n "${ANDROID_KEYSTORE_PASSWORD:-}" &&
      -n "${ANDROID_KEY_ALIAS:-}" &&
      -n "${ANDROID_KEY_PASSWORD:-}" ]]; then
  keystore_path="$(mktemp "${TMPDIR:-/tmp}/hydrus-web-android.XXXXXX.jks")"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore_path"
  export ANDROID_KEYSTORE_PATH="$keystore_path"
  (
    cd android
    ./gradlew assembleRelease
  )
  source_apk="$project_root/android/app/build/outputs/apk/release/app-release.apk"
else
  echo "ANDROID_KEYSTORE_BASE64 is not set; building an installable debug-signed APK."
  (
    cd android
    ./gradlew assembleDebug
  )
  source_apk="$project_root/android/app/build/outputs/apk/debug/app-debug.apk"
fi

mkdir -p "$output_directory"
rm -f "$output_path"
cp "$source_apk" "$output_path"

echo "Created $output_path"
