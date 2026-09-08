import { SpotifyApiError, spotifyFetch, spotifyJson } from './client'
import type { PlayStatus } from './playStatus'

export type SpotifyDevice = {
  id: string | null
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number | null
  supports_volume: boolean
}

type DevicesResponse = {
  devices: SpotifyDevice[]
}

type PlaybackState = {
  is_playing?: boolean
  currently_playing_type?: string
  item?: { uri?: string; type?: string } | null
  device?: { id?: string | null; name?: string } | null
}

/** Resume in-progress listening; restart finished episodes from the beginning. */
export function playbackPositionMs(
  playStatus: PlayStatus,
  resumePositionMs: number,
): number {
  if (playStatus === 'finished') return 0
  return Math.max(0, resumePositionMs)
}

function deviceTypeRank(type: string): number {
  const normalized = type.toLowerCase()
  if (normalized === 'computer') return 0
  if (normalized === 'smartphone') return 1
  if (normalized === 'tablet') return 2
  return 3
}

/**
 * Prefer active devices, then computers/phones (podcasts often fail on speakers).
 */
export function rankDevices(devices: SpotifyDevice[]): Array<
  SpotifyDevice & { id: string }
> {
  return devices
    .filter(
      (device): device is SpotifyDevice & { id: string } =>
        Boolean(device.id) && !device.is_restricted,
    )
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return deviceTypeRank(a.type) - deviceTypeRank(b.type)
    })
}

export function pickDeviceId(devices: SpotifyDevice[]): string | null {
  return rankDevices(devices)[0]?.id ?? null
}

