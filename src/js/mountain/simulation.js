import { BaseSimulation } from '../base/base-simulation.js';
import { SandGrain } from './sand-grain.js';

export class MountainSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);
        
        // Metal plate properties
        this.plateWidth = width * 0.8;
        this.plateHeight = height * 0.8;
        this.plateX = (width - this.plateWidth) / 2;
        this.plateY = (height - this.plateHeight) / 2;
        this.plateBounds = {
            left: this.plateX,
            right: this.plateX + this.plateWidth,
            top: this.plateY,
            bottom: this.plateY + this.plateHeight
        };
        
        // Sand grain system
        this.sandGrains = [];
        this.maxGrains = width > 1024 ? 1500 : 800; // More grains for better patterns
        this.grainSpawnTimer = 0;
        this.grainSpawnInterval = 0.02; // Add grains every 20ms - much faster
        
        // Metal plate physical simulation
        this.plateNodes = []; // Grid of points that make up the plate
        this.plateGridSize = 20; // 20x20 grid of plate nodes
        this.plateStiffness = 0.05; // Even more flexible for better wave propagation
        this.plateDamping = 0.005; // Even less damping - sustains vibrations much longer
        this.plateResonantFreq = 200; // Natural resonant frequency
        
        // Multiple audio input points for more complex patterns
        this.audioInputPoints = [
            { x: Math.floor(this.plateGridSize * 0.3), y: Math.floor(this.plateGridSize * 0.3), strength: 1.0 },
            { x: Math.floor(this.plateGridSize * 0.7), y: Math.floor(this.plateGridSize * 0.3), strength: 0.8 },
            { x: Math.floor(this.plateGridSize * 0.3), y: Math.floor(this.plateGridSize * 0.7), strength: 0.8 },
            { x: Math.floor(this.plateGridSize * 0.7), y: Math.floor(this.plateGridSize * 0.7), strength: 0.6 }
        ];
        
        // Audio analysis - use the built-in player analysis
        this.lastAudioUpdate = 0;
        
        // Visual effects
        this.plateGlow = 0;
        this.nodalLines = [];
        this.resonanceRipples = [];
        
        // Performance optimization
        this.collisionGrid = null;
        this.gridSize = 50;
        this.frameCounter = 0;
        
        this.initializePlatePhysics();
        this.initializeNodes();
    }
    
    initializePlatePhysics() {
        // Initialize grid of plate nodes with position, velocity, and acceleration
        this.plateNodes = [];
        const nodeSpacingX = this.plateWidth / (this.plateGridSize - 1);
        const nodeSpacingY = this.plateHeight / (this.plateGridSize - 1);
        
        for (let y = 0; y < this.plateGridSize; y++) {
            this.plateNodes[y] = [];
            for (let x = 0; x < this.plateGridSize; x++) {
                this.plateNodes[y][x] = {
                    // Position in world coordinates
                    worldX: this.plateX + x * nodeSpacingX,
                    worldY: this.plateY + y * nodeSpacingY,
                    // Z displacement (height of plate at this point)
                    z: 0,
                    // Velocity and acceleration in Z direction
                    vz: 0,
                    az: 0,
                    // Grid coordinates
                    gridX: x,
                    gridY: y
                };
            }
        }
    }
    
    
    initializeNodes() {
        this.sandGrains = [];
        
        // Start with more grains distributed across the plate
        const initialGrains = Math.min(200, this.maxGrains / 4);
        
        for (let i = 0; i < initialGrains; i++) {
            const x = this.plateX + Math.random() * this.plateWidth;
            const y = this.plateY + Math.random() * this.plateHeight;
            const grain = new SandGrain(i, x, y);
            this.sandGrains.push(grain);
        }
        
        return this.sandGrains;
    }
    
    updatePlatePhysics(deltaTime) {
        if (!this.audioPlayer) return;
        
        const audioAnalysis = this.audioPlayer.getAudioAnalysis();
        if (!audioAnalysis) return;
        
        // Get audio input amplitude (sum of all frequencies for driving force)
        const audioAmplitude = audioAnalysis.overall || 0;
        const bassAmplitude = audioAnalysis.bass || 0;
        
        // Apply audio forces to multiple input points
        if (this.audioInputPoints && this.plateNodes) {
            this.audioInputPoints.forEach(inputPoint => {
                if (this.plateNodes[inputPoint.y] && this.plateNodes[inputPoint.y][inputPoint.x]) {
                    const inputNode = this.plateNodes[inputPoint.y][inputPoint.x];
                    const force = (audioAmplitude * 8000 + bassAmplitude * 6000) * inputPoint.strength;
                    inputNode.az += force;
                }
            });
        }
        
        // Simulate plate physics using finite difference method
        for (let y = 0; y < this.plateGridSize; y++) {
            for (let x = 0; x < this.plateGridSize; x++) {
                const node = this.plateNodes[y][x];
                
                // Reset acceleration
                node.az = 0;
                
                // Calculate spring forces from neighboring nodes (2D wave equation)
                let springForce = 0;
                let neighborCount = 0;
                
                // Check all 4 neighbors
                const neighbors = [
                    {dx: -1, dy: 0}, {dx: 1, dy: 0},
                    {dx: 0, dy: -1}, {dx: 0, dy: 1}
                ];
                
                neighbors.forEach(({dx, dy}) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < this.plateGridSize && ny >= 0 && ny < this.plateGridSize) {
                        const neighbor = this.plateNodes[ny][nx];
                        springForce += (neighbor.z - node.z) * this.plateStiffness;
                        neighborCount++;
                    } else {
                        // Free boundary conditions (plate edges can move freely)
                        // Don't add any constraint forces at the boundaries
                    }
                });
                
                // Apply spring force (restoring force toward equilibrium)
                node.az += springForce;
                
                // Apply damping
                node.az -= node.vz * this.plateDamping;
                
                // Add continuous low-level random excitation to prevent complete settling
                node.az += (Math.random() - 0.5) * 50;
                
                // Apply audio input for any input points
                if (this.audioInputPoints) {
                    this.audioInputPoints.forEach(inputPoint => {
                        if (x === inputPoint.x && y === inputPoint.y) {
                            const force = (audioAmplitude * 20000 + bassAmplitude * 15000) * inputPoint.strength;
                            node.az += force;
                        }
                    });
                }
            }
        }
        
        // Update velocities and positions
        for (let y = 0; y < this.plateGridSize; y++) {
            for (let x = 0; x < this.plateGridSize; x++) {
                const node = this.plateNodes[y][x];
                
                // Update velocity and position using Verlet integration
                node.vz += node.az * deltaTime;
                node.z += node.vz * deltaTime;
                
                // Clamp extreme values to prevent instability
                node.z = Math.max(-100, Math.min(100, node.z));
                node.vz = Math.max(-1000, Math.min(1000, node.vz));
            }
        }
    }
    
    updateVisualEffects(deltaTime) {
        // Update plate glow based on audio intensity
        if (this.audioPlayer) {
            const audioAnalysis = this.audioPlayer.getAudioAnalysis();
            if (audioAnalysis) {
                const totalIntensity = audioAnalysis.bass + audioAnalysis.mid + audioAnalysis.treble;
                this.plateGlow = totalIntensity / 3;
            }
        }
        
        // Update resonance ripples based on plate activity
        this.updateResonanceRipples(deltaTime);
    }
    
    updateResonanceRipples(deltaTime) {
        // Create new ripples based on plate activity
        if (this.audioPlayer) {
            const audioAnalysis = this.audioPlayer.getAudioAnalysis();
            if (audioAnalysis) {
                const totalVibration = audioAnalysis.bass + audioAnalysis.mid + audioAnalysis.treble;
                
                if (totalVibration > 0.7 && Math.random() < 0.3 && this.audioInputPoints && this.audioInputPoints.length > 0) {
                    // Create ripple at a random audio input point
                    const randomInputPoint = this.audioInputPoints[Math.floor(Math.random() * this.audioInputPoints.length)];
                    if (this.plateNodes[randomInputPoint.y] && this.plateNodes[randomInputPoint.y][randomInputPoint.x]) {
                        const inputNode = this.plateNodes[randomInputPoint.y][randomInputPoint.x];
                        this.resonanceRipples.push({
                            x: inputNode.worldX,
                            y: inputNode.worldY,
                            radius: 0,
                            maxRadius: 150 + Math.random() * 100,
                            life: 1.0
                        });
                    }
                }
            }
        }
        
        // Update existing ripples
        for (let i = this.resonanceRipples.length - 1; i >= 0; i--) {
            const ripple = this.resonanceRipples[i];
            ripple.radius += 200 * deltaTime;
            ripple.life -= deltaTime * 0.5;
            
            if (ripple.life <= 0 || ripple.radius > ripple.maxRadius) {
                this.resonanceRipples.splice(i, 1);
            }
        }
    }
    
    
    updateSandGrains(deltaTime) {
        // Add new grains more frequently - add multiple grains per interval
        this.grainSpawnTimer += deltaTime;
        if (this.grainSpawnTimer >= this.grainSpawnInterval && this.sandGrains.length < this.maxGrains) {
            // Add 3-5 grains at once for faster accumulation
            const grainsToAdd = Math.min(5, this.maxGrains - this.sandGrains.length);
            for (let i = 0; i < grainsToAdd; i++) {
                this.addNewSandGrain();
            }
            this.grainSpawnTimer = 0;
        }
        
        // Update all sand grains with actual plate physics
        this.sandGrains.forEach(grain => {
            grain.update(deltaTime, this.plateNodes, this.plateGridSize, this.plateBounds);
        });
        
        // Handle grain collisions (optimized with spatial grid)
        this.handleGrainCollisions();
        
        // Periodically redistribute clumped grains
        if (this.frameCounter % 300 === 0) { // Every 5 seconds at 60fps
            this.redistributeClumpedGrains();
        }
        
        // Remove grains that have left the plate area (with some buffer)
        const buffer = 50;
        this.sandGrains = this.sandGrains.filter(grain => {
            return grain.x >= this.plateX - buffer && 
                   grain.x <= this.plateX + this.plateWidth + buffer &&
                   grain.y >= this.plateY - buffer && 
                   grain.y <= this.plateY + this.plateHeight + buffer;
        });
    }
    
    addNewSandGrain() {
        // Add grains at random positions along the plate edges (like sprinkling sand)
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (edge) {
            case 0: // Top edge
                x = this.plateX + Math.random() * this.plateWidth;
                y = this.plateY - 10;
                break;
            case 1: // Right edge
                x = this.plateX + this.plateWidth + 10;
                y = this.plateY + Math.random() * this.plateHeight;
                break;
            case 2: // Bottom edge
                x = this.plateX + Math.random() * this.plateWidth;
                y = this.plateY + this.plateHeight + 10;
                break;
            case 3: // Left edge
                x = this.plateX - 10;
                y = this.plateY + Math.random() * this.plateHeight;
                break;
        }
        
        const grain = new SandGrain(this.sandGrains.length, x, y);
        
        // Give new grains a slight inward velocity
        const centerX = this.plateX + this.plateWidth / 2;
        const centerY = this.plateY + this.plateHeight / 2;
        const direction = Math.atan2(centerY - y, centerX - x);
        grain.vx = Math.cos(direction) * 20;
        grain.vy = Math.sin(direction) * 20;
        
        this.sandGrains.push(grain);
    }
    
    handleGrainCollisions() {
        // Simple collision detection - can be optimized with spatial partitioning if needed
        for (let i = 0; i < this.sandGrains.length; i++) {
            for (let j = i + 1; j < this.sandGrains.length; j++) {
                this.sandGrains[i].collideWith(this.sandGrains[j]);
            }
        }
    }
    
    // Redistribute grains that have clumped together at the bottom
    redistributeClumpedGrains() {
        const bottomThreshold = this.plateY + this.plateHeight * 0.8;
        const clumpedGrains = this.sandGrains.filter(grain => grain.y > bottomThreshold);
        
        // If more than 40% of grains are clumped at bottom, redistribute some
        if (clumpedGrains.length > this.sandGrains.length * 0.4) {
            const grainsToRedistribute = Math.floor(clumpedGrains.length * 0.3);
            
            for (let i = 0; i < grainsToRedistribute; i++) {
                const grain = clumpedGrains[i];
                
                // Move to a random position on the plate
                grain.x = this.plateX + Math.random() * this.plateWidth;
                grain.y = this.plateY + Math.random() * this.plateHeight * 0.6; // Upper 60%
                
                // Give it some initial velocity to integrate with plate motion
                grain.vx = (Math.random() - 0.5) * 50;
                grain.vy = (Math.random() - 0.5) * 50;
                
                // Reset settling state
                grain.settled = false;
                grain.settleTime = 0;
            }
        }
    }
    
    draw() {
        const deltaTime = this.getDeltaTime();
        this.frameCounter++;
        
        // Update physics systems
        this.updatePlatePhysics(deltaTime);
        this.updateSandGrains(deltaTime);
        this.updateVisualEffects(deltaTime);
        
        // Draw metal plate with displacement visualization
        this.drawMetalPlate();
        
        // Draw plate displacement visualization
        this.drawPlateDisplacement();
        
        // Draw resonance ripples
        this.drawResonanceRipples();
        
        // Draw sand grains
        this.drawSandGrains();
        
        // Draw audio input point
        this.drawAudioInputPoint();
    }
    
    drawMetalPlate() {
        this.context.save();
        
        // Main plate with metallic appearance
        const gradient = this.context.createRadialGradient(
            this.plateX + this.plateWidth / 2, this.plateY + this.plateHeight / 2, 0,
            this.plateX + this.plateWidth / 2, this.plateY + this.plateHeight / 2, 
            Math.max(this.plateWidth, this.plateHeight) / 2
        );
        
        gradient.addColorStop(0, `rgba(200, 200, 220, ${0.3 + this.plateGlow * 0.5})`);
        gradient.addColorStop(0.7, `rgba(150, 150, 170, ${0.2 + this.plateGlow * 0.3})`);
        gradient.addColorStop(1, `rgba(100, 100, 120, ${0.1 + this.plateGlow * 0.2})`);
        
        this.context.fillStyle = gradient;
        this.context.fillRect(this.plateX, this.plateY, this.plateWidth, this.plateHeight);
        
        // Plate border
        this.context.strokeStyle = `rgba(150, 150, 170, ${0.5 + this.plateGlow * 0.5})`;
        this.context.lineWidth = 2;
        this.context.strokeRect(this.plateX, this.plateY, this.plateWidth, this.plateHeight);
        
        this.context.restore();
    }
    
    drawPlateDisplacement() {
        if (!this.plateNodes || this.plateNodes.length === 0) return;
        
        this.context.save();
        
        // Draw plate displacement as a color map
        const nodeSpacingX = this.plateWidth / (this.plateGridSize - 1);
        const nodeSpacingY = this.plateHeight / (this.plateGridSize - 1);
        
        for (let y = 0; y < this.plateGridSize - 1; y++) {
            for (let x = 0; x < this.plateGridSize - 1; x++) {
                const node = this.plateNodes[y][x];
                const displacement = node.z;
                
                // Map displacement to color intensity
                const intensity = Math.min(1, Math.abs(displacement) / 50);
                const alpha = intensity * 0.3;
                
                // Use red for positive displacement, blue for negative
                const color = displacement > 0 ? 
                    `rgba(255, 100, 100, ${alpha})` : 
                    `rgba(100, 100, 255, ${alpha})`;
                
                this.context.fillStyle = color;
                this.context.fillRect(
                    node.worldX, 
                    node.worldY, 
                    nodeSpacingX + 1, 
                    nodeSpacingY + 1
                );
            }
        }
        
        this.context.restore();
    }
    
    drawAudioInputPoint() {
        if (!this.plateNodes || !this.audioInputPoints) return;
        
        this.context.save();
        
        // Draw all audio input points
        this.audioInputPoints.forEach((inputPoint, index) => {
            const inputNode = this.plateNodes[inputPoint.y][inputPoint.x];
            if (!inputNode) return;
            
            // Different colors for different input points
            const colors = ['#FF6666', '#66FF66', '#6666FF', '#FFFF66'];
            this.context.fillStyle = colors[index % colors.length];
            this.context.globalAlpha = 0.6 * inputPoint.strength;
            
            // Draw pulsing circle at audio input point
            const baseRadius = 6 * inputPoint.strength;
            const pulseRadius = baseRadius + Math.sin(this.frameCounter * 0.2 + index) * 2;
            this.context.beginPath();
            this.context.arc(inputNode.worldX, inputNode.worldY, pulseRadius, 0, Math.PI * 2);
            this.context.fill();
        });
        
        this.context.restore();
    }
    
    drawResonanceRipples() {
        if (this.resonanceRipples.length === 0) return;
        
        this.context.save();
        this.context.strokeStyle = '#66AAFF';
        this.context.lineWidth = 2;
        
        this.resonanceRipples.forEach(ripple => {
            this.context.globalAlpha = ripple.life * 0.5;
            this.context.beginPath();
            this.context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.context.stroke();
        });
        
        this.context.restore();
    }
    
    drawSandGrains() {
        this.sandGrains.forEach(grain => {
            grain.draw(this.context, {
                beatIntensity: this.beatIntensity || 0
            });
        });
    }
    
    
    // Handle window resize
    onResize(width, height) {
        // Recalculate plate dimensions and bounds
        this.plateWidth = width * 0.8;
        this.plateHeight = height * 0.8;
        this.plateX = (width - this.plateWidth) / 2;
        this.plateY = (height - this.plateHeight) / 2;
        
        this.plateBounds = {
            left: this.plateX,
            right: this.plateX + this.plateWidth,
            top: this.plateY,
            bottom: this.plateY + this.plateHeight
        };
        
        // Adjust grain count for new screen size
        this.maxGrains = width > 1024 ? 1500 : 800;
        
        // Reinitialize plate physics for new plate size
        this.initializePlatePhysics();
    }
}