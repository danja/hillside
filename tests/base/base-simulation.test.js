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
    getFrequencyData: vi.fn(() => new Uint8Array(1024)),
    isPlaying: true
};

describe('BaseSimulation', () => {
    let simulation;

    beforeEach(() => {
        vi.clearAllMocks();
        simulation = new BaseSimulation(mockCanvas, mockContext, 800, 600, mockAudioPlayer);
    });

    it('should initialize with correct properties', () => {
        expect(simulation.canvas).toBe(mockCanvas);
        expect(simulation.context).toBe(mockContext);
        expect(simulation.width).toBe(800);
        expect(simulation.height).toBe(600);
        expect(simulation.audioPlayer).toBe(mockAudioPlayer);
        expect(simulation.running).toBe(false);
        expect(simulation.nodes).toEqual([]);
    });

    it('should start and stop correctly', () => {
        expect(simulation.running).toBe(false);
        
        simulation.start();
        expect(simulation.running).toBe(true);
        
        simulation.stop();
        expect(simulation.running).toBe(false);
    });

    it('should update audio influence correctly', () => {
        // Mock frequency data with some values
        const mockData = new Uint8Array(1024);
        mockData[0] = 255; // High bass
        mockData[500] = 128; // Medium mid
        mockData[1000] = 64; // Low treble
        
        mockAudioPlayer.getFrequencyData.mockReturnValue(mockData);
        
        simulation.updateAudioInfluence();
        
        expect(simulation.bassInfluence).toBeGreaterThan(0);
        expect(simulation.midInfluence).toBeGreaterThan(0);
        expect(simulation.trebleInfluence).toBeGreaterThan(0);
    });

    it('should setup frame correctly', () => {
        simulation.setupFrame();
        
        expect(mockContext.globalAlpha).toBe(1);
        expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('should handle resize correctly', () => {
        simulation.resize(1024, 768);
        
        expect(simulation.width).toBe(1024);
        expect(simulation.height).toBe(768);
    });

    it('should get delta time', () => {
        const deltaTime = simulation.getDeltaTime();
        expect(typeof deltaTime).toBe('number');
        expect(deltaTime).toBeGreaterThan(0);
    });

    it('should destroy cleanly', () => {
        simulation.start();
        expect(simulation.running).toBe(true);
        
        simulation.destroy();
        expect(simulation.running).toBe(false);
    });
});