import { BaseNode } from '../base/base-node.js';

export class SandpileCell extends BaseNode {
    constructor(id, x, y, gridX, gridY) {
        // Initialize with black color for empty cell (0 grains)
        super(id, x, y, '#000000');
        
        // Grid position for neighbor calculations
        this.gridX = gridX;
        this.gridY = gridY;
        
        // Sand grain count (0-3 stable, 4+ unstable)
        this.grains = 0;
        
        // Visual properties
        this.cellSize = 8; // Size of each grid cell
        this.targetColor = '#000000';
        this.animationProgress = 0;
        
        // Toppling animation
        this.justToppled = false;
        this.toppleAnimation = 0;
        
        // Color mapping for grain counts
        this.grainColors = {
            0: '#000000', // Black - empty
            1: '#1a237e', // Deep blue
            2: '#2e7d32', // Green  
            3: '#f57c00'  // Orange/gold
        };
    }

    // Add sand grains to this cell
    addGrains(count = 1) {
        this.grains += count;
        this.updateColor();
        return this.grains >= 4; // Return true if cell becomes unstable
    }

    // Check if cell is unstable (needs to topple)
    isUnstable() {
        return this.grains >= 4;
    }

    // Perform toppling - distribute grains to neighbors
    topple() {
        if (!this.isUnstable()) return 0;
        
        const grainsToDistribute = Math.floor(this.grains / 4) * 4;
        this.grains -= grainsToDistribute;
        
        // Visual feedback for toppling
        this.justToppled = true;
        this.toppleAnimation = 1.0;
        
        this.updateColor();
        return grainsToDistribute / 4; // Grains per neighbor
    }

    // Update cell color based on grain count and audio influence
    updateColor(audioInfluence = {}) {
        const baseColor = this.grainColors[Math.min(this.grains, 3)];
        
        // Apply audio-reactive color modifications
        if (audioInfluence.bass > 0.7) {
            // High bass - shift towards red
            this.targetColor = this.shiftColor(baseColor, '#ff4444', audioInfluence.bass * 0.3);
        } else if (audioInfluence.treble > 0.6) {
            // High treble - shift towards white/bright
            this.targetColor = this.shiftColor(baseColor, '#ffffff', audioInfluence.treble * 0.2);
        } else {
            this.targetColor = baseColor;
        }
        
        this.color = this.targetColor;
    }

    // Helper method to blend two colors
    shiftColor(baseColor, targetColor, intensity) {
        const base = this.hexToRgb(baseColor);
        const target = this.hexToRgb(targetColor);
        
        if (!base || !target) return baseColor;
        
        const r = Math.round(base.r + (target.r - base.r) * intensity);
        const g = Math.round(base.g + (target.g - base.g) * intensity);
        const b = Math.round(base.b + (target.b - base.b) * intensity);
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Update animation states
    update(deltaTime) {
        // Animate toppling effect
        if (this.toppleAnimation > 0) {
            this.toppleAnimation -= deltaTime * 3; // Fade over ~0.33 seconds
            if (this.toppleAnimation <= 0) {
                this.toppleAnimation = 0;
                this.justToppled = false;
            }
        }
    }

    // Get neighbors for this cell in the grid
    getNeighborPositions() {
        return [
            { x: this.gridX - 1, y: this.gridY },     // Left
            { x: this.gridX + 1, y: this.gridY },     // Right
            { x: this.gridX, y: this.gridY - 1 },     // Up
            { x: this.gridX, y: this.gridY + 1 }      // Down
        ];
    }

    // Draw the cell
    draw(context, audioInfluence = {}) {
        // Base cell drawing
        context.fillStyle = this.color;
        context.fillRect(
            this.x - this.cellSize/2, 
            this.y - this.cellSize/2, 
            this.cellSize, 
            this.cellSize
        );

        // Draw toppling animation effect
        if (this.toppleAnimation > 0) {
            const pulseSize = this.cellSize * (1 + this.toppleAnimation * 0.5);
            const pulseAlpha = this.toppleAnimation * 0.7;
            
            context.save();
            context.globalAlpha = pulseAlpha;
            context.fillStyle = '#ffffff';
            context.fillRect(
                this.x - pulseSize/2,
                this.y - pulseSize/2,
                pulseSize,
                pulseSize
            );
            context.restore();
        }

        // Draw grain count for debugging (optional)
        if (this.grains > 0 && audioInfluence.beatIntensity > 0.5) {
            context.save();
            context.fillStyle = 'white';
            context.font = '8px monospace';
            context.textAlign = 'center';
            context.fillText(
                this.grains.toString(), 
                this.x, 
                this.y + 2
            );
            context.restore();
        }
    }
}