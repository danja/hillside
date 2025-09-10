import { BaseNode } from '../base/base-node.js';

export class SandGrain extends BaseNode {
    constructor(id, x, y) {
        super(id, x, y);
        
        // Physical properties
        this.mass = 0.2 + Math.random() * 0.2; // Very light grains
        this.friction = 0.98; // Less friction loss to sustain movement
        this.restitution = 0.7; // More bouncy to prevent settling
        
        // Velocity and acceleration
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        
        // Visual properties
        this.size = 1 + Math.random() * 2;
        this.baseColor = this.generateSandColor();
        this.color = this.baseColor;
        this.alpha = 0.7 + Math.random() * 0.3;
        
        // Chladni pattern properties
        this.vibrationResponse = Math.random(); // How strongly this grain responds to vibrations
        this.resonanceFreq = 100 + Math.random() * 400; // Natural resonance frequency
        this.settled = false; // Whether grain has found a stable position
        this.settleTime = 0; // Time since last significant movement
    }
    
    generateSandColor() {
        // Natural sand colors - beiges, browns, light yellows
        const colors = [
            '#D4A574', // Sandy brown
            '#E6D2B5', // Light beige  
            '#C4A484', // Medium brown
            '#F4E4BC', // Pale yellow
            '#DDB892', // Tan
            '#B8956A'  // Darker brown
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Update grain physics based on actual plate physics
    update(deltaTime, plateNodes, plateGridSize, bounds) {
        // Apply forces from the physically simulated plate
        this.applyVibrationForces(plateNodes, plateGridSize, bounds);
        
        // Apply minimal gravity - plate forces should dominate completely
        this.ay += 2; // Minimal gravity to prevent floating
        
        // Add anti-settling force to prevent bottom accumulation
        const plateHeight = bounds.bottom - bounds.top;
        const normalizedY = (this.y - bounds.top) / plateHeight;
        if (normalizedY > 0.7) { // In bottom 30% of plate
            // Apply upward force proportional to how close to bottom
            const bottomForce = (normalizedY - 0.7) / 0.3; // 0-1 scale
            this.ay -= bottomForce * 15; // Upward anti-settling force
        }
        
        // Update velocity
        this.vx += this.ax * deltaTime;
        this.vy += this.ay * deltaTime;
        
        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Boundary constraints (plate edges)
        this.constrainToBounds(bounds);
        
        // Reset acceleration for next frame
        this.ax = 0;
        this.ay = 0;
        
        // Update settling state
        this.updateSettlingState(deltaTime);
        
        // Update visual properties based on motion
        this.updateVisualProperties();
    }
    
    applyVibrationForces(plateNodes, plateGridSize, plateBounds) {
        if (!plateNodes) return;
        
        // Find which plate node this grain is closest to
        const normalizedX = (this.x - plateBounds.left) / (plateBounds.right - plateBounds.left);
        const normalizedY = (this.y - plateBounds.top) / (plateBounds.bottom - plateBounds.top);
        
        const gridX = Math.floor(normalizedX * (plateGridSize - 1));
        const gridY = Math.floor(normalizedY * (plateGridSize - 1));
        
        // Clamp to valid grid bounds
        const clampedX = Math.max(0, Math.min(plateGridSize - 1, gridX));
        const clampedY = Math.max(0, Math.min(plateGridSize - 1, gridY));
        
        // Get the plate node at this position
        if (plateNodes[clampedY] && plateNodes[clampedY][clampedX]) {
            const plateNode = plateNodes[clampedY][clampedX];
            
            // Calculate forces from plate acceleration and velocity
            const plateAccel = plateNode.az || 0;
            const plateVel = plateNode.vz || 0;
            const plateDisp = plateNode.z || 0;
            
            // Sand grains experience stronger forces from plate movement
            // Acceleration of plate translates to force on grain
            this.ax += plateAccel * this.mass * 0.5; // Increased sensitivity
            this.ay += plateAccel * this.mass * 0.5;
            
            // Also add gradient forces - grains slide toward areas of lower displacement
            // Calculate gradient by sampling nearby plate nodes
            let gradientX = 0;
            let gradientY = 0;
            
            // Sample neighbors to calculate slope
            if (clampedX > 0 && plateNodes[clampedY][clampedX - 1]) {
                gradientX += plateDisp - plateNodes[clampedY][clampedX - 1].z;
            }
            if (clampedX < plateGridSize - 1 && plateNodes[clampedY][clampedX + 1]) {
                gradientX += plateNodes[clampedY][clampedX + 1].z - plateDisp;
            }
            if (clampedY > 0 && plateNodes[clampedY - 1][clampedX]) {
                gradientY += plateDisp - plateNodes[clampedY - 1][clampedX].z;
            }
            if (clampedY < plateGridSize - 1 && plateNodes[clampedY + 1][clampedX]) {
                gradientY += plateNodes[clampedY + 1][clampedX].z - plateDisp;
            }
            
            // Apply very strong gradient forces to maintain pattern formation
            const gradientStrength = 400; // Much stronger to counter settling
            this.ax += gradientX * gradientStrength;
            this.ay += gradientY * gradientStrength;
            
            // Realistic Chladni behavior - grains seek areas of minimal vibration (nodal lines)
            const plateActivity = Math.abs(plateAccel) + Math.abs(plateVel) * 0.1;
            
            // Find nearby areas with less activity to move toward (nodal line seeking)
            this.seekNodalLines(plateNodes, plateGridSize, plateBounds, plateActivity);
            
            if (plateActivity < 5 && this.settled) {
                // Grains are settled in low-activity areas
            } else if (plateActivity > 20) {
                this.settled = false;
                this.settleTime = 0;
            }
        }
    }
    
    seekNodalLines(plateNodes, plateGridSize, plateBounds, currentActivity) {
        // Sample nearby areas to find directions toward lower activity (nodal lines)
        const sampleRadius = 3; // How far to look for quieter areas
        const seekingStrength = 30; // How strongly to seek nodal lines
        
        // Current position in grid coordinates
        const normalizedX = (this.x - plateBounds.left) / (plateBounds.right - plateBounds.left);
        const normalizedY = (this.y - plateBounds.top) / (plateBounds.bottom - plateBounds.top);
        const gridX = Math.floor(normalizedX * (plateGridSize - 1));
        const gridY = Math.floor(normalizedY * (plateGridSize - 1));
        
        let bestDirection = { x: 0, y: 0 };
        let lowestActivity = currentActivity;
        
        // Sample in a circle around current position
        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
                const testX = gridX + dx;
                const testY = gridY + dy;
                
                // Skip if out of bounds or current position
                if (testX < 0 || testX >= plateGridSize || testY < 0 || testY >= plateGridSize || (dx === 0 && dy === 0)) {
                    continue;
                }
                
                const testNode = plateNodes[testY][testX];
                if (testNode) {
                    const testActivity = Math.abs(testNode.az || 0) + Math.abs(testNode.vz || 0) * 0.1;
                    
                    // If this area is much quieter, move toward it
                    if (testActivity < lowestActivity * 0.7) { // Must be significantly quieter
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance > 0) {
                            const strength = (lowestActivity - testActivity) / distance;
                            bestDirection.x += (dx / distance) * strength;
                            bestDirection.y += (dy / distance) * strength;
                            lowestActivity = Math.min(lowestActivity, testActivity);
                        }
                    }
                }
            }
        }
        
