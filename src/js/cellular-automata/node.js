import { clamp } from '../utils/math.js';

export class Node {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.dx = 2 - (Math.random() * 4);
        this.dy = 2 - (Math.random() * 4);
        this.size = 1 + Math.random() * 3;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
    }

    update() {
        this.size *= 0.999;
        this.size = clamp(this.size, 1, 100);
    }

    interact(other, distance) {
        if (distance < 19 * (this.size + other.size)) {
            this.size += (0.08 * other.size) / distance;
            other.size += (0.08 * this.size) / distance;
            
            this.vx += (0.41 * other.vx) / Math.max(distance, 0.01);
            this.vy += (0.41 * other.vy) / Math.max(distance, 0.01);
            other.vx += (0.41 * this.vx) / Math.max(distance, 0.01);
            other.vy += (0.41 * this.vy) / Math.max(distance, 0.01);
            
            return true;
        }
        return false;
    }
}