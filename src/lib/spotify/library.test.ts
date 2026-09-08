import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIBRARY_BATCH_SIZE, libraryContains, removeFromLibrary, saveToLibrary } from './library'

vi.mock('./client', () => ({
  spotifyFetch: vi.fn(),
  spotifyJson: vi.fn(),
}))

import { spotifyFetch, spotifyJson } from './client'

const mockedFetch = vi.mocked(spotifyFetch)
const mockedJson = vi.mocked(spotifyJson)

afterEach(() => {
  vi.clearAllMocks()
})

describe('saveToLibrary / removeFromLibrary', () => {
  it('batches PUT requests at 40 URIs', async () => {
    mockedFetch.mockResolvedValue(new Response(null, { status: 200 }))
    const uris = Array.from(
      { length: LIBRARY_BATCH_SIZE + 5 },
      (_, i) => `spotify:episode:${i}`,
    )

    await saveToLibrary(uris)

    expect(mockedFetch).toHaveBeenCalledTimes(2)
    const first = mockedFetch.mock.calls[0]![0] as string
    const second = mockedFetch.mock.calls[1]![0] as string
    expect(first).toContain('/me/library?')
    expect(first.split('uris=')[1]!.split('%2C').length).toBe(LIBRARY_BATCH_SIZE)
    expect(decodeURIComponent(second.split('uris=')[1]!).split(',').length).toBe(5)
    expect(mockedFetch.mock.calls[0]![1]).toMatchObject({ method: 'PUT' })
  })

  it('batches DELETE requests at 40 URIs', async () => {
    mockedFetch.mockResolvedValue(new Response(null, { status: 200 }))
    const uris = Array.from({ length: 41 }, (_, i) => `spotify:episode:${i}`)

    await removeFromLibrary(uris)

    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(mockedFetch.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' })
  })

  it('skips empty URI lists', async () => {
    await saveToLibrary([])
    await removeFromLibrary([])
    expect(mockedFetch).not.toHaveBeenCalled()
  })
})

describe('libraryContains', () => {
  it('zips boolean results onto URIs within each batch', async () => {
    const uris = Array.from({ length: 45 }, (_, i) => `spotify:episode:${i}`)
    mockedJson
      .mockResolvedValueOnce(Array.from({ length: 40 }, (_, i) => i % 2 === 0))
      .mockResolvedValueOnce([true, false, true, false, true])

    const result = await libraryContains(uris)

    expect(mockedJson).toHaveBeenCalledTimes(2)
    expect(result.get('spotify:episode:0')).toBe(true)
    expect(result.get('spotify:episode:1')).toBe(false)
    expect(result.get('spotify:episode:40')).toBe(true)
    expect(result.get('spotify:episode:41')).toBe(false)
    expect(result.get('spotify:episode:44')).toBe(true)
    expect(result.size).toBe(45)
  })
})
