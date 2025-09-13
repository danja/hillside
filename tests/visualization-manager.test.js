import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualizationManager } from '../src/js/visualization-manager.js';

// Mock DOM elements
const mockCanvas = {
    width: 800,
    height: 600,
    getContext: vi.fn(() => mockContext)
};

const mockContext = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    globalAlpha: 1
};

const mockBody = {
    offsetWidth: 800,
    offsetHeight: 600
};

const mockLoadingIndicator = {
    classList: {
        add: vi.fn(),
        remove: vi.fn()
    },
    style: { display: '' }
};

const mockLoadingProgress = {
    style: { width: '' }
};

const mockLoadingText = {
    textContent: ''
};

// Mock AudioPlayer
const mockAudioPlayer = {
    initialize: vi.fn(),
    loadAudio: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    isPlaying: false
};

// Mock global document
global.document = {
    getElementById: vi.fn((id) => {
        switch (id) {
            case 'c': return mockCanvas;
            case 'body': return mockBody;
            case 'loading-indicator': return mockLoadingIndicator;
            default: return null;
        }
    }),
    querySelector: vi.fn((selector) => {
        switch (selector) {
            case '.loading-progress': return mockLoadingProgress;
            case '.loading-text': return mockLoadingText;
            default: return null;
        }
    }),
    addEventListener: vi.fn()
};

// Mock imports
vi.mock('../src/js/media/audio-player.js', () => ({
    AudioPlayer: vi.fn(() => mockAudioPlayer)
}));

vi.mock('../src/js/utils/dom.js', () => ({
    getCanvasMousePosition: vi.fn(() => ({ x: 0, y: 0 })),
    resizeCanvas: vi.fn(() => ({ width: 800, height: 600 }))
}));

vi.mock('../src/js/cellular-automata/simulation.js', () => ({
    CellularAutomataSimulation: vi.fn(() => ({
        destroy: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        resize: vi.fn()
    }))
}));

vi.mock('../src/js/boids/simulation.js', () => ({
    BoidsSimulation: vi.fn(() => ({
        destroy: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        resize: vi.fn()
    }))
}));

