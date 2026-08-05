import { spotifyFetch, spotifyJson } from './client'
import type {
  EpisodeRow,
  PaginatedSavedEpisodes,
  SpotifyEpisode,
  SpotifyUser,
} from './types'

const PAGE_SIZE = 50
/** DELETE /me/library max URIs per request */
const REMOVE_BATCH_SIZE = 40

function pickImageUrl(images: { url: string }[] | undefined): string | null {
  if (!images?.length) return null
  return images[images.length - 1]?.url ?? images[0]?.url ?? null
}

export function toEpisodeRow(
  episode: SpotifyEpisode,
  addedAt: string,
): EpisodeRow {
  return {
    id: episode.id,
    uri: episode.uri,
    name: episode.name,
    showName: episode.show?.name ?? 'Unknown show',
    releaseDate: episode.release_date,
    durationMs: episode.duration_ms,
    fullyPlayed: episode.resume_point?.fully_played ?? false,
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
  for (let i = 0; i < uris.length; i += REMOVE_BATCH_SIZE) {
    const batch = uris.slice(i, i + REMOVE_BATCH_SIZE)
    const params = new URLSearchParams({ uris: batch.join(',') })
    await spotifyFetch(`/me/library?${params.toString()}`, {
      method: 'DELETE',
    })
  }
}
