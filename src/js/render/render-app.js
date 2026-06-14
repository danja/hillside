import { CellularAutomataSimulation } from '../cellular-automata/simulation.js';
import { BoidsSimulation } from '../boids/simulation.js';
import { SandpileSimulation } from '../sandpile/simulation.js';
import { CloudsSimulation } from '../clouds/simulation.js';
import { WireSimulation } from '../wire/simulation.js';
import { MountainSimulation } from '../mountain/simulation.js';
import { RenderAudioPlayer } from './render-audio-player.js';

const VISUALIZATIONS = {
    hillside: { label: 'Hillside', audio: 'hillside.mp3', Simulation: CellularAutomataSimulation },
    roofs: { label: 'Roofs', audio: 'roofs.mp3', Simulation: BoidsSimulation },
    road: { label: 'Road', audio: 'fish-march.mp3', Simulation: SandpileSimulation },
    clouds: { label: 'Clouds', audio: 'tecNO.mp3', Simulation: CloudsSimulation },
    wire: { label: 'Wire', audio: 'wire.mp3', Simulation: WireSimulation },
    mountain: { label: 'Mountain', audio: 'mountain.mp3', Simulation: MountainSimulation }
};

const DEFAULT_RENDER_OPTIONS = {
    type: 'hillside',
    width: 1280,
    height: 720,
    fps: 30,
    duration: 0,
    filename: ''
};

class RenderApp {
    constructor() {
        this.canvas = document.getElementById('c');
        this.context = this.canvas.getContext('2d');
        this.statusElement = document.getElementById('render-status');
        this.simulation = null;
        this.audioPlayer = null;
        this.isRendering = false;
        this.animationTimers = null;
        this.activeVideoTrack = null;
    }

    async render(options = {}) {
        if (this.isRendering) {
            throw new Error('A render is already running.');
        }

        const renderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
        const config = VISUALIZATIONS[renderOptions.type];
        if (!config) {
            throw new Error(`Unknown visualization type: ${renderOptions.type}`);
        }

        this.isRendering = true;
        this.setStatus(`Loading ${config.label}`);

        try {
            this.prepareCanvas(renderOptions.width, renderOptions.height);
            if (!renderOptions.manualFrames) {
                this.installTimedAnimationLoop(renderOptions.fps);
            }

            this.audioPlayer = new RenderAudioPlayer();
            await this.audioPlayer.loadAudio(config.audio);

            this.simulation = new config.Simulation(
                this.canvas,
                this.context,
                this.canvas.width,
                this.canvas.height,
                this.audioPlayer
            );

            const recording = this.createRecorder(renderOptions);
            const done = this.waitForFinish(recording.recorder, renderOptions.duration);

            this.setStatus(`Recording ${config.label}`);
            recording.recorder.start(1000);
            this.simulation.start();
            await this.audioPlayer.play();

            await done;
            const blob = await recording.complete;
            this.downloadBlob(blob, this.getFilename(renderOptions, config));
            this.setStatus(`Finished ${config.label}`);

            return {
                filename: this.getFilename(renderOptions, config),
                duration: this.audioPlayer.getDuration(),
                size: blob.size,
                type: blob.type
            };
        } finally {
            this.cleanup();
            this.isRendering = false;
        }
    }

    async startPlayback(options = {}) {
        const playback = await this.preparePlayback(options);
        await this.beginPlayback();
        return playback;
    }

    async preparePlayback(options = {}) {
        if (this.isRendering) {
            throw new Error('A render is already running.');
        }

        const renderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
        const config = VISUALIZATIONS[renderOptions.type];
        if (!config) {
            throw new Error(`Unknown visualization type: ${renderOptions.type}`);
        }

        this.isRendering = true;
        this.setStatus(`Loading ${config.label}`);

        try {
            this.prepareCanvas(renderOptions.width, renderOptions.height);
            this.installTimedAnimationLoop(renderOptions.fps);

            this.audioPlayer = new RenderAudioPlayer();
            await this.audioPlayer.loadAudio(config.audio);

            this.simulation = new config.Simulation(
                this.canvas,
                this.context,
                this.canvas.width,
                this.canvas.height,
                this.audioPlayer
            );

            this.setStatus(`Playing ${config.label}`);
            if (!renderOptions.manualFrames) {
                this.simulation.start();
            }

            return {
                audio: config.audio,
                duration: this.audioPlayer.getDuration()
            };
        } catch (error) {
            this.cleanup();
            this.isRendering = false;
            throw error;
        }
    }

