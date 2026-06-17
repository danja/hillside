import { BaseSimulation } from '../base/base-simulation.js';

export class TidesSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);

        this.ripples = [];
        this.flecks = [];
        this.sediment = [];
        this.creatures = [];
        this.bassMemory = 0;
        this.kickCooldown = 0;
        this.fleckCooldown = 0;
        this.lineCount = 34;
        this.pointCount = 104;

        this.initializeNodes();
    }

    initializeNodes() {
        this.sediment = [];
        this.creatures = [];
        this.nodes = [];

        const count = this.width > 1024 ? 240 : 170;
        for (let i = 0; i < count; i++) {
            this.sediment.push({
                id: i,
                x: this.hash(i, 1) * this.width,
                y: this.hash(i, 2) * this.height,
                size: 0.65 + this.hash(i, 3) * 1.85,
                phase: this.hash(i, 4) * Math.PI * 2,
                drift: 0.3 + this.hash(i, 5) * 0.8,
                opacity: 0.14 + this.hash(i, 6) * 0.24
            });
        }

        const creatureCount = this.width > 1024 ? 14 : 10;
        for (let i = 0; i < creatureCount; i++) {
            const size = Math.min(this.width, this.height) * (0.042 + this.hash(i, 11) * 0.048);
            this.creatures.push({
                id: i,
                x: this.width * (0.08 + this.hash(i, 12) * 0.84),
                y: this.height * (0.2 + this.hash(i, 13) * 0.62),
                vx: (0.045 + this.hash(i, 14) * 0.13) * (this.hash(i, 15) > 0.5 ? 1 : -1),
                vy: (this.hash(i, 16) - 0.5) * 0.06,
                size,
                phase: this.hash(i, 17) * Math.PI * 2,
                pulse: 0.45 + this.hash(i, 18) * 0.65,
                tentacles: 5 + Math.floor(this.hash(i, 19) * 6),
                hue: i % 3,
                shape: i % 2
            });
        }

        this.nodes = [...this.sediment, ...this.creatures];
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
        this.drawCreatures(elapsed, bass, mid, treble);

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
        const glow = 0.09 + bass * 0.065 + mid * 0.055;

        gradient.addColorStop(0, `rgba(6, 25, 27, ${glow})`);
        gradient.addColorStop(0.45, 'rgba(4, 11, 16, 0.78)');
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
            { x: 0.26, y: 0.52, color: 'rgba(24, 145, 132, 0.24)', phase: 0 },
            { x: 0.66, y: 0.42, color: 'rgba(148, 111, 42, 0.19)', phase: 2.1 },
            { x: 0.54, y: 0.7, color: 'rgba(105, 68, 138, 0.19)', phase: 4.2 }
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
        const bend = this.height * (0.028 + bass * 0.095 + mid * 0.052);
        const shimmer = 0.75 + treble * 1.8;

        this.context.save();
        this.context.globalCompositeOperation = 'screen';
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        for (let row = 0; row < this.lineCount; row++) {
            const yBase = rowGap * (row + 1);
            const depth = row / Math.max(1, this.lineCount - 1);
            const opacity = 0.095 + (1 - Math.abs(depth - 0.55)) * 0.16 + bass * 0.055;
            const hue = row % 5 === 0 ? '167, 146, 70' : row % 3 === 0 ? '104, 72, 126' : '40, 170, 155';

            this.context.strokeStyle = `rgba(${hue}, ${opacity})`;
            this.context.lineWidth = 0.85 + bass * 1.2 + (row % 7 === 0 ? 0.55 : 0);
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
            const flow = 0.14 + mid * 0.52 + bass * 0.18;
            const rise = Math.sin(elapsed * grain.drift + grain.phase) * (0.08 + treble * 0.22);

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
            this.context.fillStyle = `rgba(190, 174, 112, ${grain.opacity})`;
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
            opacity: 0.24 + bass * 0.32,
            wobble: 0.08 + this.hash(seed, 3) * 0.12,
            lobes: 5 + Math.floor(this.hash(seed, 4) * 7),
            phase: this.hash(seed, 5) * Math.PI * 2
        });

        if (this.ripples.length > 8) {
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
            this.context.strokeStyle = `rgba(87, 220, 205, ${ripple.opacity * 0.82})`;
            this.context.lineWidth = ripple.width;
            this.context.beginPath();

            const points = 144;
            for (let i = 0; i <= points; i++) {
                const t = (i / points) * Math.PI * 2;
                const wobble = 1 +
                    Math.sin(t * ripple.lobes + ripple.phase + this.counter * 0.018) * ripple.wobble +
                    Math.sin(t * (ripple.lobes + 3) - this.counter * 0.013) * ripple.wobble * 0.45;
                const radius = ripple.radius * wobble;
                const x = ripple.x + Math.cos(t) * radius;
                const y = ripple.y + Math.sin(t) * radius;

                if (i === 0) {
                    this.context.moveTo(x, y);
                } else {
                    this.context.lineTo(x, y);
                }
            }

            this.context.closePath();
            this.context.stroke();
        });

        this.context.restore();
    }

    drawCreatures(elapsed, bass, mid, treble) {
        this.context.save();
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        this.creatures.forEach((creature) => {
            this.updateCreature(creature, elapsed, bass, mid);

            const pulse = 1 + Math.sin(elapsed * creature.pulse + creature.phase) * 0.12 + bass * 0.24;
            const bodyWidth = creature.size * (1.25 + mid * 0.45) * pulse;
            const bodyHeight = creature.size * (0.78 + treble * 0.24);
            const colors = this.getCreatureColors(creature.hue, bass, mid);
            const angle = Math.atan2(creature.vy, creature.vx || 0.001);

            this.context.save();
            this.context.translate(creature.x, creature.y);

            if (creature.shape === 0) {
                this.context.rotate(angle * 0.22);
                this.drawRayCreature(creature, colors, bodyWidth * 1.18, bodyHeight * 1.12, elapsed, bass, mid, treble);
            } else {
                this.context.rotate(Math.sin(elapsed * 0.24 + creature.phase) * 0.12);
                this.drawJellyCreature(creature, colors, bodyWidth * 1.2, bodyHeight * 1.15, elapsed, bass, mid, treble);
            }

            this.context.restore();
        });

        this.context.restore();
    }

    drawJellyCreature(creature, colors, width, height, elapsed, bass, mid, treble) {
        const bellPulse = 1 + Math.sin(elapsed * (0.9 + creature.pulse) + creature.phase) * (0.05 + bass * 0.06);
        const bellWidth = width * bellPulse;
        const bellHeight = height * (1.08 + mid * 0.18);

        this.context.save();
        this.context.globalCompositeOperation = 'source-over';
        this.context.fillStyle = 'rgba(0, 0, 0, 0.26)';
        this.context.beginPath();
        this.context.ellipse(0, bellHeight * 0.48, bellWidth * 1.35, bellHeight * 1.7, 0, 0, Math.PI * 2);
        this.context.fill();

        this.context.globalCompositeOperation = 'screen';
        this.context.shadowBlur = creature.size * (0.45 + bass * 0.5);
        this.context.shadowColor = colors.shadow;
        this.context.fillStyle = colors.core;
        this.context.beginPath();
        this.drawCreatureBellPath(bellWidth, bellHeight, elapsed + creature.phase);
        this.context.fill();

        this.context.shadowBlur = 0;
        this.context.strokeStyle = colors.line;
        this.context.lineWidth = 1.45 + bass * 1.35;
        this.context.beginPath();
        this.drawCreatureBellPath(bellWidth, bellHeight, elapsed + creature.phase);
        this.context.stroke();

        this.drawCreatureTendrils(creature, colors, bellWidth, bellHeight, elapsed, mid, treble);

        this.context.fillStyle = colors.spark;
        for (let i = 0; i < 3; i++) {
            const dotX = bellWidth * (-0.25 + i * 0.25);
            const dotY = -bellHeight * (0.12 + Math.sin(elapsed + creature.phase + i) * 0.06);
            this.context.beginPath();
            this.context.arc(dotX, dotY, Math.max(1.2, creature.size * 0.055), 0, Math.PI * 2);
            this.context.fill();
        }

        this.context.restore();
    }

    drawRayCreature(creature, colors, width, height, elapsed, bass, mid, treble) {
        const finLift = Math.sin(elapsed * (1.1 + creature.pulse) + creature.phase) * height * (0.22 + treble * 0.2);

        this.context.save();
        this.context.globalCompositeOperation = 'source-over';
        this.context.fillStyle = 'rgba(0, 0, 0, 0.22)';
        this.context.beginPath();
        this.context.ellipse(0, 0, width * 1.65, height * 1.32, 0, 0, Math.PI * 2);
        this.context.fill();

        this.context.globalCompositeOperation = 'screen';
        this.context.shadowBlur = creature.size * (0.32 + bass * 0.4);
        this.context.shadowColor = colors.shadow;

        const gradient = this.context.createRadialGradient(0, 0, 0, 0, 0, width * 1.35);
        gradient.addColorStop(0, colors.core);
        gradient.addColorStop(0.58, colors.shell);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.context.fillStyle = gradient;
        this.context.beginPath();
        this.context.moveTo(width * 1.18, 0);
        this.context.bezierCurveTo(width * 0.35, -height * 0.92 - finLift, -width * 0.65, -height * 0.64, -width * 1.04, 0);
        this.context.bezierCurveTo(-width * 0.65, height * 0.64, width * 0.35, height * 0.92 + finLift, width * 1.18, 0);
        this.context.fill();

        this.context.shadowBlur = 0;
        this.context.strokeStyle = colors.line;
        this.context.lineWidth = 1.35 + bass * 1.2;
        this.context.stroke();

        this.context.strokeStyle = colors.fin;
        this.context.lineWidth = 0.9 + mid * 0.9;
        for (let i = -1; i <= 1; i++) {
            this.context.beginPath();
            this.context.moveTo(width * -0.75, i * height * 0.18);
            this.context.quadraticCurveTo(
                width * 0.08,
                i * height * 0.42 + Math.sin(elapsed * 1.2 + creature.phase + i) * height * 0.12,
                width * 0.86,
                i * height * 0.1
            );
            this.context.stroke();
        }

        this.context.strokeStyle = colors.tentacle;
        this.context.lineWidth = 1.1 + treble;
        this.context.beginPath();
        this.context.moveTo(-width * 0.95, 0);
        this.context.quadraticCurveTo(
            -width * 1.45,
            Math.sin(elapsed * 1.4 + creature.phase) * height * 0.55,
            -width * 1.95,
            Math.cos(elapsed * 1.1 + creature.phase) * height * 0.4
        );
        this.context.stroke();

        this.context.fillStyle = colors.spark;
        this.context.beginPath();
        this.context.arc(width * 0.48, -height * 0.06, Math.max(1.2, creature.size * 0.055), 0, Math.PI * 2);
        this.context.fill();

        this.context.restore();
    }

    drawCreatureBellPath(width, height, time) {
        const points = 18;
        for (let i = 0; i <= points; i++) {
            const t = (i / points) * Math.PI;
            const wobble = 1 + Math.sin(t * 5 + time * 0.8) * 0.08;
            const x = Math.cos(t) * width * wobble;
            const y = Math.sin(t) * -height * 0.85;
            if (i === 0) {
                this.context.moveTo(x, y);
            } else {
                this.context.lineTo(x, y);
            }
        }

        this.context.quadraticCurveTo(width * 0.58, height * 0.38, width * 0.24, height * 0.34);
        this.context.quadraticCurveTo(width * 0.08, height * 0.58, -width * 0.08, height * 0.34);
        this.context.quadraticCurveTo(-width * 0.28, height * 0.52, -width * 0.52, height * 0.2);
        this.context.quadraticCurveTo(-width * 0.76, height * 0.08, -width, 0);
        this.context.closePath();
    }

    drawCreatureTendrils(creature, colors, bodyWidth, bodyHeight, elapsed, mid, treble) {
        for (let i = 0; i < creature.tentacles; i++) {
            const side = (i / Math.max(1, creature.tentacles - 1) - 0.5) * 2;
            const startX = side * bodyWidth * 0.55;
            const startY = bodyHeight * 0.25;
            const length = creature.size * (1.4 + this.hash(creature.id, i + 30) * 1.9 + mid * 1.05);
            const wave = Math.sin(elapsed * (0.7 + creature.pulse) + creature.phase + i) * creature.size * 0.52;
            const endX = startX + side * creature.size * 0.38 + wave * 0.18;
            const endY = startY + length;

            this.context.strokeStyle = colors.tentacle;
            this.context.lineWidth = 1.05 + treble * 1.15;
            this.context.beginPath();
            this.context.moveTo(startX, startY);
            this.context.bezierCurveTo(
                startX + side * creature.size * 0.25,
                startY + length * 0.28,
                endX - side * creature.size * 0.3,
                startY + length * 0.7 + wave,
                endX,
                endY
            );
            this.context.stroke();
        }
    }

    updateCreature(creature, elapsed, bass, mid) {
        const eddy = this.getEddy(creature.x, creature.y, elapsed);
        creature.vx += eddy.x * (0.008 + mid * 0.018);
        creature.vy += eddy.y * (0.008 + bass * 0.014);
        creature.vx *= 0.992;
        creature.vy *= 0.992;
        creature.x += creature.vx;
        creature.y += creature.vy + Math.sin(elapsed * creature.pulse + creature.phase) * 0.08;

        const padding = creature.size * 4;
        if (creature.x > this.width + padding) creature.x = -padding;
        if (creature.x < -padding) creature.x = this.width + padding;
        if (creature.y > this.height + padding) creature.y = -padding;
        if (creature.y < -padding) creature.y = this.height + padding;
    }

    getCreatureColors(hue, bass, mid) {
        const brightness = 0.42 + bass * 0.28 + mid * 0.18;
        const palettes = [
            {
                core: `rgba(105, 236, 210, ${brightness + 0.3})`,
                shell: 'rgba(27, 137, 126, 0.62)',
                line: 'rgba(190, 255, 240, 0.94)',
                tentacle: 'rgba(142, 242, 225, 0.72)',
                spark: 'rgba(238, 255, 248, 0.9)',
                fin: 'rgba(160, 250, 230, 0.78)',
                shadow: 'rgba(77, 225, 205, 0.66)'
            },
            {
                core: `rgba(175, 130, 216, ${brightness + 0.18})`,
                shell: 'rgba(93, 55, 130, 0.56)',
                line: 'rgba(226, 190, 250, 0.86)',
                tentacle: 'rgba(202, 168, 236, 0.64)',
                spark: 'rgba(248, 232, 255, 0.84)',
                fin: 'rgba(220, 180, 246, 0.7)',
                shadow: 'rgba(165, 110, 220, 0.56)'
            },
            {
                core: `rgba(210, 179, 94, ${brightness + 0.12})`,
                shell: 'rgba(122, 92, 34, 0.54)',
                line: 'rgba(246, 226, 158, 0.84)',
                tentacle: 'rgba(236, 212, 138, 0.64)',
                spark: 'rgba(255, 246, 202, 0.84)',
                fin: 'rgba(238, 214, 142, 0.68)',
                shadow: 'rgba(218, 182, 82, 0.48)'
            }
        ];

        return palettes[hue % palettes.length];
    }

    createFlecks(treble) {
        const count = 2 + Math.floor(treble * 8);

        for (let i = 0; i < count; i++) {
            const seed = this.counter + i * 31;
            this.flecks.push({
                x: this.hash(seed, 4) * this.width,
                y: this.hash(seed, 5) * this.height,
                vx: (this.hash(seed, 6) - 0.5) * (0.4 + treble * 1.1),
                vy: (this.hash(seed, 7) - 0.5) * (0.4 + treble * 1.1),
                life: 1,
                size: 1 + this.hash(seed, 8) * 1.9
            });
        }

        if (this.flecks.length > 110) {
            this.flecks.splice(0, this.flecks.length - 110);
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
            const alpha = Math.max(0, fleck.life) * 0.78;
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
