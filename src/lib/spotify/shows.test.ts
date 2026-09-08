import { describe, expect, it } from 'vitest'
import { isNewShowEpisode, toShowEpisodeRow, toShowRow } from './shows'
import type { SpotifyShow, SpotifySimplifiedEpisode } from './types'

const show: SpotifyShow = {
  id: 'show1',
  name: 'Test Show',
  publisher: 'Publisher',
  description: 'A show',
  total_episodes: 12,
  images: [{ url: 'https://example.com/show.jpg', height: 300, width: 300 }],
  external_urls: { spotify: 'https://open.spotify.com/show/show1' },
  uri: 'spotify:show:show1',
}

function episode(
  overrides: Partial<SpotifySimplifiedEpisode> = {},
): SpotifySimplifiedEpisode {
  return {
    id: 'ep1',
    uri: 'spotify:episode:ep1',
    name: 'Episode One',
    description: 'Desc',
    duration_ms: 3_600_000,
    release_date: '2026-01-15',
    release_date_precision: 'day',
    explicit: false,
    images: [{ url: 'https://example.com/ep.jpg', height: 300, width: 300 }],
    external_urls: { spotify: 'https://open.spotify.com/episode/ep1' },
    ...overrides,
  }
}

describe('isNewShowEpisode', () => {
  it('is true only for unsaved unplayed episodes', () => {
    expect(
      isNewShowEpisode({ savedInLibrary: false, playStatus: 'unplayed' }),
    ).toBe(true)
  })

  it('is false when saved, in progress, or finished', () => {
    expect(
      isNewShowEpisode({ savedInLibrary: true, playStatus: 'unplayed' }),
    ).toBe(false)
    expect(
      isNewShowEpisode({ savedInLibrary: false, playStatus: 'in_progress' }),
    ).toBe(false)
    expect(
      isNewShowEpisode({ savedInLibrary: false, playStatus: 'finished' }),
    ).toBe(false)
  })
})

describe('toShowRow', () => {
  it('maps show fields including total episodes', () => {
    const row = toShowRow(show, '2026-01-01T00:00:00Z')
    expect(row).toMatchObject({
      id: 'show1',
      name: 'Test Show',
      publisher: 'Publisher',
      totalEpisodes: 12,
      addedAt: '2026-01-01T00:00:00Z',
      uri: 'spotify:show:show1',
    })
    expect(row.imageUrl).toBe('https://example.com/show.jpg')
  })
})

describe('toShowEpisodeRow', () => {
  it('injects show name/uri and defaults savedInLibrary to false', () => {
    const row = toShowEpisodeRow(episode(), show)
    expect(row.showName).toBe('Test Show')
    expect(row.showUri).toBe('spotify:show:show1')
    expect(row.savedInLibrary).toBe(false)
    expect(row.playStatus).toBe('unplayed')
  })

  it('derives play status from resume_point', () => {
    expect(
      toShowEpisodeRow(
        episode({
          resume_point: { fully_played: false, resume_position_ms: 90_000 },
        }),
        show,
      ).playStatus,
    ).toBe('in_progress')

    expect(
      toShowEpisodeRow(
        episode({
          resume_point: { fully_played: true, resume_position_ms: 0 },
        }),
        show,
        true,
      ),
    ).toMatchObject({ playStatus: 'finished', savedInLibrary: true })
  })

  it('falls back to show artwork when episode has no images', () => {
    const row = toShowEpisodeRow(episode({ images: [] }), show)
    expect(row.imageUrl).toBe('https://example.com/show.jpg')
  })
})
