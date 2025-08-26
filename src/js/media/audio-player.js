export class AudioPlayer {
    constructor() {
        this.audio = null;
        this.audioContext = null;
        this.analyser = null;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.isPlaying = false;
        this.source = null;
        
        // Audio analysis properties for visualization
        this.bassRange = { start: 0, end: 8 };
        this.midRange = { start: 8, end: 32 };
        this.trebleRange = { start: 32, end: 128 };
        
        // Beat detection properties (50-200 BPM range)
        this.beatHistory = [];
        this.beatThreshold = 1.2; // Multiplier for beat detection sensitivity
        this.lastBeatTime = 0;
        this.minBeatInterval = 300; // 200 BPM = 300ms minimum interval
        this.maxBeatInterval = 1200; // 50 BPM = 1200ms maximum interval
        this.beatDetected = false;
    }

    async initialize() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;  // Higher resolution for better analysis
            this.analyser.smoothingTimeConstant = 0.8;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
        }
    }

    async loadAudio(audioUrl, progressCallback = null) {
        await this.initialize();
        
        this.audio = new Audio(audioUrl);
        this.audio.crossOrigin = 'anonymous';
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        return new Promise((resolve, reject) => {
            // Track loading progress
            this.audio.addEventListener('progress', () => {
                if (this.audio.buffered.length > 0 && progressCallback) {
                    const buffered = this.audio.buffered.end(this.audio.buffered.length - 1);
                    const duration = this.audio.duration || 1;
                    const progress = Math.min(buffered / duration, 1);
                    progressCallback(progress);
                }
            });

            this.audio.addEventListener('loadedmetadata', () => {
                if (progressCallback) progressCallback(0.1); // At least show some progress
            });

            this.audio.addEventListener('canplaythrough', () => {
                if (progressCallback) progressCallback(1.0); // Complete
                resolve();
            });
            
            this.audio.addEventListener('error', reject);
            
            // Force load start
            this.audio.load();
        });
    }

    async play() {
        if (this.audio) {
            // Resume audio context if suspended (required by some browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            this.audio.play();
            this.isPlaying = true;
        }
    }

    pause() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
        }
    }

    // Enhanced audio analysis methods for visualization
    getFrequencyData() {
        if (this.analyser && this.frequencyData) {
            this.analyser.getByteFrequencyData(this.frequencyData);
            return this.frequencyData;
        }
        return null;
    }

    getTimeDomainData() {
        if (this.analyser && this.timeDomainData) {
            this.analyser.getByteTimeDomainData(this.timeDomainData);
            return this.timeDomainData;
        }
        return null;
    }

    // Get average amplitude for a frequency range
    getFrequencyRangeAverage(start, end) {
        const frequencyData = this.getFrequencyData();
        if (!frequencyData) return 0;
        
        let sum = 0;
        for (let i = start; i < Math.min(end, frequencyData.length); i++) {
            sum += frequencyData[i];
        }
        return sum / (end - start);
    }

    // Get bass frequencies (low frequencies)
    getBassLevel() {
        return this.getFrequencyRangeAverage(this.bassRange.start, this.bassRange.end) / 255;
    }

    // Get mid frequencies
    getMidLevel() {
        return this.getFrequencyRangeAverage(this.midRange.start, this.midRange.end) / 255;
    }

    // Get treble frequencies (high frequencies)
    getTrebleLevel() {
        return this.getFrequencyRangeAverage(this.trebleRange.start, this.trebleRange.end) / 255;
    }

    // Get overall volume/energy
    getOverallLevel() {
        const frequencyData = this.getFrequencyData();
        if (!frequencyData) return 0;
        
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }
        return sum / (frequencyData.length * 255);
    }

    // Simple beat detection using bass energy and timing constraints
    detectBeat() {
        const currentTime = Date.now();
        const bassLevel = this.getBassLevel();
        
        // Reset beat detection flag
        this.beatDetected = false;
        
        // Add current bass level to history (keep last 10 samples for average)
        this.beatHistory.push(bassLevel);
        if (this.beatHistory.length > 10) {
            this.beatHistory.shift();
        }
        
        // Calculate average of recent bass levels
        const averageBass = this.beatHistory.reduce((sum, level) => sum + level, 0) / this.beatHistory.length;
        
        // Detect beat if current bass exceeds threshold and timing constraints are met
        const timeSinceLastBeat = currentTime - this.lastBeatTime;
        if (bassLevel > averageBass * this.beatThreshold && 
            timeSinceLastBeat >= this.minBeatInterval && 
            timeSinceLastBeat <= this.maxBeatInterval) {
            this.beatDetected = true;
            this.lastBeatTime = currentTime;
        }
        
        return this.beatDetected;
    }
    
    // Get beat intensity for brightness pulsing (0-1 range)
    getBeatIntensity() {
        const timeSinceLastBeat = Date.now() - this.lastBeatTime;
        if (timeSinceLastBeat < 150) { // Beat pulse lasts 150ms
            // Exponential decay from beat moment
            return Math.exp(-timeSinceLastBeat / 50) * 1.0; // Max 1.0 additional brightness
        }
        return 0;
    }

    // Get audio analysis object for easy consumption by visualization
    getAudioAnalysis() {
        if (!this.isPlaying) return null;
        
        // Perform beat detection
        this.detectBeat();
        
        return {
            bass: this.getBassLevel(),
            mid: this.getMidLevel(),
            treble: this.getTrebleLevel(),
            overall: this.getOverallLevel(),
            beatDetected: this.beatDetected,
            beatIntensity: this.getBeatIntensity(),
            frequencyData: this.getFrequencyData(),
            timeDomainData: this.getTimeDomainData()
        };
    }
}