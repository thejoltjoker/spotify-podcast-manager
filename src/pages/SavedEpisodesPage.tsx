import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Container, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { EpisodeTable } from '@/components/EpisodeTable'
import { toaster } from '@/components/ui/toaster'
import {
  fetchAllSavedEpisodes,
  removeEpisodesFromLibrary,
} from '@/lib/spotify/episodes'
import { useAuth } from '@/auth/AuthContext'
import {
  formatPlaybackError,
  playbackPositionMs,
  playEpisodes,
  queueEpisodes,
} from '@/lib/spotify/playback'
import type { EpisodeRow } from '@/lib/spotify/types'

export function SavedEpisodesPage() {
  const { isPremium } = useAuth()
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(false)
  const [playbackBusy, setPlaybackBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEpisodes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllSavedEpisodes()
      setEpisodes(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load episodes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEpisodes()
  }, [loadEpisodes])

  const removeRows = useCallback(
    async (
      rows: EpisodeRow[],
      messages: { success: string; errorTitle: string },
    ) => {
      setRemoving(true)
      try {
        await removeEpisodesFromLibrary(rows.map((r) => r.uri))
        const removedIds = new Set(rows.map((r) => r.id))
        setEpisodes((prev) => prev.filter((e) => !removedIds.has(e.id)))
        toaster.create({
          title: messages.success,
          type: 'success',
        })
      } catch (err) {
        toaster.create({
          title: messages.errorTitle,
          description: err instanceof Error ? err.message : 'Unknown error',
          type: 'error',
        })
      } finally {
        setRemoving(false)
      }
    },
    [],
  )

  const handleRemove = useCallback(
    async (rows: EpisodeRow[]) => {
      await removeRows(rows, {
        success: `Removed ${rows.length} episode${rows.length === 1 ? '' : 's'}`,
        errorTitle: 'Remove failed',
      })
    },
    [removeRows],
  )

  const handleMarkPlayedAndRemove = useCallback(
    async (rows: EpisodeRow[]) => {
      await removeRows(rows, {
        success: `Marked ${rows.length} episode${rows.length === 1 ? '' : 's'} as played and removed`,
        errorTitle: 'Mark played & remove failed',
      })
    },
    [removeRows],
  )

  const handlePlay = useCallback(async (rows: EpisodeRow[]) => {
    if (rows.length === 0) return
    setPlaybackBusy(true)
    try {
      const result = await playEpisodes(
        rows.map((row) => ({
          id: row.id,
          uri: row.uri,
          showUri: row.showUri,
          positionMs: playbackPositionMs(row.playStatus, row.resumePositionMs),
        })),
      )

      if (!result.started) {
        const first = rows[0]!
        toaster.create({
          title: 'Could not start playback on a device',
          description: 'Open the episode in Spotify instead?',
          type: 'warning',
          action: {
            label: 'Open in Spotify',
            onClick: () => {
              window.open(first.spotifyUrl, '_blank', 'noopener,noreferrer')
            },
          },
        })
        return
      }

      const where = result.deviceName
        ? `on ${result.deviceName}`
        : 'on your Spotify device'

      if (result.queuedCount === 0) {
        toaster.create({
          title: 'Playing episode',
          description: `Started ${where}`,
          type: 'success',
        })
      } else if (!result.queueFailed) {
        toaster.create({
          title: 'Playing episode',
          description: `Started ${where}; queued ${result.queuedCount} more`,
          type: 'success',
        })
      } else {
        toaster.create({
          title: 'Playing episode',
          description: `Started ${where}, but could not queue the rest`,
          type: 'warning',
        })
      }
    } catch (err) {
      toaster.create({
        title: 'Play failed',
        description: formatPlaybackError(err),
        type: 'error',
      })
    } finally {
      setPlaybackBusy(false)
    }
  }, [])

  const handleQueue = useCallback(async (rows: EpisodeRow[]) => {
    if (rows.length === 0) return
    setPlaybackBusy(true)
    try {
      await queueEpisodes(rows.map((r) => r.uri))
      toaster.create({
        title: `Added ${rows.length} episode${rows.length === 1 ? '' : 's'} to queue`,
        type: 'success',
      })
    } catch (err) {
      toaster.create({
        title: 'Queue failed',
        description: formatPlaybackError(err),
        type: 'error',
      })
    } finally {
      setPlaybackBusy(false)
    }
  }, [])

  return (
    <Box py="6">
      <Container maxW="7xl">
        <VStack align="stretch" gap="6">
          <HStack justify="space-between" align="start" flexWrap="wrap" gap="3">
            <VStack align="start" gap="1">
              <Heading size="xl">Saved podcast episodes</Heading>
              <Text fontSize="sm" color="fg.muted">
                Content from Spotify
              </Text>
            </VStack>
            <Button size="sm" variant="outline" onClick={() => void loadEpisodes()}>
              Refresh
            </Button>
          </HStack>

          {error ? (
            <Text color="fg.error">{error}</Text>
          ) : (
            <EpisodeTable
              data={episodes}
              loading={loading}
              onRemove={handleRemove}
              onMarkPlayedAndRemove={handleMarkPlayedAndRemove}
              onPlay={handlePlay}
              onQueue={handleQueue}
              removing={removing}
              playbackBusy={playbackBusy}
              playbackAllowed={isPremium}
            />
          )}
        </VStack>
      </Container>
    </Box>
  )
}
