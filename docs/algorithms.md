# Visualization Algorithms

This document describes the algorithms powering the interactive audio-reactive visualizations in the Hillside project. The system supports five distinct visualization modes: **Hillside** (cellular automata), **Roofs** (flocking boids), **Road** (abelian sandpile), **Clouds** (dual cellular automata ecosystem), and **Wire** (3D rotating cubes).

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

---

## Road Visualization (Abelian Sandpile)

The third visualization implements the abelian sandpile model, a cellular automaton that demonstrates self-organized criticality through cascading avalanches of sand grains enhanced with creative audio-reactive features.

### Core Concept

The Road visualization creates a grid-based system where each cell can hold 0-3 sand grains. When a cell accumulates 4 or more grains, it becomes unstable and "topples," distributing one grain to each of its four neighbors. This simple rule creates complex fractal patterns and cascading avalanche effects.

### Grid Properties
Each cell in the sandpile grid has:
- Grid position (`gridX`, `gridY`) for neighbor calculations
- Sand grain count (0-3 stable, 4+ triggers toppling)
- Color mapping based on grain count with audio-reactive modifications
- Toppling animation states for visual feedback
- Cell size adaptive to screen dimensions

### Sandpile Algorithm

#### Core Toppling Mechanics
```javascript
topple() {
    if (this.grains >= 4) {
        const grainsToDistribute = Math.floor(this.grains / 4) * 4;
        this.grains -= grainsToDistribute;
        return grainsToDistribute / 4; // Grains per neighbor (always 1)
    }
    return 0;
}
```

#### Avalanche Processing
The system processes toppling in cascading waves:
1. **Instability Detection**: Scan grid for cells with 4+ grains
2. **Toppling Wave**: All unstable cells topple simultaneously
3. **Grain Distribution**: Each toppling cell gives 1 grain to 4 neighbors
4. **Cascade Continuation**: Process continues until all cells stable
5. **Safety Limiting**: Maximum 50 topples per frame for performance

#### Grid Layout
- **Desktop**: 80x50 grid (4000 cells)
- **Mobile**: 50x35 grid (1750 cells)
- **Cell Size**: Adaptive based on screen dimensions
- **Boundary Handling**: Grains falling off edges are lost

### Strategic Sand Pile System

Instead of random grain placement, the Road visualization uses strategic concentration points:

#### Pile Locations
1. **Center Pile** (40% of sand)
   - Primary accumulation point at grid center
   - Creates largest, most dramatic avalanches
   - Forms characteristic diamond/cross fractal patterns

2. **Corner Piles** (15% each)
   - Four secondary piles near grid corners
   - Create distributed avalanche sources
   - Generate complex interaction patterns

#### Concentrated Addition Algorithm
```javascript
addRandomSand(amount) {
    for (let grain of amount) {
        // Weighted selection of pile location
        const selectedPile = weightedRandom(sandPileLocations);
        
        // Add small randomness (3x3 area) around pile center
        const x = clamp(selectedPile.x + random(-1, 1), 0, gridWidth-1);
        const y = clamp(selectedPile.y + random(-1, 1), 0, gridHeight-1);
        
        grid[y][x].addGrains(1);
    }
}
```

### Audio-Reactive Features

The Road visualization responds creatively to different aspects of the music:

#### Bass-Driven Avalanches
- **Trigger**: Bass level > 0.5 with increase > 0.05
- **Sand Amount**: 2-17 grains per bass hit (was 1-10)
- **Effect**: Creates major avalanche cascades on musical beats
- **Response Time**: <50ms for immediate visual impact

#### Mid-Range Sand Rain
- **High Mid (>0.4)**: Very frequent addition (every 20ms)
- **Normal Mid**: Regular addition (every 40ms) 
- **Amount**: 2-4 grains per cycle (was 1)
- **Purpose**: Maintains constant pile building between bass hits

