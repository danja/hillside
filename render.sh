#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

WIDTH="${WIDTH:-1920}"
HEIGHT="${HEIGHT:-1080}"
FPS="${FPS:-30}"
OUTPUT_DIR="${OUTPUT_DIR:-renders}"
CRF="${CRF:-18}"
PRESET="${PRESET:-medium}"
ONLY="${ONLY:-}"
EXTRA_ARGS=()

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Missing ffmpeg. Install it before rendering." >&2
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "Missing ffprobe. It is usually installed with ffmpeg." >&2
  exit 1
fi

if ! command -v Xvfb >/dev/null 2>&1; then
  echo "Missing Xvfb. Install it with: sudo apt install -y xvfb" >&2
  exit 1
fi

if ! command -v openbox >/dev/null 2>&1; then
  echo "Missing openbox. Install it with: sudo apt install -y openbox" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

if [ -n "$ONLY" ]; then
  EXTRA_ARGS+=(--only "$ONLY")
fi

npm run render:videos -- \
  --width "$WIDTH" \
  --height "$HEIGHT" \
  --fps "$FPS" \
  --output "$OUTPUT_DIR" \
  --crf "$CRF" \
  --preset "$PRESET" \
  "${EXTRA_ARGS[@]}" \
  "$@"
