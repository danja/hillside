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
    expect(audioPlayer.dataArray).toBeNull()
    expect(audioPlayer.isPlaying).toBe(false)
  })

  it('should initialize audio context', async () => {
    await audioPlayer.initialize()
    
    expect(audioPlayer.audioContext).toBeTruthy()
    expect(audioPlayer.analyser).toBeTruthy()
    expect(audioPlayer.dataArray).toBeInstanceOf(Uint8Array)
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
})