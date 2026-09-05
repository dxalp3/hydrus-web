#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
output_directory="$project_root/release/android"
output_path="$output_directory/Hydrus-Web-Android.apk"
keystore_path=""
gradle_log="$(mktemp "${TMPDIR:-/tmp}/hydrus-web-gradle.XXXXXX.log")"

cleanup() {
  if [[ -n "$keystore_path" ]]; then
    rm -f "$keystore_path"
  fi
  rm -f "$gradle_log"
}

trap cleanup EXIT

cd "$project_root"

npm install --no-audit --no-fund
npm run android:sync

export HYDRUS_APP_VERSION
HYDRUS_APP_VERSION="$(node -p "require('./package.json').version")"
export HYDRUS_ANDROID_VERSION_CODE
HYDRUS_ANDROID_VERSION_CODE="$(node -e "const [major=0,minor=0,patch=0]=require('./package.json').version.split('.').map(Number); console.log(major*1000000+minor*1000+patch)")"

run_gradle() {
  local task="$1"
  local status

  set +e
  (
    cd android
    ./gradlew "$task"
  ) 2>&1 | tee "$gradle_log"
  status="${PIPESTATUS[0]}"
  set -e

  if [[ "$status" -ne 0 && "${GITHUB_ACTIONS:-}" == "true" ]]; then
    local encoded_log
    while IFS= read -r line; do
      line="${line//'%'/'%25'}"
      line="${line//$'\r'/'%0D'}"
      echo "::error title=Android Gradle build::$line"
    done < <(tail -n 30 "$gradle_log")
    encoded_log="$(tail -c 24000 "$gradle_log" | base64 | tr -d '\n')"
    echo "::error title=Android Gradle log (base64)::$encoded_log"
  fi

  return "$status"
}

if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" &&
      -n "${ANDROID_KEYSTORE_PASSWORD:-}" &&
      -n "${ANDROID_KEY_ALIAS:-}" &&
      -n "${ANDROID_KEY_PASSWORD:-}" ]]; then
  keystore_path="$(mktemp "${TMPDIR:-/tmp}/hydrus-web-android.XXXXXX.jks")"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore_path"
  export ANDROID_KEYSTORE_PATH="$keystore_path"
  run_gradle assembleRelease
  source_apk="$project_root/android/app/build/outputs/apk/release/app-release.apk"
else
  echo "ANDROID_KEYSTORE_BASE64 is not set; building an installable debug-signed APK."
  run_gradle assembleDebug
  source_apk="$project_root/android/app/build/outputs/apk/debug/app-debug.apk"
fi

mkdir -p "$output_directory"
rm -f "$output_path"
cp "$source_apk" "$output_path"

echo "Created $output_path"
