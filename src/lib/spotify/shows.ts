import { spotifyJson } from './client'
import { derivePlayStatus } from './playStatus'
import type {
  PaginatedSavedShows,
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

export async function fetchAllFollowedShows(): Promise<ShowRow[]> {
  const rows: ShowRow[] = []
  let offset = 0
  let total = Infinity

  while (offset < total) {
    const page = await spotifyJson<PaginatedSavedShows>(
      `/me/shows?limit=${PAGE_SIZE}&offset=${offset}`,
    )
    total = page.total
    for (const item of page.items) {
      if (item.show?.id) {
        rows.push(toShowRow(item.show, item.added_at))
      }
    }
    offset += page.items.length
    if (!page.next || page.items.length === 0) break
  }

  return rows
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
