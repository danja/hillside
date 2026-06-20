import { BaseSimulation } from '../base/base-simulation.js';

const COLORS = [
    { core: 'rgba(75, 211, 229, 0.95)', glow: 'rgba(75, 211, 229, 0.28)' },
    { core: 'rgba(255, 251, 230, 0.68)', glow: 'rgba(255, 251, 230, 0.14)' },
    { core: 'rgba(255, 217, 25, 0.82)', glow: 'rgba(255, 217, 25, 0.2)' },
    { core: 'rgba(255, 79, 25, 0.8)', glow: 'rgba(255, 79, 25, 0.18)' },
    { core: 'rgba(132, 96, 255, 0.9)', glow: 'rgba(132, 96, 255, 0.24)' }
];

export class TubesSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);

        this.agents = [];
        this.flashes = [];
        this.paintCanvas = null;
        this.paintContext = null;
        this.paintScale = 0.35;
        this.bassMemory = 0;
        this.burstCooldown = 0;
        this.fieldScale = 2.5;
        this.trailAlpha = 0.085;

        this.createPaintCanvas();
        this.initializeNodes();
    }

    createPaintCanvas() {
        this.paintCanvas = document.createElement('canvas');
        this.paintCanvas.width = Math.max(1, Math.floor(this.width * this.paintScale));
        this.paintCanvas.height = Math.max(1, Math.floor(this.height * this.paintScale));
        this.paintContext = this.paintCanvas.getContext('2d');
        this.paintContext.fillStyle = '#000';
        this.paintContext.fillRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
    }

    initializeNodes() {
        this.agents = [];
        this.flashes = [];
        this.nodes = this.agents;

        const count = this.width > 1024 ? 320 : 220;
        const minSide = Math.min(this.width, this.height);

        for (let i = 0; i < count; i++) {
            const side = this.hash(i, 1) > 0.5 ? 1 : -1;
            const x = this.width * 0.5 + this.gaussian(i, 3) * this.width * 0.23;
            const y = this.height * 0.5 + this.gaussian(i, 4) * this.height * 0.045;
            const sizeSeed = this.hash(i, 5);
            const widthClass = this.hash(i, 10);
            const strokeBoost = widthClass > 0.88 ? 2.8 : widthClass > 0.58 ? 1.45 : 0.72;

            this.agents.push({
                id: i,
                x,
                y,
                px: x,
                py: y,
                z: this.hash(i, 6),
                direction: side,
                speed: 0.42 + this.hash(i, 7) * 1.15,
                radius: minSide * (0.0027 + sizeSeed * 0.0065) * strokeBoost,
                baseRadius: minSide * (0.0027 + sizeSeed * 0.0065) * strokeBoost,
                phase: this.hash(i, 8) * Math.PI * 2,
                color: COLORS[i % COLORS.length],
                strokeBoost,
                age: this.hash(i, 9) * 100
            });
        }
    }

    draw() {
        const dt = Math.min(0.08, Math.max(0.016, this.getDeltaTime()));
        const elapsed = this.getElapsedTime();
        const bass = this.bassInfluence;
        const mid = this.midInfluence;
        const treble = this.trebleInfluence;
        const beat = this.beatIntensity;
        const burst = this.detectBurst(bass, beat);

        this.fadeBackground(bass, beat);
        this.updateAgents(dt, elapsed, bass, mid, treble, burst);
        this.updateFlashes(dt);

        if (burst) {
            this.createFlash(bass);
        }

        this.fadePaintLayer(bass, beat);
        this.depositAgents(bass, mid, treble);
        this.drawFieldLines(elapsed, bass, mid);
        this.drawPaintLayer(bass, mid, treble);
        this.drawAgents(bass, treble);
        this.drawFlashes();

        this.bassMemory = this.bassMemory * 0.93 + bass * 0.07;
        this.burstCooldown = Math.max(0, this.burstCooldown - 1);
    }

    detectBurst(bass, beat) {
        const lift = bass - this.bassMemory;
        const burst = this.burstCooldown <= 0 && (lift > 0.13 || beat > 0.5 || bass > 0.82);

        if (burst) {
            this.burstCooldown = 8;
        }

        return burst;
    }

    fadeBackground(bass, beat) {
        const alpha = Math.max(0.035, this.trailAlpha - bass * 0.035 - beat * 0.02);
        const gradient = this.context.createRadialGradient(
            this.width * 0.5,
            this.height * 0.5,
            0,
            this.width * 0.5,
            this.height * 0.5,
            Math.max(this.width, this.height) * 0.78
        );

        gradient.addColorStop(0, `rgba(17, 12, 42, ${alpha * 0.58})`);
        gradient.addColorStop(0.62, `rgba(4, 5, 14, ${alpha})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha + 0.05})`);

        this.context.save();
        this.context.globalCompositeOperation = 'source-over';
        this.context.fillStyle = gradient;
        this.context.fillRect(0, 0, this.width, this.height);
        this.context.restore();
    }

    updateAgents(dt, elapsed, bass, mid, treble, burst) {
        const speedScale = (0.72 + bass * 1.45 + mid * 0.55) * (dt * 58);
        const pulse = 1 + bass * 0.9 + treble * 0.24;

        this.agents.forEach((agent) => {
            agent.px = agent.x;
            agent.py = agent.y;
            agent.age += dt;

            const field = this.vectorField(agent.x, agent.y, elapsed, bass, mid);
            const swirl = Math.sin(elapsed * 0.7 + agent.phase + agent.z * 6) * treble * 0.45;
            const depthSpeed = 0.6 + agent.z * 0.9;

            agent.x += agent.direction * (field.x + swirl) * agent.speed * speedScale * depthSpeed;
            agent.y += agent.direction * field.y * agent.speed * speedScale * depthSpeed;
            agent.x += Math.sin(elapsed * 0.32 + agent.phase) * mid * 0.45;

            if (burst) {
                const dx = agent.x - this.width / 2;
                const dy = agent.y - this.height / 2;
                const distance = Math.max(1, Math.hypot(dx, dy));
                agent.x += (dx / distance) * bass * 5.4;
                agent.y += (dy / distance) * bass * 3.2;
            }

            agent.radius = agent.baseRadius * pulse * (0.72 + agent.z * 0.72);
            this.wrapAgent(agent);
        });
    }

    vectorField(x, y, elapsed, bass, mid) {
        const nx = this.map(x, 0, this.width, -this.fieldScale, this.fieldScale);
        const ny = this.map(y, 0, this.height, -this.fieldScale, this.fieldScale);
        const k1 = 5 + bass * 2.6;
        const k2 = 3 + mid * 1.8;
        const time = elapsed * (0.16 + bass * 0.08);
        const u = Math.sin(k1 * ny + time) + Math.sin(k2 * nx - time * 0.7);
        let v = Math.sin(k2 * nx + time * 0.5) - Math.cos(k1 * nx - time);

        if (v <= 0) {
            v = -v;
        }

        return { x: u, y: v };
    }

    wrapAgent(agent) {
        const pad = Math.max(18, agent.radius * 5);

        if (agent.y < -pad || agent.y > this.height + pad) {
            this.resetAgent(agent);
            return;
        }

        if (agent.x < -pad) {
            agent.x = this.width + pad;
            agent.px = agent.x;
        } else if (agent.x > this.width + pad) {
            agent.x = -pad;
            agent.px = agent.x;
        }
    }

    resetAgent(agent) {
        agent.x = this.width * 0.5 + this.gaussian(agent.id + Math.floor(agent.age * 13), 22) * this.width * 0.26;
        agent.y = this.height * 0.5 + this.gaussian(agent.id + Math.floor(agent.age * 17), 23) * this.height * 0.055;
        agent.px = agent.x;
        agent.py = agent.y;
        agent.direction *= -1;
        agent.radius = agent.baseRadius;
    }

    fadePaintLayer(bass, beat) {
        if (!this.paintContext) return;

        const decay = Math.max(0.006, 0.014 - bass * 0.006 - beat * 0.003);
        this.paintContext.save();
        this.paintContext.globalCompositeOperation = 'source-over';
        this.paintContext.setTransform(this.paintScale, 0, 0, this.paintScale, 0, 0);
        this.paintContext.fillStyle = `rgba(0, 0, 0, ${decay})`;
        this.paintContext.fillRect(0, 0, this.width, this.height);
        this.paintContext.restore();
    }

    depositAgents(bass, mid, treble) {
        if (!this.paintContext) return;

        const paint = this.paintContext;
        paint.save();
        paint.setTransform(this.paintScale, 0, 0, this.paintScale, 0, 0);
        paint.globalCompositeOperation = 'lighter';
        paint.lineCap = 'round';
        paint.lineJoin = 'round';

        this.agents.forEach((agent) => {
            if ((agent.id + this.counter) % 4 !== 0) return;

            const distance = Math.hypot(agent.x - agent.px, agent.y - agent.py);
            if (distance < 0.01 || distance > this.width * 0.35) return;

            const tubeWidth = Math.max(1.2, agent.radius * (2.15 + bass * 1.4 + agent.z * 0.85));
            const beadRadius = Math.max(1.1, agent.radius * (1.35 + bass * 0.9 + treble * 0.35));

            paint.strokeStyle = agent.color.glow;
            paint.lineWidth = tubeWidth;
            paint.globalAlpha = 0.15 + mid * 0.14 + treble * 0.06;
            paint.beginPath();
            paint.moveTo(agent.px, agent.py);
            paint.lineTo(agent.x, agent.y);
            paint.stroke();

            paint.strokeStyle = agent.color.core;
            paint.lineWidth = Math.max(0.7, tubeWidth * 0.34);
            paint.globalAlpha = 0.14 + bass * 0.1;
            paint.beginPath();
            paint.moveTo(agent.px, agent.py);
            paint.lineTo(agent.x, agent.y);
            paint.stroke();

            if ((agent.id + this.counter) % 3 === 0) {
                paint.fillStyle = agent.color.core;
                paint.globalAlpha = 0.09 + bass * 0.14;
                paint.beginPath();
                paint.arc(agent.x, agent.y, beadRadius, 0, Math.PI * 2);
                paint.fill();
            }
        });

        paint.restore();
    }

    drawPaintLayer(bass, mid, treble) {
        if (!this.paintCanvas) return;

        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.globalAlpha = 0.72 + bass * 0.12;
        this.context.drawImage(
            this.paintCanvas,
            0,
            0,
            this.paintCanvas.width,
            this.paintCanvas.height,
            0,
            0,
            this.width,
            this.height
        );
        this.context.restore();
    }

    drawFieldLines(elapsed, bass, mid) {
        const rows = 18;
        const points = 86;
        const gap = this.height / (rows + 1);
        const step = this.width / (points - 1);

        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.lineCap = 'round';

        for (let row = 0; row < rows; row++) {
            const yBase = gap * (row + 1);
            const depth = row / Math.max(1, rows - 1);
            this.context.strokeStyle = row % 4 === 0
                ? `rgba(255, 217, 25, ${0.035 + bass * 0.035})`
                : `rgba(75, 211, 229, ${0.045 + mid * 0.055})`;
            this.context.lineWidth = 0.55 + bass * 0.6;
            this.context.beginPath();

            for (let i = 0; i < points; i++) {
                const x = i * step;
                const field = this.vectorField(x, yBase, elapsed, bass, mid);
                const y = yBase + (field.x * 7 + field.y * 3) * (0.6 + depth * 0.8);

                if (i === 0) {
                    this.context.moveTo(x, y);
                } else {
                    this.context.lineTo(x, y);
                }
            }

            this.context.stroke();
        }

        this.context.restore();
    }

    drawAgentTrails(bass, mid, treble) {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.lineCap = 'round';

        this.agents.forEach((agent) => {
            const distance = Math.hypot(agent.x - agent.px, agent.y - agent.py);
            if (distance < 0.01 || distance > this.width * 0.35) return;

            this.context.strokeStyle = agent.color.glow;
            this.context.lineWidth = Math.max(1, agent.radius * (1.5 + bass + agent.z));
            this.context.globalAlpha = 0.32 + mid * 0.28 + treble * 0.12;
            this.context.beginPath();
            this.context.moveTo(agent.px, agent.py);
            this.context.lineTo(agent.x, agent.y);
            this.context.stroke();

            this.context.strokeStyle = agent.color.core;
            this.context.lineWidth = Math.max(0.6, agent.radius * (0.52 + treble * 0.45));
            this.context.globalAlpha = 0.42 + bass * 0.18;
            this.context.beginPath();
            this.context.moveTo(agent.px, agent.py);
            this.context.lineTo(agent.x, agent.y);
            this.context.stroke();
        });

        this.context.globalAlpha = 1;
        this.context.restore();
    }

    drawAgents(bass, treble) {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        this.agents.forEach((agent) => {
            if ((agent.id + this.counter) % 8 !== 0) return;

            const glow = agent.radius * (2.8 + bass * 4.5);
            const gradient = this.context.createRadialGradient(agent.x, agent.y, 0, agent.x, agent.y, glow);

            gradient.addColorStop(0, agent.color.core);
            gradient.addColorStop(0.34, agent.color.glow);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            this.context.fillStyle = gradient;
            this.context.beginPath();
            this.context.arc(agent.x, agent.y, glow, 0, Math.PI * 2);
            this.context.fill();

            this.context.fillStyle = agent.color.core;
            this.context.beginPath();
            this.context.arc(agent.x, agent.y, agent.radius * (0.48 + treble * 0.24), 0, Math.PI * 2);
            this.context.fill();
        });

        this.context.restore();
    }

    createFlash(bass) {
        const seed = this.counter + this.flashes.length * 19;
        this.flashes.push({
            x: this.width * (0.22 + this.hash(seed, 31) * 0.56),
            y: this.height * (0.28 + this.hash(seed, 32) * 0.44),
            radius: Math.min(this.width, this.height) * (0.04 + bass * 0.08),
            life: 1,
            color: COLORS[Math.floor(this.hash(seed, 33) * COLORS.length)]
        });

        if (this.flashes.length > 8) {
            this.flashes.shift();
        }
    }

    updateFlashes(dt) {
        this.flashes.forEach((flash) => {
            flash.radius += Math.min(this.width, this.height) * dt * 0.55;
            flash.life -= dt * 0.9;
        });

        this.flashes = this.flashes.filter((flash) => flash.life > 0);
    }

    drawFlashes() {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        this.flashes.forEach((flash) => {
            this.context.strokeStyle = flash.color.core.replace(/[\d.]+\)$/, `${0.48 * flash.life})`);
            this.context.lineWidth = Math.max(1, flash.radius * 0.025);
            this.context.beginPath();
            this.context.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
            this.context.stroke();
        });

        this.context.restore();
    }

    map(value, inMin, inMax, outMin, outMax) {
        return outMin + ((value - inMin) / Math.max(1, inMax - inMin)) * (outMax - outMin);
    }

    gaussian(index, salt) {
        const u = Math.max(0.0001, this.hash(index, salt));
        const v = Math.max(0.0001, this.hash(index, salt + 100));
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
    }

    hash(index, salt) {
        const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123;
        return value - Math.floor(value);
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
        this.createPaintCanvas();
        this.initializeNodes();
    }
}
