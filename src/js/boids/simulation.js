import { BaseSimulation } from '../base/base-simulation.js';
import { Boid } from './boid.js';

export class BoidsSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);
        
        // Boids-specific parameters
        this.boidCount = width > 1024 ? 55 : 35; // Reduced by 1/3 for better performance
        this.electricArcDistance = 50;
        this.electricArcProbability = 0.15; // Base chance per frame when boids are close
        this.lastArcTime = 0;
        this.lastLongArcTime = 0;
        this.arcCooldown = 25; // Reduced for better responsiveness
        this.longArcCooldown = 10; // Very short cooldown for long-distance arcs
        
        // Electric arc visual properties
        this.activeArcs = [];
        this.arcDuration = 200; // Arc lasts 200ms
        
        // Explosion system
        this.explosions = [];
        this.explosionDuration = 500; // Explosion lasts 500ms
        
        // Color palette for boids
        this.boidColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ];
        
        this.initializeNodes();
    }

    initializeNodes() {
        this.nodes = [];
        
        for (let i = 0; i < this.boidCount; i++) {
            const color = this.boidColors[i % this.boidColors.length];
            const boid = new Boid(
                i,
                Math.random() * this.width,
                Math.random() * this.height,
                color
            );
            this.nodes.push(boid);
        }
    }

    draw() {
        const deltaTime = this.getDeltaTime();
        
        // Get audio influence for this frame
        const audioInfluence = {
            bass: this.bassInfluence,
            mid: this.midInfluence,
            treble: this.trebleInfluence,
            beatIntensity: this.beatIntensity
        };
        
        // Update all boids
        this.updateBoids(deltaTime, audioInfluence);
        
        // Check for electric arcs
        this.updateElectricArcs(deltaTime, audioInfluence);
        
        // Update explosions
        this.updateExplosions(deltaTime);
        
        // Render everything
        this.renderBoids();
        this.renderElectricArcs();
        this.renderExplosions();
    }

    updateBoids(deltaTime, audioInfluence) {
        // Update each boid's physics and behavior
        for (const boid of this.nodes) {
            // Apply flocking behavior
            boid.flock(this.nodes, audioInfluence, this.width, this.height);
            
            // Update position and physics
            boid.update(deltaTime, this.width, this.height, audioInfluence);
        }
    }

    updateElectricArcs(deltaTime, audioInfluence) {
        const currentTime = Date.now();
        
        // Update existing arcs (remove expired ones)
        this.activeArcs = this.activeArcs.filter(arc => {
            arc.timeRemaining -= deltaTime * 1000; // Convert to milliseconds
            return arc.timeRemaining > 0;
        });
        
        // Check if we can create new arcs
        if (currentTime - this.lastArcTime < this.arcCooldown) {
            return;
        }
        
        // Check for long-distance arcs on treble peaks first (separate cooldown)
        const trebleLevel = audioInfluence.treble || 0;
        
        // Debug: log treble levels occasionally
        if (Math.random() < 0.005) {
            console.log('Treble level:', trebleLevel.toFixed(3));
        }
        
        const isTreblePeak = trebleLevel > 0.5; // Lower threshold for treble peaks
        
        if (isTreblePeak && Math.random() < 0.1 && (currentTime - this.lastLongArcTime > this.longArcCooldown)) {
            // Create dramatic long-distance arc during audio peaks
            this.createLongDistanceArc(audioInfluence);
            this.lastLongArcTime = currentTime;
            this.lastArcTime = currentTime; // Also update regular arc timer
            return;
        }
        
        // Find pairs of boids that are close enough for regular arcing
        const liveBoids = this.nodes.filter(boid => !boid.isDead);
        
        for (let i = 0; i < liveBoids.length; i++) {
            for (let j = i + 1; j < liveBoids.length; j++) {
                const boid1 = liveBoids[i];
                const boid2 = liveBoids[j];
                
                if (boid1.isCloseEnoughForArc(boid2, this.electricArcDistance)) {
                    // Calculate arc probability (influenced by audio)
                    const bassBoost = 1 + (audioInfluence.bass || 0) * 2;
                    const beatBoost = audioInfluence.beatIntensity > 0 ? 3 : 1;
                    const arcChance = this.electricArcProbability * bassBoost * beatBoost;
                    
                    if (Math.random() < arcChance) {
                        this.createElectricArc(boid1, boid2, audioInfluence);
                        this.lastArcTime = currentTime;
                        
                        // Only create one arc per frame to avoid overwhelming effects
                        return;
                    }
                }
            }
        }
    }

    createElectricArc(boid1, boid2, audioInfluence) {
        // Determine which boid gets "zapped" (usually the smaller/weaker one)
        const victim = Math.random() < 0.5 ? boid1 : boid2;
        const source = victim === boid1 ? boid2 : boid1;
        
        // Create arc visual effect
        const arc = {
            source: { x: source.x, y: source.y },
            target: { x: victim.x, y: victim.y },
            timeRemaining: this.arcDuration,
            intensity: 0.5 + (audioInfluence.treble || 0) * 0.5,
            branches: this.generateArcBranches(source, victim)
        };
        
        this.activeArcs.push(arc);
        
        // Apply damage to the victim
        const damage = 20 + (audioInfluence.bass || 0) * 30; // Bass increases damage
        victim.takeDamage(damage, (x, y, color) => this.createExplosion(x, y, color));
        
        console.log(`Electric arc: Boid ${source.id} zapped Boid ${victim.id} for ${Math.round(damage)} damage`);
    }
    
    createLongDistanceArc(audioInfluence) {
        // Find two random boids regardless of distance for dramatic effect
        const liveBoids = this.nodes.filter(boid => !boid.isDead);
        if (liveBoids.length < 2) return;
        
        // Select two random boids
        const boid1 = liveBoids[Math.floor(Math.random() * liveBoids.length)];
        let boid2;
        do {
            boid2 = liveBoids[Math.floor(Math.random() * liveBoids.length)];
        } while (boid2 === boid1);
        
        // Create more dramatic arc with higher intensity
        const arc = {
            source: { x: boid1.x, y: boid1.y },
            target: { x: boid2.x, y: boid2.y },
            timeRemaining: this.arcDuration * 1.5, // Longer duration
            intensity: 0.8 + (audioInfluence.treble || 0) * 0.3, // Higher base intensity
            branches: this.generateLongDistanceBranches(boid1, boid2)
        };
        
        this.activeArcs.push(arc);
        
        // Higher damage for dramatic long-distance arcs
        const damage = 40 + (audioInfluence.bass || 0) * 50;
        const victim = Math.random() < 0.5 ? boid1 : boid2;
        victim.takeDamage(damage, (x, y, color) => this.createExplosion(x, y, color));
        
        console.log(`LONG-DISTANCE Electric arc: ${Math.round(boid1.distanceTo(boid2))}px distance, ${Math.round(damage)} damage`);
    }

    generateArcBranches(source, target) {
        const branches = [];
        const distance = source.distanceTo(target);
        const numBranches = Math.floor(distance / 8); // One branch every 8 pixels
        
        for (let i = 1; i < numBranches; i++) {
            const t = i / numBranches;
            const midX = source.x + (target.x - source.x) * t;
            const midY = source.y + (target.y - source.y) * t;
            
            // Add some random deviation to make the arc look natural
            const deviation = 8;
            const branchX = midX + (Math.random() - 0.5) * deviation;
            const branchY = midY + (Math.random() - 0.5) * deviation;
            
            branches.push({ x: branchX, y: branchY });
        }
        
        return branches;
    }
    
    generateLongDistanceBranches(source, target) {
        const branches = [];
        const distance = source.distanceTo(target);
        const numBranches = Math.floor(distance / 6); // More branches for dramatic effect
        
        for (let i = 1; i < numBranches; i++) {
            const t = i / numBranches;
            const midX = source.x + (target.x - source.x) * t;
            const midY = source.y + (target.y - source.y) * t;
            
            // More dramatic deviation for long-distance arcs
            const deviation = 20 + Math.sin(t * Math.PI * 3) * 15; // Wavy pattern
            const branchX = midX + (Math.random() - 0.5) * deviation;
            const branchY = midY + (Math.random() - 0.5) * deviation;
            
            branches.push({ x: branchX, y: branchY });
        }
        
        return branches;
    }

    renderBoids() {
        for (const boid of this.nodes) {
            if (boid.isDead) {
                // Render dead boids with low opacity
                this.context.globalAlpha = 0.2;
                this.renderDeadBoid(boid);
            } else {
                // Render living boids
                this.context.globalAlpha = boid.opacity;
                this.renderLivingBoid(boid);
            }
        }
        
        // Reset global alpha
        this.context.globalAlpha = 1.0 + (this.beatIntensity || 0);
    }

    renderLivingBoid(boid) {
        // Draw trail first (if any)
        if (boid.trail.length > 1) {
            this.context.strokeStyle = boid.color + '40'; // Semi-transparent
            this.context.lineWidth = 1;
            this.context.beginPath();
            
            for (let i = 0; i < boid.trail.length - 1; i++) {
                const alpha = i / boid.trail.length;
                this.context.globalAlpha = alpha * 0.5;
                
                if (i === 0) {
                    this.context.moveTo(boid.trail[i].x, boid.trail[i].y);
                } else {
                    this.context.lineTo(boid.trail[i].x, boid.trail[i].y);
                }
            }
            this.context.stroke();
        }
        
        // Reset alpha for boid body
        this.context.globalAlpha = boid.opacity;
        
        // Draw boid body as a triangle pointing in direction of movement
        const heading = boid.getHeading();
        const size = boid.size;
        
        this.context.save();
        this.context.translate(boid.x, boid.y);
        this.context.rotate(heading);
        
        // Draw triangle
        this.context.fillStyle = boid.color;
        this.context.beginPath();
        this.context.moveTo(size * 2, 0);
        this.context.lineTo(-size, -size);
        this.context.lineTo(-size, size);
        this.context.closePath();
        this.context.fill();
        
        // Draw a small circle at the center for visibility
        this.context.fillStyle = '#FFFFFF';
        this.context.beginPath();
        this.context.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        this.context.fill();
        
        this.context.restore();
        
        // Size increase based on damage is handled in boid.applyAudioEffects()
    }

    renderDeadBoid(boid) {
        // Draw a faded 'X' to represent dead boid
        this.context.strokeStyle = boid.color;
        this.context.lineWidth = 2;
        this.context.beginPath();
        
        const size = boid.size;
        this.context.moveTo(boid.x - size, boid.y - size);
        this.context.lineTo(boid.x + size, boid.y + size);
        this.context.moveTo(boid.x + size, boid.y - size);
        this.context.lineTo(boid.x - size, boid.y + size);
        
        this.context.stroke();
    }

    renderHealthBar(boid) {
        const barWidth = 20;
        const barHeight = 3;
        const barX = boid.x - barWidth / 2;
        const barY = boid.y - boid.size * 3;
        
        // Background
        this.context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.context.fillRect(barX, barY, barWidth, barHeight);
        
        // Health
        const healthPercent = boid.health / boid.maxHealth;
        const healthColor = healthPercent > 0.5 ? '#4ECDC4' : (healthPercent > 0.25 ? '#FFEAA7' : '#FF6B6B');
        
        this.context.fillStyle = healthColor;
        this.context.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    renderElectricArcs() {
        for (const arc of this.activeArcs) {
            const alpha = arc.timeRemaining / this.arcDuration;
            const intensity = arc.intensity * alpha;
            
            // Main arc line
            this.context.globalAlpha = intensity;
            this.context.strokeStyle = '#FFFFFF';
            this.context.lineWidth = 2 + intensity * 2;
            
            this.context.beginPath();
            this.context.moveTo(arc.source.x, arc.source.y);
            
            // Draw through branch points for a jagged look
            for (const branch of arc.branches) {
                this.context.lineTo(branch.x, branch.y);
            }
            
            this.context.lineTo(arc.target.x, arc.target.y);
            this.context.stroke();
            
            // Add a blue/electric glow effect
            this.context.globalAlpha = intensity * 0.5;
            this.context.strokeStyle = '#4ECDC4';
            this.context.lineWidth = 4 + intensity * 3;
            this.context.stroke();
            
            // Sparks at endpoints
            this.renderArcSparks(arc.source, intensity);
            this.renderArcSparks(arc.target, intensity);
        }
        
        // Reset global alpha
        this.context.globalAlpha = 1.0 + (this.beatIntensity || 0);
    }

    renderArcSparks(point, intensity) {
        this.context.fillStyle = '#FFFFFF';
        this.context.globalAlpha = intensity;
        
        for (let i = 0; i < 5; i++) {
            const sparkX = point.x + (Math.random() - 0.5) * 10;
            const sparkY = point.y + (Math.random() - 0.5) * 10;
            const sparkSize = Math.random() * 2 + 1;
            
            this.context.beginPath();
            this.context.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
            this.context.fill();
        }
    }

    // Override resize handler to update boid bounds
    onResize(width, height) {
        // Respawn dead boids within new bounds
        for (const boid of this.nodes) {
            if (boid.x > width || boid.y > height) {
                boid.x = Math.random() * width;
                boid.y = Math.random() * height;
            }
        }
    }

    createExplosion(x, y, color) {
        const explosion = {
            x: x,
            y: y,
            color: color,
            timeRemaining: this.explosionDuration,
            particles: []
        };
        
        // Create explosion particles
        for (let i = 0; i < 15; i++) {
            const angle = (Math.PI * 2 * i) / 15;
            const speed = 50 + Math.random() * 100;
            explosion.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                life: 1.0
            });
        }
        
        this.explosions.push(explosion);
    }
    
    updateExplosions(deltaTime) {
        this.explosions = this.explosions.filter(explosion => {
            explosion.timeRemaining -= deltaTime * 1000;
            
            // Update particles
            for (const particle of explosion.particles) {
                particle.x += particle.vx * deltaTime;
                particle.y += particle.vy * deltaTime;
                particle.life = explosion.timeRemaining / this.explosionDuration;
                particle.size *= 0.995; // Shrink particles over time
            }
            
            return explosion.timeRemaining > 0;
        });
    }
    
    renderExplosions() {
        for (const explosion of this.explosions) {
            for (const particle of explosion.particles) {
                this.context.globalAlpha = particle.life;
                this.context.fillStyle = explosion.color;
                this.context.beginPath();
                this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                this.context.fill();
            }
        }
        this.context.globalAlpha = 1.0;
    }

    // Get statistics for debugging
    getStats() {
        const liveBoids = this.nodes.filter(boid => !boid.isDead).length;
        const deadBoids = this.nodes.filter(boid => boid.isDead).length;
        
        return {
            totalBoids: this.nodes.length,
            liveBoids,
            deadBoids,
            activeArcs: this.activeArcs.length,
            explosions: this.explosions.length
        };
    }
}