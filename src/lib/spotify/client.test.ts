import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pkce', () => ({
  clearTokens: vi.fn(),
  loadTokens: vi.fn(() => ({
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 3_600_000,
  })),
  refreshAccessToken: vi.fn(async () => ({
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 3_600_000,
  })),
  saveTokens: vi.fn(),
}))

import {
  QUOTA_EXCEEDED,
  SpotifyApiError,
  resetRateLimitStateForTests,
  spotifyFetch,
} from './client'

describe('spotifyFetch rate limiting', () => {
  beforeEach(() => {
    resetRateLimitStateForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    resetRateLimitStateForTests()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('never runs more than one Spotify request at a time', async () => {
    const fetchMock = vi.mocked(fetch)
    let inFlight = 0
    let peak = 0

    fetchMock.mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 30))
      inFlight -= 1
      return new Response(null, { status: 200 })
    })

    await Promise.all([
      spotifyFetch('/shows/a/episodes?limit=1'),
      spotifyFetch('/shows/b/episodes?limit=1'),
      spotifyFetch('/shows/c/episodes?limit=1'),
    ])

    expect(peak).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a 429 only after waiting, still serially', async () => {
    const fetchMock = vi.mocked(fetch)
    let inFlight = 0
    let peak = 0

    fetchMock
      .mockImplementationOnce(async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        inFlight -= 1
        return new Response(null, {
          status: 429,
          headers: { 'Retry-After': '1' },
        })
      })
      .mockImplementation(async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 10))
        inFlight -= 1
        return new Response(null, { status: 200 })
      })

    await Promise.all([
      spotifyFetch('/shows/a/episodes?limit=1'),
      spotifyFetch('/shows/b/episodes?limit=1'),
    ])

    expect(peak).toBe(1)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('does not retry a QUOTA_EXCEEDED 429', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            status: 429,
            message: 'Too many requests',
            reason: QUOTA_EXCEEDED,
          },
        }),
        { status: 429 },
      ),
    )

    await expect(spotifyFetch('/me/shows')).rejects.toMatchObject({
      status: 429,
      reason: QUOTA_EXCEEDED,
    } satisfies Partial<SpotifyApiError>)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('short-circuits further calls after QUOTA_EXCEEDED', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            status: 429,
            message: 'Too many requests',
            reason: QUOTA_EXCEEDED,
          },
        }),
        { status: 429 },
      ),
    )

    await expect(spotifyFetch('/me/shows')).rejects.toBeInstanceOf(
      SpotifyApiError,
    )
    await expect(spotifyFetch('/me/episodes')).rejects.toMatchObject({
      reason: QUOTA_EXCEEDED,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
