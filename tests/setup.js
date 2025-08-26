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