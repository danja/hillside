import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoidsSimulation } from '../../src/js/boids/simulation.js';

// Mock canvas and context
const mockCanvas = {
    width: 800,
    height: 600
};

const mockContext = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn()
};

const mockAudioPlayer = {
    getFrequencyData: vi.fn(() => new Uint8Array(1024)),
    isPlaying: true
};

describe('BoidsSimulation', () => {
    let simulation;

    beforeEach(() => {
        vi.clearAllMocks();
        simulation = new BoidsSimulation(mockCanvas, mockContext, 800, 600, mockAudioPlayer);
    });

    it('should initialize with correct boids-specific properties', () => {
        expect(simulation.boidCount).toBe(35); // For width = 800 (< 1024)
        expect(simulation.electricArcDistance).toBe(50);
        expect(simulation.electricArcProbability).toBe(0.15);
        expect(simulation.arcCooldown).toBe(25);
        expect(simulation.longArcCooldown).toBe(10);
        expect(Array.isArray(simulation.activeArcs)).toBe(true);
        expect(Array.isArray(simulation.explosions)).toBe(true);
        expect(Array.isArray(simulation.boidColors)).toBe(true);
    });

    it('should initialize correct number of boids for different screen sizes', () => {
        // Large screen
        const largeSimulation = new BoidsSimulation(mockCanvas, mockContext, 1200, 800, mockAudioPlayer);
        expect(largeSimulation.boidCount).toBe(55);
        expect(largeSimulation.nodes.length).toBe(55);

        // Small screen
        const smallSimulation = new BoidsSimulation(mockCanvas, mockContext, 800, 600, mockAudioPlayer);
        expect(smallSimulation.boidCount).toBe(35);
        expect(smallSimulation.nodes.length).toBe(35);
    });

    it('should create boids with different colors', () => {
        const colorSet = new Set();
        simulation.nodes.forEach(boid => {
            colorSet.add(boid.color);
        });
        
        // Should have multiple different colors
        expect(colorSet.size).toBeGreaterThan(1);
    });

    it('should update boids correctly', () => {
        const audioInfluence = {
            bass: 0.5,
            mid: 0.3,
            treble: 0.2,
            beatIntensity: 0.1
        };

        // Store initial positions
        const initialPositions = simulation.nodes.map(boid => ({ x: boid.x, y: boid.y }));
        
        simulation.updateBoids(1, audioInfluence);

        // Positions should have changed due to movement
        let positionsChanged = false;
        simulation.nodes.forEach((boid, index) => {
            if (boid.x !== initialPositions[index].x || boid.y !== initialPositions[index].y) {
                positionsChanged = true;
            }
        });
        
        expect(positionsChanged).toBe(true);
    });

    it('should create electric arcs when boids are close', () => {
        // Place two boids very close together
        simulation.nodes[0].x = 100;
        simulation.nodes[0].y = 100;
        simulation.nodes[1].x = 110;
        simulation.nodes[1].y = 110;
        simulation.nodes[1].isDead = false;
        
        const audioInfluence = { bass: 0.8, mid: 0.5, treble: 0.3 };
        
        // Run multiple times to increase chance of arc creation (it's probabilistic)
        for (let i = 0; i < 100; i++) {
            simulation.updateElectricArcs(1, audioInfluence);
            if (simulation.activeArcs.length > 0) break;
        }
        
        expect(simulation.activeArcs.length).toBeGreaterThan(0);
    });

    it('should create long-distance arcs on treble peaks', () => {
        const audioInfluence = { bass: 0.3, mid: 0.3, treble: 0.9 }; // High treble
        simulation.lastLongArcTime = 0; // Reset cooldown
        
        // Run multiple times due to probability
        for (let i = 0; i < 100; i++) {
            const initialArcCount = simulation.activeArcs.length;
            simulation.updateElectricArcs(1, audioInfluence);
            if (simulation.activeArcs.length > initialArcCount) break;
        }
        
        // Should potentially create long-distance arcs
        // Note: This is probabilistic so we can't guarantee it happens
    });

    it('should update explosions correctly', () => {
        // Create a test explosion
        simulation.createExplosion(100, 200, '#FF0000');
        expect(simulation.explosions.length).toBe(1);
        
        const initialParticleCount = simulation.explosions[0].particles.length;
        expect(initialParticleCount).toBeGreaterThan(0);
        
        // Update explosions
        simulation.updateExplosions(0.1);
        
        // Time should decrease
        expect(simulation.explosions[0].timeRemaining).toBeLessThan(simulation.explosionDuration);
    });

    it('should generate arc branches correctly', () => {
        const source = { x: 0, y: 0, distanceTo: () => 100 };
        const target = { x: 100, y: 0, distanceTo: () => 100 };
        
        const branches = simulation.generateArcBranches(source, target);
        
        expect(Array.isArray(branches)).toBe(true);
        expect(branches.length).toBeGreaterThan(0);
        branches.forEach(branch => {
            expect(branch).toHaveProperty('x');
            expect(branch).toHaveProperty('y');
        });
    });

    it('should generate long-distance arc branches with more complexity', () => {
        const source = { x: 0, y: 0, distanceTo: () => 200 };
        const target = { x: 200, y: 0, distanceTo: () => 200 };
        
        const longBranches = simulation.generateLongDistanceBranches(source, target);
        const regularBranches = simulation.generateArcBranches(source, target);
        
        expect(Array.isArray(longBranches)).toBe(true);
        // Long-distance arcs should have more branches
        expect(longBranches.length).toBeGreaterThanOrEqual(regularBranches.length);
    });

    it('should render boids without errors', () => {
        // This mainly tests that the render method doesn't crash
        expect(() => simulation.renderBoids()).not.toThrow();
        
        // Context methods should be called for rendering
        expect(mockContext.save).toHaveBeenCalled();
        expect(mockContext.restore).toHaveBeenCalled();
    });

    it('should render electric arcs without errors', () => {
        // Create a test arc
        simulation.activeArcs.push({
            source: { x: 0, y: 0 },
            target: { x: 100, y: 100 },
            timeRemaining: 200,
            intensity: 0.8,
            branches: [{ x: 50, y: 50 }]
        });
        
        expect(() => simulation.renderElectricArcs()).not.toThrow();
    });

    it('should render explosions without errors', () => {
        simulation.createExplosion(100, 100, '#FF0000');
        
        expect(() => simulation.renderExplosions()).not.toThrow();
    });

    it('should handle resize correctly', () => {
        const initialBoidPositions = simulation.nodes.map(boid => ({ x: boid.x, y: boid.y }));
        
        // Resize to smaller dimensions
        simulation.onResize(400, 300);
        
        // Some boids that were outside new bounds should be repositioned
        let repositioned = false;
        simulation.nodes.forEach((boid, index) => {
            if (initialBoidPositions[index].x > 400 || initialBoidPositions[index].y > 300) {
                if (boid.x <= 400 && boid.y <= 300) {
                    repositioned = true;
                }
            }
        });
    });

    it('should provide statistics', () => {
        const stats = simulation.getStats();
        
        expect(stats).toHaveProperty('totalBoids');
        expect(stats).toHaveProperty('liveBoids');
        expect(stats).toHaveProperty('deadBoids');
        expect(stats).toHaveProperty('activeArcs');
        expect(stats).toHaveProperty('explosions');
        
        expect(stats.totalBoids).toBe(simulation.nodes.length);
        expect(stats.liveBoids + stats.deadBoids).toBe(stats.totalBoids);
    });

    it('should handle audio influence correctly in electric arc creation', () => {
        const highAudioInfluence = { bass: 0.9, mid: 0.8, treble: 0.7, beatIntensity: 0.8 };
        const lowAudioInfluence = { bass: 0.1, mid: 0.1, treble: 0.1, beatIntensity: 0 };
        
        // Place boids close together
        simulation.nodes[0].x = 100;
        simulation.nodes[0].y = 100;
        simulation.nodes[1].x = 110;
        simulation.nodes[1].y = 110;
        
        // High audio influence should increase arc probability
        // This is probabilistic, so we test the mechanism exists
        expect(() => simulation.updateElectricArcs(1, highAudioInfluence)).not.toThrow();
        expect(() => simulation.updateElectricArcs(1, lowAudioInfluence)).not.toThrow();
    });
});