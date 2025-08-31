import { describe, it, expect, beforeEach } from 'vitest';
import { CubeNode } from '../../src/js/wire/cube-node.js';

describe('CubeNode', () => {
    let node;
    const testId = 1;
    const testX = 100;
    const testY = 200;
    const testGrayscale = 0.5;

    beforeEach(() => {
        node = new CubeNode(testId, testX, testY, testGrayscale);
    });

    it('should create CubeNode instance with proper inheritance', () => {
        expect(node).toBeDefined();
        expect(node.id).toBe(testId);
        expect(node.x).toBe(testX);
        expect(node.y).toBe(testY);
        expect(node.grayscale).toBe(testGrayscale);
        expect(node.baseGrayscale).toBe(testGrayscale);
    });

    it('should initialize 3D properties correctly', () => {
        expect(node.z).toBeGreaterThanOrEqual(20);
        expect(node.z).toBeLessThanOrEqual(80);
        expect(node.vz).toBeGreaterThanOrEqual(-0.25);
        expect(node.vz).toBeLessThanOrEqual(0.25);
        
        expect(node.rotationX).toBe(0);
        expect(node.rotationY).toBe(0);
        expect(node.rotationZ).toBe(0);
        
        expect(node.angularVelocityX).toBeGreaterThanOrEqual(-0.01);
        expect(node.angularVelocityX).toBeLessThanOrEqual(0.01);
        expect(node.angularVelocityY).toBeGreaterThanOrEqual(-0.01);
        expect(node.angularVelocityY).toBeLessThanOrEqual(0.01);
        expect(node.angularVelocityZ).toBeGreaterThanOrEqual(-0.01);
        expect(node.angularVelocityZ).toBeLessThanOrEqual(0.01);
    });

    it('should update node properties correctly', () => {
        const initialSize = node.size;
        const initialRotationX = node.rotationX;
        const initialZ = node.z;

        node.update();

        // Size should decay
        expect(node.size).toBeLessThanOrEqual(initialSize);
        // Rotation should change
        expect(node.rotationX).not.toBe(initialRotationX);
        // Z position should change
        expect(node.z).not.toBe(initialZ);
    });

    it('should calculate apparent size correctly', () => {
        node.z = 0; // At origin
        const apparentSize = node.getApparentSize();
        expect(apparentSize).toBeCloseTo(node.size);

        node.z = 250; // Farther away
        const farApparentSize = node.getApparentSize();
        expect(farApparentSize).toBeLessThan(node.size);
    });

    it('should calculate apparent position correctly', () => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
        
        node.z = 0;
        const pos = node.getApparentPosition();
        
        expect(pos.x).toBeCloseTo(testX);
        expect(pos.y).toBeCloseTo(testY);
        expect(pos.scale).toBeCloseTo(1);
    });

    it('should calculate 3D distance correctly', () => {
        const otherNode = new CubeNode(2, 150, 250, 0.3);
        const distance3D = node.getDistance3D(otherNode);
        
        expect(distance3D).toBeGreaterThan(0);
        expect(typeof distance3D).toBe('number');
    });

    it('should have 3D interaction properties for simulation use', () => {
        const otherNode = new CubeNode(2, 105, 205, 0.3); // Close node
        const distance3D = node.getDistance3D(otherNode);
        
        // Should be able to calculate 3D distances for interaction processing
        expect(distance3D).toBeGreaterThan(0);
        expect(typeof distance3D).toBe('number');
        
        // Nodes should have velocity properties for interaction
        expect(node.vx).toBeDefined();
        expect(node.vy).toBeDefined();
        expect(otherNode.vx).toBeDefined();
        expect(otherNode.vy).toBeDefined();
    });

    it('should handle Z boundary constraints correctly', () => {
        node.z = 105;
        node.vz = 2;
        node.update();
        expect(node.z).toBe(100); // Should be constrained to max
        expect(node.vz).toBeLessThan(0); // Should bounce back

        node.z = 5;
        node.vz = -2;
        node.update();
        expect(node.z).toBe(10); // Should be constrained to min
        expect(node.vz).toBeGreaterThan(0); // Should bounce back
    });
});