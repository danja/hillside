import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioPlayer } from '../../src/js/media/audio-player.js'

describe('AudioPlayer', () => {
  let audioPlayer

  beforeEach(() => {
    audioPlayer = new AudioPlayer()
  })

  it('should initialize with correct default values', () => {
    expect(audioPlayer.audio).toBeNull()
    expect(audioPlayer.audioContext).toBeNull()
    expect(audioPlayer.analyser).toBeNull()
    expect(audioPlayer.frequencyData).toBeNull()
    expect(audioPlayer.timeDomainData).toBeNull()
    expect(audioPlayer.isPlaying).toBe(false)
    // Test beat detection properties
    expect(audioPlayer.beatHistory).toEqual([])
    expect(audioPlayer.beatDetected).toBe(false)
  })

  it('should initialize audio context', async () => {
    await audioPlayer.initialize()
    
    expect(audioPlayer.audioContext).toBeTruthy()
    expect(audioPlayer.analyser).toBeTruthy()
    expect(audioPlayer.frequencyData).toBeInstanceOf(Uint8Array)
    expect(audioPlayer.timeDomainData).toBeInstanceOf(Uint8Array)
  })

  it('should handle play and pause', async () => {
    await audioPlayer.initialize()
    
    // Mock audio element
    audioPlayer.audio = {
      play: vi.fn(),
      pause: vi.fn(),
      currentTime: 0
    }

    audioPlayer.play()
    expect(audioPlayer.isPlaying).toBe(true)
    expect(audioPlayer.audio.play).toHaveBeenCalled()

    audioPlayer.pause()
    expect(audioPlayer.isPlaying).toBe(false)
    expect(audioPlayer.audio.pause).toHaveBeenCalled()
  })

  it('should stop audio correctly', async () => {
    await audioPlayer.initialize()
    
    audioPlayer.audio = {
      play: vi.fn(),
      pause: vi.fn(),
      currentTime: 10
    }

    audioPlayer.stop()
    expect(audioPlayer.isPlaying).toBe(false)
    expect(audioPlayer.audio.pause).toHaveBeenCalled()
    expect(audioPlayer.audio.currentTime).toBe(0)
  })

  it('should provide audio analysis with beat detection', async () => {
    await audioPlayer.initialize()
    
    // Mock playing state
    audioPlayer.isPlaying = true
    
    // Mock frequency data with some bass content
    audioPlayer.frequencyData = new Uint8Array(128)
    audioPlayer.frequencyData[0] = 200 // Strong bass
    audioPlayer.timeDomainData = new Uint8Array(128)
    
    const analysis = audioPlayer.getAudioAnalysis()
    
    expect(analysis).toBeTruthy()
    expect(analysis.bass).toBeGreaterThan(0)
    expect(analysis.mid).toBeDefined()
    expect(analysis.treble).toBeDefined()
    expect(analysis.overall).toBeDefined()
    expect(analysis.beatDetected).toBeDefined()
    expect(analysis.beatIntensity).toBeDefined()
    expect(analysis.frequencyData).toBeInstanceOf(Uint8Array)
    expect(analysis.timeDomainData).toBeInstanceOf(Uint8Array)
  })

  it('should return null analysis when not playing', () => {
    audioPlayer.isPlaying = false
    const analysis = audioPlayer.getAudioAnalysis()
    expect(analysis).toBeNull()
  })
})