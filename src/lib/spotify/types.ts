export type SpotifyImage = {
  url: string
  height: number | null
  width: number | null
}

export type SpotifyShow = {
  id: string
  name: string
  publisher: string
  images: SpotifyImage[]
  external_urls: { spotify: string }
}

export type SpotifyEpisode = {
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
}

export type SpotifyUser = {
  id: string
  display_name: string | null
  images: SpotifyImage[]
}

export type EpisodeRow = {
  id: string
  uri: string
  name: string
  showName: string
  releaseDate: string
  durationMs: number
  fullyPlayed: boolean
  imageUrl: string | null
  spotifyUrl: string
  addedAt: string
}
