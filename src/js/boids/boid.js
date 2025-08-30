import { BaseNode } from '../base/base-node.js';
import { clamp } from '../utils/math.js';

export class Boid extends BaseNode {
    constructor(id, x, y, color) {
        super(id, x, y, color);
        
        // Store original color for bass-reactive color changes
        this.baseColor = color;
        this.colorFlashTimer = 0;
        this.lastBassLevel = 0;
        
        // Boid-specific properties
        this.velocity = {
            x: (Math.random() - 0.5) * 200,  // Random velocity between -100 and 100
            y: (Math.random() - 0.5) * 200
        };
        
        this.acceleration = { x: 0, y: 0 };
        this.maxSpeed = 300.0;
        this.maxForce = 10.0;
        
        // Flocking parameters
        this.separationRadius = 80;
        this.alignmentRadius = 150;
        this.cohesionRadius = 150;
        
        // Health system for electric arcing
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.respawnTimer = 0;
        this.respawnDelay = 3000; // 3 seconds
        
        // Visual properties
        this.size = 3;
        this.opacity = 1.0;
        
        // Trail system for visual effect
        this.trail = [];
        this.maxTrailLength = 10;
    }

    update(deltaTime = 1, canvasWidth, canvasHeight, audioInfluence = {}) {
        if (this.isDead) {
            this.handleRespawn(deltaTime);
            return;
        }
        
        // Update physics
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;
        
        // Apply speed limit
        this.limitSpeed();
        
        // Update position
        this.x += this.velocity.x * deltaTime;
        this.y += this.velocity.y * deltaTime;
        
        // Wrap around screen edges
        this.wrapAroundBounds(canvasWidth, canvasHeight);
        
        // Reset acceleration
        this.acceleration.x = 0;
        this.acceleration.y = 0;
        
        // Update trail
        this.updateTrail();
        
        // Apply audio-reactive effects
        this.applyAudioEffects(audioInfluence);
    }

    // Core flocking behavior: separation - steer to avoid crowding local flockmates
    separate(boids) {
        const steer = { x: 0, y: 0 };
        let count = 0;
        
        for (const other of boids) {
            const d = this.distanceTo(other);
            
            if (d > 0 && d < this.separationRadius && !other.isDead) {
                // Calculate vector pointing away from neighbor
                const diff = {
                    x: this.x - other.x,
                    y: this.y - other.y
                };
                
                // Weight by distance (closer neighbors have more influence)
                const weight = 1.0 / d;
                diff.x *= weight;
                diff.y *= weight;
                
                steer.x += diff.x;
                steer.y += diff.y;
                count++;
            }
        }
        
        if (count > 0) {
            // Average the steering vectors
            steer.x /= count;
            steer.y /= count;
            
            // Normalize and apply max force
            this.normalize(steer);
            steer.x *= this.maxSpeed;
            steer.y *= this.maxSpeed;
            
            // Steering = desired - current velocity
            steer.x -= this.velocity.x;
            steer.y -= this.velocity.y;
            
            this.limit(steer, this.maxForce);
        }
        
        return steer;
    }

    // Core flocking behavior: alignment - steer towards average heading of neighbors
    align(boids) {
        const sum = { x: 0, y: 0 };
        let count = 0;
        
        for (const other of boids) {
            const d = this.distanceTo(other);
            
            if (d > 0 && d < this.alignmentRadius && !other.isDead) {
                sum.x += other.velocity.x;
                sum.y += other.velocity.y;
                count++;
            }
        }
        
        if (count > 0) {
            sum.x /= count;
            sum.y /= count;
            
            // Normalize and apply max speed
            this.normalize(sum);
            sum.x *= this.maxSpeed;
            sum.y *= this.maxSpeed;
            
            // Steering = desired - current velocity
            const steer = {
                x: sum.x - this.velocity.x,
                y: sum.y - this.velocity.y
            };
            
            this.limit(steer, this.maxForce);
            return steer;
        }
        
        return { x: 0, y: 0 };
    }

    // Core flocking behavior: cohesion - steer to move toward average position of neighbors
    cohesion(boids) {
        const sum = { x: 0, y: 0 };
        let count = 0;
        
        for (const other of boids) {
            const d = this.distanceTo(other);
            
            if (d > 0 && d < this.cohesionRadius && !other.isDead) {
                sum.x += other.x;
                sum.y += other.y;
                count++;
            }
        }
        
        if (count > 0) {
            sum.x /= count;
            sum.y /= count;
            
            // Seek towards the center
            return this.seek(sum.x, sum.y);
        }
        
        return { x: 0, y: 0 };
    }

    // Seek behavior - steer towards a target
    seek(targetX, targetY) {
        const desired = {
            x: targetX - this.x,
            y: targetY - this.y
        };
        
        // Normalize and scale to maximum speed
        this.normalize(desired);
        desired.x *= this.maxSpeed;
        desired.y *= this.maxSpeed;
        
        // Steering = desired - current velocity
        const steer = {
            x: desired.x - this.velocity.x,
            y: desired.y - this.velocity.y
        };
        
        this.limit(steer, this.maxForce);
        return steer;
    }

