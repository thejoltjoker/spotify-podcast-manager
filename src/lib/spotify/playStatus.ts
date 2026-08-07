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
