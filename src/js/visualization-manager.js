import { CellularAutomataSimulation } from './cellular-automata/simulation.js';
import { BoidsSimulation } from './boids/simulation.js';
import { SandpileSimulation } from './sandpile/simulation.js';
import { CloudsSimulation } from './clouds/simulation.js';
import { AudioPlayer } from './media/audio-player.js';
import { getCanvasMousePosition, resizeCanvas } from './utils/dom.js';

export class VisualizationManager {
    constructor() {
        this.canvas = document.getElementById('c');
        this.context = this.canvas.getContext('2d');
        this.body = document.getElementById('body');
        this.audioPlayer = new AudioPlayer();
        this.mousePosition = { x: 0, y: 0 };
        
        // Current visualization state
        this.currentVisualization = null;
        this.currentType = 'hillside'; // Default to hillside
        
        // Loading UI elements
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.loadingProgress = document.querySelector('.loading-progress');
        this.loadingText = document.querySelector('.loading-text');
        
        // Audio loading state
        this.clickToStartShown = false;
        this.audioLoaded = false;
        
        // Audio files for each visualization
        this.audioFiles = {
            hillside: 'hillside_2025-08-26.mp3',
            roofs: 'roofs.mp3',
            road: 'fish-march.mp3',
            clouds: 'tecNO.mp3'
        };
        
        this.initialize();
    }

    async initialize() {
        this.setupEventListeners();
        this.resize();
        
        // Start with hillside visualization
        await this.switchVisualization('hillside');
    }

    async switchVisualization(type) {
        // Stop and cleanup current visualization
        if (this.currentVisualization) {
            this.currentVisualization.destroy();
            this.currentVisualization = null;
        }
        
        // Stop current audio
        this.audioPlayer.stop();
        this.audioLoaded = false;
        this.clickToStartShown = false;
        
        // Update current type
        this.currentType = type;
        
        // Show loading indicator
        this.showLoadingIndicator();
        
        // Initialize audio player
        await this.audioPlayer.initialize();
        
        try {
            // Load audio for the selected visualization
            const audioFile = this.audioFiles[type];
            await this.audioPlayer.loadAudio(audioFile, (progress) => {
                this.updateLoadingProgress(progress);
            });
            
            console.log(`Audio loaded successfully for ${type}`);
            this.audioLoaded = true;
            this.showClickToStart();
        } catch (error) {
            console.warn(`Could not load audio file for ${type}:`, error);
            this.loadingText.textContent = 'Audio load failed';
            setTimeout(() => this.hideLoadingIndicator(), 2000);
        }
        
        // Create the appropriate simulation
        this.createSimulation(type);
    }
    
    createSimulation(type) {
        const { width, height } = resizeCanvas(this.canvas, this.body);
        
        switch (type) {
            case 'hillside':
                this.currentVisualization = new CellularAutomataSimulation(
                    this.canvas, this.context, width, height, this.audioPlayer
                );
                break;
            case 'roofs':
                this.currentVisualization = new BoidsSimulation(
                    this.canvas, this.context, width, height, this.audioPlayer
                );
                break;
            case 'road':
                this.currentVisualization = new SandpileSimulation(
                    this.canvas, this.context, width, height, this.audioPlayer
                );
                break;
            case 'clouds':
                this.currentVisualization = new CloudsSimulation(
                    this.canvas, this.context, width, height, this.audioPlayer
                );
                break;
            default:
                throw new Error(`Unknown visualization type: ${type}`);
        }
        
        // Start the visualization (but audio won't play until user clicks)
        this.currentVisualization.start();
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

        // Keyboard controls for audio (only when audio has started)
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
            if (this.currentVisualization) {
                this.currentVisualization.stop();
            }
        } else {
            await this.audioPlayer.play();
            if (this.currentVisualization) {
                this.currentVisualization.start();
            }
        }
    }

    resize() {
        const { width, height } = resizeCanvas(this.canvas, this.body);
        if (this.currentVisualization) {
            this.currentVisualization.resize(width, height);
        }
    }

    // Loading indicator methods
    showLoadingIndicator() {
        this.loadingIndicator.classList.remove('loading-hidden');
    }

    hideLoadingIndicator() {
        this.loadingIndicator.classList.add('loading-hidden');
        setTimeout(() => {
            this.loadingIndicator.style.display = 'none';
        }, 400);
    }

    updateLoadingProgress(progress) {
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
            console.log(`Audio started after user interaction for ${this.currentType}`);
        } catch (error) {
            console.warn('Failed to start audio:', error);
        }
    }

    // Get current visualization type (for menu updates)
    getCurrentType() {
        return this.currentType;
    }
}