    async beginPlayback() {
        if (!this.audioPlayer) {
            throw new Error('Playback has not been prepared.');
        }

        await this.audioPlayer.play();
    }

    renderFrame() {
        if (!this.simulation) {
            throw new Error('Playback has not been prepared.');
        }

        this.simulation.counter++;

        if (this.simulation.simulation && typeof this.simulation.simulation.tick === 'function') {
            this.simulation.simulation.tick();
        }

        this.simulation.setupFrame();
        this.simulation.draw();
        this.requestCanvasFrame();

        return {
            counter: this.simulation.counter,
            audioTime: this.audioPlayer?.audio?.currentTime || 0,
            bass: this.simulation.bassInfluence,
            mid: this.simulation.midInfluence,
            treble: this.simulation.trebleInfluence,
            beat: this.simulation.beatIntensity
        };
    }

    stopPlayback() {
        this.cleanup();
        this.isRendering = false;
        this.setStatus('Stopped');
    }

    prepareCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        document.body.style.width = `${width}px`;
        document.body.style.height = `${height}px`;
    }

    createRecorder(options) {
        const canvasStream = this.canvas.captureStream(0);
        this.activeVideoTrack = canvasStream.getVideoTracks()[0] || null;
        const audioStream = this.audioPlayer.getCaptureStream();
        const tracks = [
            ...canvasStream.getVideoTracks(),
            ...audioStream.getAudioTracks()
        ];
        const stream = new MediaStream(tracks);
        const chunks = [];
        const mimeType = this.getSupportedMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        const complete = new Promise((resolve, reject) => {
            recorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            });
            recorder.addEventListener('stop', () => {
                resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
                stream.getTracks().forEach((track) => track.stop());
            });
            recorder.addEventListener('error', () => reject(recorder.error));
        });

        return { recorder, complete };
    }

    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];

        return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
    }

    waitForFinish(recorder, maxDurationSeconds) {
        return new Promise((resolve) => {
            let timeoutId = null;

            const stop = () => {
                if (timeoutId) {
                    window.clearTimeout(timeoutId);
                }

                if (recorder.state !== 'inactive') {
                    recorder.stop();
                }

                resolve();
            };

            this.audioPlayer.audio.addEventListener('ended', stop, { once: true });

            if (maxDurationSeconds > 0) {
                timeoutId = window.setTimeout(stop, maxDurationSeconds * 1000);
            }
        });
    }

    getFilename(options, config) {
        if (options.filename) {
            return options.filename.endsWith('.webm') ? options.filename : `${options.filename}.webm`;
        }

        return `${config.label.toLowerCase()}-${options.width}x${options.height}.webm`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    cleanup() {
        this.restoreAnimationLoop();
        this.activeVideoTrack = null;

        if (this.simulation) {
            this.simulation.destroy();
            this.simulation = null;
        }

        if (this.audioPlayer) {
            this.audioPlayer.stop();
            this.audioPlayer = null;
        }
    }

    setStatus(message) {
        this.statusElement.textContent = message;
        window.hillsideRenderStatus = message;
    }

    installTimedAnimationLoop(fps) {
        const frameDelay = 1000 / Math.max(fps, 1);
        this.animationTimers = {
            requestAnimationFrame: window.requestAnimationFrame,
            cancelAnimationFrame: window.cancelAnimationFrame
        };

        window.requestAnimationFrame = (callback) => {
            return window.setTimeout(() => {
                callback(performance.now());
                this.requestCanvasFrame();
            }, frameDelay);
        };
        window.cancelAnimationFrame = (id) => {
            window.clearTimeout(id);
        };
    }

    restoreAnimationLoop() {
        if (!this.animationTimers) return;

        window.requestAnimationFrame = this.animationTimers.requestAnimationFrame;
        window.cancelAnimationFrame = this.animationTimers.cancelAnimationFrame;
        this.animationTimers = null;
    }

    requestCanvasFrame() {
        if (typeof this.activeVideoTrack?.requestFrame === 'function') {
            this.activeVideoTrack.requestFrame();
        }
    }
}

window.hillsideRender = new RenderApp();
window.hillsideRenderVisualizations = VISUALIZATIONS;
