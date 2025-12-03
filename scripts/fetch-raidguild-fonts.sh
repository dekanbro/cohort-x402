#!/usr/bin/env bash
set -euo pipefail

# Fetch RaidGuild brand fonts into public/fonts/
# Run from repository root: bash scripts/fetch-raidguild-fonts.sh

mkdir -p public/fonts

echo "Downloading fonts into public/fonts/"

# Source: RaidGuild brand repo (raw)
BASE="https://raw.githubusercontent.com/raid-guild/brand/main/public/fonts"

FILES=(
  "MAZIUSREVIEW20.09-Regular.woff"
  "EBGaramond-VariableFont_wght.ttf"
  "EBGaramond-Italic-VariableFont_wght.ttf"
  "UbuntuMono-Regular.woff2"
)

for f in "${FILES[@]}"; do
  url="$BASE/$f"
  out="public/fonts/$f"
  echo "Fetching $f..."
  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsSL "$url" -o "$out"; then
      echo "Warning: Failed to download $url (skipping)"
      continue
    fi
  elif command -v wget >/dev/null 2>&1; then
    if ! wget -qO "$out" "$url"; then
      echo "Warning: Failed to download $url (skipping)"
      continue
    fi
  else
    echo "Please install curl or wget to download fonts." >&2
    exit 1
  fi
done

echo "Done. Fonts saved to public/fonts/. Restart your dev server if running."