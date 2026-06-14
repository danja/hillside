# Hillside Media Visualizer

An interactive media player and sextuple-visualization system featuring cellular automata, flocking boids, abelian sandpile, dual cellular automata ecosystems, 3D rotating cubes, and Chladni pattern simulation with audio-reactive effects.

**[Demo](https://danja.github.io/hillside/)**

The [algorithms](docs/algorithms.md) - detailed documentation for all six visualization systems.


## Features

### Core System
- 🎵 Advanced audio player with Web Audio API integration and frequency analysis
- 🔄 Sextuple-visualization system with seamless switching
- 🎮 Interactive navigation menu for visualization selection
- 📱 Responsive design that adapts to screen size
- ⚡ Built with Vite for fast development and builds
- 🧪 Comprehensive test suite with 108+ tests covering all components

### Hillside Visualization (Cellular Automata)
- 🌈 Particle-based cellular automaton with D3.js force simulation
- 🎨 Rainbow color palette with audio-reactive effects
- 🔗 Dynamic node connections based on proximity and audio
- 📊 Real-time audio frequency analysis integration

### Roofs Visualization (Flocking Boids)
- 🐦 Craig Reynolds' flocking algorithm implementation
- ⚡ Electric arc system with regular and long-distance arcs
- 💥 Particle explosion effects when boids die
- 🎯 Health/damage system with visual size scaling
- 🌈 Bass-responsive color flashing
- 🏃 Audio-reactive movement speeds and behaviors

### Road Visualization (Abelian Sandpile)
- 🏔️ Mathematical sandpile model with self-organized criticality
- 🌪️ Cascading avalanche effects from concentrated sand piles
- 🎵 Bass-driven sand avalanches and treble earthquakes
- 🎨 Dynamic color mapping with audio-reactive shifts
- ✨ Strategic pile locations for dramatic fractal patterns
- ⚡ High-frequency sand addition for continuous activity

### Clouds Visualization (Dual Cellular Automata Ecosystem)
- ☁️ Conway's Game of Life + Lenia continuous cellular automata
- 🔄 Predator-prey ecosystem dynamics between discrete and continuous CA
- 🌊 Flowing organic Lenia organisms with dynamic gradient rendering
- ⚡ Life gliders hunting Lenia, Lenia feeding on static Life patterns
- 🎵 Audio-reactive ecosystem modulation with tecNO.mp3
- 🧬 Real-time dual CA system with population maintenance

### Wire Visualization (3D Rotating Cubes)
- 🎲 True 3D cellular automata with rotating geometric cubes
- 👀 Perspective-correct anaglyph 3D effects (red/cyan stereoscopic)
- 📏 Dynamic size divergence system prevents visual convergence
- 🔄 Custom 3D physics engine with attraction/repulsion forces
- 🎵 Audio-reactive rotation chaos and size pulsing with wire.mp3
- 🌫️ Depth-based shadows and grayscale industrial aesthetic

### Mountain Visualization (Chladni Pattern Simulation)
- 🏔️ Physical modeling of a vibrating metal plate with sand grains
- 🌊 Finite difference method for realistic wave propagation physics
- 🎵 Multi-point audio excitation creates complex interference patterns
- 🔬 Authentic Chladni pattern formation with nodal line seeking behavior
- ⚡ Anti-settling mechanisms maintain dynamic patterns over time
- 🎨 Natural sand grain colors with displacement visualization

## Architecture Overview

The project follows a modular ES6 architecture with clear separation of concerns:

```
src/
├── index.html                    # Main HTML file
├── css/
│   └── styles.css               # Application and UI styles
├── js/
│   ├── main.js                  # Application entry point
│   ├── visualization-manager.js # Central visualization coordinator
│   ├── base/                    # Base classes for extensibility
│   │   ├── base-simulation.js   # Abstract simulation class
│   │   └── base-node.js         # Abstract node/particle class
│   ├── cellular-automata/       # Hillside visualization
│   │   ├── simulation.js        # Cellular automata implementation
│   │   └── node.js              # Individual particle/node
│   ├── boids/                   # Roofs visualization
│   │   ├── simulation.js        # Flocking simulation with electric arcs
│   │   └── boid.js              # Individual boid agent
│   ├── sandpile/                # Road visualization
│   │   ├── simulation.js        # Abelian sandpile implementation
│   │   └── cell.js              # Individual grid cell
│   ├── clouds/                  # Clouds visualization
│   │   └── simulation.js        # Dual CA ecosystem with Life + Lenia
│   ├── wire/                    # Wire visualization
│   │   ├── simulation.js        # 3D cube cellular automata with anaglyph
│   │   └── cube-node.js         # Individual 3D rotating cube
│   ├── mountain/                # Mountain visualization
│   │   ├── simulation.js        # Chladni pattern simulation with plate physics
│   │   └── sand-grain.js        # Individual sand grain with nodal seeking
│   ├── navigation/              # UI navigation system
│   │   └── menu.js              # Menu handling and visualization switching
│   ├── media/                   # Audio system
│   │   └── audio-player.js      # Web Audio API integration
│   └── utils/                   # Shared utilities
│       ├── dom.js               # DOM manipulation helpers
│       └── math.js              # Mathematical utilities
└── lib/                         # Local D3.js dependencies

tests/                           # Comprehensive test suite (108+ tests)
├── base/                        # Base class tests
├── boids/                       # Boids system tests
├── cellular-automata/           # Cellular automata tests
├── sandpile/                    # Sandpile system tests
├── clouds/                      # Clouds dual CA system tests
├── wire/                        # Wire 3D visualization tests
├── mountain/                    # Mountain Chladni pattern tests
├── navigation/                  # Navigation menu tests
├── media/                       # Audio player tests
└── utils/                       # Utility function tests

docs/                            # Documentation
└── algorithms.md                # Detailed algorithm explanations

public/                          # Static assets and audio files
├── hillside_2025-08-26.mp3    # Hillside visualization audio
├── roofs.mp3                   # Roofs visualization audio
├── fish-march.mp3              # Road visualization audio
├── tecNO.mp3                   # Clouds visualization audio
├── wire.mp3                    # Wire visualization audio
└── mountain.mp3                # Mountain visualization audio
```

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

### Rendering MP4 Videos

```bash
# Render every visualization/tune to MP4 files in renders/
./render.sh

# Render one visualization for a short test
ONLY=hillside ./render.sh --duration 10

# Override the YouTube-oriented defaults
WIDTH=1280 HEIGHT=720 FPS=30 ./render.sh
```

The renderer uses a separate `src/render.html` entry point with no navigation menu, so the GitHub Pages/browser app is left alone. By default it decodes the MP3, samples audio-reactive bass/mid/treble levels at each exact video frame time, pipes canvas frames into `ffmpeg`, and muxes the original audio into YouTube-ready H.264/AAC MP4 files. This is intentionally frame-by-frame instead of real-time screen capture, so slow renders do not create duplicate frozen frames.

When `--duration` is omitted, each MP4 duration is derived from its audio file with `ffprobe`. The old Xvfb capture path is still available for debugging with `CAPTURE=x11 ./render.sh`, which requires `xvfb` and `openbox`.

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui
```

## Usage

### Navigation
- **Menu Buttons**: Click "Hillside", "Roofs", "Road", "Clouds", "Wire", or "Mountain" to switch visualizations
- **Auto-Start**: Audio automatically starts when switching visualizations

### Audio Controls
- **Space**: Toggle audio playback (pause/resume)
- **S**: Stop audio playback completely

### Interaction
- **Mouse Movement**: Tracked for potential particle interactions (Hillside)
- **Responsive**: Visualizations adapt to window resizing

## Technology Stack

### Core Technologies
- **Build Tool**: Vite for fast development and optimized builds
- **Testing**: Vitest + jsdom with 90+ comprehensive tests
- **Language**: Modern ES6+ JavaScript with modules
- **Architecture**: Object-oriented with inheritance and polymorphism

### Visualization Technologies
- **Hillside**: D3.js force simulation, scales, and color palettes
- **Roofs**: Custom flocking algorithm implementation
- **Road**: Abelian sandpile cellular automaton with strategic pile concentration
- **Clouds**: Dual cellular automata (Conway's Life + Lenia) with ecosystem dynamics
- **Wire**: 3D rotating cubes with perspective-correct anaglyph stereoscopic effects
- **Mountain**: Chladni pattern simulation with metal plate physics and sand grain dynamics
- **Graphics**: HTML5 Canvas 2D rendering
- **Animation**: RequestAnimationFrame for smooth 60fps performance

### Audio Integration
- **Audio Processing**: Web Audio API for real-time frequency analysis
- **Audio Formats**: MP3 support with loading progress tracking
- **Frequency Analysis**: Bass, mid, treble separation for reactive effects
- **Beat Detection**: Real-time beat intensity analysis

## Development Notes

### Architecture Principles
- **Extensibility**: Base classes (`BaseSimulation`, `BaseNode`) enable easy addition of new visualizations
- **Separation of Concerns**: Clear module boundaries between audio, visualization, navigation, and utilities
- **Code Reuse**: Common functionality shared through inheritance and utility modules
- **Modern ES6**: Full module system with import/export, classes, and modern JavaScript features

### Implementation Details
- **Dependencies**: All remote dependencies stored locally in `src/lib/` for reliability
- **Physics**: D3's force simulation powers the Hillside cellular automata
- **Custom Algorithms**: Hand-coded flocking algorithms and electric arc systems for Roofs
- **Mathematical Models**: Abelian sandpile with self-organized criticality for Road
- **Performance**: Optimized for 60fps with efficient spatial calculations and rendering
- **Audio Latency**: Sub-25ms response times for real-time audio-visual synchronization

### Testing Strategy
- **Comprehensive Coverage**: 108+ tests covering all components and edge cases
- **Test Structure**: Mirrors source structure for easy maintenance
- **Mocking**: Web APIs mocked for reliable testing in jsdom environment
- **Integration Tests**: Full workflow testing including navigation and audio integration

### Extending the System
- **New Visualizations**: Extend `BaseSimulation` and `BaseNode` classes
- **Audio Effects**: Modify frequency analysis in `AudioPlayer.getAudioAnalysis()`
- **UI Enhancements**: Add new menu items and update `VisualizationManager`
- **Visual Effects**: Canvas 2D context provides full rendering control
