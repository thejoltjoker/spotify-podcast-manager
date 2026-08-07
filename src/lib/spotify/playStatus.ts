export type PlayStatus = 'unplayed' | 'in_progress' | 'finished'

export type ResumePoint = {
  fully_played: boolean
  resume_position_ms: number
}

export const PLAY_STATUS_LABELS: Record<PlayStatus, string> = {
  unplayed: 'Unplayed',
  in_progress: 'In progress',
  finished: 'Finished',
}

export function derivePlayStatus(
  resumePoint: ResumePoint | undefined | null,
): PlayStatus {
  if (!resumePoint) return 'unplayed'
  if (resumePoint.fully_played) return 'finished'
  if (resumePoint.resume_position_ms > 0) return 'in_progress'
  return 'unplayed'
}

function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/** Compact progress for in-progress episodes, e.g. "28m left · 42%". */
export function formatPlayProgress(
  playStatus: PlayStatus,
  resumePositionMs: number,
  durationMs: number,
): string | null {
  if (playStatus !== 'in_progress' || durationMs <= 0) return null
  const playedMs = Math.min(Math.max(0, resumePositionMs), durationMs)
  const remainingMs = durationMs - playedMs
  const percent = Math.round((playedMs / durationMs) * 100)
  return `${formatRemaining(remainingMs)} left · ${percent}%`
}

/** 0–1 fraction played; used for sorting. Unplayed = 0, finished = 1. */
export function playProgressRatio(
  playStatus: PlayStatus,
  resumePositionMs: number,
  durationMs: number,
): number {
  if (playStatus === 'finished') return 1
  if (playStatus === 'unplayed' || durationMs <= 0) return 0
  return Math.min(Math.max(0, resumePositionMs), durationMs) / durationMs
}
