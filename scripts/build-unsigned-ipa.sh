#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
build_root="$(mktemp -d "${TMPDIR:-/tmp}/hydrus-web-ios.XXXXXX")"
app_path="$build_root/Build/Products/Release-iphoneos/App.app"
ipa_root="$build_root/ipa"
output_directory="$project_root/ios/App/output"
ipa_path="$output_directory/Hydrus-Web-unsigned.ipa"

cd "$project_root"

npm ci
npm run ios:sync

app_version="$(node -p "require('./package.json').version")"
build_number="${GITHUB_RUN_NUMBER:-1}"

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$build_root" \
  MARKETING_VERSION="$app_version" \
  CURRENT_PROJECT_VERSION="$build_number" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build

mkdir -p "$ipa_root/Payload"
cp -R "$app_path" "$ipa_root/Payload/Hydrus Web.app"

mkdir -p "$output_directory"
rm -f "$ipa_path"
(
  cd "$ipa_root"
  /usr/bin/zip -qry "$ipa_path" Payload
)

echo "Created $ipa_path"
