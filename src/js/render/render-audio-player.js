export class RenderAudioPlayer {
    constructor() {
        this.audio = null;
        this.audioContext = null;
        this.analyser = null;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.source = null;
        this.mediaStreamDestination = null;
        this.isPlaying = false;

        this.bassRange = { start: 0, end: 8 };
        this.midRange = { start: 8, end: 32 };
        this.trebleRange = { start: 32, end: 128 };

        this.beatHistory = [];
        this.beatThreshold = 1.2;
        this.lastBeatTime = 0;
        this.minBeatInterval = 300;
        this.maxBeatInterval = 1200;
        this.beatDetected = false;
    }

    async initialize() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.8;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
        this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
    }

    async loadAudio(audioUrl) {
        await this.initialize();

        this.audio = new Audio(audioUrl);
        this.audio.crossOrigin = 'anonymous';
        this.audio.preload = 'auto';
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.analyser.connect(this.mediaStreamDestination);

        return new Promise((resolve, reject) => {
            this.audio.addEventListener('canplaythrough', () => resolve(), { once: true });
            this.audio.addEventListener('error', () => reject(this.audio.error), { once: true });
            this.audio.load();
        });
    }

    async play() {
        if (!this.audio) return;

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        await this.audio.play();
        this.isPlaying = true;
    }

    pause() {
        if (!this.audio) return;

        this.audio.pause();
        this.isPlaying = false;
    }

    stop() {
        if (!this.audio) return;

        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
    }

    getCaptureStream() {
        return this.mediaStreamDestination?.stream || new MediaStream();
    }

    getDuration() {
        return Number.isFinite(this.audio?.duration) ? this.audio.duration : 0;
    }

    getFrequencyData() {
        if (!this.analyser || !this.frequencyData) return null;

        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    getTimeDomainData() {
        if (!this.analyser || !this.timeDomainData) return null;

        this.analyser.getByteTimeDomainData(this.timeDomainData);
        return this.timeDomainData;
    }

    getFrequencyRangeAverage(start, end) {
        const frequencyData = this.getFrequencyData();
        if (!frequencyData) return 0;

        let sum = 0;
        const stop = Math.min(end, frequencyData.length);
        for (let i = start; i < stop; i++) {
            sum += frequencyData[i];
        }

        return sum / Math.max(stop - start, 1);
    }

    getBassLevel() {
        return this.getFrequencyRangeAverage(this.bassRange.start, this.bassRange.end) / 255;
    }

    getMidLevel() {
        return this.getFrequencyRangeAverage(this.midRange.start, this.midRange.end) / 255;
    }

    getTrebleLevel() {
        return this.getFrequencyRangeAverage(this.trebleRange.start, this.trebleRange.end) / 255;
    }

    getOverallLevel() {
        const frequencyData = this.getFrequencyData();
        if (!frequencyData) return 0;

        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }

        return sum / (frequencyData.length * 255);
    }

    detectBeat() {
        const currentTime = Date.now();
        const bassLevel = this.getBassLevel();
        this.beatDetected = false;

        this.beatHistory.push(bassLevel);
        if (this.beatHistory.length > 10) {
            this.beatHistory.shift();
        }

        const averageBass = this.beatHistory.reduce((sum, level) => sum + level, 0) / this.beatHistory.length;
        const timeSinceLastBeat = currentTime - this.lastBeatTime;

        if (
            bassLevel > averageBass * this.beatThreshold &&
            timeSinceLastBeat >= this.minBeatInterval &&
            timeSinceLastBeat <= this.maxBeatInterval
        ) {
            this.beatDetected = true;
            this.lastBeatTime = currentTime;
        }

        return this.beatDetected;
    }

    getBeatIntensity() {
        const timeSinceLastBeat = Date.now() - this.lastBeatTime;
        if (timeSinceLastBeat < 150) {
            return Math.exp(-timeSinceLastBeat / 50);
        }

        return 0;
    }

    getAudioAnalysis() {
        if (!this.isPlaying) return null;

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
