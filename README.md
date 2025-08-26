# Hillside Media Visualizer

A media player and visualizer using cellular automata for generative visuals.

**[Demo](https://danja.github.io/hillside/)**

The [algorithm](docs/algorithm.md).

Starting point was https://codepen.io/Power-Flower/pen/GgRowgg (via Reddit, either r/generative or r/cellularautomata I've lost the original post).
Named after the first thing I saw when I looked out of the window.

## Features

- 🎵 Audio player with Web Audio API integration
- 🌈 Cellular automata-based particle system visualization
- 🎨 Rainbow color palette with D3.js
- 📱 Responsive design that adapts to screen size
- ⚡ Built with Vite for fast development and builds
- 🧪 Comprehensive test suite with Vitest

## Project Structure

```
src/
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # Application styles
├── js/
│   ├── main.js            # Main application entry point
│   ├── cellular-automata/ # Particle system and simulation
│   ├── media/             # Audio player functionality
│   └── utils/             # Utility functions
└── lib/                   # Local D3.js dependencies

tests/                     # Test files matching src structure
public/                   # Static assets
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

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui
```

## Controls

- **Space**: Toggle audio playback (when audio is loaded)
- **S**: Stop audio playback
- **Mouse**: Interact with the particle system

## Technology Stack

- **Build Tool**: Vite
- **Testing**: Vitest + jsdom
- **Visualization**: D3.js (force simulation, scales, color palettes)
- **Audio**: Web Audio API
- **Modules**: ES6 modules with modern JavaScript

## Development Notes

- All remote dependencies are downloaded and stored locally in `src/lib/`
- The cellular automata simulation uses D3's force simulation for physics
- Audio visualization can be extended by modifying the `updateVisualizationWithAudio()` method
- Tests cover utility functions, DOM manipulation, audio player, and particle system components
- claude mcp add playwright npx '@playwright/mcp@latest'