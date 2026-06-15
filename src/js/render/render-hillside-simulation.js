import { CellularAutomataSimulation } from '../cellular-automata/simulation.js';
import { distance } from '../utils/math.js';

export class RenderHillsideSimulation extends CellularAutomataSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);

        this.regenerationCooldown = 0;
        this.regenerationCount = 0;
        this.visibleConnectionCount = 0;
    }

    draw() {
        this.applyViewportOffset();
        super.draw();
        this.visibleConnectionCount = this.countVisibleConnections();
        this.regenerateIfSparse();
    }

    applyViewportOffset() {
        if (this.nodes.length === 0) return;

        const bounds = this.getBounds();
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const centroidX = bounds.sumX / this.nodes.length;
        const centroidY = bounds.sumY / this.nodes.length;
        const margin = Math.min(this.width, this.height) * 0.12;
        const offscreenPressure = Math.max(
            0,
            margin - bounds.maxX,
            bounds.minX - (this.width - margin),
            margin - bounds.maxY,
            bounds.minY - (this.height - margin)
        );
        const driftPressure = Math.hypot(centerX - centroidX, centerY - centroidY) / Math.min(this.width, this.height);
        const strength = offscreenPressure > 0 ? 0.075 : Math.min(0.028, driftPressure * 0.045);
        const shiftX = (centerX - centroidX) * strength;
        const shiftY = (centerY - centroidY) * strength;

        this.nodes.forEach((node) => {
            node.x += shiftX;
            node.y += shiftY;

            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
                this.regenerateNode(node, 1);
            }
        });
    }

    regenerateIfSparse() {
        if (this.regenerationCooldown > 0) {
            this.regenerationCooldown--;
        }

        const bounds = this.getBounds();
        const visibleNodes = this.nodes.filter((node) => this.isVisible(node)).length;
        const visibleRatio = visibleNodes / Math.max(this.nodes.length, 1);
        const activeRatio = this.visibleConnectionCount / Math.max(this.nodes.length, 1);
        const audioEnergy = this.getAudioEnergy();
        const sparse = visibleRatio < 0.76 || activeRatio < 0.42;
        const burst = audioEnergy > 0.48;
        const outside = bounds.maxX < this.width * 0.2 ||
            bounds.minX > this.width * 0.8 ||
            bounds.maxY < this.height * 0.2 ||
            bounds.minY > this.height * 0.8;

        if (!sparse && !burst && !outside) return;
        if (this.regenerationCooldown > 0 && !outside) return;

        const regenerateFraction = outside
            ? 0.18
            : sparse
                ? Math.min(0.1, 0.035 + audioEnergy * 0.055 + Math.max(0, 0.55 - activeRatio) * 0.04)
                : 0.012 + audioEnergy * 0.025;
        const minimumCount = sparse || outside ? 4 : 2;
        const regenerateCount = Math.max(minimumCount, Math.floor(this.nodes.length * regenerateFraction));
        const candidates = this.getRegenerationCandidates();

        for (let i = 0; i < regenerateCount && i < candidates.length; i++) {
            this.regenerateNode(candidates[i], audioEnergy);
        }

        this.regenerationCount += regenerateCount;
        this.regenerationCooldown = Math.max(2, Math.floor(10 - audioEnergy * 6));
        if (this.simulation?.alpha) {
            this.simulation.alpha(Math.max(this.simulation.alpha(), 0.32 + audioEnergy * 0.28));
        }
    }

    getRegenerationCandidates() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        return [...this.nodes].sort((a, b) => {
            const aVisible = this.isVisible(a) ? 1 : 0;
            const bVisible = this.isVisible(b) ? 1 : 0;
            if (aVisible !== bVisible) return aVisible - bVisible;

            const aDistance = Math.hypot(a.x - centerX, a.y - centerY);
            const bDistance = Math.hypot(b.x - centerX, b.y - centerY);
            if (Math.abs(aDistance - bDistance) > 1) return bDistance - aDistance;

            return a.size - b.size;
        });
    }

    regenerateNode(node, audioEnergy) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const angle = this.hash(node.id, this.regenerationCount + 1) * Math.PI * 2;
        const radius = Math.sqrt(this.hash(node.id, this.regenerationCount + 2));
        const audioSpread = 0.74 + audioEnergy * 0.28;
        const radiusX = this.width * 0.28 * audioSpread;
        const radiusY = this.height * 0.26 * audioSpread;

        node.x = centerX + Math.cos(angle) * radiusX * radius + (this.hash(node.id, 3) - 0.5) * this.width * 0.08;
        node.y = centerY + Math.sin(angle) * radiusY * radius + (this.hash(node.id, 4) - 0.5) * this.height * 0.08;
        node.size = 1 + this.hash(node.id, this.regenerationCount + 5) * (2.5 + audioEnergy * 2.2);
        node.vx = (this.hash(node.id, this.regenerationCount + 6) - 0.5) * (1.2 + audioEnergy * 2.2);
        node.vy = (this.hash(node.id, this.regenerationCount + 7) - 0.5) * (1.2 + audioEnergy * 2.2);
    }

    countVisibleConnections() {
        let count = 0;
        const timeDensity = this.getTimeDensity();

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (!this.isVisible(node)) continue;

            for (let j = i + 1; j < this.nodes.length; j++) {
                const other = this.nodes[j];
                if (!this.isVisible(other)) continue;

                const d = distance(node, other);
                if (d < 19 * (node.size + other.size) * timeDensity) {
                    count++;
                    if (count > this.nodes.length * 1.5) return count;
                }
            }
        }

        return count;
    }

    getBounds() {
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

        return { minX, maxX, minY, maxY, sumX, sumY };
    }

    isVisible(node) {
        const padding = Math.min(this.width, this.height) * 0.15;
        return node.x >= -padding &&
            node.x <= this.width + padding &&
            node.y >= -padding &&
            node.y <= this.height + padding;
    }

    getAudioEnergy() {
        return Math.max(0, Math.min(1, (this.bassInfluence * 0.45) + (this.midInfluence * 0.35) + (this.trebleInfluence * 0.2)));
    }

    hash(index, salt) {
        const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123;
        return value - Math.floor(value);
    }
}
