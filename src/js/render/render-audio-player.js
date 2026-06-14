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
        this.audioBuffer = null;
        this.offlineAnalysis = null;
        this.analysisTime = null;
        this.analysisFrameRate = 60;
        this.offlineFrequencyData = null;
        this.offlineTimeDomainData = null;

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
        this.offlineFrequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.offlineTimeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
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

        const elementReady = new Promise((resolve, reject) => {
            this.audio.addEventListener('canplaythrough', () => resolve(), { once: true });
            this.audio.addEventListener('error', () => reject(this.audio.error), { once: true });
            this.audio.load();
        });
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Could not load audio for analysis: ${audioUrl}`);
        }
        const encodedAudio = await audioResponse.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(encodedAudio.slice(0));
        this.buildOfflineAnalysis();

        return elementReady;
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
        this.analysisTime = null;
    }

    getCaptureStream() {
        return this.mediaStreamDestination?.stream || new MediaStream();
    }

    getDuration() {
        if (Number.isFinite(this.audio?.duration)) {
            return this.audio.duration;
        }

        return Number.isFinite(this.audioBuffer?.duration) ? this.audioBuffer.duration : 0;
    }

    setAnalysisTime(seconds) {
        const duration = this.getDuration();
        this.analysisTime = Math.max(0, Math.min(seconds, duration || seconds));
        this.isPlaying = true;
    }

    getCurrentTime() {
        if (this.analysisTime !== null) {
            return this.analysisTime;
        }

        return this.audio ? this.audio.currentTime : 0;
    }

    getFrequencyData() {
        const offlineFrame = this.getOfflineFrame();
        if (offlineFrame && this.offlineFrequencyData) {
            this.fillOfflineFrequencyData(offlineFrame);
            return this.offlineFrequencyData;
        }

        if (!this.analyser || !this.frequencyData) return null;

        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    getTimeDomainData() {
        if (this.getOfflineFrame() && this.offlineTimeDomainData) {
            this.offlineTimeDomainData.fill(128);
            return this.offlineTimeDomainData;
        }

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
        const offlineFrame = this.getOfflineFrame();
        if (offlineFrame) return offlineFrame.bass;

        return this.getFrequencyRangeAverage(this.bassRange.start, this.bassRange.end) / 255;
    }

    getRawMidLevel() {
        const offlineFrame = this.getOfflineFrame();
        if (offlineFrame) return offlineFrame.mid;

        return this.getFrequencyRangeAverage(this.midRange.start, this.midRange.end) / 255;
    }

    getRawTrebleLevel() {
        const offlineFrame = this.getOfflineFrame();
        if (offlineFrame) return offlineFrame.treble;

        return this.getFrequencyRangeAverage(this.trebleRange.start, this.trebleRange.end) / 255;
    }

    getRawOverallLevel() {
        const offlineFrame = this.getOfflineFrame();
        if (offlineFrame) return offlineFrame.overall;

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
        const currentTime = this.getCurrentTime() * 1000;
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
        if (this.lastBeatTime === 0) {
            return 0;
        }

        const timeSinceLastBeat = (this.getCurrentTime() * 1000) - this.lastBeatTime;
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

    buildOfflineAnalysis() {
        if (!this.audioBuffer) return;

        const sampleRate = this.audioBuffer.sampleRate;
        const duration = this.audioBuffer.duration;
        const frameCount = Math.max(1, Math.ceil(duration * this.analysisFrameRate) + 1);
        const windowSize = Math.min(4096, Math.max(1024, Math.round(sampleRate * 0.055)));
        const channelCount = Math.min(this.audioBuffer.numberOfChannels, 2);
        const channels = Array.from({ length: channelCount }, (_, index) => this.audioBuffer.getChannelData(index));
        const rawFrames = [];
        const bassValues = [];
        const midValues = [];
        const trebleValues = [];
        const overallValues = [];
        const bassAlpha = this.getFilterAlpha(170, sampleRate);
        const midAlpha = this.getFilterAlpha(2400, sampleRate);

        for (let frame = 0; frame < frameCount; frame++) {
            const time = frame / this.analysisFrameRate;
            const center = Math.floor(time * sampleRate);
            const start = Math.max(0, Math.min(center - Math.floor(windowSize / 2), this.audioBuffer.length - windowSize));
            let bassFilter = 0;
            let midFilter = 0;
            let bassEnergy = 0;
            let midEnergy = 0;
            let trebleEnergy = 0;
            let overallEnergy = 0;

            for (let i = 0; i < windowSize; i++) {
                const sampleIndex = start + i;
                let sample = 0;
                for (const channel of channels) {
                    sample += channel[sampleIndex] || 0;
                }
                sample /= channelCount || 1;

                bassFilter += bassAlpha * (sample - bassFilter);
                midFilter += midAlpha * (sample - midFilter);

                const bassSample = bassFilter;
                const midSample = midFilter - bassFilter;
                const trebleSample = sample - midFilter;

                bassEnergy += bassSample * bassSample;
                midEnergy += midSample * midSample;
                trebleEnergy += trebleSample * trebleSample;
                overallEnergy += sample * sample;
            }

            const values = {
                time,
                bass: Math.sqrt(bassEnergy / windowSize),
                mid: Math.sqrt(midEnergy / windowSize),
                treble: Math.sqrt(trebleEnergy / windowSize),
                overall: Math.sqrt(overallEnergy / windowSize)
            };
            rawFrames.push(values);
            bassValues.push(values.bass);
            midValues.push(values.mid);
            trebleValues.push(values.treble);
            overallValues.push(values.overall);
        }

        const peaks = {
            bass: this.percentile(bassValues, 0.96),
            mid: this.percentile(midValues, 0.96),
            treble: this.percentile(trebleValues, 0.96),
            overall: this.percentile(overallValues, 0.96)
        };

        this.offlineAnalysis = rawFrames.map((frame) => ({
            time: frame.time,
            bass: this.normalizeOfflineLevel(frame.bass, peaks.bass),
            mid: this.normalizeOfflineLevel(frame.mid, peaks.mid),
            treble: this.normalizeOfflineLevel(frame.treble, peaks.treble),
            overall: this.normalizeOfflineLevel(frame.overall, peaks.overall)
        }));
    }

    getFilterAlpha(cutoff, sampleRate) {
        return 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    }

    percentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * percentile)));
        return sorted[index] || 1;
    }

    normalizeOfflineLevel(value, peak) {
        if (!Number.isFinite(value) || value <= 0) return 0;

        const normalized = value / Math.max(peak, 0.000001);
        return Math.max(0, Math.min(Math.pow(normalized, 0.72), 1));
    }

    getOfflineFrame() {
        if (this.analysisTime === null || !this.offlineAnalysis?.length) return null;

        const framePosition = this.analysisTime * this.analysisFrameRate;
        const frameIndex = Math.max(0, Math.min(Math.floor(framePosition), this.offlineAnalysis.length - 1));
        const nextIndex = Math.min(frameIndex + 1, this.offlineAnalysis.length - 1);
        const mix = framePosition - frameIndex;
        const current = this.offlineAnalysis[frameIndex];
        const next = this.offlineAnalysis[nextIndex];

        return {
            bass: this.lerp(current.bass, next.bass, mix),
            mid: this.lerp(current.mid, next.mid, mix),
            treble: this.lerp(current.treble, next.treble, mix),
            overall: this.lerp(current.overall, next.overall, mix)
        };
    }

    fillOfflineFrequencyData(frame) {
        this.offlineFrequencyData.fill(0);
        this.fillFrequencyRange(this.bassRange.start, this.bassRange.end, frame.bass);
        this.fillFrequencyRange(this.midRange.start, this.midRange.end, frame.mid);
        this.fillFrequencyRange(this.trebleRange.start, this.trebleRange.end, frame.treble);
        this.fillFrequencyRange(this.trebleRange.end, this.offlineFrequencyData.length, frame.overall * 0.35);
    }

    fillFrequencyRange(start, end, level) {
        const value = Math.round(Math.max(0, Math.min(level, 1)) * 255);
        const stop = Math.min(end, this.offlineFrequencyData.length);
        for (let i = start; i < stop; i++) {
            this.offlineFrequencyData[i] = value;
        }
    }

    lerp(a, b, mix) {
        return a + ((b - a) * mix);
    }
}
