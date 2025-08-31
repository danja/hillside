import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WireSimulation } from '../../src/js/wire/simulation.js';

// Mock canvas and context
const mockCanvas = {
    width: 800,
    height: 600
};

const mockContext = {
    clearRect: () => {},
    fillRect: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(800 * 600 * 4) }),
    putImageData: () => {},
    createRadialGradient: () => ({
        addColorStop: () => {}
    })
};

describe('WireSimulation', () => {
    let wireSimulation;
    let originalInnerWidth;

    beforeEach(() => {
        // Mock window.innerWidth for node count calculation
        originalInnerWidth = global.window?.innerWidth;
        Object.defineProperty(global, 'window', {
            value: { innerWidth: 800, innerHeight: 600 },
            configurable: true
        });
        wireSimulation = new WireSimulation(mockCanvas, mockContext, 800, 600);
    });
    
    afterEach(() => {
        // Restore original window if it existed
        if (originalInnerWidth !== undefined) {
            Object.defineProperty(global, 'window', {
                value: { innerWidth: originalInnerWidth },
                configurable: true
            });
        }
    });

    it('should create WireSimulation instance', () => {
        expect(wireSimulation).toBeDefined();
        expect(wireSimulation.nodes).toBeDefined();
        expect(wireSimulation.nodes.length).toBeGreaterThan(0);
    });

    it('should initialize with correct parameters', () => {
        expect(wireSimulation.baseAlpha).toBe(0.7);
        expect(wireSimulation.audioMultiplier).toBe(2.5);
        expect(wireSimulation.baseDensity).toBe(1.2);
        expect(wireSimulation.anaglyphOffset).toBe(6);
        expect(wireSimulation.shadowOffset).toBe(2);
        expect(wireSimulation.perspective).toBe(300);
    });

    it('should create nodes with grayscale colors', () => {
        const node = wireSimulation.nodes[0];
        expect(node).toBeDefined();
        expect(node.grayscale).toBeGreaterThanOrEqual(0);
        expect(node.grayscale).toBeLessThanOrEqual(1);
        expect(node.z).toBeDefined();
        expect(node.rotationX).toBeDefined();
        expect(node.rotationY).toBeDefined();
        expect(node.rotationZ).toBeDefined();
    });

    it('should have proper node count for different screen sizes', () => {
        // Check that nodes were created (count should be either 200 or 400)
        expect(wireSimulation.nodes.length).toBeGreaterThan(0);
        expect([200, 400]).toContain(wireSimulation.nodes.length);
    });

    it('should calculate time density correctly', () => {
        const density = wireSimulation.getTimeDensity();
        expect(density).toBeGreaterThan(0);
        expect(typeof density).toBe('number');
    });

    it('should have proper 3D force system setup', () => {
        expect(wireSimulation.centerX).toBeDefined();
        expect(wireSimulation.centerY).toBeDefined();
        expect(wireSimulation.centerZ).toBeDefined();
        expect(wireSimulation.centerForceStrength).toBeDefined();
        expect(wireSimulation.attractionStrength).toBeDefined();
        expect(wireSimulation.repulsionStrength).toBeDefined();
    });

    it('should handle node updates', () => {
        const initialSize = wireSimulation.nodes[0].size;
        wireSimulation.updateNodesWithAudio();
        
        // Size should decay slightly
        expect(wireSimulation.nodes[0].size).toBeLessThanOrEqual(initialSize);
    });

    it('should have nodes with different sizes', () => {
        const sizes = wireSimulation.nodes.slice(0, 10).map(node => node.size);
        const uniqueSizes = new Set(sizes);
        
        // Should have multiple different sizes (not all the same)
        expect(uniqueSizes.size).toBeGreaterThan(1);
        
        // Sizes should be in expected range
        expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(100);
    });

    it('should have size divergence system properties', () => {
        expect(wireSimulation.lastDivergenceTime).toBeDefined();
        expect(wireSimulation.divergenceInterval).toBe(3000);
        expect(wireSimulation.audioEnergyHistory).toBeDefined();
        expect(wireSimulation.audioEnergyThreshold).toBe(0.4);
    });

    it('should detect when sizes need divergence', () => {
        // Force all nodes to have similar sizes to test convergence detection
        for (const node of wireSimulation.nodes) {
            node.size = 10 + Math.random() * 2; // Very narrow range: 10-12
        }
        
        const shouldForce = wireSimulation.shouldForceDivergence();
        expect(shouldForce).toBe(true);
    });
});