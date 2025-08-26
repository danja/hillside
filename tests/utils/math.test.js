import { describe, it, expect } from 'vitest'
import { distance, clamp } from '../../src/js/utils/math.js'

describe('Math utilities', () => {
  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const point1 = { x: 0, y: 0 }
      const point2 = { x: 3, y: 4 }
      expect(distance(point1, point2)).toBe(5)
    })

    it('should return 0 for same points', () => {
      const point = { x: 5, y: 10 }
      expect(distance(point, point)).toBe(0)
    })
  })

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })
})