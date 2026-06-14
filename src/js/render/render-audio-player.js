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
        this.levelState = {
            bass: { average: 0, peak: 0 },
            mid: { average: 0, peak: 0 },
            treble: { average: 0, peak: 0 },
            overall: { average: 0, peak: 0 }
        };
    }

    async initialize() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.35;
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

        await this.resumeContext();

        await this.audio.play();
        this.isPlaying = true;
    }

    async resumeContext() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
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
        return this.getBoostedLevel('bass', this.getRawBassLevel());
    }

    getMidLevel() {
        return this.getBoostedLevel('mid', this.getRawMidLevel());
    }

    getTrebleLevel() {
        return this.getBoostedLevel('treble', this.getRawTrebleLevel());
    }

    getOverallLevel() {
        return this.getBoostedLevel('overall', this.getRawOverallLevel());
    }

    getRawBassLevel() {
        return this.getFrequencyRangeAverage(this.bassRange.start, this.bassRange.end) / 255;
    }

    getRawMidLevel() {
        return this.getFrequencyRangeAverage(this.midRange.start, this.midRange.end) / 255;
    }

    getRawTrebleLevel() {
        return this.getFrequencyRangeAverage(this.trebleRange.start, this.trebleRange.end) / 255;
    }

    getRawOverallLevel() {
        const frequencyData = this.getFrequencyData();
        if (!frequencyData) return 0;

        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
        }

        return sum / (frequencyData.length * 255);
    }

    getBoostedLevel(key, rawLevel) {
        const state = this.levelState[key];
        state.average = state.average === 0 ? rawLevel : (state.average * 0.94) + (rawLevel * 0.06);
        state.peak = Math.max(rawLevel, state.peak * 0.985);

        const transient = Math.max(0, rawLevel - state.average);
        const compressed = Math.pow(Math.max(rawLevel, 0), 0.78) * 0.56;
        const boosted = compressed + transient * 2.75;

        return Math.max(0, Math.min(boosted, 1));
    }

    detectBeat() {
        const currentTime = this.audio ? this.audio.currentTime * 1000 : Date.now();
        const bassLevel = this.getRawBassLevel();
        this.beatDetected = false;

        const averageBass = this.beatHistory.length > 0
            ? this.beatHistory.reduce((sum, level) => sum + level, 0) / this.beatHistory.length
            : bassLevel;
        const timeSinceLastBeat = currentTime - this.lastBeatTime;
        const hasTimingGap = this.lastBeatTime === 0 || timeSinceLastBeat >= this.minBeatInterval;
        const isBassTransient = bassLevel > averageBass * 1.08 && bassLevel - averageBass > 0.035;

        if (hasTimingGap && isBassTransient) {
            this.beatDetected = true;
            this.lastBeatTime = currentTime;
        }

        if (this.lastBeatTime !== 0 && timeSinceLastBeat > this.maxBeatInterval && bassLevel > averageBass + 0.02) {
            this.lastBeatTime = currentTime;
        }

        this.beatHistory.push(bassLevel);
        if (this.beatHistory.length > 24) {
            this.beatHistory.shift();
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
