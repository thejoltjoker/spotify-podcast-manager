import { useCallback, useState } from 'react'
import { Box, Button, Container, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EpisodeTable } from '@/components/EpisodeTable'
import { toaster } from '@/components/ui/toaster'
import {
  fetchAllSavedEpisodes,
  removeEpisodesFromLibrary,
} from '@/lib/spotify/episodes'
import { useAuth } from '@/auth/AuthContext'
import { queryKeys } from '@/lib/query'
import { formatSpotifyError } from '@/lib/spotify/errors'
import {
  formatPlaybackError,
  playbackPositionMs,
  playEpisodes,
  queueEpisodes,
} from '@/lib/spotify/playback'
import type { EpisodeRow } from '@/lib/spotify/types'

export function SavedEpisodesPage() {
  const { isPremium } = useAuth()
  const queryClient = useQueryClient()
  const [playbackBusy, setPlaybackBusy] = useState(false)

  const {
    data: episodes = [],
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.savedEpisodes,
    queryFn: fetchAllSavedEpisodes,
  })

  const removeMutation = useMutation({
    mutationFn: async (rows: EpisodeRow[]) => {
      await removeEpisodesFromLibrary(rows.map((r) => r.uri))
      return rows
    },
    onSuccess: (rows) => {
      const removedIds = new Set(rows.map((r) => r.id))
      queryClient.setQueryData<EpisodeRow[]>(queryKeys.savedEpisodes, (prev) =>
        (prev ?? []).filter((e) => !removedIds.has(e.id)),
      )
      void queryClient.invalidateQueries({ queryKey: ['showEpisodes'] })
      toaster.create({
        title: `Removed ${rows.length} episode${rows.length === 1 ? '' : 's'}`,
        type: 'success',
      })
    },
    onError: (err) => {
      toaster.create({
        title: 'Remove failed',
        description: formatSpotifyError(err),
        type: 'error',
      })
    },
  })

  const handleRemove = useCallback(
    async (rows: EpisodeRow[]) => {
      await removeMutation.mutateAsync(rows)
    },
    [removeMutation],
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              loading={isFetching && !isPending}
              disabled={isPending}
            >
              Refresh
            </Button>
          </HStack>

          {error ? (
            <Text color="fg.error">
              {formatSpotifyError(error, 'Failed to load episodes')}
            </Text>
          ) : (
            <EpisodeTable
              data={episodes}
              loading={isPending}
              onRemove={handleRemove}
              onPlay={handlePlay}
              onQueue={handleQueue}
              removing={removeMutation.isPending}
              playbackBusy={playbackBusy}
              playbackAllowed={isPremium}
            />
          )}
        </VStack>
      </Container>
    </Box>
  )
}
