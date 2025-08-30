import { BaseSimulation } from '../base/base-simulation.js';

export class CloudsSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);
        
        // Grid dimensions - smaller for performance with dual CA
        this.gridWidth = width > 1000 ? 150 : 120;
        this.gridHeight = height > 700 ? 100 : 80;
        
        // Cell size calculation
        this.cellWidth = width / this.gridWidth;
        this.cellHeight = height / this.gridHeight;
        
        // Dual grid system
        this.lifeGrid = [];          // Conway's Life (binary: 0/1)
        this.leniaGrid = [];         // Lenia CA (continuous: 0.0-1.0)
        this.interactionGrid = [];   // Tracks predation events
        
        // Pattern tracking
        this.gliders = [];           // Active Life gliders
        this.staticPatterns = [];    // Static Life formations
        this.leniaOrganisms = [];    // Lenia blob tracking
        
        // Audio-reactive parameters
        this.lastBassLevel = 0;
        this.lastTrebleLevel = 0;
        this.ecosystemPulse = 0;
        
        // Lenia parameters (balanced for persistence and dynamics)
        this.leniaRadius = 13;       // Neighborhood radius
        this.leniaAlpha = 0.25;      // Time step (increased for more dynamics)
        this.leniaGrowthMu = 0.15;   // Growth center
        this.leniaGrowthSigma = 0.035; // Growth width (reduced for more selective growth)
        
        // Interaction parameters
        this.feedingRate = 0.008;    // Lenia feeding on Life (reduced)
        this.predationRate = 0.015;  // Gliders consuming Lenia (reduced)
        this.feedingThreshold = 0.05; // Min Lenia density to feed (lowered)
        this.predationThreshold = 0.02; // Min Lenia to predate (lowered)
        
        // Performance optimization
        this.leniaUpdateCounter = 0;  // Update Lenia every N frames
        this.leniaUpdateInterval = 1; // Update every frame for smoother dynamics
        this.maxGliders = 10;        // Limit active gliders
        
        // Advanced performance optimizations
        this.activeRegions = new Set(); // Track regions with activity
        this.leniaKernelCache = new Map(); // Cache kernel calculations
        this.maxKernelCacheSize = 1000;
        this.regionSize = 16; // Size of activity regions
        this.framesSinceCleanup = 0;
        this.cleanupInterval = 60; // Clean up every 1 second at 60fps
        
        // Adaptive quality settings
        this.performanceMode = false; // Enable for better performance
        this.lastFrameTime = Date.now();
        this.targetFrameTime = 16.67; // Target 60fps
        this.frameTimeHistory = [];
        this.maxHistorySize = 30;
        
        // Visual effects
        this.predationEvents = [];   // Visual feedback for interactions
        this.feedingEvents = [];     // Visual feedback for feeding
        
        // Initialize grids and patterns
        this.initializeGrids();
        this.seedInitialPatterns();
    }

    initializeGrids() {
        // Initialize all three grids
        this.lifeGrid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(0)
        );
        
        this.leniaGrid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(0.0)
        );
        
        this.interactionGrid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(0)
        );
    }

    seedInitialPatterns() {
        // Seed some initial Life patterns
        this.seedLifePatterns();
        
        // Seed some initial Lenia organisms
        this.seedLeniaOrganisms();
    }

    seedLifePatterns() {
        // Add some gliders
        this.addGlider(10, 10);
        this.addGlider(this.gridWidth - 20, 15);
        
        // Add some static patterns
        this.addBlock(this.gridWidth / 2, this.gridHeight / 2);
        this.addBeehive(30, 30);
        this.addBeehive(this.gridWidth - 40, this.gridHeight - 20);
    }

    seedLeniaOrganisms() {
        // Add some initial Lenia seeds with better persistence
        const centerX = Math.floor(this.gridWidth / 2);
        const centerY = Math.floor(this.gridHeight / 2);
        
        // Create circular Lenia organisms with higher initial intensity
        this.createLeniaOrganism(centerX - 30, centerY - 20, 10, 0.9);
        this.createLeniaOrganism(centerX + 25, centerY + 15, 8, 0.85);
        this.createLeniaOrganism(20, this.gridHeight - 25, 7, 0.8);
        
        // Add a few more smaller organisms for diversity
        this.createLeniaOrganism(centerX, centerY - 35, 6, 0.7);
        this.createLeniaOrganism(centerX - 10, centerY + 25, 5, 0.75);
    }

    // Conway's Life pattern creation methods
    addGlider(x, y) {
        if (this.isValidPosition(x, y)) {
            // Standard glider pattern
            this.setLife(x, y, 1);
            this.setLife(x + 1, y + 1, 1);
            this.setLife(x + 2, y - 1, 1);
            this.setLife(x + 2, y, 1);
            this.setLife(x + 2, y + 1, 1);
            
            // Track this glider
            this.gliders.push({
                x: x + 1, y: y, 
                vx: 1, vy: 1,
                age: 0,
                energy: 1.0
            });
        }
    }

    addBlock(x, y) {
        if (this.isValidPosition(x, y)) {
            // 2x2 block (static pattern)
            this.setLife(x, y, 1);
            this.setLife(x + 1, y, 1);
            this.setLife(x, y + 1, 1);
            this.setLife(x + 1, y + 1, 1);
            
            this.staticPatterns.push({
                type: 'block',
                x: x, y: y,
                width: 2, height: 2,
                energy: 1.0
            });
        }
    }

    addBeehive(x, y) {
        if (this.isValidPosition(x, y)) {
            // Beehive pattern (static)
            this.setLife(x + 1, y, 1);
            this.setLife(x + 2, y, 1);
            this.setLife(x, y + 1, 1);
            this.setLife(x + 3, y + 1, 1);
            this.setLife(x + 1, y + 2, 1);
            this.setLife(x + 2, y + 2, 1);
            
            this.staticPatterns.push({
                type: 'beehive',
                x: x, y: y,
                width: 4, height: 3,
                energy: 1.5
            });
        }
    }

    createLeniaOrganism(centerX, centerY, radius, intensity) {
        // Create circular Lenia organism
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    if (this.isValidPosition(x, y)) {
                        // Gaussian distribution
                        const value = intensity * Math.exp(-(distance * distance) / (2 * radius * radius / 4));
                        this.leniaGrid[y][x] = Math.min(1.0, this.leniaGrid[y][x] + value);
                    }
                }
            }
        }
        
        this.leniaOrganisms.push({
            x: centerX, y: centerY,
            radius: radius,
            intensity: intensity,
            age: 0
        });
    }

    // Grid utility methods
    setLife(x, y, value) {
        if (this.isValidPosition(x, y)) {
            this.lifeGrid[y][x] = value;
        }
    }

    getLife(x, y) {
        const safeX = Math.floor(x);
        const safeY = Math.floor(y);
        if (this.isValidPosition(safeX, safeY)) {
            return this.lifeGrid[safeY][safeX];
        }
        return 0;
    }

    setLenia(x, y, value) {
        const safeX = Math.floor(x);
        const safeY = Math.floor(y);
        if (this.isValidPosition(safeX, safeY)) {
            this.leniaGrid[safeY][safeX] = Math.max(0, Math.min(1, value));
        }
    }

    getLenia(x, y) {
        const safeX = Math.floor(x);
        const safeY = Math.floor(y);
        if (this.isValidPosition(safeX, safeY)) {
            return this.leniaGrid[safeY][safeX];
        }
        return 0.0;
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
    }

    // Main update method with performance monitoring
    draw() {
        const frameStart = Date.now();
        const deltaTime = this.getDeltaTime();
        
        // Monitor performance and adjust quality
        this.monitorPerformance();
        
        // Update audio-reactive behavior
        this.updateAudioReactivity(deltaTime);
        
        // Update Conway's Life
        this.updateLifeGrid();
        
        // Update Lenia with adaptive quality
        this.leniaUpdateCounter++;
        const leniaInterval = this.performanceMode ? this.leniaUpdateInterval * 2 : this.leniaUpdateInterval;
        
        if (this.leniaUpdateCounter >= leniaInterval) {
            this.updateLeniaGridOptimized();
            this.leniaUpdateCounter = 0;
        }
        
        // Process predator-prey interactions
        this.processInteractions();
        
        // Update pattern tracking (reduced frequency in performance mode)
        if (!this.performanceMode || this.counter % 3 === 0) {
            this.updatePatternTracking();
        }
        
        // Update visual effects
        this.updateVisualEffects(deltaTime);
        
        // Periodic cleanup
        this.framesSinceCleanup++;
        if (this.framesSinceCleanup >= this.cleanupInterval) {
            this.performMaintenance();
            this.framesSinceCleanup = 0;
        }
        
        // Render everything
        this.render();
        
        // Track frame time for performance monitoring
        const frameTime = Date.now() - frameStart;
        this.recordFrameTime(frameTime);
    }

    monitorPerformance() {
        // Automatically adjust quality based on frame times
        if (this.frameTimeHistory.length >= this.maxHistorySize) {
            const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length;
            
            // Enable performance mode if consistently slow
            if (avgFrameTime > this.targetFrameTime * 1.5 && !this.performanceMode) {
                this.performanceMode = true;
                console.log('CloudsSimulation: Enabled performance mode due to slow frame times');
            }
            
            // Disable performance mode if frame times improve
            if (avgFrameTime < this.targetFrameTime * 1.2 && this.performanceMode) {
                this.performanceMode = false;
                console.log('CloudsSimulation: Disabled performance mode - performance improved');
            }
        }
    }

    recordFrameTime(frameTime) {
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > this.maxHistorySize) {
            this.frameTimeHistory.shift();
        }
    }

    updateLeniaGridOptimized() {
        // Update active regions tracking
        this.updateActiveRegions();
        
        // Only update Lenia in active regions for better performance
        const regionsToUpdate = this.performanceMode ? 
            Array.from(this.activeRegions).slice(0, 20) : // Limit regions in performance mode
            Array.from(this.activeRegions);
        
        const newLeniaGrid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(0.0)
        );
        
        // Copy non-active regions from existing grid
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                newLeniaGrid[y][x] = this.leniaGrid[y][x];
            }
        }
        
        // Update only active regions
        for (const regionKey of regionsToUpdate) {
            const [regionX, regionY] = regionKey.split(',').map(Number);
            this.updateLeniaRegion(newLeniaGrid, regionX, regionY);
        }
        
        this.leniaGrid = newLeniaGrid;
    }

    updateActiveRegions() {
        this.activeRegions.clear();
        
        // Mark regions with Life activity
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.lifeGrid[y][x] === 1 || this.leniaGrid[y][x] > 0.05) {
                    const regionX = Math.floor(x / this.regionSize);
                    const regionY = Math.floor(y / this.regionSize);
                    this.activeRegions.add(`${regionX},${regionY}`);
                    
                    // Also mark neighboring regions for Lenia propagation
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nregX = regionX + dx;
                            const nregY = regionY + dy;
                            if (nregX >= 0 && nregX < Math.ceil(this.gridWidth / this.regionSize) &&
                                nregY >= 0 && nregY < Math.ceil(this.gridHeight / this.regionSize)) {
                                this.activeRegions.add(`${nregX},${nregY}`);
                            }
                        }
                    }
                }
            }
        }
    }

    updateLeniaRegion(newGrid, regionX, regionY) {
        const startX = regionX * this.regionSize;
        const endX = Math.min((regionX + 1) * this.regionSize, this.gridWidth);
        const startY = regionY * this.regionSize;
        const endY = Math.min((regionY + 1) * this.regionSize, this.gridHeight);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                // Use optimized kernel computation with caching
                const density = this.computeLeniaKernelCached(x, y);
                const currentValue = this.leniaGrid[y][x];
                const growthRate = this.leniaGrowthFunction(density);
                
                let newValue = currentValue + this.leniaAlpha * growthRate;
                
                // Apply interactions
                if (this.getLife(x, y) === 1 && this.isPartOfGlider(x, y)) {
                    const predationFactor = 1.0 - this.predationRate * this.ecosystemPulse;
                    newValue *= predationFactor;
                    
                    if (newValue > 0.1) {
                        this.createPredationEvent(x, y, newValue);
                    }
                }
                
                if (this.getLife(x, y) === 1 && this.isPartOfStaticPattern(x, y)) {
                    const feedingBonus = this.feedingRate * currentValue;
                    newValue += feedingBonus;
                }
                
                newGrid[y][x] = Math.max(0, Math.min(1, newValue));
            }
        }
    }

    computeLeniaKernelCached(centerX, centerY) {
        // Use caching for kernel computations
        const cacheKey = `${centerX},${centerY}`;
        
        // In performance mode, use simplified kernel
        if (this.performanceMode) {
            return this.computeLeniaKernelSimplified(centerX, centerY);
        }
        
        if (this.leniaKernelCache.has(cacheKey)) {
            return this.leniaKernelCache.get(cacheKey);
        }
        
        const density = this.computeLeniaKernel(centerX, centerY);
        
        // Manage cache size
        if (this.leniaKernelCache.size >= this.maxKernelCacheSize) {
            // Remove oldest entries
            const keysToDelete = Array.from(this.leniaKernelCache.keys()).slice(0, 100);
            keysToDelete.forEach(key => this.leniaKernelCache.delete(key));
        }
        
        this.leniaKernelCache.set(cacheKey, density);
        return density;
    }

    computeLeniaKernelSimplified(centerX, centerY) {
        // Simplified kernel for performance mode - smaller radius
        const simpleRadius = Math.max(6, Math.floor(this.leniaRadius / 2));
        let totalDensity = 0;
        let totalWeight = 0;
        
        // Ensure center coordinates are integers
        const safeCenterX = Math.floor(centerX);
        const safeCenterY = Math.floor(centerY);
        
        for (let dy = -simpleRadius; dy <= simpleRadius; dy += 2) { // Skip every other cell
            for (let dx = -simpleRadius; dx <= simpleRadius; dx += 2) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > simpleRadius) continue;
                
                // Calculate neighbor position with wrapping - ensure integers
                let nx = safeCenterX + dx;
                let ny = safeCenterY + dy;
                
                // Handle wrapping with proper bounds checking
                nx = ((nx % this.gridWidth) + this.gridWidth) % this.gridWidth;
                ny = ((ny % this.gridHeight) + this.gridHeight) % this.gridHeight;
                
                // Ensure indices are integers
                const safeNx = Math.floor(nx);
                const safeNy = Math.floor(ny);
                
                // Bounds check before array access
                if (safeNx >= 0 && safeNx < this.gridWidth && 
                    safeNy >= 0 && safeNy < this.gridHeight) {
                    
                    const kernelWeight = this.leniaKernelFunction(distance);
                    const cellValue = this.leniaGrid[safeNy][safeNx];
                    
                    if (typeof cellValue === 'number' && !isNaN(cellValue)) {
                        totalDensity += kernelWeight * cellValue;
                        totalWeight += kernelWeight;
                    }
                }
            }
        }
        
        return totalWeight > 0 ? totalDensity / totalWeight : 0;
    }

    performMaintenance() {
        // Clean up old visual effects
        this.feedingEvents = this.feedingEvents.filter(event => event.life > 0);
        this.predationEvents = this.predationEvents.filter(event => event.life > 0);
        
        // Clean up old gliders
        this.gliders = this.gliders.filter(glider => 
            glider.age < 300 && this.isGliderStillAlive(glider)
        );
        
        // Clean up static patterns with no energy
        this.staticPatterns = this.staticPatterns.filter(pattern => pattern.energy > 0);
        
        // Check Lenia population and reseed if necessary
        this.maintainLeniaPopulation();
        
        // Clear kernel cache periodically
        if (this.leniaKernelCache.size > this.maxKernelCacheSize / 2) {
            this.leniaKernelCache.clear();
        }
        
        // Garbage collection hint
        if (typeof window !== 'undefined' && window.gc) {
            window.gc();
        }
    }

    updateAudioReactivity(deltaTime) {
        if (!this.audioPlayer) return;
        
        const audioAnalysis = this.audioPlayer.getAudioAnalysis();
        if (!audioAnalysis) return;
        
        // Bass spawns new patterns
        const bassIncrease = audioAnalysis.bass - this.lastBassLevel;
        if (bassIncrease > 0.1 && audioAnalysis.bass > 0.6) {
            this.spawnAudioReactivePatterns(audioAnalysis.bass);
        }
        this.lastBassLevel = audioAnalysis.bass;
        
        // Treble creates disturbances
        const trebleIncrease = audioAnalysis.treble - this.lastTrebleLevel;
        if (trebleIncrease > 0.15 && audioAnalysis.treble > 0.7) {
            this.createDisturbances(audioAnalysis.treble);
        }
        this.lastTrebleLevel = audioAnalysis.treble;
        
        // Mid-range affects interaction rates (using adjusted base rates)
        const midInfluence = audioAnalysis.mid || 0;
        this.feedingRate = 0.008 * (1 + midInfluence * 1.5);
        this.predationRate = 0.015 * (1 + midInfluence * 1.2);
        
        // Beat creates ecosystem pulse
        if (audioAnalysis.beatIntensity > 0.5) {
            this.ecosystemPulse = audioAnalysis.beatIntensity;
        } else {
            this.ecosystemPulse *= 0.9; // Decay
        }
    }

    spawnAudioReactivePatterns(bassLevel) {
        // Spawn new gliders on bass hits
        if (this.gliders.length < this.maxGliders && Math.random() < bassLevel * 0.5) {
            const x = Math.floor(Math.random() * (this.gridWidth - 10)) + 5;
            const y = Math.floor(Math.random() * (this.gridHeight - 10)) + 5;
            this.addGlider(x, y);
        }
        
        // Boost Lenia growth and dynamics
        this.leniaGrowthMu = 0.15 + bassLevel * 0.1;
        // Make Lenia more dynamic on bass hits
        this.leniaAlpha = 0.25 + bassLevel * 0.15;
    }

    createDisturbances(trebleLevel) {
        // Create new Lenia seeds
        for (let i = 0; i < Math.floor(trebleLevel * 3); i++) {
            const x = Math.floor(Math.random() * this.gridWidth);
            const y = Math.floor(Math.random() * this.gridHeight);
            const radius = 3 + Math.floor(trebleLevel * 5);
            this.createLeniaOrganism(x, y, radius, trebleLevel * 0.6);
        }
    }

    // Conway's Game of Life implementation
    updateLifeGrid() {
        // Create new grid for next generation (double buffering)
        const newLifeGrid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(0)
        );
        
        // Apply Conway's Life rules to each cell
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const neighbors = this.countLifeNeighbors(x, y);
                const isAlive = this.lifeGrid[y][x] === 1;
                
                // Conway's Life rules
                if (isAlive) {
                    // Live cell survives with 2 or 3 neighbors
                    if (neighbors === 2 || neighbors === 3) {
                        newLifeGrid[y][x] = 1;
                    }
                    // Otherwise dies (underpopulation or overpopulation)
                } else {
                    // Dead cell becomes alive with exactly 3 neighbors
                    if (neighbors === 3) {
                        newLifeGrid[y][x] = 1;
                    }
                }
                
                // Check for Lenia predation on this Life cell
                if (newLifeGrid[y][x] === 1) {
                    const leniaIntensity = this.getLenia(x, y);
                    // If Lenia is present and this is part of a static pattern
                    if (leniaIntensity > this.predationThreshold && 
                        this.isPartOfStaticPattern(x, y)) {
                        // Lenia consumes static Life cells
                        if (Math.random() < this.feedingRate * leniaIntensity) {
                            newLifeGrid[y][x] = 0;
                            this.createFeedingEvent(x, y, leniaIntensity);
                        }
                    }
                }
            }
        }
        
        // Replace old grid with new generation
        this.lifeGrid = newLifeGrid;
    }

    countLifeNeighbors(x, y) {
        let count = 0;
        
        // Ensure coordinates are integers
        const safeX = Math.floor(x);
        const safeY = Math.floor(y);
        
        // Check all 8 neighbors
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip center cell
                
                const nx = safeX + dx;
                const ny = safeY + dy;
                
                // Handle boundaries with wrapping (toroidal topology)
                let wrappedX = ((nx % this.gridWidth) + this.gridWidth) % this.gridWidth;
                let wrappedY = ((ny % this.gridHeight) + this.gridHeight) % this.gridHeight;
                
                // Ensure indices are integers
                wrappedX = Math.floor(wrappedX);
                wrappedY = Math.floor(wrappedY);
                
                // Bounds check before array access
                if (wrappedX >= 0 && wrappedX < this.gridWidth &&
                    wrappedY >= 0 && wrappedY < this.gridHeight) {
                    
                    if (this.lifeGrid[wrappedY][wrappedX] === 1) {
                        count++;
                    }
                }
            }
        }
        
        return count;
    }

    isPartOfStaticPattern(x, y) {
        // Check if this Life cell is part of a static pattern
        // We'll do a simple check by seeing if the local configuration
        // matches known static patterns or if it hasn't moved recently
        
        for (const pattern of this.staticPatterns) {
            if (x >= pattern.x && x < pattern.x + pattern.width &&
                y >= pattern.y && y < pattern.y + pattern.height) {
                return true;
            }
        }
        
        // Alternative: check if the local area is stable
        return this.isLocallyStable(x, y);
    }

    isLocallyStable(x, y) {
        // Simple heuristic: if neighbors haven't changed much, consider static
        // This is a simplified approach - in a full implementation we'd track
        // pattern history over multiple generations
        let stableNeighbors = 0;
        const totalNeighbors = 8;
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = ((x + dx) + this.gridWidth) % this.gridWidth;
                const ny = ((y + dy) + this.gridHeight) % this.gridHeight;
                
                // Assume stable if neighbors are mostly consistent
                // (This is simplified - real implementation would need history)
                stableNeighbors++;
            }
        }
        
        return stableNeighbors >= 6; // Arbitrary threshold for "stability"
    }

    createFeedingEvent(x, y, intensity) {
        // Create visual feedback for Lenia feeding on Life
        this.feedingEvents.push({
            x: x * this.cellWidth + this.cellWidth / 2,
            y: y * this.cellHeight + this.cellHeight / 2,
            intensity: intensity,
            life: 1.0,
            maxLife: 1.0,
            color: { r: 100, g: 255, b: 100 } // Green feeding effect
        });
    }

    updateLeniaGrid() {
        // Create new grid for next generation
        const newLeniaGrid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(0.0)
        );
        
        // Apply Lenia update rules with kernel convolution
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                // Compute local neighborhood density using kernel
                const density = this.computeLeniaKernel(x, y);
                
                // Apply growth function
                const currentValue = this.leniaGrid[y][x];
                const growthRate = this.leniaGrowthFunction(density);
                
                // Update with time step integration
                let newValue = currentValue + this.leniaAlpha * growthRate;
                
                // Check for Life glider predation
                if (this.getLife(x, y) === 1 && this.isPartOfGlider(x, y)) {
                    // Life gliders consume Lenia
                    const predationFactor = 1.0 - this.predationRate * this.ecosystemPulse;
                    newValue *= predationFactor;
                    
                    if (newValue > 0.1) { // Significant predation occurred
                        this.createPredationEvent(x, y, newValue);
                    }
                }
                
                // Check for feeding on Life static patterns
                if (this.getLife(x, y) === 1 && this.isPartOfStaticPattern(x, y)) {
                    // Lenia gains energy from consuming Life
                    const feedingBonus = this.feedingRate * currentValue;
                    newValue += feedingBonus;
                }
                
                // Clamp to valid range and apply
                newLeniaGrid[y][x] = Math.max(0, Math.min(1, newValue));
            }
        }
        
        // Replace old grid with new generation
        this.leniaGrid = newLeniaGrid;
    }

    computeLeniaKernel(centerX, centerY) {
        let totalDensity = 0;
        let totalWeight = 0;
        
        // Ensure center coordinates are integers
        const safeCenterX = Math.floor(centerX);
        const safeCenterY = Math.floor(centerY);
        
        // Iterate over kernel radius
        for (let dy = -this.leniaRadius; dy <= this.leniaRadius; dy++) {
            for (let dx = -this.leniaRadius; dx <= this.leniaRadius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Skip if outside kernel radius
                if (distance > this.leniaRadius) continue;
                
                // Calculate neighbor position with wrapping - ensure integers
                let nx = safeCenterX + dx;
                let ny = safeCenterY + dy;
                
                // Handle wrapping with proper bounds checking
                nx = ((nx % this.gridWidth) + this.gridWidth) % this.gridWidth;
                ny = ((ny % this.gridHeight) + this.gridHeight) % this.gridHeight;
                
                // Ensure indices are integers
                const safeNx = Math.floor(nx);
                const safeNy = Math.floor(ny);
                
                // Bounds check before array access
                if (safeNx >= 0 && safeNx < this.gridWidth && 
                    safeNy >= 0 && safeNy < this.gridHeight) {
                    
                    // Compute kernel weight based on distance
                    const kernelWeight = this.leniaKernelFunction(distance);
                    const cellValue = this.leniaGrid[safeNy][safeNx];
                    
                    if (typeof cellValue === 'number' && !isNaN(cellValue)) {
                        totalDensity += kernelWeight * cellValue;
                        totalWeight += kernelWeight;
                    }
                }
            }
        }
        
        // Normalize by total weight to get density
        return totalWeight > 0 ? totalDensity / totalWeight : 0;
    }

    leniaKernelFunction(distance) {
        // Bell-shaped kernel based on distance
        // This is a simplified version - full Lenia uses more complex kernels
        const normalizedDistance = distance / this.leniaRadius;
        
        if (normalizedDistance > 1.0) return 0;
        
        // Gaussian-like kernel
        const sigma = 0.3; // Kernel width parameter
        return Math.exp(-(normalizedDistance * normalizedDistance) / (2 * sigma * sigma));
    }

    leniaGrowthFunction(density) {
        // Dynamic growth function for flowing Lenia organisms
        // Growth is maximum at leniaGrowthMu and decreases on either side
        const difference = density - this.leniaGrowthMu;
        const normalizedDiff = difference / this.leniaGrowthSigma;
        
        // More dynamic growth function with stronger gradient
        const baseGrowth = 2.5 * Math.exp(-(normalizedDiff * normalizedDiff) / 2) - 1.0;
        
        // Add time-varying component for wave-like behavior
        const timeComponent = Math.sin(Date.now() * 0.001) * 0.02;
        
        // Density-dependent dynamics for flow behavior  
        const flowComponent = density > 0.3 ? Math.sin(density * 10) * 0.1 : 0;
        
        // Small positive bias to prevent total extinction, but allow more variation
        return Math.max(-0.5, baseGrowth + timeComponent + flowComponent + 0.02);
    }

    maintainLeniaPopulation() {
        // Calculate total Lenia population
        let totalLeniaPopulation = 0;
        let activeCells = 0;
        let maxDensity = 0;
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const density = this.leniaGrid[y][x];
                if (density > 0.01) { // Count cells with meaningful Lenia presence
                    totalLeniaPopulation += density;
                    activeCells++;
                    maxDensity = Math.max(maxDensity, density);
                }
            }
        }
        
        // Calculate average density of active regions
        const averageDensity = activeCells > 0 ? totalLeniaPopulation / activeCells : 0;
        const populationRatio = totalLeniaPopulation / (this.gridWidth * this.gridHeight);
        
        // Debug logging every maintenance cycle
        console.log(`Lenia population check: ratio=${populationRatio.toFixed(4)}, active cells=${activeCells}, max density=${maxDensity.toFixed(3)}`);
        
        // If population is critically low, reseed some organisms
        if (populationRatio < 0.01 || activeCells < 20) {
            console.log(`Lenia population critically low (ratio: ${populationRatio.toFixed(4)}, active cells: ${activeCells}), reseeding...`);
            this.reseedLeniaOrganisms();
        }
        // If population is moderately low, add a small organism
        else if (populationRatio < 0.03 || activeCells < 50) {
            console.log(`Lenia population low (ratio: ${populationRatio.toFixed(4)}), adding small organism...`);
            this.addSmallLeniaOrganism();
        }
    }

    reseedLeniaOrganisms() {
        // Reseed 2-3 Lenia organisms in safe locations
        const centerX = Math.floor(this.gridWidth / 2);
        const centerY = Math.floor(this.gridHeight / 2);
        
        // Find areas with low Life activity
        const safeLocations = this.findSafeLocationsForLenia();
        
        if (safeLocations.length > 0) {
            // Use safe locations
            for (let i = 0; i < Math.min(3, safeLocations.length); i++) {
                const loc = safeLocations[i];
                this.createLeniaOrganism(loc.x, loc.y, 6 + Math.random() * 3, 0.6 + Math.random() * 0.3);
            }
        } else {
            // Fallback to center regions
            this.createLeniaOrganism(centerX - 20, centerY - 15, 7, 0.8);
            this.createLeniaOrganism(centerX + 15, centerY + 20, 6, 0.7);
        }
    }

    addSmallLeniaOrganism() {
        // Add a single small organism in a safe location
        const safeLocations = this.findSafeLocationsForLenia();
        
        if (safeLocations.length > 0) {
            const loc = safeLocations[Math.floor(Math.random() * safeLocations.length)];
            this.createLeniaOrganism(loc.x, loc.y, 4 + Math.random() * 2, 0.5 + Math.random() * 0.2);
        }
    }

    findSafeLocationsForLenia() {
        // Find locations with minimal Life activity
        const safeLocations = [];
        const checkRadius = 15;
        const maxLocations = 10;
        
        for (let attempts = 0; attempts < 50 && safeLocations.length < maxLocations; attempts++) {
            const x = checkRadius + Math.random() * (this.gridWidth - 2 * checkRadius);
            const y = checkRadius + Math.random() * (this.gridHeight - 2 * checkRadius);
            
            // Check if this area has low Life density
            let lifeDensity = 0;
            let cellCount = 0;
            
            for (let dy = -checkRadius; dy <= checkRadius; dy++) {
                for (let dx = -checkRadius; dx <= checkRadius; dx++) {
                    const px = Math.floor(x + dx);
                    const py = Math.floor(y + dy);
                    if (this.isValidPosition(px, py)) {
                        lifeDensity += this.getLife(px, py);
                        cellCount++;
                    }
                }
            }
            
            const averageLifeDensity = lifeDensity / cellCount;
            
            // Safe if low Life density and not too close to existing safe locations
            if (averageLifeDensity < 0.1) {
                let tooClose = false;
                for (const existing of safeLocations) {
                    const distance = Math.sqrt((x - existing.x) ** 2 + (y - existing.y) ** 2);
                    if (distance < 20) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    safeLocations.push({ x: Math.floor(x), y: Math.floor(y) });
                }
            }
        }
        
        return safeLocations;
    }

    isPartOfGlider(x, y) {
        // Check if this position is part of a tracked glider
        for (const glider of this.gliders) {
            const distance = Math.sqrt((x - glider.x) ** 2 + (y - glider.y) ** 2);
            if (distance <= 3) { // Gliders are roughly 3x3 patterns
                return true;
            }
        }
        return false;
    }

    createPredationEvent(x, y, intensity) {
        // Create visual feedback for Life gliders consuming Lenia
        this.predationEvents.push({
            x: x * this.cellWidth + this.cellWidth / 2,
            y: y * this.cellHeight + this.cellHeight / 2,
            intensity: intensity,
            life: 1.0,
            maxLife: 1.0,
            color: { r: 255, g: 50, b: 50 } // Red predation effect
        });
    }

    processInteractions() {
        // Process ecosystem interactions between Life and Lenia
        this.processLeniaFeedingOnLife();
        this.processGliderPredationOnLenia();
        this.updateEcosystemBalance();
    }

    processLeniaFeedingOnLife() {
        // Lenia organisms feed on static Life patterns
        for (let i = this.staticPatterns.length - 1; i >= 0; i--) {
            const pattern = this.staticPatterns[i];
            
            // Check if Lenia is present in this pattern's area
            let totalLeniaIntensity = 0;
            let cellCount = 0;
            
            for (let py = pattern.y; py < pattern.y + pattern.height; py++) {
                for (let px = pattern.x; px < pattern.x + pattern.width; px++) {
                    if (this.isValidPosition(px, py)) {
                        totalLeniaIntensity += this.getLenia(px, py);
                        cellCount++;
                    }
                }
            }
            
            const averageLeniaIntensity = totalLeniaIntensity / cellCount;
            
            if (averageLeniaIntensity > this.feedingThreshold) {
                // Lenia is consuming this static pattern
                pattern.energy -= this.feedingRate * averageLeniaIntensity;
                
                // Create feeding visual effect
                this.createFeedingEvent(
                    pattern.x + pattern.width / 2, 
                    pattern.y + pattern.height / 2, 
                    averageLeniaIntensity
                );
                
                // If pattern is consumed, remove it
                if (pattern.energy <= 0) {
                    this.staticPatterns.splice(i, 1);
                    
                    // Clear the Life cells in this area
                    for (let py = pattern.y; py < pattern.y + pattern.height; py++) {
                        for (let px = pattern.x; px < pattern.x + pattern.width; px++) {
                            if (this.isValidPosition(px, py)) {
                                this.setLife(px, py, 0);
                            }
                        }
                    }
                }
            }
        }
    }

    processGliderPredationOnLenia() {
        // Life gliders consume Lenia organisms
        for (let i = this.gliders.length - 1; i >= 0; i--) {
            const glider = this.gliders[i];
            
            // Update glider position (simple tracking)
            glider.age++;
            if (glider.age % 4 === 0) { // Gliders move every 4 generations
                glider.x += glider.vx;
                glider.y += glider.vy;
                
                // Wrap around boundaries
                glider.x = ((glider.x % this.gridWidth) + this.gridWidth) % this.gridWidth;
                glider.y = ((glider.y % this.gridHeight) + this.gridHeight) % this.gridHeight;
            }
            
            // Check for Lenia consumption in glider's path
            let leniaConsumed = 0;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const px = glider.x + dx;
                    const py = glider.y + dy;
                    
                    if (this.isValidPosition(px, py)) {
                        const leniaValue = this.getLenia(px, py);
                        if (leniaValue > this.predationThreshold) {
                            leniaConsumed += leniaValue * this.predationRate;
                            
                            // Reduce Lenia in this area
                            this.setLenia(px, py, leniaValue * (1 - this.predationRate));
                            
                            // Create predation visual effect
                            if (Math.random() < 0.3) { // Don't create too many effects
                                this.createPredationEvent(px, py, leniaValue);
                            }
                        }
                    }
                }
            }
            
            // Glider gains energy from predation
            glider.energy += leniaConsumed;
            
            // Remove gliders that are too old or have moved off patterns
            if (glider.age > 200 || !this.isGliderStillAlive(glider)) {
                this.gliders.splice(i, 1);
            }
        }
    }

    updateEcosystemBalance() {
        // Maintain ecosystem balance and spawn new organisms based on conditions
        const totalLifeCells = this.countTotalLifeCells();
        const totalLeniaIntensity = this.calculateTotalLeniaIntensity();
        
        // If Life is dominating too much, boost Lenia growth
        if (totalLifeCells > totalLeniaIntensity * 50) {
            this.leniaGrowthMu += 0.001; // Slight boost to Lenia growth
        }
        
        // If Lenia is dominating too much, spawn more gliders
        if (totalLeniaIntensity > totalLifeCells * 2 && this.gliders.length < this.maxGliders) {
            this.spawnRandomGlider();
        }
        
        // Decay ecosystem parameters back to baseline
        this.leniaGrowthMu = 0.15 + (this.leniaGrowthMu - 0.15) * 0.99;
    }

    updatePatternTracking() {
        // Update tracking for gliders and static patterns
        this.updateGliderTracking();
        this.updateStaticPatternTracking();
        this.updateLeniaOrganismTracking();
    }

    updateGliderTracking() {
        // Detect new gliders that may have formed
        // This is simplified - real implementation would use sophisticated pattern matching
        const newGliders = this.detectNewGliders();
        
        for (const newGlider of newGliders) {
            if (this.gliders.length < this.maxGliders) {
                this.gliders.push(newGlider);
            }
        }
    }

    updateStaticPatternTracking() {
        // Update existing static patterns and detect new ones
        for (const pattern of this.staticPatterns) {
            // Check if static pattern still exists
            if (!this.verifyStaticPattern(pattern)) {
                // Pattern has been consumed or evolved
                pattern.energy = 0; // Mark for removal
            }
        }
        
        // Detect new static patterns that may have formed
        const newPatterns = this.detectNewStaticPatterns();
        this.staticPatterns.push(...newPatterns);
    }

    updateLeniaOrganismTracking() {
        // Update Lenia organism positions and properties
        for (let i = this.leniaOrganisms.length - 1; i >= 0; i--) {
            const organism = this.leniaOrganisms[i];
            organism.age++;
            
            // Update organism center based on Lenia density
            const newCenter = this.findLeniaCenter(organism);
            organism.x = newCenter.x;
            organism.y = newCenter.y;
            
            // Remove organisms that have died out
            if (this.getLenia(organism.x, organism.y) < 0.05) {
                this.leniaOrganisms.splice(i, 1);
            }
        }
    }

    // Helper methods for pattern tracking
    detectNewGliders() {
        // Simplified glider detection
        // In practice, this would involve sophisticated pattern matching
        return []; // Placeholder
    }

    detectNewStaticPatterns() {
        // Simplified static pattern detection
        // Would check for stable configurations over multiple generations
        return []; // Placeholder
    }

    verifyStaticPattern(pattern) {
        // Check if a static pattern still exists at its location
        for (let py = pattern.y; py < pattern.y + pattern.height; py++) {
            for (let px = pattern.x; px < pattern.x + pattern.width; px++) {
                if (this.isValidPosition(px, py) && this.getLife(px, py) === 0) {
                    return false; // Pattern is incomplete
                }
            }
        }
        return true;
    }

    findLeniaCenter(organism) {
        // Find the center of mass for a Lenia organism
        let totalIntensity = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        const searchRadius = organism.radius + 5;
        
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const px = organism.x + dx;
                const py = organism.y + dy;
                
                if (this.isValidPosition(px, py)) {
                    const intensity = this.getLenia(px, py);
                    totalIntensity += intensity;
                    weightedX += px * intensity;
                    weightedY += py * intensity;
                }
            }
        }
        
        if (totalIntensity > 0) {
            return {
                x: Math.round(weightedX / totalIntensity),
                y: Math.round(weightedY / totalIntensity)
            };
        }
        
        return { x: organism.x, y: organism.y };
    }

    isGliderStillAlive(glider) {
        // Check if there are still Life cells near the glider's position
        let liveCells = 0;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (this.getLife(glider.x + dx, glider.y + dy) === 1) {
                    liveCells++;
                }
            }
        }
        return liveCells >= 3; // Minimum cells for a viable pattern
    }

    countTotalLifeCells() {
        let count = 0;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.lifeGrid[y][x] === 1) count++;
            }
        }
        return count;
    }

    calculateTotalLeniaIntensity() {
        let total = 0;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                total += this.leniaGrid[y][x];
            }
        }
        return total;
    }

    spawnRandomGlider() {
        const x = Math.floor(Math.random() * (this.gridWidth - 10)) + 5;
        const y = Math.floor(Math.random() * (this.gridHeight - 10)) + 5;
        this.addGlider(x, y);
    }

    updateVisualEffects(deltaTime) {
        // Update feeding events
        for (let i = this.feedingEvents.length - 1; i >= 0; i--) {
            const event = this.feedingEvents[i];
            event.life -= deltaTime * 2; // Fade over 0.5 seconds
            
            if (event.life <= 0) {
                this.feedingEvents.splice(i, 1);
            }
        }
        
        // Update predation events
        for (let i = this.predationEvents.length - 1; i >= 0; i--) {
            const event = this.predationEvents[i];
            event.life -= deltaTime * 3; // Fade over 0.33 seconds
            
            if (event.life <= 0) {
                this.predationEvents.splice(i, 1);
            }
        }
    }

    render() {
        // Clear canvas with dark background
        this.context.globalAlpha = 1.0;
        this.context.fillStyle = '#0a0a0a';
        this.context.fillRect(0, 0, this.width, this.height);
        
        // Render Lenia layer (background, continuous)
        this.renderLeniaLayer();
        
        // Render Life layer (foreground, discrete)
        this.renderLifeLayer();
        
        // Render interaction effects
        this.renderInteractionEffects();
        
        // Render debug info if needed
        this.renderDebugInfo();
    }

    renderLeniaLayer() {
        // Render Lenia as flowing, wave-like organisms using gradients and contours
        this.context.globalCompositeOperation = 'source-over';
        
        // Find all significant Lenia density regions
        const leniaRegions = this.findLeniaRegions();
        
        // Render each region as a flowing organic shape
        for (const region of leniaRegions) {
            this.renderLeniaRegion(region);
        }
    }

    findLeniaRegions() {
        // Find contiguous regions of Lenia above threshold
        const regions = [];
        const visited = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(false));
        const threshold = 0.05;
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (!visited[y][x] && this.leniaGrid[y][x] > threshold) {
                    const region = this.floodFillLeniaRegion(x, y, threshold, visited);
                    if (region.points.length > 5) { // Only render significant regions
                        regions.push(region);
                    }
                }
            }
        }
        
        return regions;
    }

    floodFillLeniaRegion(startX, startY, threshold, visited) {
        const region = {
            points: [],
            maxIntensity: 0,
            centerX: 0,
            centerY: 0,
            avgIntensity: 0
        };
        
        const stack = [{ x: startX, y: startY }];
        let totalIntensity = 0;
        
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            
            if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight || visited[y][x]) {
                continue;
            }
            
            const intensity = this.leniaGrid[y][x];
            if (intensity < threshold) continue;
            
            visited[y][x] = true;
            region.points.push({ x, y, intensity });
            totalIntensity += intensity;
            region.maxIntensity = Math.max(region.maxIntensity, intensity);
            
            // Add neighbors to stack
            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }
        
        // Calculate center and average intensity
        if (region.points.length > 0) {
            region.centerX = region.points.reduce((sum, p) => sum + p.x, 0) / region.points.length;
            region.centerY = region.points.reduce((sum, p) => sum + p.y, 0) / region.points.length;
            region.avgIntensity = totalIntensity / region.points.length;
        }
        
        return region;
    }

    renderLeniaRegion(region) {
        if (region.points.length === 0) return;
        
        const centerX = region.centerX * this.cellWidth + this.cellWidth / 2;
        const centerY = region.centerY * this.cellHeight + this.cellHeight / 2;
        
        // Create flowing gradient for each organism
        const time = Date.now() * 0.002;
        const maxRadius = Math.sqrt(region.points.length) * this.cellWidth * 0.8;
        
        // Animated gradient center for flow effect
        const flowOffsetX = Math.sin(time + region.centerX * 0.1) * maxRadius * 0.3;
        const flowOffsetY = Math.cos(time + region.centerY * 0.1) * maxRadius * 0.3;
        
        const gradient = this.context.createRadialGradient(
            centerX + flowOffsetX, centerY + flowOffsetY, 0,
            centerX, centerY, maxRadius
        );
        
        // Dynamic color based on intensity and audio
        const baseColor = this.mapLeniaToColor(region.avgIntensity);
        const audioInfluence = this.bassInfluence || 0;
        
        // Pulsing colors with audio
        const pulseIntensity = 1 + audioInfluence * 0.5;
        const r = Math.min(255, baseColor.r * pulseIntensity);
        const g = Math.min(255, baseColor.g * pulseIntensity);
        const b = Math.min(255, baseColor.b * pulseIntensity);
        
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${region.maxIntensity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${region.avgIntensity * 0.6})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        // Draw flowing organic shape
        this.context.fillStyle = gradient;
        this.context.beginPath();
        
        // Create smooth organic outline
        const smoothPoints = this.smoothLeniaOutline(region.points);
        if (smoothPoints.length > 2) {
            this.context.moveTo(smoothPoints[0].x * this.cellWidth, smoothPoints[0].y * this.cellHeight);
            
            for (let i = 1; i < smoothPoints.length; i++) {
                const curr = smoothPoints[i];
                const next = smoothPoints[(i + 1) % smoothPoints.length];
                const cpx = (curr.x + next.x) / 2 * this.cellWidth;
                const cpy = (curr.y + next.y) / 2 * this.cellHeight;
                
                this.context.quadraticCurveTo(
                    curr.x * this.cellWidth, curr.y * this.cellHeight,
                    cpx, cpy
                );
            }
            
            this.context.closePath();
            this.context.fill();
        }
        
        // Add flowing particle effects for high-intensity regions
        if (region.maxIntensity > 0.7) {
            this.renderLeniaParticles(region, time);
        }
    }

    smoothLeniaOutline(points) {
        // Find convex hull for smooth outline
        if (points.length < 3) return points;
        
        // Simple convex hull algorithm
        points.sort((a, b) => a.x - b.x || a.y - b.y);
        
        const lower = [];
        for (const point of points) {
            while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
                lower.pop();
            }
            lower.push(point);
        }
        
        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
            const point = points[i];
            while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
                upper.pop();
            }
            upper.push(point);
        }
        
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }

    cross(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    renderLeniaParticles(region, time) {
        // Add flowing particles for dynamic effect
        const particleCount = Math.min(8, Math.floor(region.points.length / 10));
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (time + i * 2) % (Math.PI * 2);
            const distance = (Math.sin(time * 2 + i) + 1) * 20;
            
            const x = region.centerX * this.cellWidth + Math.cos(angle) * distance;
            const y = region.centerY * this.cellHeight + Math.sin(angle) * distance;
            
            this.context.save();
            this.context.globalAlpha = 0.6;
            this.context.fillStyle = `rgba(255, 200, 100, 0.8)`;
            this.context.beginPath();
            this.context.arc(x, y, 2, 0, Math.PI * 2);
            this.context.fill();
            this.context.restore();
        }
    }

    renderLifeLayer() {
        // Render Conway's Life as distinct geometric shapes
        this.context.globalCompositeOperation = 'source-over';
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.lifeGrid[y][x] === 1) {
                    const pixelX = x * this.cellWidth;
                    const pixelY = y * this.cellHeight;
                    
                    // Determine if this is part of a glider or static pattern
                    const isGlider = this.isPartOfGlider(x, y);
                    const isStatic = this.isPartOfStaticPattern(x, y);
                    
                    // Different visual styles for different Life types
                    if (isGlider) {
                        this.renderLifeGliderCell(pixelX, pixelY);
                    } else if (isStatic) {
                        this.renderLifeStaticCell(pixelX, pixelY);
                    } else {
                        this.renderLifeGenericCell(pixelX, pixelY);
                    }
                }
            }
        }
    }

    renderLifeGliderCell(x, y) {
        // Gliders: bright, animated triangular shapes
        const centerX = x + this.cellWidth / 2;
        const centerY = y + this.cellHeight / 2;
        const size = this.cellWidth * 0.4;
        
        // Pulsing animation based on ecosystem pulse
        const pulse = 1.0 + this.ecosystemPulse * 0.3;
        const actualSize = size * pulse;
        
        this.context.save();
        this.context.translate(centerX, centerY);
        this.context.rotate(Date.now() * 0.001); // Slow rotation
        
        this.context.fillStyle = '#00ffff'; // Cyan for gliders
        this.context.strokeStyle = '#ffffff';
        this.context.lineWidth = 1;
        
        // Draw triangle
        this.context.beginPath();
        this.context.moveTo(0, -actualSize);
        this.context.lineTo(-actualSize * 0.866, actualSize * 0.5);
        this.context.lineTo(actualSize * 0.866, actualSize * 0.5);
        this.context.closePath();
        this.context.fill();
        this.context.stroke();
        
        this.context.restore();
    }

    renderLifeStaticCell(x, y) {
        // Static patterns: solid, stable squares
        const centerX = x + this.cellWidth / 2;
        const centerY = y + this.cellHeight / 2;
        const size = this.cellWidth * 0.35;
        
        this.context.fillStyle = '#ffff00'; // Yellow for static patterns
        this.context.strokeStyle = '#ffffff';
        this.context.lineWidth = 1;
        
        this.context.fillRect(centerX - size, centerY - size, size * 2, size * 2);
        this.context.strokeRect(centerX - size, centerY - size, size * 2, size * 2);
    }

    renderLifeGenericCell(x, y) {
        // Generic Life: simple circles
        const centerX = x + this.cellWidth / 2;
        const centerY = y + this.cellHeight / 2;
        const radius = this.cellWidth * 0.3;
        
        this.context.fillStyle = '#ffffff'; // White for generic Life
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.context.fill();
    }

    renderInteractionEffects() {
        // Render feeding events (Lenia consuming Life)
        for (const event of this.feedingEvents) {
            this.renderFeedingEffect(event);
        }
        
        // Render predation events (Life consuming Lenia)
        for (const event of this.predationEvents) {
            this.renderPredationEffect(event);
        }
    }

    renderFeedingEffect(event) {
        const alpha = event.life / event.maxLife;
        const radius = (1 - alpha) * 20 + 5; // Expanding circle
        
        this.context.save();
        this.context.globalAlpha = alpha;
        this.context.strokeStyle = `rgb(${event.color.r}, ${event.color.g}, ${event.color.b})`;
        this.context.lineWidth = 2;
        
        // Pulsing green circle for feeding
        this.context.beginPath();
        this.context.arc(event.x, event.y, radius, 0, Math.PI * 2);
        this.context.stroke();
        
        // Inner glow
        this.context.globalAlpha = alpha * 0.3;
        this.context.fillStyle = `rgb(${event.color.r}, ${event.color.g}, ${event.color.b})`;
        this.context.fill();
        
        this.context.restore();
    }

    renderPredationEffect(event) {
        const alpha = event.life / event.maxLife;
        const size = (1 - alpha) * 15 + 3; // Expanding burst
        
        this.context.save();
        this.context.globalAlpha = alpha;
        this.context.fillStyle = `rgb(${event.color.r}, ${event.color.g}, ${event.color.b})`;
        
        // Star burst pattern for predation
        this.context.translate(event.x, event.y);
        this.context.rotate(Date.now() * 0.01);
        
        for (let i = 0; i < 6; i++) {
            this.context.rotate(Math.PI / 3);
            this.context.beginPath();
            this.context.moveTo(0, 0);
            this.context.lineTo(0, -size);
            this.context.lineTo(size * 0.3, -size * 0.7);
            this.context.lineTo(0, -size);
            this.context.lineTo(-size * 0.3, -size * 0.7);
            this.context.fill();
        }
        
        this.context.restore();
    }

    renderDebugInfo() {
        // Optional debug information
        if (false) { // Set to true for debugging
            this.context.fillStyle = '#ffffff';
            this.context.font = '12px monospace';
            this.context.fillText(`Life cells: ${this.countTotalLifeCells()}`, 10, 20);
            this.context.fillText(`Lenia intensity: ${this.calculateTotalLeniaIntensity().toFixed(2)}`, 10, 35);
            this.context.fillText(`Gliders: ${this.gliders.length}`, 10, 50);
            this.context.fillText(`Static patterns: ${this.staticPatterns.length}`, 10, 65);
            this.context.fillText(`Feeding events: ${this.feedingEvents.length}`, 10, 80);
            this.context.fillText(`Predation events: ${this.predationEvents.length}`, 10, 95);
        }
    }

    mapLeniaToColor(intensity) {
        // Map Lenia intensity to warm, organic colors
        const clamped = Math.max(0, Math.min(1, intensity));
        
        // Base colors for different intensity ranges
        if (clamped < 0.2) {
            // Low intensity: deep purple/blue
            const t = clamped / 0.2;
            return {
                r: Math.floor(20 + t * 30),
                g: Math.floor(10 + t * 20),
                b: Math.floor(40 + t * 60),
                a: clamped * 2
            };
        } else if (clamped < 0.5) {
            // Medium intensity: purple to orange
            const t = (clamped - 0.2) / 0.3;
            return {
                r: Math.floor(50 + t * 100),
                g: Math.floor(30 + t * 70),
                b: Math.floor(100 - t * 80),
                a: 0.4 + t * 0.3
            };
        } else {
            // High intensity: orange to bright yellow
            const t = (clamped - 0.5) / 0.5;
            return {
                r: Math.floor(150 + t * 105),
                g: Math.floor(100 + t * 155),
                b: Math.floor(20 + t * 50),
                a: 0.7 + t * 0.3
            };
        }
    }

    // Required by BaseSimulation
    initializeNodes() {
        return []; // No traditional nodes in this system
    }

    // Handle resize
    onResize(width, height) {
        this.gridWidth = width > 1000 ? 150 : 120;
        this.gridHeight = height > 700 ? 100 : 80;
        this.cellWidth = width / this.gridWidth;
        this.cellHeight = height / this.gridHeight;
        
        // Reinitialize grids with new dimensions
        this.initializeGrids();
        this.seedInitialPatterns();
    }
}