import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CellularAutomataSimulation } from '../../src/js/cellular-automata/simulation.js'

describe('CellularAutomataSimulation', () => {
  let simulation
  let mockCanvas
  let mockContext

  beforeEach(() => {
    // Mock canvas and context
    mockContext = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn()
      }))
    }

    mockCanvas = {
      getContext: vi.fn(() => mockContext),
      width: 800,
      height: 600
    }

    simulation = new CellularAutomataSimulation(mockCanvas, mockContext, 800, 600)
  })

  it('should initialize with correct properties', () => {
    expect(simulation.width).toBe(800)
    expect(simulation.height).toBe(600)
    expect(simulation.context).toBe(mockContext)
    expect(simulation.nodes).toHaveLength(300) // Default node count for smaller screens
    expect(simulation.bassInfluence).toBe(0.0)
    expect(simulation.midInfluence).toBe(0.0)
    expect(simulation.trebleInfluence).toBe(0.0)
    expect(simulation.baseDensity).toBe(1.0)
    expect(simulation.startTime).toBeDefined()
  })

  it('should calculate time-based density variation', () => {
    // Mock a specific time to get predictable results
    const fixedTime = Date.now()
    simulation.startTime = fixedTime - 7500 // 7.5 seconds ago (quarter cycle)
    
    vi.spyOn(Date, 'now').mockReturnValue(fixedTime)
    
    const density = simulation.getTimeDensity()
    
    expect(density).toBeGreaterThanOrEqual(0.5)
    expect(density).toBeLessThanOrEqual(1.5)
    expect(typeof density).toBe('number')
    
    Date.now.mockRestore()
  })

  it('should update audio influence correctly', () => {
    const mockAudioPlayer = {
      getAudioAnalysis: vi.fn(() => ({
        bass: 0.5,
        mid: 0.3,
        treble: 0.7,
        beatIntensity: 0.2
      }))
    }

    simulation.audioPlayer = mockAudioPlayer
    simulation.updateAudioInfluence()

    expect(simulation.bassInfluence).toBe(0.5)
    expect(simulation.midInfluence).toBe(0.3)
    expect(simulation.trebleInfluence).toBe(0.7)
    expect(simulation.beatIntensity).toBe(0.2)
  })

  it('should handle missing audio player', () => {
    simulation.audioPlayer = null
    simulation.updateAudioInfluence()

    expect(simulation.beatIntensity).toBe(0)
  })

  it('should start and stop animation correctly', () => {
    // Mock requestAnimationFrame and cancelAnimationFrame
    global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16))
    global.cancelAnimationFrame = vi.fn()

    simulation.start()
    expect(simulation.rafId).toBeDefined()

    simulation.stop()
    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(simulation.rafId)
    expect(simulation.rafId).toBeNull()
  })
})