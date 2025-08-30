import { BaseSimulation } from '../base/base-simulation.js';
import { SandpileCell } from './cell.js';

export class SandpileSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);
        
        // Grid dimensions - adaptive based on screen size
        this.gridWidth = width > 800 ? 80 : 50;
        this.gridHeight = height > 600 ? 50 : 35;
        
        // Cell size calculation
        this.cellWidth = width / this.gridWidth;
        this.cellHeight = height / this.gridHeight;
        
        // Grid storage
        this.grid = [];
        this.toppleQueue = [];
        
        // Animation and timing
        this.sandAdditionTimer = 0;
        this.sandAdditionInterval = 0.05; // Add sand every 50ms base rate (more frequent)
        
        // Sand pile concentration points - fewer locations for more dramatic piles
        this.sandPileLocations = [];
        this.generateSandPileLocations();
        
        // Audio-reactive parameters
        this.lastBassLevel = 0;
        this.lastTrebleLevel = 0;
        this.avalancheIntensity = 0;
        
        // Visual effects
        this.earthquakeEffect = 0;
        this.avalancheParticles = [];
        
        // Performance optimization
        this.maxTopplesPerFrame = 50;
        this.framesSinceLastUpdate = 0;
        
        this.initializeGrid();
    }

    initializeGrid() {
        this.grid = [];
        let cellId = 0;
        
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                const pixelX = (x + 0.5) * this.cellWidth;
                const pixelY = (y + 0.5) * this.cellHeight;
                
                const cell = new SandpileCell(cellId++, pixelX, pixelY, x, y);
                cell.cellSize = Math.min(this.cellWidth, this.cellHeight) * 0.9;
                this.grid[y][x] = cell;
            }
        }
        
        // Add initial sand pattern - create some interesting starting configurations
        this.addInitialSand();
    }
    
    // Generate fewer strategic locations for sand pile concentration
    generateSandPileLocations() {
        this.sandPileLocations = [];
        
        // Create 4-6 strategic locations for sand accumulation
        const numLocations = 5;
        
        // Center location - primary pile
        this.sandPileLocations.push({
            x: Math.floor(this.gridWidth / 2),
            y: Math.floor(this.gridHeight / 2),
            weight: 0.4 // 40% of sand goes here
        });
        
        // Four corner regions - secondary piles
        const margin = Math.floor(Math.min(this.gridWidth, this.gridHeight) * 0.2);
        
        this.sandPileLocations.push({
            x: margin,
            y: margin,
            weight: 0.15
        });
        
        this.sandPileLocations.push({
            x: this.gridWidth - margin,
            y: margin,
            weight: 0.15
        });
        
        this.sandPileLocations.push({
            x: margin,
            y: this.gridHeight - margin,
            weight: 0.15
        });
        
        this.sandPileLocations.push({
            x: this.gridWidth - margin,
            y: this.gridHeight - margin,
            weight: 0.15
        });
    }

    addInitialSand() {
        // Add a small amount of initial sand in interesting patterns
        const centerX = Math.floor(this.gridWidth / 2);
        const centerY = Math.floor(this.gridHeight / 2);
        
        // Central cluster
        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                if (this.isValidGridPosition(centerX + i, centerY + j)) {
                    this.grid[centerY + j][centerX + i].addGrains(1);
                }
            }
        }
        
        // Corner seeds
        const corners = [
            { x: 5, y: 5 },
            { x: this.gridWidth - 6, y: 5 },
            { x: 5, y: this.gridHeight - 6 },
            { x: this.gridWidth - 6, y: this.gridHeight - 6 }
        ];
        
        corners.forEach(corner => {
            if (this.isValidGridPosition(corner.x, corner.y)) {
                this.grid[corner.y][corner.x].addGrains(2);
            }
        });
    }

    // Core sandpile algorithm implementation
    processToppling() {
        let topplesThisFrame = 0;
        const newTopples = [];
        
        // Find all unstable cells
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x].isUnstable()) {
                    newTopples.push({ x, y });
                }
            }
        }
        
        // Process toppling
        newTopples.forEach(pos => {
            if (topplesThisFrame >= this.maxTopplesPerFrame) return;
            
            const cell = this.grid[pos.y][pos.x];
            const grainsPerNeighbor = cell.topple();
            
            if (grainsPerNeighbor > 0) {
                topplesThisFrame++;
                this.avalancheIntensity += 0.1;
                
                // Distribute grains to neighbors
                const neighborPositions = cell.getNeighborPositions();
                neighborPositions.forEach(neighborPos => {
                    if (this.isValidGridPosition(neighborPos.x, neighborPos.y)) {
                        this.grid[neighborPos.y][neighborPos.x].addGrains(grainsPerNeighbor);
                    }
                });
                
                // Create particle effect for large avalanches
                if (this.avalancheIntensity > 2.0 && this.avalancheParticles.length < 20) {
                    this.createAvalancheParticle(cell.x, cell.y);
                }
            }
        });
        
        // Decay avalanche intensity
        this.avalancheIntensity *= 0.95;
        
        return topplesThisFrame > 0;
    }

    // Audio-reactive sand addition
    updateAudioReactiveBehavior(deltaTime) {
        if (!this.audioPlayer) return;
        
        const audioAnalysis = this.audioPlayer.getAudioAnalysis();
        if (!audioAnalysis) return;
        
        // Bass-driven sand addition - more responsive and frequent
        const bassIncrease = audioAnalysis.bass - this.lastBassLevel;
        if (bassIncrease > 0.05 && audioAnalysis.bass > 0.5) {
            // Add more sand on bass hits for bigger avalanches
            const sandAmount = Math.floor(bassIncrease * 15) + 2;
            this.addRandomSand(sandAmount);
        }
        this.lastBassLevel = audioAnalysis.bass;
        
        // Treble-triggered earthquakes
        const trebleIncrease = audioAnalysis.treble - this.lastTrebleLevel;
        if (trebleIncrease > 0.15 && audioAnalysis.treble > 0.7) {
            this.triggerEarthquake();
        }
        this.lastTrebleLevel = audioAnalysis.treble;
        
        // Mid-frequency influences sand addition rate - faster overall
        const midInfluence = audioAnalysis.mid || 0;
        if (midInfluence > 0.4) {
            // High mid = very frequent sand addition
            this.sandAdditionInterval = 0.02; // Every 20ms
        } else {
            // Normal = still frequent
            this.sandAdditionInterval = 0.04; // Every 40ms
        }
        
        // Regular sand addition timer - now more frequent
        this.sandAdditionTimer += deltaTime;
        if (this.sandAdditionTimer >= this.sandAdditionInterval) {
            // Add 2-3 grains at once for faster pile building
            this.addRandomSand(2 + Math.floor(Math.random() * 2));
            this.sandAdditionTimer = 0;
        }
        
        // Update all cells with audio influence
        const audioInfluence = {
            bass: audioAnalysis.bass,
            mid: audioAnalysis.mid,
            treble: audioAnalysis.treble,
            beatIntensity: audioAnalysis.beatIntensity
        };
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y][x].updateColor(audioInfluence);
                this.grid[y][x].update(deltaTime);
            }
        }
    }

    // Add sand at strategic pile locations with some randomness
    addRandomSand(amount) {
        for (let i = 0; i < amount; i++) {
            // Choose a pile location based on weights
            const rand = Math.random();
            let cumulativeWeight = 0;
            let selectedLocation = this.sandPileLocations[0]; // fallback
            
            for (const location of this.sandPileLocations) {
                cumulativeWeight += location.weight;
                if (rand <= cumulativeWeight) {
                    selectedLocation = location;
                    break;
                }
            }
            
            // Add some randomness around the selected location (3x3 area)
            const spreadRadius = 1;
            const x = Math.max(0, Math.min(this.gridWidth - 1, 
                selectedLocation.x + Math.floor((Math.random() - 0.5) * 2 * spreadRadius)));
            const y = Math.max(0, Math.min(this.gridHeight - 1, 
                selectedLocation.y + Math.floor((Math.random() - 0.5) * 2 * spreadRadius)));
                
            this.grid[y][x].addGrains(1);
        }
    }

    // Earthquake effect - redistribute sand in localized areas
    triggerEarthquake() {
        this.earthquakeEffect = 1.0;
        
        // Choose random epicenter
        const epicenterX = Math.floor(Math.random() * this.gridWidth);
        const epicenterY = Math.floor(Math.random() * this.gridHeight);
        const radius = 8 + Math.random() * 12;
        
        // Redistribute sand in affected area
        for (let y = Math.max(0, epicenterY - radius); y < Math.min(this.gridHeight, epicenterY + radius); y++) {
            for (let x = Math.max(0, epicenterX - radius); x < Math.min(this.gridWidth, epicenterX + radius); x++) {
                const distance = Math.sqrt((x - epicenterX) ** 2 + (y - epicenterY) ** 2);
                if (distance <= radius) {
                    const cell = this.grid[y][x];
                    if (cell.grains > 0) {
                        // Redistribute some grains
                        const grainsToMove = Math.floor(cell.grains * 0.5);
                        cell.grains -= grainsToMove;
                        
                        // Add to nearby random location
                        const nearbyX = Math.max(0, Math.min(this.gridWidth - 1, x + (Math.random() - 0.5) * 4));
                        const nearbyY = Math.max(0, Math.min(this.gridHeight - 1, y + (Math.random() - 0.5) * 4));
                        this.grid[Math.floor(nearbyY)][Math.floor(nearbyX)].addGrains(grainsToMove);
                    }
                }
            }
        }
    }

    // Create visual particle for avalanche effects
    createAvalancheParticle(x, y) {
        this.avalancheParticles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            life: 1.0,
            size: 2 + Math.random() * 3
        });
    }

    // Update and draw avalanche particles
    updateAvalancheParticles(deltaTime) {
        for (let i = this.avalancheParticles.length - 1; i >= 0; i--) {
            const particle = this.avalancheParticles[i];
            
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.life -= deltaTime * 2;
            particle.size *= 0.98;
            
            if (particle.life <= 0) {
                this.avalancheParticles.splice(i, 1);
            }
        }
    }

    // Check if grid position is valid
    isValidGridPosition(x, y) {
        return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
    }

    // Main drawing method
    draw() {
        const deltaTime = this.getDeltaTime();
        
        // Update audio-reactive behavior
        this.updateAudioReactiveBehavior(deltaTime);
        
        // Process sandpile toppling
        let stillToppling = true;
        let safetyCounter = 0;
        while (stillToppling && safetyCounter < 10) {
            stillToppling = this.processToppling();
            safetyCounter++;
        }
        
        // Update earthquake effect
        if (this.earthquakeEffect > 0) {
            this.earthquakeEffect -= deltaTime * 2;
            
            // Screen shake effect
            if (this.earthquakeEffect > 0.5) {
                this.context.save();
                const shakeX = (Math.random() - 0.5) * this.earthquakeEffect * 4;
                const shakeY = (Math.random() - 0.5) * this.earthquakeEffect * 4;
                this.context.translate(shakeX, shakeY);
            }
        }
        
        // Draw all grid cells
        const audioInfluence = {
            beatIntensity: this.beatIntensity || 0
        };
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y][x].draw(this.context, audioInfluence);
            }
        }
        
        // Draw avalanche particles
        this.updateAvalancheParticles(deltaTime);
        this.context.fillStyle = '#ffaa00';
        this.avalancheParticles.forEach(particle => {
            this.context.save();
            this.context.globalAlpha = particle.life;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.context.fill();
            this.context.restore();
        });
        
        // Restore context if earthquake effect was applied
        if (this.earthquakeEffect > 0.5) {
            this.context.restore();
        }
    }

    // Handle resize
    onResize(width, height) {
        this.gridWidth = width > 800 ? 80 : 50;
        this.gridHeight = height > 600 ? 50 : 35;
        this.cellWidth = width / this.gridWidth;
        this.cellHeight = height / this.gridHeight;
        
        // Regenerate sand pile locations for new grid size
        this.generateSandPileLocations();
        
        // Reinitialize grid with new dimensions
        this.initializeGrid();
    }

    // Initialize nodes (required by BaseSimulation)
    initializeNodes() {
        // Grid is initialized in constructor, this satisfies the interface
        return this.grid.flat();
    }
}