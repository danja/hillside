import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCanvasMousePosition, resizeCanvas } from '../../src/js/utils/dom.js'

describe('DOM utilities', () => {
  describe('getCanvasMousePosition', () => {
    let mockCanvas
    let mockEvent

    beforeEach(() => {
      mockCanvas = {
        getBoundingClientRect: vi.fn(() => ({
          left: 10,
          top: 20
        }))
      }
      
      mockEvent = {
        clientX: 50,
        clientY: 80
      }
    })

    it('should calculate correct mouse position relative to canvas', () => {
      const position = getCanvasMousePosition(mockCanvas, mockEvent)
      expect(position).toEqual({ x: 40, y: 60 })
    })
  })

  describe('resizeCanvas', () => {
    let mockCanvas
    let mockBody

    beforeEach(() => {
      mockCanvas = {
        width: 0,
        height: 0
      }
      
      mockBody = {
        clientWidth: 800,
        clientHeight: 600
      }
    })

    it('should resize canvas to match body dimensions', () => {
      const result = resizeCanvas(mockCanvas, mockBody)
      
      expect(mockCanvas.width).toBe(800)
      expect(mockCanvas.height).toBe(600)
      expect(result).toEqual({ width: 800, height: 600 })
    })
  })
})