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
        
        // Initialize audio player
        await this.audioPlayer.initialize();
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
            // For demo purposes, you can add audio file loading here
            // await this.audioPlayer.loadAudio('../audio/your-audio-file.wav');
            this.audioPlayer.play();
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
            height
        );
        
        this.simulation.start();
    }

    // Method to integrate audio data with visualization
    updateVisualizationWithAudio() {
        const frequencyData = this.audioPlayer.getFrequencyData();
        if (frequencyData && this.simulation) {
            // You can modify the simulation based on audio data
            // For example, affect node sizes or colors based on frequency
            const avgFrequency = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
            
            // This is where you can implement audio-reactive features
            // Example: modify node behavior based on audio amplitude
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MediaVisualizer();
});