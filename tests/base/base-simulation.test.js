import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseSimulation } from '../../src/js/base/base-simulation.js';

// Mock canvas and context
const mockCanvas = {
    width: 800,
    height: 600
};

const mockContext = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    globalAlpha: 1
};

const mockAudioPlayer = {
    getAudioAnalysis: vi.fn(() => ({
        bass: 0.5,
        mid: 0.3,
        treble: 0.2,
        beatIntensity: 0.1
    })),
    isPlaying: true
};

// Create a concrete class for testing
class TestSimulation extends BaseSimulation {
    draw() {
        // Mock implementation for testing
    }
    
    initializeNodes() {
        // Mock implementation for testing
    }
}

describe('BaseSimulation', () => {
    let simulation;

    beforeEach(() => {
        vi.clearAllMocks();
        simulation = new TestSimulation(mockCanvas, mockContext, 800, 600, mockAudioPlayer);
    });

    it('should initialize with correct properties', () => {
        expect(simulation.canvas).toBe(mockCanvas);
        expect(simulation.context).toBe(mockContext);
        expect(simulation.width).toBe(800);
        expect(simulation.height).toBe(600);
        expect(simulation.audioPlayer).toBe(mockAudioPlayer);
        expect(simulation.rafId).toBeFalsy();
        expect(simulation.nodes).toEqual([]);
    });

    it('should start and stop correctly', () => {
        expect(simulation.rafId).toBeFalsy();
        
        simulation.start();
        expect(simulation.rafId).toBeTruthy();
        
        simulation.stop();
        expect(simulation.rafId).toBe(null);
    });

    it('should update audio influence correctly', () => {
        simulation.updateAudioInfluence();
        
        expect(simulation.bassInfluence).toBe(0.5);
        expect(simulation.midInfluence).toBe(0.3);
        expect(simulation.trebleInfluence).toBe(0.2);
        expect(simulation.beatIntensity).toBe(0.1);
    });

    it('should setup frame correctly', () => {
        simulation.setupFrame();
        
        expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
        // globalAlpha might be modified by beat intensity, so just check it's a number
        expect(typeof mockContext.globalAlpha).toBe('number');
        expect(mockContext.globalAlpha).toBeGreaterThan(0);
    });

    it('should handle resize correctly', () => {
        simulation.resize(1024, 768);
        
        expect(simulation.width).toBe(1024);
        expect(simulation.height).toBe(768);
    });

    it('should get delta time', async () => {
        // Wait a bit to ensure time difference
        await new Promise(resolve => setTimeout(resolve, 10));
        const deltaTime = simulation.getDeltaTime();
        expect(typeof deltaTime).toBe('number');
        expect(deltaTime).toBeGreaterThanOrEqual(0);
    });

    it('should destroy cleanly', () => {
        simulation.start();
        expect(simulation.rafId).toBeTruthy();
        
        simulation.destroy();
        expect(simulation.rafId).toBe(null);
        expect(simulation.nodes).toEqual([]);
        expect(simulation.audioPlayer).toBe(null);
    });
});