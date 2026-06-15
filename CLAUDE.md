# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Development
npm run dev          # Start Vite development server on localhost:5173
npm run build        # Build for production (outputs to dist/)
npm run build:render # Build the MP4 render app (outputs to dist-render/)
npm run preview      # Preview production build

# Rendering
./render.sh          # Render all visualization/audio pairs to MP4 files
ONLY=step ./render.sh --duration 10  # Render a short smoke test for one visualization
npm run render:videos      # Build dist-render/ and run the frame-pipe renderer
npm run render:videos:xvfb # Debug-only Xvfb screen capture path

# Testing
npm test            # Run all tests once (vitest run)
npm run test:ui     # Run tests with interactive UI
vitest             # Run tests in watch mode (if needed for development)

# Run single test file
npx vitest run tests/utils/math.test.js
npx vitest run tests/cellular-automata/node.test.js
```

## Architecture Overview

This is a media player and visualizer application using cellular automata for generative visuals. The architecture follows a modular ES6 structure:

### Core Application Flow
1. **MediaVisualizer** (main.js) - Main application controller that orchestrates all components
2. **CellularAutomataSimulation** - Manages the particle system and D3.js force simulation
3. **AudioPlayer** - Handles Web Audio API integration and audio analysis
4. **Node** - Individual particle/cell in the cellular automata system

### Key Architectural Patterns

**Vite Configuration**: The project uses a custom Vite setup with `src/` as root directory, meaning all imports should be relative to `src/`. Build outputs go to `../dist/`.

**Parallel Render Build**: MP4 generation is intentionally separate from the GitHub Pages/browser app. The browser app uses `src/index.html`, `src/js/main.js`, and `src/js/visualization-manager.js`; the renderer uses `src/render.html`, `src/js/render/render-app.js`, `src/js/render/render-audio-player.js`, and `scripts/render-videos.js`. Render-specific behavior should stay in `src/js/render/` or clearly isolated simulation modules so it does not accidentally change the normal browser experience. See `docs/render.md` for render architecture and encoder details.

**D3.js Integration**: D3 libraries are loaded locally from `src/lib/` and used globally. The simulation relies heavily on D3's force simulation for physics:
- `d3.forceSimulation()` drives the particle system
- `d3.forceCollide()`, `d3.forceManyBody()`, `d3.forceCenter()` provide physics forces
- `d3.scaleLinear()` and `d3.scaleSequential()` with `d3.interpolateRainbow` handle color mapping

**Canvas Rendering**: The visualization uses a single HTML5 canvas with 2D context. The simulation runs in `requestAnimationFrame` loop with particle interaction calculations performed in nested loops.

**Audio Integration**: Web Audio API provides frequency/time domain analysis. Simulations receive bass/mid/treble/beat values through `BaseSimulation.updateAudioInfluence()`, normally called by `setupFrame()` before each draw. The render build uses decoded audio buffers so each video frame can sample analysis at the exact frame timestamp.

### Module Dependencies
- **Simulation depends on**: Node class, math utilities, D3 global objects
- **Main app depends on**: Simulation, AudioPlayer, DOM utilities  
- **Render app depends on**: RenderAudioPlayer, render registry, simulation modules
- **Tests require**: jsdom environment and Web API mocks (see tests/setup.js)

### Testing Architecture
Tests use Vitest with jsdom. Web APIs (AudioContext, Audio) are mocked in `tests/setup.js`. Test structure mirrors `src/` directory structure.

## Development Notes

- All remote dependencies are downloaded and stored locally in `src/lib/`
- The cellular automata uses D3's force simulation with collision detection and interaction between nodes
- Audio visualization integration point is `BaseSimulation.updateAudioInfluence()` / `setupFrame()`
- Node count adapts based on screen size (600 for >1024px width, 300 for smaller)
- Keyboard controls: Space (toggle audio), S (stop audio)
- New visualizations usually need: a module under `src/js/<name>/`, an audio entry in `VisualizationManager.audioFiles`, a `createSimulation()` case, a menu button in `src/index.html`, a render registry entry in `src/js/render/render-app.js`, and an allowed type in `scripts/render-videos.js`.
- Audio files live in `public/` so Vite copies them into both `dist/` and `dist-render/`.
- Default MP4 output uses deterministic frame-by-frame capture with bitrate-capped H.264/AAC. Use `ONLY=<type> ./render.sh --duration <seconds>` for smoke tests before full-length renders.
