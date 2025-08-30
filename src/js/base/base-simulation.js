export class BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        this.canvas = canvas;
        this.context = context;
        this.width = width;
        this.height = height;
        this.audioPlayer = audioPlayer;
        this.nodes = [];
        this.rafId = null;
        this.counter = 0;
        
        // Common audio-reactive parameters
        this.bassInfluence = 0.0;
        this.midInfluence = 0.0;
        this.trebleInfluence = 0.0;
        this.beatIntensity = 0.0;
        
        // Time-based effects
        this.startTime = Date.now();
        this.lastFrameTime = Date.now();
    }

    // Audio influence update - common across all simulations
    updateAudioInfluence() {
        if (this.audioPlayer) {
            const audioAnalysis = this.audioPlayer.getAudioAnalysis();
            if (audioAnalysis) {
                this.bassInfluence = audioAnalysis.bass;
                this.midInfluence = audioAnalysis.mid;
                this.trebleInfluence = audioAnalysis.treble;
                this.beatIntensity = audioAnalysis.beatIntensity;
            }
        } else {
            this.beatIntensity = 0;
        }
    }

    // Calculate elapsed time since start
    getElapsedTime() {
        return (Date.now() - this.startTime) / 1000;
    }

    // Calculate delta time for frame-rate independent animation
    getDeltaTime() {
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        return deltaTime;
    }

    // Common animation setup - applies beat-driven brightness
    setupFrame() {
        this.updateAudioInfluence();
        
        // Draw black background first
        this.context.globalAlpha = 1.0;
        this.context.fillStyle = '#000';
        this.context.fillRect(0, 0, this.width, this.height);
        
        // Apply beat-driven brightness pulsing to visualization elements
        const baseBrightness = 1.0;
        const beatBrightness = this.beatIntensity || 0;
        this.context.globalAlpha = baseBrightness + beatBrightness;
    }

    // Animation frame method - should be overridden by subclasses
    animate() {
        this.rafId = requestAnimationFrame(() => this.animate());
        
        // Update frame counter
        this.counter++;
        
        // Base frame setup
        this.setupFrame();
        
        // Call the subclass-specific drawing method
        this.draw();
    }

    // Drawing method - must be overridden by subclasses
    draw() {
        throw new Error('draw() method must be implemented by subclass');
    }

    // Node initialization - should be overridden by subclasses
    initializeNodes() {
        throw new Error('initializeNodes() method must be implemented by subclass');
    }

    // Start the animation loop
    start() {
        if (!this.rafId) {
            this.animate();
        }
    }

    // Stop the animation loop
    stop() {
        if (this.rafId) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    // Cleanup method for when switching visualizations
    destroy() {
        this.stop();
        this.nodes = [];
        this.audioPlayer = null;
    }

    // Utility method to resize the simulation
    resize(width, height) {
        this.width = width;
        this.height = height;
        
        // Subclasses can override this to handle resize logic
        this.onResize(width, height);
    }

    // Resize handler - can be overridden by subclasses
    onResize(width, height) {
        // Override in subclasses if needed
    }

    // Common utility for drawing connections between nodes
    drawConnection(node1, node2, lineWidth = 1, opacity = 1) {
        this.context.lineWidth = lineWidth;
        this.context.globalAlpha *= opacity;
        this.context.beginPath();
        this.context.moveTo(node1.x, node1.y);
        this.context.lineTo(node2.x, node2.y);
        this.context.stroke();
    }

    // Common utility for drawing a node
    drawNode(node, radius = 2) {
        this.context.beginPath();
        this.context.fillStyle = node.color;
        this.context.arc(node.x, node.y, radius, 0, Math.PI * 2, true);
        this.context.closePath();
        this.context.fill();
    }
}