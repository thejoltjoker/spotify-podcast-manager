import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  SpotifyApiError: class SpotifyApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'SpotifyApiError'
      this.status = status
    }
  },
  spotifyFetch: vi.fn(),
  spotifyJson: vi.fn(),
}))

import { SpotifyApiError, spotifyFetch, spotifyJson } from './client'
import {
  formatPlaybackError,
  isCurrentUri,
  isPlayingUri,
  pickDeviceId,
  playbackPositionMs,
  playEpisodes,
  rankDevices,
  shouldSeek,
  type SpotifyDevice,
} from './playback'

const mockedFetch = vi.mocked(spotifyFetch)
const mockedJson = vi.mocked(spotifyJson)

function device(
  overrides: Partial<SpotifyDevice> & Pick<SpotifyDevice, 'id' | 'name'>,
): SpotifyDevice {
  return {
    is_active: false,
    is_private_session: false,
    is_restricted: false,
    type: 'Computer',
    volume_percent: 50,
    supports_volume: true,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('playbackPositionMs', () => {
  it('returns 0 for finished episodes', () => {
    expect(playbackPositionMs('finished', 1_200_000)).toBe(0)
  })

  it('returns resume position for unplayed and in-progress', () => {
    expect(playbackPositionMs('unplayed', 0)).toBe(0)
    expect(playbackPositionMs('in_progress', 90_000)).toBe(90_000)
  })

  it('clamps negative positions to 0', () => {
    expect(playbackPositionMs('in_progress', -10)).toBe(0)
  })
})

describe('shouldSeek', () => {
  it('skips seek when already near the desired position', () => {
    expect(shouldSeek(90_000, 95_000)).toBe(false)
    expect(shouldSeek(0, 0)).toBe(false)
    expect(shouldSeek(null, 0)).toBe(false)
  })

  it('seeks when progress differs by more than 10s', () => {
    expect(shouldSeek(0, 90_000)).toBe(true)
    expect(shouldSeek(1_200_000, 0)).toBe(true)
  })

  it('rewinds finished episodes from a late progress to 0', () => {
    expect(shouldSeek(3_500_000, playbackPositionMs('finished', 3_500_000))).toBe(
      true,
    )
  })
})

describe('rankDevices / pickDeviceId', () => {
  it('prefers the active unrestricted device', () => {
    expect(
      pickDeviceId([
        device({ id: 'a', name: 'Phone', type: 'Smartphone', is_active: false }),
        device({ id: 'b', name: 'Desktop', is_active: true }),
      ]),
    ).toBe('b')
  })

  it('prefers computers over speakers when none is active', () => {
    const ranked = rankDevices([
      device({ id: 'speaker', name: 'Kitchen', type: 'Speaker' }),
      device({ id: 'phone', name: 'Phone', type: 'Smartphone' }),
      device({ id: 'desktop', name: 'Desktop', type: 'Computer' }),
    ])
    expect(ranked.map((d) => d.id)).toEqual(['desktop', 'phone', 'speaker'])
  })

  it('returns null when no usable devices exist', () => {
    expect(pickDeviceId([])).toBeNull()
    expect(
      pickDeviceId([device({ id: 'x', name: 'Car', is_restricted: true })]),
    ).toBeNull()
  })
})

describe('isPlayingUri / isCurrentUri', () => {
  it('detects the current episode', () => {
    const state = { is_playing: true, item: { uri: 'spotify:episode:1' } }
    expect(isPlayingUri(state, 'spotify:episode:1')).toBe(true)
    expect(isCurrentUri({ ...state, is_playing: false }, 'spotify:episode:1')).toBe(
      true,
    )
    expect(isPlayingUri(null, 'spotify:episode:1')).toBe(false)
  })
})

describe('formatPlaybackError', () => {
  it('maps Premium / restriction errors', () => {
    expect(
      formatPlaybackError(
        new SpotifyApiError(403, 'Player command failed: Restriction violated'),
      ),
    ).toBe('Requires Spotify Premium')
  })

  it('maps no active device errors', () => {
    expect(
      formatPlaybackError(
        new SpotifyApiError(
          404,
          'Player command failed: No active device found',
        ),
      ),
    ).toBe('Start playing anything in Spotify first, then try again')
  })

  it('handles non-Spotify errors', () => {
    expect(formatPlaybackError(new Error('network'))).toBe('network')
    expect(formatPlaybackError('nope')).toBe('Playback failed')
  })
})

describe('playEpisodes', () => {
  const episode = {
    id: 'ep1',
    uri: 'spotify:episode:ep1',
    showUri: 'spotify:show:show1',
    positionMs: 0,
  }

  function mockActivePlayer(itemUri?: string) {
    mockedFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (path.startsWith('/me/player?') && method === 'GET') {
        return jsonResponse({
          is_playing: true,
          progress_ms: itemUri === episode.uri ? 0 : 12_000,
          item: itemUri
            ? { uri: itemUri, type: 'episode' }
            : { uri: 'spotify:track:other', type: 'track' },
          device: { id: 'dev1', name: 'MacBook Pro' },
        })
      }
      if (path.includes('/me/player/queue') && method === 'POST') {
        return emptyResponse(204)
      }
      if (path.includes('/me/player/next') && method === 'POST') {
        return emptyResponse(204)
      }
      if (path.includes('/me/player/play') && method === 'PUT') {
        return emptyResponse(204)
      }
      if (path.includes('/me/player/seek') && method === 'PUT') {
        return emptyResponse(204)
      }
      return emptyResponse(204)
    })
  }

  it('never sends episode URIs in play body uris[]', async () => {
    let playPoll = 0
    mockedFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (path.startsWith('/me/player?') && method === 'GET') {
        playPoll += 1
        // First call: active device. Later polls: still wrong item so strategy B runs.
        return jsonResponse({
          is_playing: true,
          progress_ms: 0,
          item:
            playPoll > 3
              ? { uri: episode.uri, type: 'episode' }
              : { uri: 'spotify:track:other', type: 'track' },
          device: { id: 'dev1', name: 'MacBook Pro' },
        })
      }
      return emptyResponse(204)
    })

    await playEpisodes([episode])

    for (const [, init] of mockedFetch.mock.calls) {
      if (init?.method !== 'PUT' || !init.body) continue
      const body = JSON.parse(String(init.body)) as { uris?: string[] }
      if (body.uris) {
        expect(body.uris.every((uri) => uri.startsWith('spotify:track:'))).toBe(
          true,
        )
        expect(body.uris.some((uri) => uri.includes('episode'))).toBe(false)
      }
    }
  })

  it('queues then skips, and reports the polled device', async () => {
    let afterNext = false
    mockedFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (path.startsWith('/me/player?') && method === 'GET') {
        return jsonResponse({
          is_playing: true,
          progress_ms: 0,
          item: afterNext
            ? { uri: episode.uri, type: 'episode' }
            : { uri: 'spotify:track:other', type: 'track' },
          device: { id: 'dev1', name: 'MacBook Pro' },
        })
      }
      if (path.includes('/me/player/next') && method === 'POST') {
        afterNext = true
        return emptyResponse(204)
      }
      return emptyResponse(204)
    })

    const result = await playEpisodes([episode])

    expect(result.started).toBe(true)
    expect(result.deviceName).toBe('MacBook Pro')
    expect(result.queuedCount).toBe(0)

    const paths = mockedFetch.mock.calls.map(([path, init]) => ({
      path: String(path),
      method: init?.method ?? 'GET',
    }))
    expect(paths.some((c) => c.path.includes('/me/player/queue'))).toBe(true)
    expect(paths.some((c) => c.path.includes('/me/player/next'))).toBe(true)
  })

  it('returns started:false when play is accepted but item never matches', async () => {
    vi.useFakeTimers()
    mockActivePlayer('spotify:track:never-matches')

    const promise = playEpisodes([
      { ...episode, showUri: null },
    ])
    // Advance past both poll timeouts (strategy A only when no showUri).
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.started).toBe(false)
    expect(result.deviceName).toBe('MacBook Pro')
  })

  it('does not transfer/pause when a device is already active', async () => {
    let afterNext = false
    mockedFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (path.startsWith('/me/player?') && method === 'GET') {
        return jsonResponse({
          is_playing: true,
          progress_ms: 0,
          item: afterNext
            ? { uri: episode.uri, type: 'episode' }
            : { uri: 'spotify:track:other', type: 'track' },
          device: { id: 'dev1', name: 'MacBook Pro' },
        })
      }
      if (path.includes('/me/player/next') && method === 'POST') {
        afterNext = true
      }
      return emptyResponse(204)
    })

    await playEpisodes([episode])

    const transfer = mockedFetch.mock.calls.find(
      ([path, init]) =>
        path === '/me/player' &&
        init?.method === 'PUT' &&
        String(init.body).includes('device_ids'),
    )
    expect(transfer).toBeUndefined()
    expect(mockedJson).not.toHaveBeenCalled()
  })
})
