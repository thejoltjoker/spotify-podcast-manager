import { spotifyFetch, spotifyJson } from './client'

/** Spotify caps /me/library at 40 URIs per request */
export const LIBRARY_BATCH_SIZE = 40

function chunkUris(uris: string[], size = LIBRARY_BATCH_SIZE): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < uris.length; i += size) {
    chunks.push(uris.slice(i, i + size))
  }
  return chunks
}

export async function saveToLibrary(uris: string[]): Promise<void> {
  for (const batch of chunkUris(uris)) {
    if (batch.length === 0) continue
    const params = new URLSearchParams({ uris: batch.join(',') })
    await spotifyFetch(`/me/library?${params.toString()}`, {
      method: 'PUT',
    })
  }
}

export async function removeFromLibrary(uris: string[]): Promise<void> {
  for (const batch of chunkUris(uris)) {
    if (batch.length === 0) continue
    const params = new URLSearchParams({ uris: batch.join(',') })
    await spotifyFetch(`/me/library?${params.toString()}`, {
      method: 'DELETE',
    })
  }
}

/**
 * Check which URIs are already in the user's library.
 * Zips each batch's boolean[] back onto that batch's URIs (order-sensitive).
 */
export async function libraryContains(
  uris: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>()
  for (const batch of chunkUris(uris)) {
    if (batch.length === 0) continue
    const params = new URLSearchParams({ uris: batch.join(',') })
    const flags = await spotifyJson<boolean[]>(
      `/me/library/contains?${params.toString()}`,
    )
    for (let i = 0; i < batch.length; i++) {
      result.set(batch[i]!, flags[i] ?? false)
    }
  }
  return result
}