describe('VisualizationManager', () => {
    let manager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new VisualizationManager();
    });

    it('should initialize with correct properties', () => {
        expect(manager.canvas).toBe(mockCanvas);
        expect(manager.context).toBe(mockContext);
        expect(manager.body).toBe(mockBody);
        expect(manager.currentType).toBe('hillside');
        expect(manager.audioFiles).toHaveProperty('hillside');
        expect(manager.audioFiles).toHaveProperty('roofs');
    });

    it('should have correct audio files mapping', () => {
        expect(manager.audioFiles.hillside).toBe('hillside.mp3');
        expect(manager.audioFiles.roofs).toBe('roofs.mp3');
    });

    it('should switch visualization successfully', async () => {
        mockAudioPlayer.loadAudio.mockResolvedValue(undefined);
        mockAudioPlayer.initialize.mockResolvedValue(undefined);

        await manager.switchVisualization('roofs');

        expect(manager.currentType).toBe('roofs');
        expect(mockAudioPlayer.stop).toHaveBeenCalled();
        expect(mockAudioPlayer.initialize).toHaveBeenCalled();
        expect(mockAudioPlayer.loadAudio).toHaveBeenCalledWith('roofs.mp3', expect.any(Function));
    });

    it('should handle audio loading progress', async () => {
        // Mock loadAudio to call progress callback with different values
        mockAudioPlayer.loadAudio.mockImplementation(async (file, callback) => {
            callback(0.5); // 50% progress
            callback(1.0); // 100% progress (final)
        });
        mockAudioPlayer.initialize.mockResolvedValue(undefined);

        await manager.switchVisualization('hillside');

        // Should end up at 100% after completion
        expect(mockLoadingProgress.style.width).toBe('100%');
        expect(mockLoadingText.textContent).toBe('Click anywhere or press SPACE to start');
    });

    it('should show click to start after audio loads', async () => {
        mockAudioPlayer.loadAudio.mockResolvedValue(undefined);
        mockAudioPlayer.initialize.mockResolvedValue(undefined);

        await manager.switchVisualization('roofs');

        expect(manager.audioLoaded).toBe(true);
        expect(manager.clickToStartShown).toBe(true);
        expect(mockLoadingText.textContent).toBe('Click anywhere or press SPACE to start');
    });

    it('should handle audio loading errors', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockAudioPlayer.initialize.mockResolvedValue(undefined);
        mockAudioPlayer.loadAudio.mockRejectedValue(new Error('Audio load failed'));

        await manager.switchVisualization('hillside');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Could not load audio file'),
            expect.any(Error)
        );
        expect(mockLoadingText.textContent).toBe('Audio load failed');

        consoleWarnSpy.mockRestore();
    });

    it('should start audio correctly', async () => {
        manager.clickToStartShown = true;
        mockAudioPlayer.play.mockResolvedValue(undefined);

        await manager.startAudio();

        expect(manager.clickToStartShown).toBe(false);
        expect(mockAudioPlayer.play).toHaveBeenCalled();
        expect(mockLoadingIndicator.classList.add).toHaveBeenCalledWith('loading-hidden');
    });

    it('should not start audio if click to start is not shown', async () => {
        manager.clickToStartShown = false;

        await manager.startAudio();

        expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('should toggle audio correctly', async () => {
        const mockVisualization = {
            start: vi.fn(),
            stop: vi.fn()
        };
        manager.currentVisualization = mockVisualization;

        // Test play when paused
        mockAudioPlayer.isPlaying = false;
        mockAudioPlayer.play.mockResolvedValue(undefined);

        await manager.toggleAudio();

        expect(mockAudioPlayer.play).toHaveBeenCalled();
        expect(mockVisualization.start).toHaveBeenCalled();

        // Test pause when playing
        mockAudioPlayer.isPlaying = true;
        mockAudioPlayer.pause.mockResolvedValue(undefined);

        await manager.toggleAudio();

        expect(mockAudioPlayer.pause).toHaveBeenCalled();
        expect(mockVisualization.stop).toHaveBeenCalled();
    });

    it('should handle resize correctly', () => {
        const mockVisualization = {
            resize: vi.fn()
        };
        manager.currentVisualization = mockVisualization;

        manager.resize();

        expect(mockVisualization.resize).toHaveBeenCalledWith(800, 600);
    });

    it('should show and hide loading indicator correctly', () => {
        manager.showLoadingIndicator();
        expect(mockLoadingIndicator.classList.remove).toHaveBeenCalledWith('loading-hidden');

        manager.hideLoadingIndicator();
        expect(mockLoadingIndicator.classList.add).toHaveBeenCalledWith('loading-hidden');
    });

    it('should update loading progress correctly', () => {
        manager.updateLoadingProgress(0.75);

        expect(mockLoadingProgress.style.width).toBe('75%');
        expect(mockLoadingText.textContent).toBe('Loading audio... 75%');
    });

    it('should not update loading progress when audio is already loaded', () => {
        manager.audioLoaded = true;
        const initialWidth = mockLoadingProgress.style.width;

        manager.updateLoadingProgress(0.5);

        expect(mockLoadingProgress.style.width).toBe(initialWidth);
    });

    it('should return current visualization type', () => {
        manager.currentType = 'roofs';
        expect(manager.getCurrentType()).toBe('roofs');
    });

    it('should destroy current visualization when switching', async () => {
        const mockCurrentVisualization = {
            destroy: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            resize: vi.fn()
        };
        manager.currentVisualization = mockCurrentVisualization;

        mockAudioPlayer.loadAudio.mockResolvedValue(undefined);
        mockAudioPlayer.initialize.mockResolvedValue(undefined);

        await manager.switchVisualization('hillside');

        expect(mockCurrentVisualization.destroy).toHaveBeenCalled();
    });

    it('should create correct simulation type', async () => {
        mockAudioPlayer.loadAudio.mockResolvedValue(undefined);
        mockAudioPlayer.initialize.mockResolvedValue(undefined);

        await manager.switchVisualization('hillside');
        expect(manager.currentVisualization).toBeDefined();

        await manager.switchVisualization('roofs');
        expect(manager.currentVisualization).toBeDefined();
    });

    it('should throw error for unknown visualization type', async () => {
        mockAudioPlayer.loadAudio.mockResolvedValue(undefined);
        mockAudioPlayer.initialize.mockResolvedValue(undefined);

        await expect(manager.switchVisualization('unknown')).rejects.toThrow('Unknown visualization type: unknown');
    });
});