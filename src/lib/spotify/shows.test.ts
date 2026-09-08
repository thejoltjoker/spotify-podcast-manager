import { describe, expect, it } from 'vitest'
import {
  filterPodcastShows,
  isNewShowEpisode,
  showEpisodesFromEmbedded,
  toShowEpisodeRow,
  toShowRow,
  withSavedInLibrary,
} from './shows'
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
  it('maps show fields', () => {
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

describe('withSavedInLibrary', () => {
  it('marks rows whose id is in the saved set', () => {
    const rows = [
      toShowEpisodeRow(episode({ id: 'a', uri: 'spotify:episode:a' }), show),
      toShowEpisodeRow(episode({ id: 'b', uri: 'spotify:episode:b' }), show),
    ]
    const marked = withSavedInLibrary(rows, new Set(['b']))
    expect(marked.map((row) => row.savedInLibrary)).toEqual([false, true])
  })
})

describe('showEpisodesFromEmbedded', () => {
  it('returns null when the show has no embedded episodes', () => {
    expect(showEpisodesFromEmbedded(show)).toBeNull()
  })

  it('builds a page from embedded episodes without a network call', () => {
    const page = showEpisodesFromEmbedded({
      ...show,
      episodes: {
        href: '',
        limit: 20,
        next: 'https://api.spotify.com/v1/shows/show1/episodes?offset=20',
        offset: 0,
        previous: null,
        total: 40,
        items: [episode()],
      },
    })
    expect(page).toMatchObject({
      total: 40,
      hasMore: true,
      nextOffset: 1,
    })
    expect(page?.rows).toHaveLength(1)
    expect(page?.rows[0]?.id).toBe('ep1')
  })
})

describe('filterPodcastShows', () => {
  it('omits shows whose id is in the audiobook set', () => {
    const rows = filterPodcastShows(
      [
        { added_at: '2026-01-01T00:00:00Z', show },
        {
          added_at: '2026-01-02T00:00:00Z',
          show: {
            ...show,
            id: 'book1',
            name: 'An Audiobook',
            uri: 'spotify:show:book1',
          },
        },
      ],
      new Set(['book1']),
    )
    expect(rows.map((row) => row.id)).toEqual(['show1'])
  })

  it('omits entries flagged as audiobook via type or media_type', () => {
    const rows = filterPodcastShows(
      [
        {
          added_at: '2026-01-01T00:00:00Z',
          show: { ...show, id: 'a', type: 'audiobook' },
        },
        {
          added_at: '2026-01-01T00:00:00Z',
          show: { ...show, id: 'b', media_type: 'audiobook' },
        },
        { added_at: '2026-01-01T00:00:00Z', show },
      ],
      new Set(),
    )
    expect(rows.map((row) => row.id)).toEqual(['show1'])
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
