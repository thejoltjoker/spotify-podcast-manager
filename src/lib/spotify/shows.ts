import { spotifyJson } from './client'
import { derivePlayStatus } from './playStatus'
import type {
  PaginatedSavedShows,
  PaginatedSimplifiedAudiobooks,
  PaginatedSimplifiedEpisodes,
  ShowEpisodeRow,
  ShowRow,
  SpotifyShow,
  SpotifySimplifiedEpisode,
} from './types'

const PAGE_SIZE = 50

function pickImageUrl(images: { url: string }[] | undefined): string | null {
  if (!images?.length) return null
  return images[images.length - 1]?.url ?? images[0]?.url ?? null
}

function looksLikeAudiobook(show: SpotifyShow): boolean {
  return show.type === 'audiobook' || show.media_type === 'audiobook'
}

export function toShowRow(show: SpotifyShow, addedAt: string): ShowRow {
  return {
    id: show.id,
    uri: show.uri ?? `spotify:show:${show.id}`,
    name: show.name,
    publisher: show.publisher,
    description: show.description ?? null,
    totalEpisodes: show.total_episodes ?? null,
    imageUrl: pickImageUrl(show.images),
    spotifyUrl: show.external_urls.spotify,
    addedAt,
  }
}

/** Unsaved and never started — finished/in-progress are not "new". */
export function isNewShowEpisode(row: {
  savedInLibrary: boolean
  playStatus: string
}): boolean {
  return !row.savedInLibrary && row.playStatus === 'unplayed'
}

/**
 * Mark episodes as saved based on a set of library episode ids
 * (from the cached /me/episodes query).
 */
export function withSavedInLibrary(
  rows: ShowEpisodeRow[],
  savedIds: Set<string>,
): ShowEpisodeRow[] {
  return rows.map((row) => ({
    ...row,
    savedInLibrary: savedIds.has(row.id),
  }))
}

export function toShowEpisodeRow(
  episode: SpotifySimplifiedEpisode,
  show: SpotifyShow,
  savedInLibrary = false,
): ShowEpisodeRow {
  const showId = show.id
  return {
    id: episode.id,
    uri: episode.uri,
    name: episode.name,
    showName: show.name,
    showUri: show.uri ?? (showId ? `spotify:show:${showId}` : null),
    releaseDate: episode.release_date,
    durationMs: episode.duration_ms,
    playStatus: derivePlayStatus(episode.resume_point),
    resumePositionMs: episode.resume_point?.resume_position_ms ?? 0,
    imageUrl: pickImageUrl(episode.images) ?? pickImageUrl(show.images),
    spotifyUrl: episode.external_urls.spotify,
    addedAt: '',
    savedInLibrary,
  }
}

export async function fetchSavedAudiobookIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  let offset = 0
  let total = Infinity

  while (offset < total) {
    const page = await spotifyJson<PaginatedSimplifiedAudiobooks>(
      `/me/audiobooks?limit=${PAGE_SIZE}&offset=${offset}`,
    )
    total = page.total
    for (const item of page.items) {
      if (item?.id) ids.add(item.id)
    }
    offset += page.items.length
    if (!page.next || page.items.length === 0) break
  }

  return ids
}

export function filterPodcastShows(
  items: Array<{ added_at: string; show: SpotifyShow }>,
  audiobookIds: Set<string>,
): ShowRow[] {
  const rows: ShowRow[] = []
  for (const item of items) {
    const show = item.show
    if (!show?.id) continue
    if (audiobookIds.has(show.id) || looksLikeAudiobook(show)) continue
    rows.push(toShowRow(show, item.added_at))
  }
  return rows
}

export async function fetchAllFollowedShows(): Promise<ShowRow[]> {
  const [audiobookIds, showPages] = await Promise.all([
    fetchSavedAudiobookIds(),
    (async () => {
      const items: Array<{ added_at: string; show: SpotifyShow }> = []
      let offset = 0
      let total = Infinity
      while (offset < total) {
        const page = await spotifyJson<PaginatedSavedShows>(
          `/me/shows?limit=${PAGE_SIZE}&offset=${offset}`,
        )
        total = page.total
        items.push(...page.items.filter((item) => item.show?.id))
        offset += page.items.length
        if (!page.next || page.items.length === 0) break
      }
      return items
    })(),
  ])

  return filterPodcastShows(showPages, audiobookIds)
}

export async function fetchShow(showId: string): Promise<SpotifyShow> {
  return spotifyJson<SpotifyShow>(`/shows/${encodeURIComponent(showId)}`)
}

export type ShowEpisodesPage = {
  rows: ShowEpisodeRow[]
  total: number
  hasMore: boolean
  nextOffset: number
}

/** Build a page from the episodes already embedded on GET /shows/{id}. */
export function showEpisodesFromEmbedded(
  show: SpotifyShow,
): ShowEpisodesPage | null {
  const embedded = show.episodes
  if (!embedded) return null
  const rows = embedded.items
    .filter((episode) => episode?.id)
    .map((episode) => toShowEpisodeRow(episode, show, false))
  const nextOffset = embedded.items.length
  return {
    rows,
    total: embedded.total,
    hasMore: Boolean(embedded.next) && embedded.items.length > 0,
    nextOffset,
  }
}

export async function fetchShowEpisodesPage(
  showId: string,
  show: SpotifyShow,
  offset = 0,
  limit = PAGE_SIZE,
): Promise<ShowEpisodesPage> {
  const page = await spotifyJson<PaginatedSimplifiedEpisodes>(
    `/shows/${encodeURIComponent(showId)}/episodes?limit=${limit}&offset=${offset}`,
  )
  const rows = page.items
    .filter((episode) => episode?.id)
    .map((episode) => toShowEpisodeRow(episode, show, false))

  const nextOffset = offset + page.items.length
  return {
    rows,
    total: page.total,
    hasMore: Boolean(page.next) && page.items.length > 0,
    nextOffset,
  }
}
