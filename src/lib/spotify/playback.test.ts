import { describe, expect, it } from 'vitest'
import { SpotifyApiError } from './client'
import {
  formatPlaybackError,
  isCurrentUri,
  isPlayingUri,
  pickDeviceId,
  playbackPositionMs,
  rankDevices,
  type SpotifyDevice,
} from './playback'

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
