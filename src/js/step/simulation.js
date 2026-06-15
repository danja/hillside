import { BaseSimulation } from '../base/base-simulation.js';
import { distance } from '../utils/math.js';

export class StepSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);

        this.blobs = [];
        this.ripples = [];
        this.sparks = [];
        this.pressure = 0;
        this.bassMemory = 0;
        this.thumpCooldown = 0;
        this.sparkCooldown = 0;
        this.fieldCanvas = null;
        this.fieldContext = null;
        this.fieldScale = 0.5;

        this.createFieldCanvas();
        this.initializeNodes();
    }

    initializeNodes() {
        this.blobs = [];
        this.nodes = this.blobs;

        const count = this.width > 1024 ? 38 : 28;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const minSize = Math.min(this.width, this.height);

        for (let i = 0; i < count; i++) {
            const angle = this.hash(i, 1) * Math.PI * 2;
            const radius = Math.sqrt(this.hash(i, 2));
            const orbitX = Math.cos(angle) * this.width * 0.22 * radius;
            const orbitY = Math.sin(angle) * this.height * 0.18 * radius;

            this.blobs.push({
                id: i,
                x: centerX + orbitX,
                y: centerY + orbitY,
                vx: (this.hash(i, 3) - 0.5) * 0.28,
                vy: (this.hash(i, 4) - 0.5) * 0.28,
                baseRadius: minSize * (0.045 + this.hash(i, 5) * 0.07),
                radius: minSize * 0.08,
                phase: this.hash(i, 6) * Math.PI * 2,
                drift: 0.45 + this.hash(i, 7) * 0.85,
                color: this.pickColor(i),
                pull: 0.015 + this.hash(i, 8) * 0.018
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
        const thump = this.detectThump(bass, beat);

        this.drawBackground(bass, beat);
        this.updateBlobs(dt, elapsed, bass, mid, treble, thump);
        this.updateRipples(dt);
        this.updateSparks(dt);

        if (thump) {
            this.createRipple(bass);
        }
        if (treble > 0.62 && this.sparkCooldown <= 0) {
            this.createSparks(treble);
            this.sparkCooldown = 3;
        }

        this.drawPressureField(bass, mid, treble);
        this.drawTendrils(mid);
        this.drawRipples();
        this.drawSparks();

        this.bassMemory = this.bassMemory * 0.92 + bass * 0.08;
        this.thumpCooldown = Math.max(0, this.thumpCooldown - 1);
        this.sparkCooldown = Math.max(0, this.sparkCooldown - 1);
    }

    detectThump(bass, beat) {
        const impact = bass - this.bassMemory;
        const thump = this.thumpCooldown <= 0 && (impact > 0.16 || beat > 0.52 || bass > 0.82);

        if (thump) {
            this.pressure = Math.min(1.8, this.pressure + 0.55 + bass * 0.8);
            this.thumpCooldown = 8;
        } else {
            this.pressure *= 0.93;
        }

        return thump;
    }

    updateBlobs(dt, elapsed, bass, mid, treble, thump) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const pressurePush = this.pressure * (0.9 + bass * 1.6);
        const viscosity = 0.988 - Math.min(0.08, bass * 0.05);

        this.blobs.forEach((blob) => {
            const orbit = elapsed * blob.drift + blob.phase;
            const wobbleX = Math.sin(orbit * 0.73) * (0.015 + mid * 0.035);
            const wobbleY = Math.cos(orbit * 0.61) * (0.015 + treble * 0.025);
            const dx = blob.x - centerX;
            const dy = blob.y - centerY;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const edgeX = dx / dist;
            const edgeY = dy / dist;
            const sink = 0.018 + bass * 0.012;

            blob.vx += (centerX - blob.x) * blob.pull * dt * sink;
            blob.vy += (centerY - blob.y) * blob.pull * dt * sink;
            blob.vx += edgeX * pressurePush * dt * 1.4;
            blob.vy += edgeY * pressurePush * dt * 1.4;
            blob.vx += wobbleX;
            blob.vy += wobbleY;

            if (thump) {
                blob.vx += edgeX * (0.7 + bass * 1.1);
                blob.vy += edgeY * (0.7 + bass * 1.1);
            }

            blob.vx *= viscosity;
            blob.vy *= viscosity;
            blob.x += blob.vx;
            blob.y += blob.vy;

            blob.radius = blob.baseRadius * (1.0 + bass * 1.6 + this.pressure * 0.45);
            this.keepBlobInFrame(blob);
        });
    }

    keepBlobInFrame(blob) {
        const padding = blob.radius * 1.6;
        if (blob.x < -padding) {
            blob.x = -padding;
            blob.vx = Math.abs(blob.vx) * 0.35;
        } else if (blob.x > this.width + padding) {
            blob.x = this.width + padding;
            blob.vx = -Math.abs(blob.vx) * 0.35;
        }

        if (blob.y < -padding) {
            blob.y = -padding;
            blob.vy = Math.abs(blob.vy) * 0.35;
        } else if (blob.y > this.height + padding) {
            blob.y = this.height + padding;
            blob.vy = -Math.abs(blob.vy) * 0.35;
        }
    }

    drawBackground(bass, beat) {
        const glow = Math.min(0.22, 0.035 + bass * 0.08 + beat * 0.07);
        const gradient = this.context.createRadialGradient(
            this.width * 0.48,
            this.height * 0.55,
            0,
            this.width * 0.5,
            this.height * 0.5,
            Math.max(this.width, this.height) * 0.75
        );

        gradient.addColorStop(0, `rgba(5, 14, 18, ${glow})`);
        gradient.addColorStop(0.55, 'rgba(2, 4, 8, 0.45)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

        this.context.save();
        this.context.globalAlpha = 1;
        this.context.fillStyle = gradient;
        this.context.fillRect(0, 0, this.width, this.height);
        this.context.restore();
    }

    drawPressureField(bass, mid, treble) {
        const field = this.fieldContext;
        if (!field) return;

        const fieldWidth = this.fieldCanvas.width;
        const fieldHeight = this.fieldCanvas.height;
        field.save();
        field.setTransform(this.fieldScale, 0, 0, this.fieldScale, 0, 0);
        field.clearRect(0, 0, this.width, this.height);
        field.globalCompositeOperation = 'lighter';

        this.blobs.forEach((blob) => {
            const pulse = 1 + bass * 0.45 + Math.sin(this.getElapsedTime() * blob.drift + blob.phase) * 0.08;
            const radius = blob.radius * pulse;
            const gradient = field.createRadialGradient(blob.x, blob.y, radius * 0.08, blob.x, blob.y, radius);
            gradient.addColorStop(0, blob.color.core);
            gradient.addColorStop(0.45, blob.color.mid);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            field.fillStyle = gradient;
            field.beginPath();
            field.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
            field.fill();
        });

        field.restore();

        this.context.save();
        this.context.globalAlpha = 0.78 + bass * 0.18;
        this.context.globalCompositeOperation = 'screen';
        this.context.filter = `blur(${Math.max(10, Math.min(this.width, this.height) * (0.028 + mid * 0.016))}px) saturate(${1.1 + treble * 0.55})`;
        this.context.drawImage(this.fieldCanvas, 0, 0, fieldWidth, fieldHeight, 0, 0, this.width, this.height);
        this.context.filter = 'none';
        this.context.globalAlpha = 0.35 + bass * 0.28;
        this.context.drawImage(this.fieldCanvas, 0, 0, fieldWidth, fieldHeight, 0, 0, this.width, this.height);
        this.context.restore();
    }

    drawTendrils(mid) {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.lineCap = 'round';

        const maxDistance = Math.min(this.width, this.height) * (0.22 + mid * 0.16);
        for (let i = 0; i < this.blobs.length; i++) {
            const a = this.blobs[i];
            for (let j = i + 1; j < this.blobs.length; j++) {
                const b = this.blobs[j];
                const d = distance(a, b);
                if (d > maxDistance) continue;

                const opacity = (1 - d / maxDistance) * (0.12 + mid * 0.25);
                const width = 1 + mid * 5 + this.pressure * 1.5;
                const curve = Math.sin((a.phase + b.phase + this.getElapsedTime()) * 0.7) * d * 0.11;
                const midX = (a.x + b.x) / 2 + curve;
                const midY = (a.y + b.y) / 2 - curve * 0.45;

                this.context.strokeStyle = `rgba(48, 205, 178, ${opacity})`;
                this.context.lineWidth = width;
                this.context.beginPath();
                this.context.moveTo(a.x, a.y);
                this.context.quadraticCurveTo(midX, midY, b.x, b.y);
                this.context.stroke();
            }
        }

        this.context.restore();
    }

    createRipple(bass) {
        const anchor = this.blobs[Math.floor(this.hash(this.counter + this.ripples.length, 12) * this.blobs.length)] || {
            x: this.width / 2,
            y: this.height / 2
        };

        this.ripples.push({
            x: anchor.x,
            y: anchor.y,
            radius: Math.min(this.width, this.height) * 0.04,
            velocity: Math.min(this.width, this.height) * (0.012 + bass * 0.018),
            opacity: 0.42 + bass * 0.35,
            width: Math.min(this.width, this.height) * (0.01 + bass * 0.015)
        });

        if (this.ripples.length > 14) {
            this.ripples.shift();
        }
    }

    updateRipples(dt) {
        this.ripples.forEach((ripple) => {
            ripple.radius += ripple.velocity * (1 + dt * 18);
            ripple.opacity *= 0.945;
            ripple.width *= 0.986;
        });

        this.ripples = this.ripples.filter((ripple) => ripple.opacity > 0.025);
    }

    drawRipples() {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';

        this.ripples.forEach((ripple) => {
            this.context.strokeStyle = `rgba(86, 186, 190, ${ripple.opacity})`;
            this.context.lineWidth = ripple.width;
            this.context.beginPath();
            this.context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.context.stroke();
        });

        this.context.restore();
    }

    createSparks(treble) {
        const count = 1 + Math.floor(treble * 4);

        for (let i = 0; i < count; i++) {
            const blob = this.blobs[Math.floor(this.hash(this.counter + i, 21) * this.blobs.length)];
            if (!blob) continue;

            const angle = this.hash(this.counter + i, 22) * Math.PI * 2;
            const length = Math.min(this.width, this.height) * (0.035 + this.hash(this.counter + i, 23) * 0.09);

            this.sparks.push({
                x: blob.x + Math.cos(angle) * blob.radius * 0.45,
                y: blob.y + Math.sin(angle) * blob.radius * 0.45,
                dx: Math.cos(angle) * length,
                dy: Math.sin(angle) * length,
                opacity: 0.22 + treble * 0.38,
                width: 0.8 + treble * 2
            });
        }

        if (this.sparks.length > 28) {
            this.sparks.splice(0, this.sparks.length - 28);
        }
    }

    updateSparks() {
        this.sparks.forEach((spark) => {
            spark.opacity *= 0.82;
            spark.width *= 0.94;
        });

        this.sparks = this.sparks.filter((spark) => spark.opacity > 0.018);
    }

    drawSparks() {
        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.lineCap = 'round';

        this.sparks.forEach((spark) => {
            this.context.strokeStyle = `rgba(132, 240, 219, ${spark.opacity})`;
            this.context.lineWidth = spark.width;
            this.context.beginPath();
            this.context.moveTo(spark.x, spark.y);
            this.context.lineTo(spark.x + spark.dx, spark.y + spark.dy);
            this.context.stroke();
        });

        this.context.restore();
    }

    createFieldCanvas() {
        if (typeof document === 'undefined') return;

        this.fieldCanvas = document.createElement('canvas');
        this.fieldContext = this.fieldCanvas.getContext('2d');
        this.resizeFieldCanvas();
    }

    resizeFieldCanvas() {
        if (!this.fieldCanvas) return;

        this.fieldCanvas.width = Math.max(1, Math.floor(this.width * this.fieldScale));
        this.fieldCanvas.height = Math.max(1, Math.floor(this.height * this.fieldScale));
    }

    onResize(width, height) {
        this.resizeFieldCanvas();
        this.initializeNodes();
    }

    pickColor(index) {
        const colors = [
            {
                core: 'rgba(11, 90, 80, 0.58)',
                mid: 'rgba(12, 48, 62, 0.28)'
            },
            {
                core: 'rgba(35, 28, 82, 0.5)',
                mid: 'rgba(18, 16, 46, 0.25)'
            },
            {
                core: 'rgba(64, 15, 76, 0.42)',
                mid: 'rgba(24, 10, 34, 0.22)'
            },
            {
                core: 'rgba(5, 64, 92, 0.5)',
                mid: 'rgba(4, 26, 45, 0.24)'
            }
        ];

        return colors[index % colors.length];
    }

    hash(index, salt) {
        const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123;
        return value - Math.floor(value);
    }
}
