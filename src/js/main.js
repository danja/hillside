import { CellularAutomataSimulation } from './cellular-automata/simulation.js';
import { AudioPlayer } from './media/audio-player.js';
import { getCanvasMousePosition, resizeCanvas } from './utils/dom.js';

class MediaVisualizer {
    constructor() {
        this.canvas = document.getElementById('c');
        this.context = this.canvas.getContext('2d');
        this.body = document.getElementById('body');
        this.simulation = null;
        this.audioPlayer = new AudioPlayer();
        this.mousePosition = { x: 0, y: 0 };
        
        this.initialize();
    }

    async initialize() {
        this.setupEventListeners();
        this.resize();
        this.startSimulation();
        
        // Initialize and load audio
        await this.audioPlayer.initialize();
        try {
            await this.audioPlayer.loadAudio('./hillside_2025-08-26.wav');
            console.log('Audio loaded successfully');
        } catch (error) {
            console.warn('Could not load audio file:', error);
        }
    }

    setupEventListeners() {
        // Mouse movement tracking
        document.addEventListener('mousemove', (event) => {
            this.mousePosition = getCanvasMousePosition(this.canvas, event);
        });

        // Window resize handling
        window.addEventListener('resize', () => {
            this.resize();
        }, false);

        // Keyboard controls for audio
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event);
        });
    }

    handleKeyPress(event) {
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.toggleAudio();
                break;
            case 'KeyS':
                event.preventDefault();
                this.audioPlayer.stop();
                break;
        }
    }

    async toggleAudio() {
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.pause();
        } else {
            await this.audioPlayer.play();
        }
    }

    resize() {
        const { width, height } = resizeCanvas(this.canvas, this.body);
        
        if (this.simulation) {
            this.simulation.resize(width, height);
        }
    }

    startSimulation() {
        const { width, height } = resizeCanvas(this.canvas, this.body);
        
        this.simulation = new CellularAutomataSimulation(
            this.canvas,
            this.context,
            width,
            height,
            this.audioPlayer  // Pass audio player to simulation
        );
        
        this.simulation.start();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaVisualizer = new MediaVisualizer();
    console.log('MediaVisualizer initialized:', window.mediaVisualizer);
});