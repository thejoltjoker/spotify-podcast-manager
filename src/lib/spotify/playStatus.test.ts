import { describe, expect, it } from 'vitest'
import {
  derivePlayStatus,
  formatPlayProgress,
  playProgressRatio,
} from './playStatus'

describe('derivePlayStatus', () => {
  it('returns unplayed when resume_point is missing', () => {
    expect(derivePlayStatus(undefined)).toBe('unplayed')
    expect(derivePlayStatus(null)).toBe('unplayed')
  })

  it('returns finished when fully_played is true', () => {
    expect(
      derivePlayStatus({ fully_played: true, resume_position_ms: 0 }),
    ).toBe('finished')
    expect(
      derivePlayStatus({ fully_played: true, resume_position_ms: 1_200_000 }),
    ).toBe('finished')
  })

  it('returns in_progress when not finished and position > 0', () => {
    expect(
      derivePlayStatus({ fully_played: false, resume_position_ms: 1 }),
    ).toBe('in_progress')
    expect(
      derivePlayStatus({ fully_played: false, resume_position_ms: 600_000 }),
    ).toBe('in_progress')
  })

  it('returns unplayed when not finished and position is 0', () => {
    expect(
      derivePlayStatus({ fully_played: false, resume_position_ms: 0 }),
    ).toBe('unplayed')
  })
})

describe('formatPlayProgress', () => {
  it('returns null for unplayed and finished', () => {
    expect(formatPlayProgress('unplayed', 0, 3_600_000)).toBeNull()
    expect(formatPlayProgress('finished', 3_600_000, 3_600_000)).toBeNull()
  })

  it('formats minutes left and percent for in-progress episodes', () => {
    // 30 of 60 minutes played → 30m left · 50%
    expect(formatPlayProgress('in_progress', 30 * 60_000, 60 * 60_000)).toBe(
      '30m left · 50%',
    )
  })

  it('formats hours when remaining time is long', () => {
    // 30 of 90 minutes → 1h 0m left · 33%
    expect(formatPlayProgress('in_progress', 30 * 60_000, 90 * 60_000)).toBe(
      '1h 0m left · 33%',
    )
  })

  it('clamps position to duration and handles zero duration', () => {
    expect(formatPlayProgress('in_progress', 99_000_000, 60_000)).toBe(
      '0m left · 100%',
    )
    expect(formatPlayProgress('in_progress', 10_000, 0)).toBeNull()
  })
})

describe('playProgressRatio', () => {
  it('returns 0 for unplayed and 1 for finished', () => {
    expect(playProgressRatio('unplayed', 0, 3_600_000)).toBe(0)
    expect(playProgressRatio('finished', 0, 3_600_000)).toBe(1)
  })

  it('returns fraction played for in-progress episodes', () => {
    expect(playProgressRatio('in_progress', 15 * 60_000, 60 * 60_000)).toBe(0.25)
  })
})
