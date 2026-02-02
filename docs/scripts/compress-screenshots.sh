#!/bin/bash
# Resize raw screenshots to 1600px wide and compress for the docs site.
# Uses sips (macOS-native) for resize, pngquant for compression.

set -euo pipefail

SRC="../local/promotion/raw"
DST="static/screenshots"

FILES=(
  kanban-wide-light.png
  agent-kanban-light.png
  detail-panel-light.png
  keyboard-hints-light.png
  graph-view-light.png
  stats-view-light.png
  tree-expanded-light.png
  tree-view-light.png
)

mkdir -p "$DST"

for f in "${FILES[@]}"; do
  src="$SRC/$f"
  dst="$DST/$f"
  if [[ ! -f "$src" ]]; then
    echo "skip: $src not found"
    continue
  fi
  # Skip if destination is newer than source
  if [[ -f "$dst" && "$dst" -nt "$src" ]]; then
    echo "fresh: $f ($(du -h "$dst" | cut -f1))"
    continue
  fi
  cp "$src" "$dst"
  sips --resampleWidth 1600 "$dst" >/dev/null 2>&1
  if command -v pngquant >/dev/null 2>&1; then
    pngquant --force --quality=70-90 --output "$dst" "$dst"
  fi
  echo "compressed: $f ($(du -h "$dst" | cut -f1))"
done

echo "done — total: $(du -sh "$DST" | cut -f1)"
