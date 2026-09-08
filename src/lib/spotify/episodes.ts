import { spotifyJson } from './client'
import { removeFromLibrary } from './library'
import { derivePlayStatus } from './playStatus'
import type {
  EpisodeRow,
  PaginatedSavedEpisodes,
  SpotifyEpisode,
  SpotifyUser,
} from './types'

const PAGE_SIZE = 50

function pickImageUrl(images: { url: string }[] | undefined): string | null {
  if (!images?.length) return null
  return images[images.length - 1]?.url ?? images[0]?.url ?? null
}

export function toEpisodeRow(
  episode: SpotifyEpisode,
  addedAt: string,
): EpisodeRow {
  const showId = episode.show?.id
  return {
    id: episode.id,
    uri: episode.uri,
    name: episode.name,
    showName: episode.show?.name ?? 'Unknown show',
    showUri:
      episode.show?.uri ?? (showId ? `spotify:show:${showId}` : null),
    releaseDate: episode.release_date,
    durationMs: episode.duration_ms,
    playStatus: derivePlayStatus(episode.resume_point),
    resumePositionMs: episode.resume_point?.resume_position_ms ?? 0,
    imageUrl: pickImageUrl(episode.images) ?? pickImageUrl(episode.show?.images),
    spotifyUrl: episode.external_urls.spotify,
    addedAt,
  }
}

export async function fetchCurrentUser(): Promise<SpotifyUser> {
  return spotifyJson<SpotifyUser>('/me')
}

export async function fetchAllSavedEpisodes(): Promise<EpisodeRow[]> {
  const rows: EpisodeRow[] = []
  let offset = 0
  let total = Infinity

  while (offset < total) {
    const page = await spotifyJson<PaginatedSavedEpisodes>(
      `/me/episodes?limit=${PAGE_SIZE}&offset=${offset}`,
    )
    total = page.total
    for (const item of page.items) {
      if (item.episode?.id) {
        rows.push(toEpisodeRow(item.episode, item.added_at))
      }
    }
    offset += page.items.length
    if (!page.next || page.items.length === 0) break
  }

  return rows
}

export async function removeEpisodesFromLibrary(uris: string[]): Promise<void> {
  await removeFromLibrary(uris)
}
