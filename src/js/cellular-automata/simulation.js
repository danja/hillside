// D3 libraries are loaded globally via script tags in index.html
import { Node } from './node.js';
import { distance } from '../utils/math.js';

export class CellularAutomataSimulation {
    constructor(canvas, context, width, height) {
        this.canvas = canvas;
        this.context = context;
        this.width = width;
        this.height = height;
        this.nodes = [];
        this.rafId = null;
        this.counter = 0;
        
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

    draw() {
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
                        this.context.lineWidth = Math.min(e.vx, 2);
                        e.size += (0.08 * e2.size) / d;
                        e2.size += (0.08 * e.size) / d;
                        e.vx += (0.41 * e2.vx) / Math.max(d, 0.01);
                        e.vy += (0.41 * e2.vy) / Math.max(d, 0.01);
                        e2.vx += (0.41 * e.vx) / Math.max(d, 0.01);
                        e2.vy += (0.41 * e.vy) / Math.max(d, 0.01);
                        this.context.strokeStyle = t.color.replace(')', ',' + 2 / Math.log(d) + ')').replace('rgb', 'rgba');
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

        // Draw nodes with velocity-based sizing
        this.nodes.forEach((e) => {
            const radius = 0.4 * Math.min(e.size, 2) * Math.min(Math.abs(e.vx * e.vy), 5);
            
            // Shadow
            this.context.beginPath();
            this.context.fillStyle = "#000000aa";
            this.context.arc(e.x + 1, e.y + 1, 0.45 * radius, 0, Math.PI * 2, true);
            this.context.closePath();
            this.context.fill();

            // Node
            this.context.beginPath();
            this.context.fillStyle = e.color;
            this.context.arc(e.x, e.y, radius, 0, Math.PI * 2, true);
            this.context.closePath();
            this.context.fill();
        });

        this.simulation.alpha(0.5);
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