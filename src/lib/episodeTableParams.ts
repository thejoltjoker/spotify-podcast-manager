import type { PlayStatus } from '@/lib/spotify/playStatus'

export const EPISODE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type EpisodePageSize = (typeof EPISODE_PAGE_SIZE_OPTIONS)[number]

export const DEFAULT_EPISODE_PAGE_SIZE: EpisodePageSize = 25

const PLAY_STATUSES = new Set<PlayStatus>([
  'unplayed',
  'in_progress',
  'finished',
])

export type EpisodeTableParams = {
  q: string
  shows: string[]
  statuses: PlayStatus[]
  /** 1-based page number */
  page: number
  pageSize: EpisodePageSize
}

export type EpisodeTableParamsInput = {
  q?: string
  shows?: string[]
  statuses?: PlayStatus[]
  page?: number
  pageSize?: number
}

function isPlayStatus(value: string): value is PlayStatus {
  return PLAY_STATUSES.has(value as PlayStatus)
}

function isPageSize(value: number): value is EpisodePageSize {
  return (EPISODE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
}

export function parseEpisodeTableParams(
  searchParams: URLSearchParams,
): EpisodeTableParams {
  const q = searchParams.get('q')?.trim() ?? ''
  const shows = searchParams
    .getAll('show')
    .map((show) => show.trim())
    .filter(Boolean)
  const statuses = searchParams
    .getAll('status')
    .filter(isPlayStatus)

  const pageRaw = Number(searchParams.get('page'))
  const page =
    Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1

  const pageSizeRaw = Number(searchParams.get('pageSize'))
  const pageSize = isPageSize(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_EPISODE_PAGE_SIZE

  return { q, shows, statuses, page, pageSize }
}

export function serializeEpisodeTableParams(
  state: EpisodeTableParamsInput,
): URLSearchParams {
  const params = new URLSearchParams()
  const q = state.q?.trim() ?? ''
  if (q) params.set('q', q)

  for (const show of state.shows ?? []) {
    const trimmed = show.trim()
    if (trimmed) params.append('show', trimmed)
  }

  for (const status of state.statuses ?? []) {
    if (isPlayStatus(status)) params.append('status', status)
  }

  const page = state.page ?? 1
  if (Number.isInteger(page) && page > 1) {
    params.set('page', String(page))
  }

  const pageSize = state.pageSize ?? DEFAULT_EPISODE_PAGE_SIZE
  if (isPageSize(pageSize) && pageSize !== DEFAULT_EPISODE_PAGE_SIZE) {
    params.set('pageSize', String(pageSize))
  }

  return params
}

export function episodeTableParamsEqual(
  a: EpisodeTableParams,
  b: EpisodeTableParams,
): boolean {
  return (
    a.q === b.q &&
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.shows.length === b.shows.length &&
    a.statuses.length === b.statuses.length &&
    a.shows.every((show, i) => show === b.shows[i]) &&
    a.statuses.every((status, i) => status === b.statuses[i])
  )
}
