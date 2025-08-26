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
        
        // Initialize loading indicator
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.loadingProgress = document.querySelector('.loading-progress');
        this.loadingText = document.querySelector('.loading-text');
        
        this.clickToStartShown = false;
        this.audioLoaded = false;
        
        // Show loading indicator
        this.showLoadingIndicator();
        
        // Initialize and load audio with progress tracking
        await this.audioPlayer.initialize();
        try {
            await this.audioPlayer.loadAudio('hillside_2025-08-26.mp3', (progress) => {
                this.updateLoadingProgress(progress);
            });
            console.log('Audio loaded successfully');
            this.audioLoaded = true;
            // Wait for user interaction before starting audio
            this.showClickToStart();
        } catch (error) {
            console.warn('Could not load audio file:', error);
            this.loadingText.textContent = 'Audio load failed';
            setTimeout(() => this.hideLoadingIndicator(), 2000);
        }
    }

    showLoadingIndicator() {
        this.loadingIndicator.classList.remove('loading-hidden');
    }

    hideLoadingIndicator() {
        this.loadingIndicator.classList.add('loading-hidden');
        // Ensure indicator is fully hidden after transition
        setTimeout(() => {
            this.loadingIndicator.style.display = 'none';
        }, 400);
    }

    updateLoadingProgress(progress) {
        // Don't update progress if audio has already loaded
        if (this.audioLoaded) return;
        
        const percentage = Math.round(progress * 100);
        this.loadingProgress.style.width = `${percentage}%`;
        this.loadingText.textContent = `Loading audio... ${percentage}%`;
    }
    
    showClickToStart() {
        this.clickToStartShown = true;
        this.loadingIndicator.classList.remove('loading-hidden');
        this.loadingProgress.style.width = '100%';
        this.loadingText.textContent = 'Click anywhere or press SPACE to start';
    }
    
    async startAudio() {
        if (!this.clickToStartShown) return;
        
        this.clickToStartShown = false;
        this.hideLoadingIndicator();
        
        try {
            await this.audioPlayer.play();
            console.log('Audio started after user interaction');
        } catch (error) {
            console.warn('Failed to start audio:', error);
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
        
        // Click to start audio (required for browser autoplay policy)
        document.addEventListener('click', async (event) => {
            if (this.clickToStartShown) {
                await this.startAudio();
            }
        });
        
        // Spacebar to start audio (alternative to click)
        document.addEventListener('keydown', async (event) => {
            if (event.code === 'Space' && this.clickToStartShown) {
                event.preventDefault();
                await this.startAudio();
            }
        });
    }

    handleKeyPress(event) {
        // Only handle these keys after audio has started
        if (this.clickToStartShown) return;
        
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
            this.simulation.stop();
        } else {
            await this.audioPlayer.play();
            this.simulation.start();
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