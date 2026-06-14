import { CellularAutomataSimulation } from '../cellular-automata/simulation.js';
import { Node } from '../cellular-automata/node.js';
import { distance } from '../utils/math.js';

export class RenderHillsideSimulation extends CellularAutomataSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);

        this.baseAlpha = 0.46;
        this.maxRenderSize = 18;
        this.maxInteractionDistance = Math.min(width, height) * 0.28;
        this.maxConnections = width > 1024 ? 2200 : 1200;
        this.maxConnectionsPerNode = width > 1024 ? 8 : 6;
        this.maxVelocity = 6;
    }

    initializeNodes() {
        const nodeCount = this.width > 1024 ? 420 : 300;
        const scale = d3.scaleLinear()
            .domain([0, nodeCount])
            .range([0, 1]);
        const color = d3.scaleSequential(d3.interpolateRainbow);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const clusterCenters = [
            { x: centerX - this.width * 0.2, y: centerY - this.height * 0.12 },
            { x: centerX + this.width * 0.18, y: centerY - this.height * 0.08 },
            { x: centerX - this.width * 0.08, y: centerY + this.height * 0.16 },
            { x: centerX + this.width * 0.1, y: centerY + this.height * 0.14 }
        ];
        const radiusX = this.width * 0.18;
        const radiusY = this.height * 0.17;

        for (let i = 0; i < nodeCount; i++) {
            const cluster = clusterCenters[i % clusterCenters.length];
            const angle = this.hash(i, 1) * Math.PI * 2;
            const radius = Math.sqrt(this.hash(i, 2));
            const wobbleX = (this.hash(i, 3) - 0.5) * this.width * 0.2;
            const wobbleY = (this.hash(i, 4) - 0.5) * this.height * 0.18;
            const node = new Node(
                i,
                cluster.x + Math.cos(angle) * radiusX * radius + wobbleX,
                cluster.y + Math.sin(angle) * radiusY * radius + wobbleY,
                color(scale(i))
            );
            node.size = 1.2 + ((i % 11) / 11) * 2.6;
            this.nodes.push(node);
        }
    }

    setupForces() {
        const collisionForce = d3.forceCollide((node) => node.size * 11).strength(0.045).iterations(1);
        const attractForce = d3.forceManyBody().strength((node) => node.size * 0.42);
        const center = d3.forceCenter(this.width / 2, this.height / 2).strength(0.045);

        this.simulation = d3.forceSimulation(this.nodes)
            .force('collisionForce', collisionForce)
            .force('attractForce', attractForce)
            .force('center', center);
    }

    draw() {
        this.repairNodes();
        this.applyOrganicMotion();

        this.context.strokeStyle = '#ffffff80';
        this.context.lineWidth = 0.51;

        const timeDensity = this.getTimeDensity();
        let connectionCount = 0;

        for (let i = 0; i < this.nodes.length; i++) {
            if (connectionCount >= this.maxConnections) break;

            const node = this.nodes[i];
            let nodeConnections = 0;
            node.size = this.clampSize(node.size * 0.9975);

            for (let j = i + 1; j < this.nodes.length; j++) {
                if (nodeConnections >= this.maxConnectionsPerNode) break;

                const other = this.nodes[j];
                const d = Math.max(distance(node, other), 0.5);
                const interactionDistance = Math.min(
                    17 * (node.size + other.size) * timeDensity,
                    this.maxInteractionDistance
                );

                if (d >= interactionDistance) {
                    continue;
                }

                connectionCount++;
                nodeConnections++;

                const smaller = node.size < other.size ? node : other;
                const velocityWidth = Math.max(0.18, Math.min(Math.abs(node.vx), 2));
                this.context.lineWidth = velocityWidth * (1 + this.bassInfluence * 3.2);

                const growthRate = 0.05 * (1 + this.midInfluence * 2.2);
                node.size = this.clampSize(node.size + (growthRate * other.size) / d);
                other.size = this.clampSize(other.size + (growthRate * node.size) / d);

                const interactionStrength = 0.27 * (1 + this.trebleInfluence * 1.8);
                node.vx += (interactionStrength * other.vx) / d;
                node.vy += (interactionStrength * other.vy) / d;
                other.vx += (interactionStrength * node.vx) / d;
                other.vy += (interactionStrength * node.vy) / d;
                this.clampVelocity(node);
                this.clampVelocity(other);

                const baseOpacity = 1.65 / Math.max(Math.log(d + 2), 1);
                const audioReactiveOpacity = Math.min(0.95, baseOpacity * (0.22 + this.bassInfluence));
                this.context.strokeStyle = smaller.color
                    .replace(')', `,${audioReactiveOpacity})`)
                    .replace('rgb', 'rgba');
                this.context.beginPath();
                this.context.moveTo(node.x, node.y);
                this.context.lineTo(other.x, other.y);
                this.context.stroke();

                if (connectionCount >= this.maxConnections) break;
            }
        }

        this.nodes.forEach((node) => {
            const velocityEnergy = Math.max(Math.min(Math.abs(node.vx * node.vy), 4), 0.55);
            const baseRadius = 0.22 * Math.min(node.size, 3) * velocityEnergy;
            const audioReactivity = this.bassInfluence + this.midInfluence + this.trebleInfluence;
            const audioInfluencedRadius = Math.min(4.2, Math.max(0.35, baseRadius * (1 + audioReactivity * 0.75)));

            this.context.beginPath();
            const shadowOpacity = 0.22 + this.bassInfluence * 0.35;
            this.context.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
            this.context.arc(node.x + 1, node.y + 1, 0.45 * audioInfluencedRadius, 0, Math.PI * 2, true);
            this.context.closePath();
            this.context.fill();

            this.context.beginPath();

            if (this.trebleInfluence > 0.48) {
                const glowRadius = audioInfluencedRadius * (1 + this.trebleInfluence * 0.55);
                const gradient = this.context.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
                gradient.addColorStop(0, node.color);
                gradient.addColorStop(0.7, node.color.replace(')', ', 0.18)').replace('rgb', 'rgba'));
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                this.context.fillStyle = gradient;
                this.context.arc(node.x, node.y, glowRadius, 0, Math.PI * 2, true);
                this.context.closePath();
                this.context.fill();
                this.context.beginPath();
            }

            this.context.fillStyle = node.color;
            this.context.arc(node.x, node.y, audioInfluencedRadius, 0, Math.PI * 2, true);
            this.context.closePath();
            this.context.fill();
        });

        const totalAudioInfluence = this.bassInfluence + this.midInfluence + this.trebleInfluence;
        this.simulation.alpha(this.baseAlpha * (0.8 + totalAudioInfluence * 0.4));
        this.nudgeCloudIntoView();
    }

    repairNodes() {
        if (this.nodes.length === 0) return;

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        this.nodes.forEach((node) => {
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
                const angle = node.id * 2.399963229728653;
                node.x = centerX + Math.cos(angle) * this.width * 0.25;
                node.y = centerY + Math.sin(angle) * this.height * 0.25;
            }

            node.size = this.clampSize(node.size);
            this.clampVelocity(node);
        });
    }

    applyOrganicMotion() {
        const elapsed = this.getElapsedTime();
        const energy = 0.015 + this.bassInfluence * 0.05 + this.trebleInfluence * 0.035;

        this.nodes.forEach((node) => {
            const phase = elapsed * (0.55 + this.hash(node.id, 5) * 0.9) + node.id * 0.19;
            const orbit = elapsed * (0.32 + this.hash(node.id, 6) * 0.42) + node.id * 0.07;
            node.vx += Math.sin(phase) * energy + Math.cos(orbit) * energy * 0.7;
            node.vy += Math.cos(phase * 0.83) * energy + Math.sin(orbit) * energy * 0.7;
            this.clampVelocity(node);
        });
    }

    nudgeCloudIntoView() {
        if (this.nodes.length === 0) return;

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const hardPadding = Math.min(this.width, this.height) * 0.28;
        const softPadding = Math.min(this.width, this.height) * 0.1;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let sumX = 0;
        let sumY = 0;

        this.nodes.forEach((node) => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
            sumX += node.x;
            sumY += node.y;
        });

        const centroidX = sumX / this.nodes.length;
        const centroidY = sumY / this.nodes.length;
        const isMostlyInView = minX > -softPadding &&
            maxX < this.width + softPadding &&
            minY > -softPadding &&
            maxY < this.height + softPadding;
        const shiftStrength = isMostlyInView ? 0.008 : 0.035;
        const shiftX = (centerX - centroidX) * shiftStrength;
        const shiftY = (centerY - centroidY) * shiftStrength;

        this.nodes.forEach((node) => {
            node.x += shiftX;
            node.y += shiftY;

            if (
                node.x < -hardPadding ||
                node.x > this.width + hardPadding ||
                node.y < -hardPadding ||
                node.y > this.height + hardPadding
            ) {
                const angle = node.id * 2.399963229728653 + this.counter * 0.017;
                node.x = centerX + Math.cos(angle) * this.width * (0.18 + this.hash(node.id, 7) * 0.2);
                node.y = centerY + Math.sin(angle) * this.height * (0.16 + this.hash(node.id, 8) * 0.18);
                node.vx *= 0.35;
                node.vy *= 0.35;
            }
        });
    }

    clampSize(size) {
        return Math.max(1, Math.min(size, this.maxRenderSize));
    }

    clampVelocity(node) {
        node.vx = this.clampNumber(node.vx, this.maxVelocity);
        node.vy = this.clampNumber(node.vy, this.maxVelocity);
    }

    clampNumber(value, magnitude) {
        if (!Number.isFinite(value)) return 0;

        return Math.max(-magnitude, Math.min(value, magnitude));
    }

    hash(index, salt) {
        const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123;
        return value - Math.floor(value);
    }
}