    // Apply flocking forces
    flock(boids, audioInfluence = {}, canvasWidth = 800, canvasHeight = 600) {
        // Calculate flocking forces
        const sep = this.separate(boids);
        const ali = this.align(boids);
        const coh = this.cohesion(boids);
        
        // Add center gravity
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const centerGravity = this.seek(centerX, centerY);
        
        // Apply audio-reactive weights
        const bassBoost = 1 + (audioInfluence.bass || 0) * 0.5;
        const midBoost = 1 + (audioInfluence.mid || 0) * 0.3;
        const trebleBoost = 1 + (audioInfluence.treble || 0) * 0.2;
        
        // Weight the forces (with audio reactivity)
        sep.x *= 3.0 * bassBoost;  // Stronger separation influenced by bass
        sep.y *= 3.0 * bassBoost;
        
        ali.x *= 2.0 * midBoost;   // Stronger alignment influenced by mid frequencies
        ali.y *= 2.0 * midBoost;
        
        coh.x *= 2.5 * trebleBoost; // Stronger cohesion influenced by treble
        coh.y *= 2.5 * trebleBoost;
        
        centerGravity.x *= 1.0;    // Stronger center gravity
        centerGravity.y *= 1.0;
        
        // Apply forces
        this.applyForce(sep);
        this.applyForce(ali);
        this.applyForce(coh);
        this.applyForce(centerGravity);
    }

    // Apply a force to the boid
    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    // Limit speed to maximum
    limitSpeed() {
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }
    }

    // Health and death system
    takeDamage(amount, explosionCallback = null) {
        if (this.isDead) return;
        
        this.health -= amount;
        this.health = Math.max(0, this.health);
        
        if (this.health <= 0) {
            this.die(explosionCallback);
        }
    }

    die(explosionCallback = null) {
        // Trigger explosion before marking as dead
        if (explosionCallback) {
            explosionCallback(this.x, this.y, this.color);
        }
        
        this.isDead = true;
        this.respawnTimer = this.respawnDelay;
        this.opacity = 0.1;
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    handleRespawn(deltaTime) {
        this.respawnTimer -= deltaTime * 1000; // Convert to milliseconds
        
        if (this.respawnTimer <= 0) {
            this.respawn();
        }
    }

    respawn() {
        this.isDead = false;
        this.health = this.maxHealth;
        this.opacity = 1.0;
        
        // Random respawn position
        this.x = Math.random() * 800; // Will be updated by simulation bounds
        this.y = Math.random() * 600;
        
        // Random initial velocity
        this.velocity.x = (Math.random() - 0.5) * 200;
        this.velocity.y = (Math.random() - 0.5) * 200;
        
        // Clear trail
        this.trail = [];
    }

    // Trail system for visual effects
    updateTrail() {
        this.trail.push({ x: this.x, y: this.y });
        
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
    }

    // Apply audio-reactive effects
    applyAudioEffects(audioInfluence) {
        // Size responds to overall audio level AND damage taken
        const baseSize = 3;
        const audioLevel = (audioInfluence.bass || 0) + (audioInfluence.mid || 0) + (audioInfluence.treble || 0);
        
        // Size increases as health decreases (damaged boids get bigger)
        const healthPercent = this.health / this.maxHealth;
        const damageMultiplier = 1 + (1 - healthPercent) * 2; // Up to 3x size when near death
        
        this.size = baseSize * (1 + audioLevel * 0.5) * damageMultiplier;
        
        // Color flash system - detect bass spikes instead of absolute levels
        const bassLevel = audioInfluence.bass || 0;
        
        // Detect sudden bass increases (spikes)
        const bassIncrease = bassLevel - this.lastBassLevel;
        this.lastBassLevel = bassLevel;
        
        // Debug: log values occasionally
        if (this.id === 0 && Math.random() < 0.01) {
            console.log('Bass:', bassLevel.toFixed(2), 'Increase:', bassIncrease.toFixed(3));
        }
        
        // Trigger flash on bass spikes (sudden increases)
        if (bassIncrease > 0.05) {
            this.colorFlashTimer = 200; // Flash for 200ms
        }
        
        // Update flash timer
        if (this.colorFlashTimer > 0) {
            this.colorFlashTimer -= 16; // Approximately 60fps
            const intensity = this.colorFlashTimer / 200; // Fade out
            this.color = this.interpolateColor(this.baseColor, '#FF4444', intensity * 0.6);
        } else {
            this.color = this.baseColor;
        }
        
        // Speed can be influenced by beat intensity
        if (audioInfluence.beatIntensity > 0) {
            const speedBoost = 1 + audioInfluence.beatIntensity * 2;
            this.maxSpeed = clamp(300.0 * speedBoost, 250.0, 500.0);
        } else {
            this.maxSpeed = 300.0;
        }
    }

    // Utility functions
    normalize(vector) {
        const mag = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (mag > 0) {
            vector.x /= mag;
            vector.y /= mag;
        }
    }

    limit(vector, max) {
        const mag = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (mag > max) {
            vector.x = (vector.x / mag) * max;
            vector.y = (vector.y / mag) * max;
        }
    }

    // Get current heading angle
    getHeading() {
        return Math.atan2(this.velocity.y, this.velocity.x);
    }

    // Check if this boid is too close to another for electric arc
    isCloseEnoughForArc(other, arcDistance = 15) {
        return !this.isDead && !other.isDead && this.distanceTo(other) < arcDistance;
    }
    
    // Interpolate between two colors
    interpolateColor(color1, color2, factor) {
        // Convert hex colors to RGB
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');
        
        const r1 = parseInt(hex1.substr(0, 2), 16);
        const g1 = parseInt(hex1.substr(2, 2), 16);
        const b1 = parseInt(hex1.substr(4, 2), 16);
        
        const r2 = parseInt(hex2.substr(0, 2), 16);
        const g2 = parseInt(hex2.substr(2, 2), 16);
        const b2 = parseInt(hex2.substr(4, 2), 16);
        
        // Interpolate
        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}