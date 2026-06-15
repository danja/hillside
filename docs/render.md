# MP4 Rendering

The MP4 renderer is a parallel build path for making finished video files from the visualizers. It uses the same simulation modules where possible, but it runs through `src/render.html` instead of the browser app entry point. That render page has no navigation menu and is intended for automation.

## Entry Points

- `render.sh` is the normal command-line entry point.
- `npm run render:videos` builds `dist-render/` and runs `scripts/render-videos.js`.
- `src/render.html` loads `src/js/render/render-app.js`, which exposes `window.hillsideRender`.
- `src/js/render/render-audio-player.js` provides render-time audio loading and offline-ish analysis.

The regular GitHub Pages/browser app still uses `src/index.html`, `src/js/main.js`, and `src/js/visualization-manager.js`.

## Frame-By-Frame Capture

The default renderer uses `CAPTURE=frames`. Puppeteer opens `dist-render/render.html`, creates the selected simulation, and renders one canvas frame at each exact video timestamp:

```text
frameTime = frame / fps
```

For each frame, the renderer:

1. Sets the deterministic render clock to that timestamp.
2. Sets the audio analysis time to the same timestamp.
3. Advances the simulation.
4. Reads the canvas as JPEG.
5. Pipes the JPEG into `ffmpeg`.

This is intentionally not real-time screen recording. If the machine is slow, the final MP4 still gets one unique visual frame per output frame rather than repeated frozen frames.

## Audio-Reactive Analysis

The render audio player loads each MP3 in two ways:

- As an `Audio` element for browser playback and capture compatibility.
- As a decoded `AudioBuffer` for deterministic analysis at arbitrary timestamps.

During frame rendering, `setAnalysisTime(seconds)` makes frequency analysis correspond to the exact video frame time. Simulations then consume the same audio fields they use in the browser:

- `bass`
- `mid`
- `treble`
- `overall`
- `beatIntensity`

That keeps the visuals synchronized with the muxed audio even though the render may take much longer than the song duration.

## Duration

When `--duration` is omitted, `scripts/render-videos.js` derives the output duration from the selected audio file with `ffprobe`. A short test render can override this:

```bash
ONLY=hillside ./render.sh --duration 10
ONLY=step ./render.sh --duration 10
```

Full renders should normally omit `--duration`:

```bash
ONLY=step ./render.sh
```

## Encoding

Canvas frames are piped to `ffmpeg` and muxed with the original MP3 audio as H.264/AAC MP4:

- Video codec: `libx264`
- Pixel format: `yuv420p`
- Audio codec: `aac`
- Audio bitrate: `192k`
- `+faststart` is enabled for web/video-platform playback

The default rate control is bitrate-capped:

```bash
RATE_CONTROL=bitrate
VIDEO_BITRATE=2500k
MAXRATE=3500k
BUFSIZE=7000k
PRESET=medium
```

These defaults are aimed at keeping full-length YouTube-ready files in a manageable size range. For smaller files:

```bash
ONLY=step VIDEO_BITRATE=1800k MAXRATE=2500k BUFSIZE=5000k ./render.sh
```

For quality-based encoding instead of bitrate targeting:

```bash
ONLY=step RATE_CONTROL=crf CRF=23 PRESET=slow ./render.sh
```

Lower CRF values increase quality and file size.

## Visualization Selection

Renderable visualizations are listed in two places:

- `scripts/render-videos.js`, for validating `ONLY` / `--only`.
- `src/js/render/render-app.js`, for mapping each type to its audio file and simulation class.

Example:

```js
step: { label: 'Step', audio: 'step.mp3', Simulation: StepSimulation }
```

The audio file must be available in `public/`, so Vite copies it into `dist-render/` during the render build.

## Render-Specific Simulation Behavior

Most visualizations reuse their browser simulation directly. Hillside has a render-only subclass at `src/js/render/render-hillside-simulation.js` because long deterministic renders exposed drift and sparsity that were less obvious in real-time browser playback.

That subclass preserves the original Hillside draw path and adds only render-oriented stabilization:

- soft x/y recentering
- small, frequent audio-sensitive regeneration
- checks for sparse or offscreen node clouds

This keeps the GitHub Pages/browser Hillside implementation separate from render-specific fixes.

## Xvfb Capture

`CAPTURE=x11` remains available for debugging:

```bash
CAPTURE=x11 ONLY=hillside ./render.sh --duration 10
```

That path uses Xvfb/openbox and records the virtual display. It is useful when debugging browser presentation issues, but the default frame-pipe path is preferred for final renders because it avoids duplicate frozen frames on slow machines.

## Outputs

By default, finished MP4s are written to `renders/`:

```text
renders/<visualization>-<width>x<height>-<timestamp>.mp4
```

Use `OUTPUT_DIR` to write elsewhere:

```bash
ONLY=step OUTPUT_DIR=temp/step-test ./render.sh --duration 8
```
