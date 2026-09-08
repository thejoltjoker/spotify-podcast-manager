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

export type PlaybackState = {
  is_playing?: boolean
  currently_playing_type?: string
  progress_ms?: number | null
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

/** Seek when progress differs from the desired position by more than 10s. */
export function shouldSeek(
  progressMs: number | null | undefined,
  desiredMs: number,
): boolean {
  if (desiredMs <= 0 && (progressMs == null || progressMs <= 0)) return false
  const current = Math.max(0, progressMs ?? 0)
  return Math.abs(current - desiredMs) > 10_000
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
  return response?.devices ?? []
}

function withDeviceId(path: string, deviceId: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}device_id=${encodeURIComponent(deviceId)}`
}

export async function fetchPlaybackState(): Promise<PlaybackState | null> {
  const response = await spotifyFetch(
    '/me/player?additional_types=track,episode',
  )
  if (response.status === 204) return null
  const text = await response.text()
  if (!text.trim()) return null
  return JSON.parse(text) as PlaybackState
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
 * Resolve a device id for Player commands.
 * Prefer an already-active device (e.g. something currently playing).
 * Only transfer when nothing is active — never pause an active player.
 */
export async function ensurePlaybackDeviceId(): Promise<{
  deviceId: string
  deviceName: string | null
}> {
  const state = await fetchPlaybackState()
  if (state?.device?.id) {
    return {
      deviceId: state.device.id,
      deviceName: state.device.name ?? null,
    }
  }

  const devices = await fetchDevices()
  const ranked = rankDevices(devices)
  const active = ranked.find((device) => device.is_active)
  const chosen = active ?? ranked[0]
  if (!chosen) {
    throw new SpotifyApiError(
      404,
      'Player command failed: No active device found',
    )
  }

  // Transfer only when no device is already active. play:false would pause
  // an active session, so we only wake idle devices.
  if (!active) {
    try {
      await spotifyFetch('/me/player', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [chosen.id], play: false }),
      })
      await sleep(800)
    } catch {
      // Device may still accept commands with device_id.
    }
  }

  return { deviceId: chosen.id, deviceName: chosen.name }
}

export async function queueItem(uri: string, deviceId: string): Promise<void> {
  const params = new URLSearchParams({ uri })
  await spotifyFetch(
    withDeviceId(`/me/player/queue?${params.toString()}`, deviceId),
    { method: 'POST' },
  )
}

export async function skipToNext(deviceId: string): Promise<void> {
  await spotifyFetch(withDeviceId('/me/player/next', deviceId), {
    method: 'POST',
  })
}

export async function seekTo(
  positionMs: number,
  deviceId: string,
): Promise<void> {
  const params = new URLSearchParams({
    position_ms: String(Math.max(0, Math.floor(positionMs))),
  })
  await spotifyFetch(
    withDeviceId(`/me/player/seek?${params.toString()}`, deviceId),
    { method: 'PUT' },
  )
}

/** Resume current playback (no body — does not replace the context). */
export async function resumePlayback(deviceId: string): Promise<void> {
  await spotifyFetch(withDeviceId('/me/player/play', deviceId), {
    method: 'PUT',
  })
}

/**
 * Play a show context starting at a specific episode.
 * Never pass episode URIs in `uris` — Spotify only accepts track URIs there.
 */
export async function playShowEpisode(
  showUri: string,
  episodeUri: string,
  positionMs: number,
  deviceId: string,
): Promise<void> {
  await spotifyFetch(withDeviceId('/me/player/play', deviceId), {
    method: 'PUT',
    body: JSON.stringify({
      context_uri: showUri,
      offset: { uri: episodeUri },
      position_ms: positionMs,
    }),
  })
}

const POLL_INTERVAL_MS = 400
const POLL_TIMEOUT_MS = 5_000

export async function waitForCurrentItem(
  uri: string,
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<PlaybackState | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await fetchPlaybackState()
    if (isCurrentUri(state, uri)) return state
    await sleep(POLL_INTERVAL_MS)
  }
  return null
}

async function settleAfterStart(
  uri: string,
  positionMs: number,
  deviceId: string,
): Promise<PlaybackState | null> {
  const state = await waitForCurrentItem(uri)
  if (!state) return null

  if (shouldSeek(state.progress_ms, positionMs)) {
    try {
      await seekTo(positionMs, deviceId)
    } catch {
      // Resume position is best-effort.
    }
  }

  if (state.is_playing === false) {
    try {
      await resumePlayback(deviceId)
    } catch {
      // May already be playing by the time we check.
    }
  }

  return state
}

export type PlayRequest = {
  id: string
  uri: string
  showUri?: string | null
  positionMs: number
}

export type PlayOutcome = {
  started: boolean
  deviceName: string | null
  queuedCount: number
  queueFailed: boolean
}

/**
 * Start an episode on the active Connect device via queue→next (episodes are
 * not supported in play `uris`). Fall back to show context + offset, then
 * report started:false so the UI can offer a Spotify deep link.
 */
export async function playEpisodes(
  episodes: PlayRequest[],
): Promise<PlayOutcome> {
  if (episodes.length === 0) {
    throw new Error('No episodes to play')
  }

  const [first, ...rest] = episodes
  const { deviceId, deviceName } = await ensurePlaybackDeviceId()

  let started = false
  let verified: PlaybackState | null = null

  // Strategy A: queue episode then skip to it (officially supports episode URIs).
  try {
    await queueItem(first.uri, deviceId)
    await skipToNext(deviceId)
    verified = await settleAfterStart(first.uri, first.positionMs, deviceId)
    started = verified != null
  } catch (err) {
    if (
      err instanceof SpotifyApiError &&
      err.status === 403 &&
      /premium|restriction|restrict/i.test(err.message)
    ) {
      throw err
    }
    // Fall through to strategy B.
  }

  // Strategy B: play show context with episode offset.
  if (!started && first.showUri) {
    try {
      await playShowEpisode(
        first.showUri,
        first.uri,
        first.positionMs,
        deviceId,
      )
      verified = await settleAfterStart(first.uri, first.positionMs, deviceId)
      started = verified != null
    } catch (err) {
      if (
        err instanceof SpotifyApiError &&
        err.status === 403 &&
        /premium|restriction|restrict/i.test(err.message)
      ) {
        throw err
      }
    }
  }

  if (!started) {
    return {
      started: false,
      deviceName,
      queuedCount: 0,
      queueFailed: rest.length > 0,
    }
  }

  if (rest.length === 0) {
    return {
      started: true,
      deviceName: verified?.device?.name ?? deviceName,
      queuedCount: 0,
      queueFailed: false,
    }
  }

  try {
    await queueEpisodes(
      rest.map((episode) => episode.uri),
      deviceId,
    )
    return {
      started: true,
      deviceName: verified?.device?.name ?? deviceName,
      queuedCount: rest.length,
      queueFailed: false,
    }
  } catch {
    return {
      started: true,
      deviceName: verified?.device?.name ?? deviceName,
      queuedCount: rest.length,
      queueFailed: true,
    }
  }
}

const QUEUE_GAP_MS = 150

export async function queueEpisode(
  uri: string,
  deviceId?: string,
): Promise<void> {
  const targetDeviceId =
    deviceId ?? (await ensurePlaybackDeviceId()).deviceId
  await queueItem(uri, targetDeviceId)
}

export async function queueEpisodes(
  uris: string[],
  deviceId?: string,
): Promise<void> {
  if (uris.length === 0) return
  const targetDeviceId =
    deviceId ?? (await ensurePlaybackDeviceId()).deviceId
  for (let i = 0; i < uris.length; i++) {
    await queueItem(uris[i]!, targetDeviceId)
    if (i < uris.length - 1) {
      await sleep(QUEUE_GAP_MS)
    }
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
