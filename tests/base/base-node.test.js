import { describe, it, expect, beforeEach } from 'vitest';
import { BaseNode } from '../../src/js/base/base-node.js';

describe('BaseNode', () => {
    let node;

    beforeEach(() => {
        node = new BaseNode(1, 100, 200, '#FF0000');
    });

    it('should initialize with correct properties', () => {
        expect(node.id).toBe(1);
        expect(node.x).toBe(100);
        expect(node.y).toBe(200);
        expect(node.color).toBe('#FF0000');
        expect(node.size).toBe(1);
        expect(node.vx).toBe(0);
        expect(node.vy).toBe(0);
    });

    it('should calculate distance to another node correctly', () => {
        const otherNode = new BaseNode(2, 103, 204, '#00FF00');
        const distance = node.distanceTo(otherNode);
        expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should wrap around bounds correctly', () => {
        node.x = -10;
        node.y = 610;
        node.wrapAroundBounds(800, 600);
        
        expect(node.x).toBe(800); // -10 < 0, so x = width = 800
        expect(node.y).toBe(0);   // 610 > 600, so y = 0
    });

    it('should update position based on velocity', () => {
        node.vx = 5;
        node.vy = -3;
        node.updatePosition(1);
        
        expect(node.x).toBe(105);
        expect(node.y).toBe(197);
    });

    it('should handle delta time correctly', () => {
        node.vx = 10;
        node.vy = 20;
        node.updatePosition(0.5); // Half time step
        
        expect(node.x).toBe(105);
        expect(node.y).toBe(210);
    });
});