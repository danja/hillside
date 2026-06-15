import { BaseSimulation } from '../base/base-simulation.js';

export class TidesSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);

        this.ripples = [];
        this.flecks = [];
        this.sediment = [];
        this.bassMemory = 0;
        this.kickCooldown = 0;
        this.fleckCooldown = 0;
        this.lineCount = 28;
        this.pointCount = 88;

        this.initializeNodes();
    }

    initializeNodes() {
        this.sediment = [];
        this.nodes = this.sediment;

        const count = this.width > 1024 ? 180 : 120;
        for (let i = 0; i < count; i++) {
            this.sediment.push({
                id: i,
                x: this.hash(i, 1) * this.width,
                y: this.hash(i, 2) * this.height,
                size: 0.45 + this.hash(i, 3) * 1.4,
                phase: this.hash(i, 4) * Math.PI * 2,
                drift: 0.3 + this.hash(i, 5) * 0.8,
                opacity: 0.08 + this.hash(i, 6) * 0.16
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
        const kick = this.detectKick(bass, beat);

        this.drawDepthGradient(bass, mid);
        this.updateSediment(dt, elapsed, bass, mid, treble);
        this.updateRipples(dt);
        this.updateFlecks(dt);

        if (kick) {
            this.createRipple(bass);
        }
        if (treble > 0.5 && this.fleckCooldown <= 0) {
            this.createFlecks(treble);
            this.fleckCooldown = Math.max(2, Math.floor(8 - treble * 5));
        }

        this.drawCurrents(elapsed, bass, mid);
        this.drawContourField(elapsed, bass, mid, treble);
        this.drawRipples();
        this.drawSediment();
        this.drawFlecks();

        this.bassMemory = this.bassMemory * 0.94 + bass * 0.06;
        this.kickCooldown = Math.max(0, this.kickCooldown - 1);
        this.fleckCooldown = Math.max(0, this.fleckCooldown - 1);
    }

    detectKick(bass, beat) {
        const lift = bass - this.bassMemory;
        const kick = this.kickCooldown <= 0 && (lift > 0.12 || beat > 0.48 || bass > 0.78);

        if (kick) {
            this.kickCooldown = 12;
        }

        return kick;
    }

    drawDepthGradient(bass, mid) {
        const gradient = this.context.createRadialGradient(
            this.width * 0.52,
            this.height * 0.58,
            0,
            this.width * 0.5,
            this.height * 0.5,
            Math.max(this.width, this.height) * 0.82
        );
        const glow = 0.06 + bass * 0.045 + mid * 0.035;

        gradient.addColorStop(0, `rgba(5, 18, 20, ${glow})`);
        gradient.addColorStop(0.45, 'rgba(3, 8, 12, 0.72)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

        this.context.save();
        this.context.globalAlpha = 1;
        this.context.fillStyle = gradient;
        this.context.fillRect(0, 0, this.width, this.height);
        this.context.restore();
    }

    drawCurrents(elapsed, bass, mid) {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        const currents = [
            { x: 0.26, y: 0.52, color: 'rgba(20, 112, 105, 0.18)', phase: 0 },
            { x: 0.66, y: 0.42, color: 'rgba(116, 85, 31, 0.13)', phase: 2.1 },
            { x: 0.54, y: 0.7, color: 'rgba(76, 48, 102, 0.13)', phase: 4.2 }
        ];

        currents.forEach((current) => {
            const x = this.width * (current.x + Math.sin(elapsed * 0.055 + current.phase) * 0.08);
            const y = this.height * (current.y + Math.cos(elapsed * 0.047 + current.phase) * 0.08);
            const radius = Math.min(this.width, this.height) * (0.2 + mid * 0.09 + bass * 0.05);
            const gradient = this.context.createRadialGradient(x, y, 0, x, y, radius);

            gradient.addColorStop(0, current.color);
            gradient.addColorStop(0.65, current.color.replace('0.1', '0.04').replace('0.18', '0.04').replace('0.13', '0.035'));
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            this.context.fillStyle = gradient;
            this.context.beginPath();
            this.context.arc(x, y, radius, 0, Math.PI * 2);
            this.context.fill();
        });

        this.context.restore();
    }

    drawContourField(elapsed, bass, mid, treble) {
        const rowGap = this.height / (this.lineCount + 1);
        const pointGap = this.width / (this.pointCount - 1);
        const bend = this.height * (0.02 + bass * 0.08 + mid * 0.035);
        const shimmer = 0.35 + treble * 1.2;

        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        for (let row = 0; row < this.lineCount; row++) {
            const yBase = rowGap * (row + 1);
            const depth = row / Math.max(1, this.lineCount - 1);
            const opacity = 0.045 + (1 - Math.abs(depth - 0.55)) * 0.09 + bass * 0.035;
            const hue = row % 5 === 0 ? '167, 146, 70' : row % 3 === 0 ? '104, 72, 126' : '40, 170, 155';

            this.context.strokeStyle = `rgba(${hue}, ${opacity})`;
            this.context.lineWidth = 0.55 + bass * 0.9 + (row % 7 === 0 ? 0.35 : 0);
            this.context.beginPath();

            for (let point = 0; point < this.pointCount; point++) {
                const x = point * pointGap;
                const nx = point / Math.max(1, this.pointCount - 1);
                const wave = this.fieldValue(nx, depth, elapsed);
                const fine = Math.sin(nx * 28 + elapsed * 0.22 + row * 0.37) * shimmer;
                const rippleOffset = this.getRippleOffset(x, yBase);
                const y = yBase + wave * bend + fine + rippleOffset;

                if (point === 0) {
                    this.context.moveTo(x, y);
                } else {
                    this.context.lineTo(x, y);
                }
            }

            this.context.stroke();
        }

        this.context.restore();
    }

    fieldValue(x, y, t) {
        const slow = Math.sin(x * 7.2 + y * 5.4 + t * 0.13);
        const broad = Math.sin(x * 3.1 - y * 8.7 + t * 0.08);
        const eddy = Math.cos((x - 0.5) * (x - 0.5) * 13 + y * 9.2 - t * 0.11);

        return slow * 0.52 + broad * 0.34 + eddy * 0.22;
    }

    getRippleOffset(x, y) {
        let offset = 0;

        this.ripples.forEach((ripple) => {
            const dx = x - ripple.x;
            const dy = y - ripple.y;
            const d = Math.hypot(dx, dy);
            const band = Math.abs(d - ripple.radius);

            if (band < ripple.width * 1.8) {
                const strength = (1 - band / (ripple.width * 1.8)) * ripple.opacity;
                offset += Math.sin((d - ripple.radius) * 0.08) * strength * this.height * 0.035;
            }
        });

        return offset;
    }

    updateSediment(dt, elapsed, bass, mid, treble) {
        this.sediment.forEach((grain) => {
            const eddy = this.getEddy(grain.x, grain.y, elapsed);
            const flow = 0.12 + mid * 0.42 + bass * 0.14;
            const rise = Math.sin(elapsed * grain.drift + grain.phase) * (0.06 + treble * 0.16);

            grain.x += eddy.x * flow + dt * this.width * 0.0015;
            grain.y += eddy.y * flow + rise;

            if (grain.x > this.width + 8) grain.x = -8;
            if (grain.x < -8) grain.x = this.width + 8;
            if (grain.y > this.height + 8) grain.y = -8;
            if (grain.y < -8) grain.y = this.height + 8;
        });
    }

    getEddy(x, y, elapsed) {
        const nx = x / Math.max(1, this.width);
        const ny = y / Math.max(1, this.height);
        const a = Math.sin(nx * 8.6 + elapsed * 0.06) + Math.cos(ny * 7.4 - elapsed * 0.05);
        const b = Math.cos(nx * 5.2 - ny * 4.7 + elapsed * 0.09);

        return {
            x: Math.cos(a + b) * 0.85,
            y: Math.sin(a - b) * 0.65
        };
    }

    drawSediment() {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        this.sediment.forEach((grain) => {
            this.context.fillStyle = `rgba(172, 154, 94, ${grain.opacity})`;
            this.context.beginPath();
            this.context.arc(grain.x, grain.y, grain.size, 0, Math.PI * 2);
            this.context.fill();
        });

        this.context.restore();
    }

    createRipple(bass) {
        const seed = this.counter + this.ripples.length * 17;
        const x = this.width * (0.22 + this.hash(seed, 1) * 0.56);
        const y = this.height * (0.28 + this.hash(seed, 2) * 0.44);

        this.ripples.push({
            x,
            y,
            radius: Math.min(this.width, this.height) * 0.035,
            velocity: Math.min(this.width, this.height) * (0.008 + bass * 0.015),
            width: Math.min(this.width, this.height) * (0.012 + bass * 0.012),
            opacity: 0.22 + bass * 0.35
        });

        if (this.ripples.length > 10) {
            this.ripples.shift();
        }
    }

    updateRipples(dt) {
        this.ripples.forEach((ripple) => {
            ripple.radius += ripple.velocity * (1 + dt * 20);
            ripple.opacity *= 0.965;
            ripple.width *= 0.992;
        });

        this.ripples = this.ripples.filter((ripple) => ripple.opacity > 0.018);
    }

    drawRipples() {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        this.ripples.forEach((ripple) => {
            this.context.strokeStyle = `rgba(75, 196, 184, ${ripple.opacity})`;
            this.context.lineWidth = ripple.width;
            this.context.beginPath();
            this.context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.context.stroke();
        });

        this.context.restore();
    }

    createFlecks(treble) {
        const count = 1 + Math.floor(treble * 5);

        for (let i = 0; i < count; i++) {
            const seed = this.counter + i * 31;
            this.flecks.push({
                x: this.hash(seed, 4) * this.width,
                y: this.hash(seed, 5) * this.height,
                vx: (this.hash(seed, 6) - 0.5) * (0.4 + treble * 1.1),
                vy: (this.hash(seed, 7) - 0.5) * (0.4 + treble * 1.1),
                life: 1,
                size: 0.7 + this.hash(seed, 8) * 1.4
            });
        }

        if (this.flecks.length > 70) {
            this.flecks.splice(0, this.flecks.length - 70);
        }
    }

    updateFlecks(dt) {
        this.flecks.forEach((fleck) => {
            fleck.x += fleck.vx;
            fleck.y += fleck.vy;
            fleck.vx *= 0.985;
            fleck.vy *= 0.985;
            fleck.life -= dt * 0.42;
        });

        this.flecks = this.flecks.filter((fleck) => fleck.life > 0);
    }

    drawFlecks() {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        this.flecks.forEach((fleck) => {
            const alpha = Math.max(0, fleck.life) * 0.55;
            this.context.fillStyle = `rgba(238, 232, 204, ${alpha})`;
            this.context.beginPath();
            this.context.arc(fleck.x, fleck.y, fleck.size, 0, Math.PI * 2);
            this.context.fill();
        });

        this.context.restore();
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
        this.initializeNodes();
    }

    hash(index, salt) {
        const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123;
        return value - Math.floor(value);
    }
}
