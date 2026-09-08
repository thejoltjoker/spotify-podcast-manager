import type { PlayStatus } from './playStatus'

export type { PlayStatus } from './playStatus'

export type SpotifyImage = {
  url: string
  height: number | null
  width: number | null
}

export type SpotifyShow = {
  id: string
  name: string
  publisher: string
  description?: string
  total_episodes?: number
  images: SpotifyImage[]
  external_urls: { spotify: string }
  uri?: string
  type?: string
  media_type?: string
  /** Present on GET /shows/{id}; first page of episodes. */
  episodes?: PaginatedSimplifiedEpisodes
}

export type SpotifySimplifiedEpisode = {
  id: string
  uri: string
  name: string
  description: string
  duration_ms: number
  release_date: string
  release_date_precision: string
  explicit: boolean
  images: SpotifyImage[]
  external_urls: { spotify: string }
  resume_point?: {
    fully_played: boolean
    resume_position_ms: number
  }
}

export type SpotifyEpisode = SpotifySimplifiedEpisode & {
  show: SpotifyShow
}

export type SavedEpisodeItem = {
  added_at: string
  episode: SpotifyEpisode
}

export type PaginatedSavedEpisodes = {
  href: string
  limit: number
  next: string | null
  offset: number
  previous: string | null
  total: number
  items: SavedEpisodeItem[]
}

export type SpotifyErrorBody = {
  error: {
    status: number
    message: string
    /** e.g. "QUOTA_EXCEEDED" on development-mode 429s */
    reason?: string
  }
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export type StoredTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  /** Space-separated scopes granted with this token set */
  scope?: string
}

export type SpotifyUser = {
  id: string
  display_name: string | null
  images: SpotifyImage[]
  /** "premium" | "free" | "open" — only present with user-read-private; often absent */
  product?: string
}

export type EpisodeRow = {
  id: string
  uri: string
  name: string
  showName: string
  showUri: string | null
  releaseDate: string
  durationMs: number
  playStatus: PlayStatus
  resumePositionMs: number
  imageUrl: string | null
  spotifyUrl: string
  addedAt: string
}

export type ShowEpisodeRow = EpisodeRow & {
  savedInLibrary: boolean
}

export type SavedShowItem = {
  added_at: string
  show: SpotifyShow
}

export type PaginatedSavedShows = {
  href: string
  limit: number
  next: string | null
  offset: number
  previous: string | null
  total: number
  items: SavedShowItem[]
}

export type PaginatedSimplifiedEpisodes = {
  href: string
  limit: number
  next: string | null
  offset: number
  previous: string | null
  total: number
  items: SpotifySimplifiedEpisode[]
}

export type ShowRow = {
  id: string
  uri: string
  name: string
  publisher: string
  description: string | null
  totalEpisodes: number | null
  imageUrl: string | null
  spotifyUrl: string
  addedAt: string
}

export type SimplifiedAudiobook = {
  id: string
  type?: string
  name?: string
}

export type PaginatedSimplifiedAudiobooks = {
  href: string
  limit: number
  next: string | null
  offset: number
  previous: string | null
  total: number
  items: SimplifiedAudiobook[]
}
