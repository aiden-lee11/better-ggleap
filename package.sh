#!/usr/bin/env bash
# Build the Chrome Web Store upload: only the files the extension needs at runtime.
set -euo pipefail
cd "$(dirname "$0")"

version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/uptime-badges-for-ggleap-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -q -X -r "$out" manifest.json states.js content.js colors.js popup.html popup.css popup.js icons -x '*.DS_Store'
echo "$out"
