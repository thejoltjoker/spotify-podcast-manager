import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EPISODE_PAGE_SIZE,
  episodeTableParamsEqual,
  parseEpisodeTableParams,
  serializeEpisodeTableParams,
} from './episodeTableParams'

describe('parseEpisodeTableParams', () => {
  it('returns defaults for empty params', () => {
    expect(parseEpisodeTableParams(new URLSearchParams())).toEqual({
      q: '',
      shows: [],
      statuses: [],
      page: 1,
      pageSize: DEFAULT_EPISODE_PAGE_SIZE,
    })
  })

  it('parses q, repeated show/status, page, and pageSize', () => {
    const params = new URLSearchParams()
    params.set('q', '  Italian  ')
    params.append('show', 'Coffee Break Italian')
    params.append('show', 'Syntax')
    params.append('status', 'unplayed')
    params.append('status', 'in_progress')
    params.set('page', '3')
    params.set('pageSize', '50')

    expect(parseEpisodeTableParams(params)).toEqual({
      q: 'Italian',
      shows: ['Coffee Break Italian', 'Syntax'],
      statuses: ['unplayed', 'in_progress'],
      page: 3,
      pageSize: 50,
    })
  })

  it('drops invalid statuses and clamps invalid page/pageSize', () => {
    const params = new URLSearchParams(
      'status=bogus&status=finished&page=0&pageSize=15',
    )
    expect(parseEpisodeTableParams(params)).toEqual({
      q: '',
      shows: [],
      statuses: ['finished'],
      page: 1,
      pageSize: DEFAULT_EPISODE_PAGE_SIZE,
    })
  })
})

describe('serializeEpisodeTableParams', () => {
  it('omits defaults', () => {
    expect(
      serializeEpisodeTableParams({
        q: '',
        shows: [],
        statuses: [],
        page: 1,
        pageSize: DEFAULT_EPISODE_PAGE_SIZE,
      }).toString(),
    ).toBe('')
  })

  it('writes non-default values with repeated keys', () => {
    const params = serializeEpisodeTableParams({
      q: 'Italian',
      shows: ['Coffee Break Italian', 'Syntax'],
      statuses: ['unplayed', 'finished'],
      page: 2,
      pageSize: 10,
    })

    expect(params.get('q')).toBe('Italian')
    expect(params.getAll('show')).toEqual([
      'Coffee Break Italian',
      'Syntax',
    ])
    expect(params.getAll('status')).toEqual(['unplayed', 'finished'])
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('10')
  })
})

describe('round-trip', () => {
  it('preserves parsed state through serialize', () => {
    const original = new URLSearchParams(
      'q=foo&show=A&show=B&status=finished&page=4&pageSize=100',
    )
    const parsed = parseEpisodeTableParams(original)
    const again = parseEpisodeTableParams(serializeEpisodeTableParams(parsed))
    expect(episodeTableParamsEqual(parsed, again)).toBe(true)
  })
})
