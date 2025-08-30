# Visualization Algorithms

This document describes the algorithms powering the interactive audio-reactive visualizations in the Hillside project. The system supports two distinct visualization modes: **Hillside** (cellular automata) and **Roofs** (flocking boids).

---

## Hillside Visualization (Cellular Automata)

The original visualization implements a particle-based cellular automaton where nodes interact based on proximity, creating dynamic, organic patterns.

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

Starting point was https://codepen.io/Power-Flower/pen/GgRowgg (via Reddit, either r/generative or r/cellularautomata I've lost the original post).
Named after the first thing I saw when I looked out of the window.

---

## Roofs Visualization (Flocking Boids)

The second visualization implements a flocking algorithm based on Craig Reynolds' boids system, enhanced with electric arc effects and audio-reactive behaviors.

### Core Concept

The Roofs visualization creates a flock of autonomous agents (boids) that exhibit emergent collective behavior through three simple rules: separation, alignment, and cohesion. The system is enhanced with electric arcing effects that create dramatic visual interactions between nearby boids.

### Boid Properties
Each boid in the simulation has:
- Position (`x`, `y`) and velocity (`vx`, `vy`) vectors
- Health system (0-100) for electric arc damage
- Size that scales with damage taken and audio levels
- Color that flashes red on bass peaks
- Trail system for motion blur effects
- Flocking parameters (separation, alignment, cohesion radii)

### Flocking Algorithm

#### 1. Separation
Boids steer to avoid crowding local flockmates:
```javascript
// Calculate repulsion force from nearby boids
const steer = { x: 0, y: 0 };
for (const neighbor of nearbyBoids) {
    const distance = this.distanceTo(neighbor);
    if (distance < separationRadius) {
        const repulsion = (this.position - neighbor.position) / distance;
        steer += repulsion * (1.0 / distance); // Weight by inverse distance
    }
}
```

#### 2. Alignment
Boids steer towards the average heading of neighbors:
```javascript
// Average velocity of nearby boids
const averageVelocity = nearbyBoids.reduce((sum, boid) => 
    sum + boid.velocity, {x: 0, y: 0}) / nearbyBoids.length;

const alignmentForce = averageVelocity - this.velocity;
```

#### 3. Cohesion
Boids steer to move toward the average position of local flockmates:
```javascript
// Calculate center of mass of nearby boids
const centerOfMass = nearbyBoids.reduce((sum, boid) => 
    sum + boid.position, {x: 0, y: 0}) / nearbyBoids.length;

const cohesionForce = this.seek(centerOfMass);
```

#### 4. Center Gravity
Additional force that gently pulls boids toward screen center:
```javascript
const centerX = canvasWidth / 2;
const centerY = canvasHeight / 2;
const centerGravity = this.seek(centerX, centerY);
```

### Electric Arc System

The visualization features a dynamic electric arc system that creates dramatic visual effects:

#### Regular Electric Arcs
- **Trigger Conditions**: Boids within 50 pixels of each other
- **Probability**: Base 15% chance per frame, boosted by audio
- **Visual**: Jagged lightning effect with branching patterns
- **Damage**: 20-50 points based on bass levels
- **Cooldown**: 25ms between regular arcs

#### Long-Distance Electric Arcs
- **Trigger Conditions**: High treble levels (>0.8) in audio
- **Probability**: 6% chance during treble peaks
- **Range**: Any two random boids regardless of distance
- **Visual**: More dramatic branching with wavy sine patterns
- **Damage**: 40-90 points (double regular arc damage)
- **Duration**: 300ms (50% longer than regular arcs)
- **Cooldown**: 10ms for maximum responsiveness

#### Arc Generation Algorithm
```javascript
generateArcBranches(source, target) {
    const branches = [];
    const distance = source.distanceTo(target);
    const numBranches = Math.floor(distance / 8);
    
    for (let i = 1; i < numBranches; i++) {
        const t = i / numBranches;
        const midpoint = source.lerp(target, t);
        
        // Add random deviation for natural lightning appearance
        const deviation = (Math.random() - 0.5) * 8;
        branches.push(midpoint + deviation);
    }
    
    return branches;
}
```

### Audio Reactivity

The Roofs visualization responds to different frequency bands:

#### Bass Response
- **Flocking Behavior**: Increases separation force (avoidance)
- **Arc Probability**: 2x multiplier for arc creation
- **Arc Damage**: Directly scales damage amount
- **Color Flashing**: Bass spikes trigger red color flashes

#### Mid-Range Response
- **Alignment**: Influences boid alignment strength
- **Movement**: Affects general responsiveness

#### Treble Response
- **Long-Distance Arcs**: Primary trigger for dramatic arcs
- **Arc Intensity**: Controls visual brightness of arcs
- **Cohesion**: Influences flocking cohesion strength

#### Beat Detection
- **Speed Boost**: Increases maximum boid speed on beats
- **Arc Multiplier**: 3x arc probability during beats
- **Size Scaling**: Boids grow larger during intense beats

### Health and Death System

Boids feature a health system that creates lifecycle dynamics:

1. **Damage**: Boids lose health when struck by electric arcs
2. **Size Scaling**: Damaged boids grow up to 3x larger than healthy ones
3. **Death**: Boids die when health reaches 0
4. **Explosion**: Death triggers particle explosion effect
5. **Respawn**: Dead boids respawn after 3 seconds at random locations

### Performance Characteristics

- **Boid Count**: 35 boids (small screens) to 55 boids (large screens)
- **Interaction Range**: 150 pixel radius for flocking calculations
- **Arc Range**: 50 pixels (regular) / unlimited (long-distance)
- **Frame Rate**: Optimized for 60fps with efficient spatial calculations
- **Audio Latency**: 10-25ms response time for visual effects

### Visual Effects

1. **Boid Rendering**: Triangular shapes pointing in movement direction
2. **Motion Trails**: Fading trail system shows movement history  
3. **Electric Arcs**: White core with blue glow effects
4. **Explosions**: 15-particle radial bursts on death
5. **Health Visualization**: Size scaling instead of traditional health bars
6. **Audio-Reactive Colors**: Bass-triggered red flashing system

The Roofs visualization creates a dynamic ecosystem where autonomous agents exhibit complex emergent behaviors while being enhanced by dramatic electric effects that respond to musical peaks and audio intensity.

Named after the view of rooftops from my window during development.
