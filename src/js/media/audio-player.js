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

    async loadAudio(audioUrl) {
        await this.initialize();
        
        this.audio = new Audio(audioUrl);
        this.audio.crossOrigin = 'anonymous';
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        return new Promise((resolve, reject) => {
            this.audio.addEventListener('canplaythrough', resolve);
            this.audio.addEventListener('error', reject);
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

    // Get audio analysis object for easy consumption by visualization
    getAudioAnalysis() {
        if (!this.isPlaying) return null;
        
        return {
            bass: this.getBassLevel(),
            mid: this.getMidLevel(),
            treble: this.getTrebleLevel(),
            overall: this.getOverallLevel(),
            frequencyData: this.getFrequencyData(),
            timeDomainData: this.getTimeDomainData()
        };
    }
}