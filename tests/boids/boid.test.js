import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Boid } from '../../src/js/boids/boid.js';

describe('Boid', () => {
    let boid;
    let otherBoids;

    beforeEach(() => {
        boid = new Boid(1, 100, 200, '#FF0000');
        otherBoids = [
            new Boid(2, 120, 220, '#00FF00'),
            new Boid(3, 150, 250, '#0000FF')
        ];
    });

    it('should initialize with correct boid-specific properties', () => {
        expect(boid.id).toBe(1);
        expect(boid.baseColor).toBe('#FF0000');
        expect(boid.health).toBe(100);
        expect(boid.maxHealth).toBe(100);
        expect(boid.isDead).toBe(false);
        expect(boid.maxSpeed).toBe(300.0);
        expect(boid.maxForce).toBe(10.0);
        expect(boid.separationRadius).toBe(80);
        expect(boid.alignmentRadius).toBe(150);
        expect(boid.cohesionRadius).toBe(150);
        expect(Array.isArray(boid.trail)).toBe(true);
        expect(boid.velocity).toHaveProperty('x');
        expect(boid.velocity).toHaveProperty('y');
    });

    it('should update position and physics correctly', () => {
        const initialX = boid.x;
        const initialY = boid.y;
        
        boid.velocity.x = 10;
        boid.velocity.y = 5;
        
        boid.update(1, 800, 600, {});
        
        expect(boid.x).not.toBe(initialX);
        expect(boid.y).not.toBe(initialY);
    });

    it('should apply flocking forces', () => {
        const initialAccelX = boid.acceleration.x;
        const initialAccelY = boid.acceleration.y;
        
        boid.flock(otherBoids, {}, 800, 600);
        
        // Acceleration should change due to flocking forces
        expect(boid.acceleration.x).not.toBe(initialAccelX);
        expect(boid.acceleration.y).not.toBe(initialAccelY);
    });

    it('should calculate separation force', () => {
        // Place a boid very close to trigger separation
        const closeBoid = new Boid(4, 105, 205, '#FFFF00');
        const separationForce = boid.separate([closeBoid]);
        
        expect(typeof separationForce.x).toBe('number');
        expect(typeof separationForce.y).toBe('number');
    });

    it('should calculate alignment force', () => {
        otherBoids[0].velocity.x = 20;
        otherBoids[0].velocity.y = 10;
        
        const alignmentForce = boid.align(otherBoids);
        
        expect(typeof alignmentForce.x).toBe('number');
        expect(typeof alignmentForce.y).toBe('number');
    });

    it('should calculate cohesion force', () => {
        const cohesionForce = boid.cohesion(otherBoids);
        
        expect(typeof cohesionForce.x).toBe('number');
        expect(typeof cohesionForce.y).toBe('number');
    });

    it('should take damage and die when health reaches zero', () => {
        expect(boid.isDead).toBe(false);
        
        const explosionCallback = vi.fn();
        boid.takeDamage(150, explosionCallback); // More than max health
        
        expect(boid.isDead).toBe(true);
        expect(boid.health).toBe(0);
        expect(explosionCallback).toHaveBeenCalledWith(boid.x, boid.y, boid.baseColor);
    });

    it('should respawn after death timer', () => {
        boid.die();
        expect(boid.isDead).toBe(true);
        
        // Simulate time passing
        boid.respawnTimer = 0;
        boid.handleRespawn(1);
        
        expect(boid.isDead).toBe(false);
        expect(boid.health).toBe(boid.maxHealth);
    });

    it('should update trail correctly', () => {
        const initialTrailLength = boid.trail.length;
        
        boid.updateTrail();
        
        expect(boid.trail.length).toBe(initialTrailLength + 1);
        expect(boid.trail[boid.trail.length - 1]).toEqual({ x: boid.x, y: boid.y });
    });

    it('should apply audio effects correctly', () => {
        const audioInfluence = {
            bass: 0.5,
            mid: 0.3,
            treble: 0.2,
            beatIntensity: 0.1
        };
        
        const originalSize = boid.size;
        boid.applyAudioEffects(audioInfluence);
        
        expect(boid.size).toBeGreaterThan(originalSize);
    });

    it('should interpolate colors correctly', () => {
        const color1 = '#FF0000'; // Red
        const color2 = '#00FF00'; // Green
        const interpolated = boid.interpolateColor(color1, color2, 0.5);
        
        // Should be something between red and green
        expect(interpolated).toMatch(/^#[0-9A-F]{6}$/i);
        expect(interpolated).not.toBe(color1);
        expect(interpolated).not.toBe(color2);
    });

    it('should detect if close enough for arc', () => {
        const closeBoid = new Boid(5, 110, 210, '#FFFFFF');
        const farBoid = new Boid(6, 500, 500, '#000000');
        
        expect(boid.isCloseEnoughForArc(closeBoid, 50)).toBe(true);
        expect(boid.isCloseEnoughForArc(farBoid, 50)).toBe(false);
    });

    it('should get heading correctly', () => {
        boid.velocity.x = 1;
        boid.velocity.y = 0;
        
        const heading = boid.getHeading();
        expect(heading).toBe(0); // Pointing right
        
        boid.velocity.x = 0;
        boid.velocity.y = 1;
        
        const heading2 = boid.getHeading();
        expect(heading2).toBeCloseTo(Math.PI / 2); // Pointing down
    });
});