#### Treble Earthquakes
- **Trigger**: Treble increase >0.15 and level >0.7
- **Effect**: Redistributes accumulated sand in localized areas
- **Radius**: 8-20 cell circular area around random epicenter
- **Redistribution**: 50% of grains moved to nearby random locations
- **Visual**: Screen shake effect during earthquake

#### Color Dynamics
```javascript
updateColor(audioInfluence) {
    const baseColor = grainColors[Math.min(this.grains, 3)];
    
    if (audioInfluence.bass > 0.7) {
        // High bass - shift towards red
        this.color = shiftColor(baseColor, '#ff4444', bass * 0.3);
    } else if (audioInfluence.treble > 0.6) {
        // High treble - shift towards bright white
        this.color = shiftColor(baseColor, '#ffffff', treble * 0.2);
    }
}
```

### Visual Design

#### Color Mapping
- **0 Grains**: Black (#000000) - empty cells
- **1 Grain**: Deep Blue (#1a237e) - sparse distribution  
- **2 Grains**: Green (#2e7d32) - moderate accumulation
- **3 Grains**: Orange/Gold (#f57c00) - high concentration

#### Toppling Animation
- **White Pulse**: Cells flash bright white when toppling
- **Size Growth**: Toppling cells briefly grow 50% larger
- **Fade Duration**: 330ms smooth fade-out animation
- **Particle Effects**: Orange avalanche particles during large cascades

#### Earthquake Effects
- **Screen Shake**: Camera jitter during redistribution
- **Duration**: 500ms earthquake effect
- **Intensity**: Proportional to treble spike magnitude

### Performance Optimizations

#### Efficient Processing
- **Batch Toppling**: Process all unstable cells simultaneously
- **Safety Limits**: Maximum 50 topples per frame prevents stalls
- **Grid Scanning**: Optimized neighbor lookup with boundary checks
- **Memory Management**: Reuse particle objects for avalanche effects

#### Frame Rate Stability
- **Target**: 60fps on modern devices
- **Adaptive Quality**: Grid size scales with screen dimensions
- **Culling**: Skip rendering empty areas when possible
- **Animation Batching**: Group multiple grain additions per frame

### Mathematical Properties

The abelian sandpile exhibits fascinating mathematical properties:

#### Self-Organized Criticality
- **Avalanche Distribution**: Power-law scaling of avalanche sizes
- **Fractal Patterns**: Self-similar structures emerge naturally
- **Critical State**: System evolves to edge of stability

#### Abelian Property
- **Order Independence**: Final stable state independent of toppling order
- **Deterministic**: Same initial conditions always produce same result
- **Commutative**: Addition operations can be performed in any sequence

#### Emergent Complexity
- **Simple Rules**: Only 4-grain threshold and redistribution rule
- **Complex Patterns**: Generates intricate fractal boundaries
- **Scale Invariance**: Patterns repeat at multiple size scales

The Road visualization demonstrates how simple local rules can generate complex global patterns, enhanced by musical influences that create a dynamic, ever-evolving sandscape of cascading avalanches.

Named after the winding road visible from the development workspace, representing the journey from simple rules to complex emergent beauty.

---

## Clouds Visualization (Dual Cellular Automata Ecosystem)

The fourth visualization implements a predator-prey ecosystem featuring two forms of cellular automata: Conway's Game of Life (discrete) and Lenia (continuous). This creates a dynamic interplay between pixelated Life patterns and flowing organic Lenia organisms, enhanced with audio-reactive behaviors that modulate the ecosystem dynamics.

### Core Concept

The Clouds visualization combines two fundamentally different cellular automaton systems in a shared environment:
- **Conway's Life**: Discrete binary cellular automaton with birth/death rules
- **Lenia**: Continuous cellular automaton with kernel convolution and smooth growth functions

These systems interact through predator-prey relationships where Lenia organisms feed on static Life patterns, while Life gliders consume Lenia organisms.

### Dual Grid Architecture

#### Grid System
- **Life Grid**: Binary (0/1) states for Conway's Game of Life
- **Lenia Grid**: Continuous (0.0-1.0) density values for Lenia organisms  
- **Interaction Grid**: Tracks predation and feeding events between systems
- **Grid Dimensions**: 150x100 (large screens) or 120x80 (smaller screens)

#### Pattern Tracking
```javascript
// Track different Life pattern types
this.gliders = [];           // Moving Life patterns (predators)
this.staticPatterns = [];    // Stable Life formations (prey)
this.leniaOrganisms = [];    // Lenia blob tracking for persistence
```

### Conway's Game of Life Implementation

#### Standard Rules
1. **Survival**: Live cells with 2-3 neighbors survive
2. **Birth**: Dead cells with exactly 3 neighbors become alive
3. **Death**: All other cells die from over/underpopulation

#### Pattern Types
- **Gliders**: Moving 5-cell patterns that translate across the grid
- **Static Patterns**: Stable formations (blocks, beehives) that don't change
- **Pattern Recognition**: System distinguishes moving vs static Life formations

#### Life Pattern Creation
```javascript
addGlider(x, y) {
    // Standard glider pattern
    this.setLife(x, y, 1);
    this.setLife(x + 1, y + 1, 1);
    this.setLife(x + 2, y - 1, 1);
    this.setLife(x + 2, y, 1);
    this.setLife(x + 2, y + 1, 1);
    
    // Track as predator
    this.gliders.push({x: x + 1, y: y, vx: 1, vy: 1, energy: 1.0});
}
```

### Lenia Continuous Cellular Automata

#### Kernel Convolution System
Lenia organisms evolve through continuous kernel convolution:

```javascript
computeLeniaKernel(centerX, centerY) {
    let totalDensity = 0;
    let totalWeight = 0;
    
    for (let dy = -this.leniaRadius; dy <= this.leniaRadius; dy++) {
        for (let dx = -this.leniaRadius; dx <= this.leniaRadius; dx++) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= this.leniaRadius) {
                const weight = this.leniaKernelFunction(distance);
                const density = this.getLenia(centerX + dx, centerY + dy);
                totalDensity += density * weight;
                totalWeight += weight;
            }
        }
    }
    
    return totalWeight > 0 ? totalDensity / totalWeight : 0;
}
```

#### Growth Function
Dynamic growth function creates flowing, wave-like behavior:

```javascript
leniaGrowthFunction(density) {
    const difference = density - this.leniaGrowthMu;
    const normalizedDiff = difference / this.leniaGrowthSigma;
    
    // Dynamic growth with time-varying components
    const baseGrowth = 2.5 * Math.exp(-(normalizedDiff * normalizedDiff) / 2) - 1.0;
    const timeComponent = Math.sin(Date.now() * 0.001) * 0.02;
    const flowComponent = density > 0.3 ? Math.sin(density * 10) * 0.1 : 0;
    
    return Math.max(-0.5, baseGrowth + timeComponent + flowComponent + 0.02);
}
```

#### Lenia Parameters
- **Radius**: 13 (neighborhood size)
- **Alpha**: 0.25 (time step for dynamics)
- **Growth Mu**: 0.15 (optimal density center)
- **Growth Sigma**: 0.035 (growth function width)

### Predator-Prey Ecosystem

#### Lenia Feeding on Static Life
```javascript
processLeniaFeedingOnLife() {
    for (const pattern of this.staticPatterns) {
        const averageLeniaIntensity = this.calculateLeniaInArea(pattern);
        
        if (averageLeniaIntensity > this.feedingThreshold) {
            pattern.energy -= this.feedingRate * averageLeniaIntensity;
            this.createFeedingEvent(pattern.x, pattern.y, averageLeniaIntensity);
            
            if (pattern.energy <= 0) {
                this.removeLifePattern(pattern);
            }
        }
    }
}
```

#### Life Gliders Consuming Lenia
```javascript
processGliderPredationOnLenia() {
    for (const glider of this.gliders) {
        const localLeniaIntensity = this.getLeniaInRadius(glider.x, glider.y, 3);
        
        if (localLeniaIntensity > this.predationThreshold) {
            this.reduceLeniaInArea(glider.x, glider.y, this.predationRate);
            this.createPredationEvent(glider.x, glider.y, localLeniaIntensity);
        }
    }
}
```

### Advanced Lenia Rendering System

The visualization uses a sophisticated rendering approach to show Lenia as flowing, organic clouds:

#### Region-Based Rendering
```javascript
findLeniaRegions() {
    const regions = [];
    const visited = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));
    const threshold = 0.05;
    
    // Flood-fill algorithm to find contiguous Lenia organisms
    for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
            if (!visited[y][x] && this.leniaGrid[y][x] > threshold) {
                const region = this.floodFillLeniaRegion(x, y, threshold, visited);
                if (region.points.length > 5) {
                    regions.push(region);
                }
            }
        }
    }
    
    return regions;
}
```

#### Flowing Gradient Visualization
```javascript
renderLeniaRegion(region) {
    const time = Date.now() * 0.002;
    const centerX = region.centerX * this.cellWidth + this.cellWidth / 2;
    const centerY = region.centerY * this.cellHeight + this.cellHeight / 2;
    
    // Animated gradient center for flow effect
    const flowOffsetX = Math.sin(time + region.centerX * 0.1) * maxRadius * 0.3;
    const flowOffsetY = Math.cos(time + region.centerY * 0.1) * maxRadius * 0.3;
    
    const gradient = this.context.createRadialGradient(
        centerX + flowOffsetX, centerY + flowOffsetY, 0,
        centerX, centerY, maxRadius
    );
    
    // Dynamic colors with audio pulsing
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${region.maxIntensity * 0.8})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
}
```

### Audio-Reactive Ecosystem Modulation

#### Bass-Driven Spawning
- **Life Glider Creation**: Bass hits spawn new predatory gliders
- **Lenia Growth Boost**: Low frequencies enhance Lenia growth parameters
- **Dynamic Alpha**: Time step increases with bass for faster evolution

#### Mid-Range Interaction Modulation
```javascript
updateAudioReactivity(deltaTime) {
    const midInfluence = audioAnalysis.mid || 0;
    this.feedingRate = 0.008 * (1 + midInfluence * 1.5);
    this.predationRate = 0.015 * (1 + midInfluence * 1.2);
}
```

#### Treble Disturbances
- **Lenia Seed Creation**: High frequencies create new Lenia organisms
- **Ecosystem Disruption**: Treble spikes cause environmental changes
- **Visual Enhancement**: Particle effects and color shifts

### Population Maintenance System

#### Automatic Reseeding
```javascript
maintainLeniaPopulation() {
    let totalLeniaPopulation = 0;
    let activeCells = 0;
    
    // Calculate population statistics
    for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
            const density = this.leniaGrid[y][x];
            if (density > 0.01) {
                totalLeniaPopulation += density;
                activeCells++;
            }
        }
    }
    
    const populationRatio = totalLeniaPopulation / (this.gridWidth * this.gridHeight);
    
    // Reseed if population falls below thresholds
    if (populationRatio < 0.01 || activeCells < 20) {
        this.reseedLeniaOrganisms();
    }
}
```

#### Smart Location Finding
- **Safe Zone Detection**: Finds areas with minimal Life activity
- **Strategic Placement**: Avoids overcrowded regions
- **Diversity Maintenance**: Creates organisms of varying sizes and intensities

### Performance Optimizations

#### Computational Efficiency
- **Region-Based Updates**: Only processes active Lenia areas
- **Kernel Caching**: Stores frequently computed convolution results
- **Adaptive Quality**: Reduces update frequency during performance issues
- **Spatial Partitioning**: Tracks activity regions to minimize computation

#### Memory Management
```javascript
performMaintenance() {
    // Clean up old visual effects
    this.feedingEvents = this.feedingEvents.filter(event => event.life > 0);
    this.predationEvents = this.predationEvents.filter(event => event.life > 0);
    
    // Clear kernel cache periodically
    if (this.leniaKernelCache.size > this.maxKernelCacheSize / 2) {
        this.leniaKernelCache.clear();
    }
}
```

### Visual Design Language

#### Contrasting Aesthetics
- **Life Patterns**: Sharp, pixelated yellow squares representing digital precision
- **Lenia Organisms**: Smooth, flowing orange/brown clouds representing organic life
- **Interaction Effects**: Bright red bursts showing ecosystem dynamics
- **Background**: Deep black space emphasizing the contrast

#### Dynamic Visual Effects
- **Flowing Particles**: Orbiting points around intense Lenia organisms
- **Smooth Morphing**: Gradual shape changes in Lenia boundaries  
- **Audio-Reactive Pulsing**: Colors and sizes respond to tecNO.mp3 soundtrack
- **Organic Motion**: Continuous animation creates living, breathing feel

### Research Foundation

The Clouds visualization combines:
- **Conway's Game of Life** (1970): Classical discrete cellular automaton
- **Lenia** (2019): Modern continuous cellular automaton research by Bert Wang-Chak Chan
- **Predator-Prey Dynamics**: Ecological modeling principles
- **Kernel Convolution**: Signal processing techniques applied to CA
- **Self-Organizing Systems**: Emergence from simple local rules

### Technical Innovation

This implementation represents several technical achievements:
1. **Real-time dual CA system**: Running both discrete and continuous CA simultaneously
2. **Cross-system interactions**: Enabling predator-prey relationships between different CA types
3. **Flowing organic rendering**: Converting grid-based CA into smooth visual organisms
4. **Audio-ecosystem coupling**: Musical influences on artificial life dynamics
5. **Population management**: Automatic reseeding to maintain ecosystem balance

The Clouds visualization demonstrates how different computational models of life can coexist and interact, creating a rich digital ecosystem that responds to musical input while maintaining biological plausibility.

Named after the cloud-like appearance of the flowing Lenia organisms as they drift and morph across the digital sky.

---

## Wire Visualization (3D Rotating Cubes)

The fifth visualization implements a 3D cellular automata system featuring rotating cubes with perspective-correct anaglyph 3D effects, enhanced with audio-reactive behaviors and sophisticated size divergence mechanics to prevent convergence.

### Core Concept

The Wire visualization extends the cellular automata concept into true 3D space, where nodes are rendered as rotating geometric cubes instead of simple circles. Each cube exists in 3D coordinate space with proper perspective projection, depth-based anaglyph rendering, and complex 3D physics interactions.

### 3D Node System

#### CubeNode Properties
Each cube in the simulation extends the base node system with 3D properties:
```javascript
// 3D spatial properties
this.z = 50 + (Math.random() - 0.5) * 60;     // Z-depth: 20-80 range
this.vz = (Math.random() - 0.5) * 0.5;       // Z-velocity for movement
this.rotationX = 0;                           // X-axis rotation angle
this.rotationY = 0;                           // Y-axis rotation angle  
this.rotationZ = 0;                           // Z-axis rotation angle
this.angularVelocityX = (Math.random() - 0.5) * 0.02;  // Rotation speeds
this.angularVelocityY = (Math.random() - 0.5) * 0.02;
this.angularVelocityZ = (Math.random() - 0.5) * 0.02;
```

#### Dramatic Size Variation System
```javascript
// Multi-tier size distribution for extreme variation
const rand = Math.random();
if (rand < 0.3) {
    this.size = 2 + Math.random() * 5;    // 30% small cubes: 2-7
} else if (rand < 0.7) {
    this.size = 8 + Math.random() * 10;   // 40% medium cubes: 8-18
} else {
    this.size = 20 + Math.random() * 25;  // 30% large cubes: 20-45
}
```

### 3D Physics System

#### Custom 3D Force Engine
The Wire visualization replaces D3's 2D physics with a custom 3D force system:

```javascript
apply3DForces() {
    for (const node of this.nodes) {
        // 3D center force - pulls toward center point in 3D space
        const toCenterX = this.centerX - node.x;
        const toCenterY = this.centerY - node.y;
        const toCenterZ = this.centerZ - node.z;  // Z-axis center force
        
        node.vx += toCenterX * this.centerForceStrength;
        node.vy += toCenterY * this.centerForceStrength;
        node.vz += toCenterZ * this.centerForceStrength;
        
        // 3D position integration
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;
        
        // 3D velocity damping with depth-specific rates
        node.vx *= 0.95;
        node.vy *= 0.95;
        node.vz *= 0.98;  // Slower Z damping for more 3D movement
    }
}
```

#### 3D Inter-Node Interactions
```javascript
apply3DInterNodeForce(node1, node2) {
    // True 3D distance calculation
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;
    const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // 3D normalized direction vector
    const nx = dx / distance3D;
    const ny = dy / distance3D;  
    const nz = dz / distance3D;
    
    // Distance-based force calculation
    if (distance3D < this.repulsionDistance) {
        forceStrength = -this.repulsionStrength * (1 / (distance3D + 1));
    } else if (distance3D < this.attractionDistance) {
        forceStrength = this.attractionStrength * (node1.size + node2.size) * 0.1 / distance3D;
    }
    
    // Apply 3D forces
    node1.vx += nx * forceStrength;
    node1.vy += ny * forceStrength;
    node1.vz += nz * forceStrength;
}
```

#### 3D Boundary Constraints
```javascript
// Soft boundary system with bouncing
if (node.z > 100) {
    node.z = 100;
    node.vz = -Math.abs(node.vz) * 0.8;  // Bounce back softly
} else if (node.z < 10) {
    node.z = 10;
    node.vz = Math.abs(node.vz) * 0.8;   // Bounce back softly
}
```

### Advanced 3D Cube Rendering

#### True 3D Geometry System
The cubes are rendered using proper 3D vertex transformation and projection:

```javascript
render3DCubeGeometry(centerX, centerY, cubeSize, node, r, g, b, alpha) {
    // Apply 3D rotation matrices
    const cos_x = Math.cos(node.rotationX);
    const sin_x = Math.sin(node.rotationX);
    const cos_y = Math.cos(node.rotationY);
    const sin_y = Math.sin(node.rotationY);
    const cos_z = Math.cos(node.rotationZ);
    const sin_z = Math.sin(node.rotationZ);
    
    // Define cube vertices in 3D space
    const vertices = [
        [-halfSize, -halfSize, -halfSize], // 8 cube vertices
        [halfSize, -halfSize, -halfSize],
        [halfSize, halfSize, -halfSize],
        // ... (full cube geometry)
    ];
    
    // Transform each vertex through 3D rotation
    const projected = vertices.map(([x, y, z]) => {
        // X-axis rotation
        let y1 = y * cos_x - z * sin_x;
        let z1 = y * sin_x + z * cos_x;
        
        // Y-axis rotation  
        let x2 = x * cos_y + z1 * sin_y;
        let z2 = -x * sin_y + z1 * cos_y;
        
        // Z-axis rotation
        let x3 = x2 * cos_z - y1 * sin_z;
        let y3 = x2 * sin_z + y1 * cos_z;
        
        // Orthographic projection to 2D
        return [centerX + x3, centerY + y3, z2];
    });
}
```

#### Depth Sorting and Face Culling
```javascript
// Define faces with proper winding order
const faces = [
    [0, 1, 2, 3], // front, back, left, right, top, bottom faces
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [1, 5, 6, 2],
    [3, 2, 6, 7],
    [4, 5, 1, 0]
];

// Sort faces by depth (painter's algorithm)
const faceDepths = faces.map((face, i) => {
    const avgZ = face.reduce((sum, vertexIndex) => 
        sum + projected[vertexIndex][2], 0) / face.length;
    return { face, brightness: faceBrightness[i], depth: avgZ };
});

faceDepths.sort((a, b) => a.depth - b.depth); // Back to front rendering
```

### Perspective-Correct Anaglyph 3D System

#### Depth-Based Anaglyph Calculation
```javascript
renderCubeWithAnaglyph(centerX, centerY, cubeSize, colorValue, alpha, node) {
    // Perspective-correct offset calculation
    const perspectiveScale = 300 / (300 + node.z);  // Closer = larger offset
    const offset = this.anaglyphOffset * perspectiveScale * 2;
    
    // Depth-based intensity variation
    const anaglyphIntensity = 0.6 + (perspectiveScale * 0.4); // 0.6-1.0 range
    
    // Render red channel (left eye) - shifted left
    this.context.globalAlpha = alpha * anaglyphIntensity;
    this.render3DCubeGeometry(centerX - offset, centerY, cubeSize, node, colorValue, 0, 0, alpha);
    
    // Render cyan channel (right eye) - shifted right with additive blending
    this.context.globalCompositeOperation = 'lighter';
    this.context.globalAlpha = alpha * anaglyphIntensity;
    this.render3DCubeGeometry(centerX + offset, centerY, cubeSize, node, 0, colorValue * 0.8, colorValue * 0.8, alpha);
}
```

#### 3D Depth Relationships
- **Near cubes (Z ≈ 10-30)**: Large anaglyph separation, high intensity
- **Mid-distance cubes (Z ≈ 40-70)**: Moderate separation and intensity  
- **Far cubes (Z ≈ 80-100)**: Small separation, subtle 3D effect

### Audio-Reactive Size Divergence System

#### Peak-Driven Size Divergence
```javascript
updateNodesWithAudio() {
    const totalAudioEnergy = (this.bassInfluence || 0) + (this.midInfluence || 0) + (this.trebleInfluence || 0);
    const isAudioPeak = totalAudioEnergy > 0.7 || (this.beatIntensity || 0) > 0.3;
    
    if (isAudioPeak) {
        for (const node of this.nodes) {
            const nodeRandomSeed = (node.id * 0.618034) % 1; // Golden ratio distribution
            const peakIntensity = totalAudioEnergy + (this.beatIntensity || 0);
            
            if (nodeRandomSeed < 0.2) {
                // 20% grow dramatically large
                node.size += peakIntensity * 15 * (nodeRandomSeed + 0.5);
            } else if (nodeRandomSeed < 0.4) {
                // 20% shrink for contrast
                node.size *= 0.7 - peakIntensity * 0.3;
            } else if (nodeRandomSeed < 0.6) {
                // 20% moderate growth
                node.size += peakIntensity * 8 * nodeRandomSeed;
            }
            // 40% remain unchanged for balance
        }
    }
}
```

#### Periodic Size Divergence Prevention
```javascript
handleSizeDivergence() {
    // Track convergence through size range analysis
    const sizes = this.nodes.map(node => node.size);
    const sizeRange = Math.max(...sizes) - Math.min(...sizes);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    // Force divergence if range < 30% of average (too similar)
    const shouldForceDivergence = sizeRange < (avgSize * 0.3);
    
    if (shouldForceDivergence && timeSinceLastDivergence > 3000) {
        this.performSizeDivergence(avgAudioEnergy);
    }
}

performSizeDivergence(audioEnergy) {
    const divergenceStrength = 0.5 + audioEnergy * 1.5;
    
    for (const node of this.nodes) {
        const nodeRandom = (node.id * 0.618034) % 1;
        
        if (nodeRandom < 0.25) {
            node.size *= 1.2 + (divergenceStrength * nodeRandom * 2);      // 25% grow
        } else if (nodeRandom < 0.5) {
            node.size *= Math.max(0.3, 0.7 - divergenceStrength * 0.3);   // 25% shrink
        } else if (nodeRandom < 0.75) {
            node.size += divergenceStrength * 10 * nodeRandom;            // 25% dramatic
        }
        // 25% unchanged for stability
    }
}
```

### Audio Reactivity Features

#### Multi-Frequency Response System
- **Bass Response**:
  - Increases cube rotation chaos
  - Triggers size growth effects
  - Enhances 3D force interactions

- **Mid-Range Response**:
  - Controls rhythmic rotation patterns
  - Affects growth interaction rates
  - Modulates perspective scaling

- **Treble Response**:
  - Adds rapid spin effects to cubes
  - Influences Z-axis movement patterns
  - Affects grayscale brightness modulation

- **Beat Intensity**:
  - Triggers immediate size pulsing
  - Amplifies all audio-reactive effects
  - Creates synchronized visual beats

#### Rotation Chaos System
```javascript
// Audio affects rotation in different ways per frequency
if (this.bassInfluence > 0) {
    const bassImpact = this.bassInfluence * 0.03;
    node.angularVelocityX += bassImpact * (Math.random() - 0.5);
    node.angularVelocityY += bassImpact * (Math.random() - 0.5);
}

if (this.trebleInfluence > 0) {
    const trebleImpact = this.trebleInfluence * 0.05;
    node.angularVelocityZ += trebleImpact * (Math.random() - 0.5);
}

if (this.midInfluence > 0) {
    const midImpact = this.midInfluence * 0.02;
    node.angularVelocityX += midImpact * Math.sin(this.getElapsedTime() * 0.01 + node.id);
    node.angularVelocityY += midImpact * Math.cos(this.getElapsedTime() * 0.01 + node.id);
}
```

### Visual Design

#### Grayscale Aesthetic
- **Color Scheme**: Pure grayscale (0.1-0.9 range) for industrial/electronic feel
- **Face Lighting**: Different brightness per cube face (top: 1.3x, left: 0.8x, right: 0.5x)
- **Audio Modulation**: Treble frequencies brighten cubes dynamically

#### Shadow System
- **3D Shadows**: Shadows use same geometry as cubes, rotated identically
- **Offset**: 2-pixel offset creates depth perception
- **Color**: Dark gray (#111) with reduced alpha for subtlety

#### Performance Optimizations
- **Culling**: Skip rendering cubes smaller than 0.1 apparent size
- **Rotation Bounds**: Keep rotations within 0-2π to prevent overflow
- **Size Clamping**: Limit cube sizes to 1-100 range for stability
- **Decay Rate**: Extremely slow (0.99995) to preserve size differences

### Technical Innovation

The Wire visualization represents several technical achievements:

1. **True 3D Cellular Automata**: First implementation combining CA with full 3D geometry
2. **Perspective-Correct Anaglyph**: Proper depth-based stereoscopic rendering
3. **Dynamic Size Anti-Convergence**: Automatic system to prevent visual uniformity
4. **3D Audio-Force Coupling**: Music directly influences 3D physics parameters
5. **Vertex-Level Cube Rendering**: Real-time 3D transformation and projection
6. **Multi-Tier Size Distribution**: Intelligent size variation for visual contrast

### Mathematical Foundation

#### 3D Transformation Matrices
The cube rendering uses standard 3D rotation matrices:
```
Rx(θ) = [1   0      0    ]
        [0  cos(θ) -sin(θ)]
        [0  sin(θ)  cos(θ)]

Ry(θ) = [cos(θ)  0  sin(θ)]
        [0       1   0    ]
        [-sin(θ) 0  cos(θ)]

Rz(θ) = [cos(θ) -sin(θ)  0]
        [sin(θ)  cos(θ)  0]
        [0       0       1]
```

#### Perspective Projection
```javascript
perspectiveScale = perspective / (perspective + z);
projectedX = worldX * perspectiveScale;
projectedY = worldY * perspectiveScale;
```

#### Golden Ratio Distribution
Uses φ = 0.618034 (golden ratio) for deterministic but well-distributed node behavior, ensuring consistent visual patterns while avoiding artificial regularity.

The Wire visualization creates a sophisticated 3D environment where geometric precision meets organic audio-reactive behavior, resulting in a hypnotic display of rotating cubes that pulse, grow, and dance in true stereoscopic 3D space.

Named after the wire.mp3 audio track that drives its industrial, electronic aesthetic.
