#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
FPS="${FPS:-24}"
OUTPUT_DIR="${OUTPUT_DIR:-renders}"
CRF="${CRF:-28}"
PRESET="${PRESET:-veryfast}"
RATE_CONTROL="${RATE_CONTROL:-bitrate}"
VIDEO_BITRATE="${VIDEO_BITRATE:-1800k}"
MAXRATE="${MAXRATE:-2500k}"
BUFSIZE="${BUFSIZE:-5000k}"
CAPTURE="${CAPTURE:-frames}"
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

if [ "$CAPTURE" = "x11" ]; then
  if ! command -v Xvfb >/dev/null 2>&1; then
    echo "Missing Xvfb. Install it with: sudo apt install -y xvfb" >&2
    exit 1
  fi

  if ! command -v openbox >/dev/null 2>&1; then
    echo "Missing openbox. Install it with: sudo apt install -y openbox" >&2
    exit 1
  fi
fi

if [ ! -d node_modules ]; then
  npm install
fi

if [ -n "$ONLY" ]; then
  EXTRA_ARGS+=(--only "$ONLY")
fi

if [ "$RATE_CONTROL" = "bitrate" ]; then
  EXTRA_ARGS+=(--video-bitrate "$VIDEO_BITRATE" --maxrate "$MAXRATE" --bufsize "$BUFSIZE")
else
  EXTRA_ARGS+=(--crf "$CRF")
fi

npm run render:videos -- \
  --width "$WIDTH" \
  --height "$HEIGHT" \
  --fps "$FPS" \
  --output "$OUTPUT_DIR" \
  --preset "$PRESET" \
  --capture "$CAPTURE" \
  "${EXTRA_ARGS[@]}" \
  "$@"
