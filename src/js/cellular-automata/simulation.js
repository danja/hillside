// D3 libraries are loaded globally via script tags in index.html
import { Node } from './node.js';
import { distance } from '../utils/math.js';

export class CellularAutomataSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        this.canvas = canvas;
        this.context = context;
        this.width = width;
        this.height = height;
        this.audioPlayer = audioPlayer;
        this.nodes = [];
        this.rafId = null;
        this.counter = 0;
        
        // Audio-reactive parameters
        this.baseAlpha = 0.5;
        this.audioMultiplier = 3.0;
        this.bassInfluence = 0.0;
        this.midInfluence = 0.0;
        this.trebleInfluence = 0.0;
        
        this.initializeNodes();
        this.setupForces();
    }

    initializeNodes() {
        const nodeCount = window.innerWidth > 1024 ? 600 : 300;
        const sc = d3.scaleLinear()
            .domain([0, nodeCount])
            .range([0, 1]);
        const color2 = d3.scaleSequential(d3.interpolateRainbow);

        for (let i = 0; i < nodeCount; i++) {
            const node = new Node(
                i,
                Math.random() * this.width,
                Math.random() * this.height,
                color2(sc(i))
            );
            this.nodes.push(node);
        }
    }

    setupForces() {
        const collisionForce = d3.forceCollide((e) => e.size * 13).strength(0.05).iterations(1);
        const attractForce = d3.forceManyBody().strength((e) => e.size);
        const center = d3.forceCenter(this.width / 2, this.height / 2).strength(0.163);

        this.simulation = d3.forceSimulation(this.nodes)
            .force("collisionForce", collisionForce)
            .force("attractForce", attractForce)
            .force("center", center);
    }

    updateAudioInfluence() {
        if (this.audioPlayer) {
            const audioAnalysis = this.audioPlayer.getAudioAnalysis();
            if (audioAnalysis) {
                this.bassInfluence = audioAnalysis.bass;
                this.midInfluence = audioAnalysis.mid;
                this.trebleInfluence = audioAnalysis.treble;
            }
        }
    }

    draw() {
        this.updateAudioInfluence();
        
        this.context.fillStyle = '#000';
        this.context.fillRect(0, 0, this.width, this.height);

        this.context.strokeStyle = '#ffffff80';
        this.context.lineWidth = 0.51;
        
        let indc = [];
        let t;
        
        // Process all node interactions (matching original exactly)
        this.nodes.forEach((e, i) => {
            this.nodes.forEach((e2, i2) => {
                e.size *= 0.999;
                if (i !== i2) {
                    const d = distance(e, e2);
                    if (d < 19 * (e.size + e2.size) && !indc[Math.max(i, i2) + '_' + Math.min(i, i2)]) {
                        indc[Math.max(i, i2) + '_' + Math.min(i, i2)] = true;
                        t = e.size < e2.size ? e : e2;
                        // Audio-reactive line width: bass increases thickness
                        const baseLineWidth = Math.min(e.vx, 2);
                        this.context.lineWidth = baseLineWidth * (1 + this.bassInfluence * 2);
                        
                        // Audio-reactive size growth: mid frequencies affect growth rate
                        const growthRate = 0.08 * (1 + this.midInfluence * 1.5);
                        e.size += (growthRate * e2.size) / d;
                        e2.size += (growthRate * e.size) / d;
                        
                        // Audio-reactive velocity exchange: treble affects interaction strength
                        const interactionStrength = 0.41 * (1 + this.trebleInfluence * 1.2);
                        e.vx += (interactionStrength * e2.vx) / Math.max(d, 0.01);
                        e.vy += (interactionStrength * e2.vy) / Math.max(d, 0.01);
                        e2.vx += (interactionStrength * e.vx) / Math.max(d, 0.01);
                        e2.vy += (interactionStrength * e.vy) / Math.max(d, 0.01);
                        
                        // Audio-reactive line opacity: overall level affects brightness
                        const baseOpacity = 2 / Math.log(d);
                        const audioReactiveOpacity = baseOpacity * (0.3 + this.bassInfluence * 0.7);
                        this.context.strokeStyle = t.color.replace(')', ',' + audioReactiveOpacity + ')').replace('rgb', 'rgba');
                        this.context.beginPath();
                        this.context.moveTo(e.x, e.y);
                        this.context.lineTo(e2.x, e2.y);
                        this.context.stroke();
                    }
                }
                
                e2.size = Math.min(e2.size, 100);
                e2.size = Math.max(e2.size, 1);
                e.size = Math.max(e.size, 1);
                e.size = Math.min(e.size, 100);
            });
        });

        // Draw nodes with velocity-based and audio-reactive sizing
        this.nodes.forEach((e) => {
            // Base radius calculation - ensure minimum visibility
            let baseRadius = 0.4 * Math.min(e.size, 2) * Math.max(Math.min(Math.abs(e.vx * e.vy), 5), 0.5);
            
            // Audio-reactive radius: overall audio level increases node size
            const audioReactivity = this.bassInfluence + this.midInfluence + this.trebleInfluence;
            const audioInfluencedRadius = baseRadius * (1.0 + audioReactivity * 0.5);
            
            // Shadow with audio-reactive opacity
            this.context.beginPath();
            const shadowOpacity = 0.6 + this.bassInfluence * 0.4;
            this.context.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
            this.context.arc(e.x + 1, e.y + 1, 0.45 * audioInfluencedRadius, 0, Math.PI * 2, true);
            this.context.closePath();
            this.context.fill();

            // Node with audio-reactive glow
            this.context.beginPath();
            
            // Add audio-reactive glow effect for high frequencies
            if (this.trebleInfluence > 0.3) {
                // Create glow effect
                const glowRadius = audioInfluencedRadius * (1 + this.trebleInfluence);
                const gradient = this.context.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowRadius);
                gradient.addColorStop(0, e.color);
                gradient.addColorStop(0.7, e.color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                this.context.fillStyle = gradient;
                this.context.arc(e.x, e.y, glowRadius, 0, Math.PI * 2, true);
                this.context.closePath();
                this.context.fill();
                
                // Draw the core node
                this.context.beginPath();
            }
            
            this.context.fillStyle = e.color;
            this.context.arc(e.x, e.y, audioInfluencedRadius, 0, Math.PI * 2, true);
            this.context.closePath();
            this.context.fill();
        });

        // Audio-reactive simulation alpha - maintain base level for visibility
        const totalAudioInfluence = this.bassInfluence + this.midInfluence + this.trebleInfluence;
        const audioReactiveAlpha = this.baseAlpha * (0.8 + totalAudioInfluence * 0.5);
        this.simulation.alpha(audioReactiveAlpha);
    }

    animate() {
        this.counter += 0.1;
        window.cancelAnimationFrame(this.rafId);
        this.rafId = window.requestAnimationFrame(() => this.animate());
        
        if (this.context) {
            this.draw();
        }
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        
        if (this.simulation) {
            const center = d3.forceCenter(width / 2, height / 2).strength(0.163);
            this.simulation.force("center", center);
        }
        
        this.draw();
    }

    start() {
        this.animate();
    }

    stop() {
        if (this.rafId) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}