export function isNoActiveDeviceError(err: unknown): boolean {
  if (!(err instanceof SpotifyApiError)) return false
  const message = err.message.toLowerCase()
  return (
    err.status === 404 ||
    message.includes('no active device') ||
    message.includes('device not found')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchDevices(): Promise<SpotifyDevice[]> {
  const response = await spotifyJson<DevicesResponse>('/me/player/devices')
  return response.devices ?? []
}

function withDeviceId(path: string, deviceId: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}device_id=${encodeURIComponent(deviceId)}`
}

async function fetchPlaybackState(): Promise<PlaybackState | null> {
  const response = await spotifyFetch(
    '/me/player?additional_types=track,episode',
  )
  if (response.status === 204) return null
  return (await response.json()) as PlaybackState
}

export function isPlayingUri(
  state: PlaybackState | null,
  uri: string,
): boolean {
  return Boolean(state?.item?.uri === uri && state.is_playing)
}

/** True when the player reports this episode as the current item (playing or paused). */
export function isCurrentUri(
  state: PlaybackState | null,
  uri: string,
): boolean {
  return state?.item?.uri === uri
}

/**
 * Open via the OS protocol handler. Must use top-level navigation — hidden
 * iframes are ignored by modern browsers for custom schemes.
 */
export function openInSpotifyApp(uri: string): void {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    window.open(uri, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.assign(uri)
}

/**
 * Resolve a device id for Player commands.
 * Prefer an already-active device (e.g. something currently playing).
 */
export async function ensurePlaybackDeviceId(): Promise<string> {
  // Playback state is the source of truth for "what's actually playing".
  const state = await fetchPlaybackState()
  if (state?.device?.id) {
    return state.device.id
  }

  const devices = await fetchDevices()
  const ranked = rankDevices(devices)
  const active = ranked.find((device) => device.is_active)
  const deviceId = active?.id ?? ranked[0]?.id
  if (!deviceId) {
    throw new SpotifyApiError(
      404,
      'Player command failed: No active device found',
    )
  }

  if (!active) {
    try {
      await spotifyFetch('/me/player', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      })
      await sleep(800)
    } catch {
      // Device may still accept commands with device_id.
    }
  }

  return deviceId
}

type PlayBody = {
  uris?: string[]
  context_uri?: string
  offset?: { uri: string }
  position_ms?: number
}

async function putPlayBody(
  body: PlayBody,
  deviceId?: string | null,
): Promise<void> {
  const path = deviceId
    ? withDeviceId('/me/player/play', deviceId)
    : '/me/player/play'
  await spotifyFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function buildPlayAttempts(
  uri: string,
  positionMs: number,
  showUri: string | null | undefined,
  activeDeviceId: string | null,
): Array<() => Promise<void>> {
  const attempts: Array<() => Promise<void>> = []

  // Prefer omitting device_id so Spotify uses the already-active player.
  attempts.push(() =>
    putPlayBody({ uris: [uri], position_ms: positionMs }),
  )

  if (activeDeviceId) {
    attempts.push(() =>
      putPlayBody({ uris: [uri], position_ms: positionMs }, activeDeviceId),
    )
  }

  if (showUri) {
    attempts.push(() =>
      putPlayBody({
        context_uri: showUri,
        offset: { uri },
        position_ms: positionMs,
      }),
    )
  }

  return attempts
}

/**
 * Start an episode on the active Connect device.
 * Returns true when the play command was accepted (204). Spotify often starts
 * playback before /me/player reflects the episode, so we do not require
 * playback-state confirmation.
 */
export async function playEpisodeViaConnect(
  uri: string,
  positionMs: number,
  showUri?: string | null,
): Promise<boolean> {
  const state = await fetchPlaybackState()
  const activeDeviceId = state?.device?.id ?? null

  if (!activeDeviceId) {
    // Wake / resolve a device only when nothing appears active yet.
    try {
      await ensurePlaybackDeviceId()
    } catch {
      throw new SpotifyApiError(
        404,
        'Player command failed: No active device found',
      )
    }
  }

  const attempts = buildPlayAttempts(
    uri,
    positionMs,
    showUri,
    activeDeviceId,
  )

  for (const attempt of attempts) {
    try {
      await attempt()
      // Spotify often starts playback before /me/player catches up.
      // A 204 from play is enough — do not deep-link afterward.
      return true
    } catch {
      // Try the next strategy.
    }
  }

  return false
}

export async function queueEpisode(
  uri: string,
  deviceId?: string,
): Promise<void> {
  const targetDeviceId = deviceId ?? (await ensurePlaybackDeviceId())
  const params = new URLSearchParams({ uri })
  await spotifyFetch(
    withDeviceId(`/me/player/queue?${params.toString()}`, targetDeviceId),
    { method: 'POST' },
  )
}

export async function queueEpisodes(
  uris: string[],
  deviceId?: string,
): Promise<void> {
  if (uris.length === 0) return
  const targetDeviceId = deviceId ?? (await ensurePlaybackDeviceId())
  for (const uri of uris) {
    await queueEpisode(uri, targetDeviceId)
  }
}

export type PlayRequest = {
  id: string
  uri: string
  showUri?: string | null
  positionMs: number
}

export type PlayThenQueueResult = {
  method: 'connect' | 'deep_link'
  queuedRemaining: boolean
  remainingCount: number
}

/**
 * Prefer Connect when a device is already active (e.g. music playing).
 * Fall back to a top-level `spotify:` handoff if Connect does not start the episode.
 */
export async function playThenQueue(
  episodes: PlayRequest[],
): Promise<PlayThenQueueResult> {
  if (episodes.length === 0) {
    throw new Error('No episodes to play')
  }

  const [first, ...rest] = episodes
  let method: PlayThenQueueResult['method'] = 'connect'

  try {
    const started = await playEpisodeViaConnect(
      first.uri,
      first.positionMs,
      first.showUri,
    )
    if (!started) {
      openInSpotifyApp(first.uri)
      method = 'deep_link'
    }
  } catch (err) {
    // Hard auth/premium failures should surface; otherwise try deep link.
    if (
      err instanceof SpotifyApiError &&
      err.status === 403 &&
      /premium|restriction|restrict/i.test(err.message)
    ) {
      throw err
    }
    openInSpotifyApp(first.uri)
    method = 'deep_link'
  }

  if (rest.length === 0) {
    return { method, queuedRemaining: true, remainingCount: 0 }
  }

  if (method === 'deep_link') {
    await sleep(2000)
  }

  try {
    const state = await fetchPlaybackState()
    const deviceId = state?.device?.id ?? (await ensurePlaybackDeviceId())
    await queueEpisodes(
      rest.map((episode) => episode.uri),
      deviceId ?? undefined,
    )
    return { method, queuedRemaining: true, remainingCount: rest.length }
  } catch {
    return { method, queuedRemaining: false, remainingCount: rest.length }
  }
}

export function formatPlaybackError(err: unknown): string {
  if (!(err instanceof SpotifyApiError)) {
    return err instanceof Error ? err.message : 'Playback failed'
  }

  const message = err.message.toLowerCase()

  if (
    err.status === 403 &&
    (message.includes('premium') ||
      message.includes('restriction') ||
      message.includes('restrict'))
  ) {
    return 'Requires Spotify Premium'
  }

  if (isNoActiveDeviceError(err)) {
    return 'Start playing anything in Spotify first, then try again'
  }

  if (
    message.includes('scope') ||
    message.includes('insufficient client scope')
  ) {
    return 'Please log out and log in again to grant playback permissions'
  }

  return err.message || `Playback failed (${err.status})`
}
