#!/usr/bin/env bash
set -euo pipefail

# Syncs NeonStrike2 web runtime files into Android assets/www.
# Source of truth remains NeonStrike2 (web project).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="$ROOT_DIR/NeonStrike2"
ANDROID_WWW="$ROOT_DIR/THE_LAST_GENERATION_ANDROID/app/src/main/assets/www"

if [ ! -d "$WEB_DIR" ]; then
  echo "ERROR: Web project not found: $WEB_DIR" >&2
  exit 1
fi

mkdir -p "$ANDROID_WWW"

# Clean only synced runtime targets (never touch Android source)
rm -rf "$ANDROID_WWW/src" "$ANDROID_WWW/assets" "$ANDROID_WWW/public"
rm -f "$ANDROID_WWW/index.html" "$ANDROID_WWW/style.css"

cp "$WEB_DIR/index.html" "$ANDROID_WWW/index.html"
cp "$WEB_DIR/style.css" "$ANDROID_WWW/style.css"
cp -r "$WEB_DIR/src" "$ANDROID_WWW/src"
cp -r "$WEB_DIR/assets" "$ANDROID_WWW/assets"
cp -r "$WEB_DIR/public" "$ANDROID_WWW/public"

# Safety: never ship backups/docs/dev-only files in www
rm -rf "$ANDROID_WWW/backups" "$ANDROID_WWW/docs" "$ANDROID_WWW/.git" 2>/dev/null || true

echo "Sync complete -> $ANDROID_WWW"
echo "Included: index.html style.css src/ assets/ public/"
