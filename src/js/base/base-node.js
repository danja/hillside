export class BaseNode {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        
        // Base properties that can be used by subclasses
        this.size = 1;
        this.vx = 0;
        this.vy = 0;
    }

    // Base update method - should be overridden by subclasses
    update() {
        // Override in subclasses
    }

    // Base interaction method - should be overridden by subclasses  
    interact(other, distance) {
        // Override in subclasses
        return false;
    }

    // Utility method for position updates
    updatePosition(deltaTime = 1) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    // Utility method for distance calculation to another node
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Utility method for angle to another node
    angleTo(other) {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }

    // Check if node is within canvas bounds
    isWithinBounds(width, height, margin = 0) {
        return this.x >= margin && 
               this.x <= width - margin && 
               this.y >= margin && 
               this.y <= height - margin;
    }

    // Wrap around screen edges
    wrapAroundBounds(width, height) {
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    // Bounce off screen edges
    bounceOffBounds(width, height) {
        if (this.x <= 0 || this.x >= width) {
            this.vx *= -1;
            this.x = Math.max(0, Math.min(width, this.x));
        }
        if (this.y <= 0 || this.y >= height) {
            this.vy *= -1;
            this.y = Math.max(0, Math.min(height, this.y));
        }
    }
}