        // Apply the nodal-seeking force
        this.ax += bestDirection.x * seekingStrength;
        this.ay += bestDirection.y * seekingStrength;
    }
    
    calculateFrequencyMatch(dominantFreq) {
        if (!dominantFreq) return 0;
        
        const freqDiff = Math.abs(dominantFreq - this.resonanceFreq);
        const maxDiff = 200; // Maximum frequency difference for resonance
        return Math.max(0, 1 - (freqDiff / maxDiff));
    }
    
    constrainToBounds(bounds) {
        const margin = this.size;
        
        // Bounce off boundaries with energy loss
        if (this.x <= bounds.left + margin) {
            this.x = bounds.left + margin;
            this.vx *= -this.restitution;
        }
        if (this.x >= bounds.right - margin) {
            this.x = bounds.right - margin;
            this.vx *= -this.restitution;
        }
        if (this.y <= bounds.top + margin) {
            this.y = bounds.top + margin;
            this.vy *= -this.restitution;
        }
        if (this.y >= bounds.bottom - margin) {
            this.y = bounds.bottom - margin;
            this.vy *= -this.restitution;
        }
    }
    
    updateSettlingState(deltaTime) {
        const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
        const settleThreshold = 10; // Speed below which grain is considered settled
        
        if (speed < settleThreshold) {
            this.settleTime += deltaTime;
            if (this.settleTime > 0.5) { // Settled for half a second
                this.settled = true;
            }
        } else {
            this.settleTime = 0;
            this.settled = false;
        }
    }
    
    updateVisualProperties() {
        const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
        const maxSpeed = 200;
        const normalizedSpeed = Math.min(speed / maxSpeed, 1);
        
        // Color becomes brighter when moving fast
        const brightness = this.settled ? 0.7 : 0.7 + normalizedSpeed * 0.3;
        this.alpha = brightness;
        
        // Size varies slightly with movement
        this.size = (1 + Math.random() * 2) * (1 + normalizedSpeed * 0.2);
    }
    
    // Handle collision with another grain
    collideWith(otherGrain) {
        const dx = otherGrain.x - this.x;
        const dy = otherGrain.y - this.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        const minDistance = this.size + otherGrain.size;
        
        if (distance < minDistance && distance > 0) {
            // Normalize collision vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Separate grains
            const overlap = minDistance - distance;
            const separation = overlap * 0.5;
            
            this.x -= nx * separation;
            this.y -= ny * separation;
            otherGrain.x += nx * separation;
            otherGrain.y += ny * separation;
            
            // Exchange velocities (simplified collision response)
            const relativeVelX = this.vx - otherGrain.vx;
            const relativeVelY = this.vy - otherGrain.vy;
            const impulse = (relativeVelX * nx + relativeVelY * ny) * 0.5;
            
            this.vx -= impulse * nx;
            this.vy -= impulse * ny;
            otherGrain.vx += impulse * nx;
            otherGrain.vy += impulse * ny;
            
            // Both grains become unsettled
            this.settled = false;
            this.settleTime = 0;
            otherGrain.settled = false;
            otherGrain.settleTime = 0;
        }
    }
    
    draw(context, audioInfluence = {}) {
        context.save();
        context.globalAlpha = this.alpha;
        context.fillStyle = this.color;
        
        // Draw grain as a small circle
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
        
        // Add slight glow for moving grains
        if (!this.settled) {
            const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
            if (speed > 20) {
                context.globalAlpha = 0.3;
                context.beginPath();
                context.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
                context.fill();
            }
        }
        
        context.restore();
    }
}