# Cellular Automata Visualization Algorithm

This document describes the algorithm powering the interactive audio-reactive visualization in the Hillside project.

## Core Concept

The visualization implements a particle-based cellular automaton where nodes interact based on proximity, creating dynamic, organic patterns. The system is audio-reactive, with visual elements responding to different frequency bands of the playing audio.

## Node System

### Node Properties
Each node in the simulation has:
- Position (`x`, `y`) and velocity (`vx`, `vy`)
- Size (`size`) that grows/shrinks based on interactions
- Color determined by its position in the initial node array
- Direction vectors (`dx`, `dy`) for initial movement

### Node Behavior
1. **Natural Decay**: Nodes gradually shrink over time (`size *= 0.999`)
2. **Size Constraints**: Node size is clamped between 1 and 100 units
3. **Velocity Damping**: Movement naturally slows down over time

## Physics Simulation

The simulation uses D3's force simulation with three main forces:

1. **Collision Force**
   - Prevents nodes from overlapping
   - Strength scales with node size
   - Configured with `strength(0.05)` for subtle repulsion

2. **Attraction Force**
   - Pulls nodes toward each other
   - Strength increases with node size
   - Creates organic clustering behavior

3. **Center Force**
   - Gently pulls nodes toward the center
   - Strength of 0.163 for balanced movement
   - Prevents nodes from drifting off-screen

## Audio Reactivity

The visualization responds to audio analysis in real-time:

### Frequency Band Processing
- **Bass Frequencies (Low-End)**:
  - Increases node glow and size
  - Affects line thickness between nodes
  - Creates pulsing effect on beats

- **Mid Frequencies**:
  - Influences growth rate of node sizes
  - Affects interaction strength between nodes

- **Treble Frequencies (High-End)**:
  - Creates glow effects around nodes
  - Enhances velocity exchange between nodes
  - Adds subtle highlights to active areas

### Time-Based Variations
- Slow density oscillation over ~30 second cycles
- Interaction distances vary based on audio levels
- Subtle brightness variations with the beat

## Rendering Pipeline

1. **Background**
   - Solid black background
   - Beat-driven brightness pulsing

2. **Node Connections**
   - Lines drawn between nearby nodes
   - Line opacity based on distance and audio levels
   - Thickness responds to bass frequencies

3. **Node Rendering**
   - Core node with audio-reactive size
   - Glow effect for high frequencies
   - Drop shadow for depth
   - Color gradients based on audio reactivity

## Performance Optimizations

- Limited node count (300-600 based on screen size)
- Distance-based culling for interactions
- Efficient force simulation with D3
- RequestAnimationFrame for smooth animation

## Interaction Rules

Nodes interact when within a certain distance:
1. **Size Exchange**:
   ```
   growthRate = 0.08 * (1 + midInfluence * 3)
   node1.size += (growthRate * node2.size) / distance
   node2.size += (growthRate * node1.size) / distance
   ```

2. **Velocity Exchange**:
   ```
   interactionStrength = 0.41 * (1 + trebleInfluence * 2.5)
   node1.vx += (interactionStrength * node2.vx) / distance
   ```

3. **Visual Connection**:
   - Lines drawn between interacting nodes
   - Opacity and thickness vary with audio input
   - Color gradients based on node colors and audio levels

This algorithm creates an organic, ever-evolving visualization that responds dynamically to audio input while maintaining smooth performance.
