#!/bin/bash
# Sync all in-app / PWA icons from the iOS App Store icon (source of truth).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
PUBLIC="$ROOT/public"

if [[ ! -f "$SRC" ]]; then
  echo "Missing AppIcon: $SRC" >&2
  exit 1
fi

cp "$SRC" "$PUBLIC/img/bi.png"
cp "$SRC" "$PUBLIC/img/app-icon.png"
sips -z 64 64 "$SRC" --out "$PUBLIC/favicon.png" >/dev/null
sips -z 64 64 "$SRC" --out "$PUBLIC/pwa-64x64.png" >/dev/null
sips -z 192 192 "$SRC" --out "$PUBLIC/pwa-192x192.png" >/dev/null
sips -z 180 180 "$SRC" --out "$PUBLIC/apple-touch-icon-180x180.png" >/dev/null
sips -z 512 512 "$SRC" --out "$PUBLIC/pwa-512x512.png" >/dev/null
sips -z 512 512 "$SRC" --out "$PUBLIC/maskable-icon-512x512.png" >/dev/null

echo "Synced icons from AppIcon-512@2x.png"
