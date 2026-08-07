import { describe, expect, it } from 'vitest'
import { derivePlayStatus } from './playStatus'

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
