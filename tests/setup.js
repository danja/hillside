import { vi } from 'vitest'

// Mock Web APIs that might not be available in test environment
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => ({
    createAnalyser: vi.fn(() => ({
      fftSize: 256,
      frequencyBinCount: 128,
      connect: vi.fn(),
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn()
    })),
    createMediaElementSource: vi.fn(() => ({
      connect: vi.fn()
    })),
    destination: {}
  }))
})

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: window.AudioContext
})

global.Audio = vi.fn(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  currentTime: 0
}))

// Mock D3 for simulation tests
global.d3 = {
  scaleLinear: vi.fn(() => {
    const scale = vi.fn(x => x) // Mock scale function that returns input
    scale.domain = vi.fn().mockReturnValue(scale)
    scale.range = vi.fn().mockReturnValue(scale)
    return scale
  }),
  scaleSequential: vi.fn(() => {
    const scale = vi.fn(t => `rgb(${Math.floor(t * 255)}, 100, 200)`)
    scale.domain = vi.fn().mockReturnValue(scale)
    scale.interpolator = vi.fn().mockReturnValue(scale)
    return scale
  }),
  interpolateRainbow: vi.fn(t => `rgb(${Math.floor(t * 255)}, 100, 200)`),
  forceSimulation: vi.fn(() => ({
    nodes: vi.fn().mockReturnThis(),
    force: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    alpha: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis()
  })),
  forceCollide: vi.fn(() => ({
    strength: vi.fn().mockReturnThis(),
    iterations: vi.fn().mockReturnThis()
  })),
  forceManyBody: vi.fn(() => ({
    strength: vi.fn().mockReturnThis()
  })),
  forceCenter: vi.fn(() => ({
    strength: vi.fn().mockReturnThis()
  }))
}