import { describe, expect, it } from 'vitest'
import { QUOTA_EXCEEDED, SpotifyApiError } from './client'
import {
  QUOTA_EXCEEDED_MESSAGE,
  formatSpotifyError,
  isQuotaExceededError,
} from './errors'

describe('formatSpotifyError', () => {
  it('returns the quota message for QUOTA_EXCEEDED', () => {
    const err = new SpotifyApiError(429, 'Too many requests', QUOTA_EXCEEDED)
    expect(isQuotaExceededError(err)).toBe(true)
    expect(formatSpotifyError(err)).toBe(QUOTA_EXCEEDED_MESSAGE)
  })

  it('falls back to Error.message for other errors', () => {
    expect(formatSpotifyError(new Error('boom'))).toBe('boom')
    expect(formatSpotifyError(new SpotifyApiError(500, 'Server error'))).toBe(
      'Server error',
    )
  })
})
