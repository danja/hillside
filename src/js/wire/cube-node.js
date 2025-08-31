import { clamp } from '../utils/math.js';
import { BaseNode } from '../base/base-node.js';

export class CubeNode extends BaseNode {
    constructor(id, x, y, grayscaleValue) {
        super(id, x, y, grayscaleValue);
        
        // Wire specific properties
        this.dx = 2 - (Math.random() * 4);
        this.dy = 2 - (Math.random() * 4);
        // Create much more dramatic size variation with some very large and very small cubes
        const rand = Math.random();
        if (rand < 0.3) {
            this.size = 2 + Math.random() * 5; // 30% small cubes: 2-7
        } else if (rand < 0.7) {
            this.size = 8 + Math.random() * 10; // 40% medium cubes: 8-18
        } else {
            this.size = 20 + Math.random() * 25; // 30% large cubes: 20-45
        }
        this.vx = 0;
        this.vy = 0;
        
        // 3D cube properties - more controlled depth range
        this.z = 50 + (Math.random() - 0.5) * 60; // Depth range: 20-80 for better perspective
        this.vz = (Math.random() - 0.5) * 0.5; // Slow Z velocity for organic movement
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.angularVelocityX = (Math.random() - 0.5) * 0.02;
        this.angularVelocityY = (Math.random() - 0.5) * 0.02;
        this.angularVelocityZ = (Math.random() - 0.5) * 0.02;
        
        // Grayscale value (0-1)
        this.grayscale = grayscaleValue;
        this.baseGrayscale = grayscaleValue;
    }

    update() {
        // Update size with extremely slow decay to preserve size differences
        this.size *= 0.99995;
        this.size = clamp(this.size, 1, 100); // Allow much larger max size for dramatic peaks
        
        // Update 3D position with velocity damping
        this.z += this.vz;
        this.vz *= 0.98; // Damping for organic movement
        
        // Constrain Z to reasonable bounds with soft boundaries
        if (this.z > 100) {
            this.z = 100;
            this.vz = -Math.abs(this.vz) * 0.8; // Bounce back softly
        } else if (this.z < 10) {
            this.z = 10;
            this.vz = Math.abs(this.vz) * 0.8; // Bounce back softly
        }
        
        // Update 3D rotation with bounds wrapping
        this.rotationX += this.angularVelocityX;
        this.rotationY += this.angularVelocityY;
        this.rotationZ += this.angularVelocityZ;
        
        // Keep rotations within 0-2π bounds
        this.rotationX = this.rotationX % (Math.PI * 2);
        this.rotationY = this.rotationY % (Math.PI * 2);
        this.rotationZ = this.rotationZ % (Math.PI * 2);
        
        // Damping on angular velocities for natural slowdown
        this.angularVelocityX *= 0.995;
        this.angularVelocityY *= 0.995;
        this.angularVelocityZ *= 0.995;
    }

    // Interactions are now handled in the WireSimulation class
    // This keeps the simulation logic centralized and audio-reactive
    
    // Calculate apparent size based on Z depth (perspective)
    getApparentSize() {
        const perspective = 300; // Reduced perspective for more dramatic size differences
        return this.size * perspective / (perspective + this.z);
    }
    
    // Calculate apparent position based on Z depth
    getApparentPosition() {
        const perspective = 300;
        const scale = perspective / (perspective + this.z);
        return {
            x: this.x * scale + (1 - scale) * window.innerWidth / 2,
            y: this.y * scale + (1 - scale) * window.innerHeight / 2,
            scale: scale
        };
    }
    
    // Get 3D distance to another node
    getDistance3D(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}