import { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Image,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router'
import { LuArrowLeft } from 'react-icons/lu'
import { useAuth } from '@/auth/AuthContext'
import { ShowEpisodeTable } from '@/components/ShowEpisodeTable'
import { toaster } from '@/components/ui/toaster'
import { queryKeys } from '@/lib/query'
import { fetchAllSavedEpisodes } from '@/lib/spotify/episodes'
import { formatSpotifyError } from '@/lib/spotify/errors'
import { removeFromLibrary, saveToLibrary } from '@/lib/spotify/library'
import {
  formatPlaybackError,
  playbackPositionMs,
  playEpisodes,
  queueEpisodes,
} from '@/lib/spotify/playback'
import {
  fetchShow,
  fetchShowEpisodesPage,
  showEpisodesFromEmbedded,
  toShowRow,
  withSavedInLibrary,
  type ShowEpisodesPage,
} from '@/lib/spotify/shows'
import type { EpisodeRow, ShowEpisodeRow } from '@/lib/spotify/types'

type EpisodesPage = ShowEpisodesPage

function toEpisodeRowFromShowEpisode(row: ShowEpisodeRow): EpisodeRow {
  const { savedInLibrary: _saved, ...rest } = row
  return {
    ...rest,
    addedAt: new Date().toISOString(),
  }
}

export function ShowDetailPage() {
  const { isPremium } = useAuth()
  const { showId } = useParams<{ showId: string }>()
  const queryClient = useQueryClient()
  const [playbackBusy, setPlaybackBusy] = useState(false)

  const showQuery = useQuery({
    queryKey: queryKeys.show(showId ?? ''),
    queryFn: () => fetchShow(showId!),
    enabled: Boolean(showId),
  })

  const savedEpisodesQuery = useQuery({
    queryKey: queryKeys.savedEpisodes,
    queryFn: fetchAllSavedEpisodes,
  })

  const savedIds = useMemo(
    () => new Set((savedEpisodesQuery.data ?? []).map((row) => row.id)),
    [savedEpisodesQuery.data],
  )

  const show = showQuery.data ?? null
  const showRow = useMemo(
    () => (show ? toShowRow(show, '') : null),
    [show],
  )

  const episodesQuery = useInfiniteQuery({
    queryKey: queryKeys.showEpisodes(showId ?? ''),
    enabled: Boolean(showId) && Boolean(show),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (pageParam === 0) {
        const embedded = showEpisodesFromEmbedded(show!)
        if (embedded) return embedded
      }
      return fetchShowEpisodesPage(showId!, show!, pageParam)
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
  })

  const episodes = useMemo(() => {
    const raw =
      episodesQuery.data?.pages.flatMap((page: EpisodesPage) => page.rows) ??
      []
    return withSavedInLibrary(raw, savedIds)
  }, [episodesQuery.data, savedIds])
  const total = episodesQuery.data?.pages[0]?.total ?? 0

  const saveMutation = useMutation({
    mutationFn: async (rows: ShowEpisodeRow[]) => {
      await saveToLibrary(rows.map((row) => row.uri))
      return rows
    },
    onSuccess: (rows) => {
      queryClient.setQueryData<EpisodeRow[]>(
        queryKeys.savedEpisodes,
        (prev) => {
          const existing = new Set((prev ?? []).map((row) => row.id))
          const additions = rows
            .filter((row) => !existing.has(row.id))
            .map(toEpisodeRowFromShowEpisode)
          return [...additions, ...(prev ?? [])]
        },
      )
      toaster.create({
        title: `Saved ${rows.length} episode${rows.length === 1 ? '' : 's'}`,
        type: 'success',
      })
    },
    onError: (err) => {
      toaster.create({
        title: 'Save failed',
        description: formatSpotifyError(err),
        type: 'error',
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (rows: ShowEpisodeRow[]) => {
      await removeFromLibrary(rows.map((row) => row.uri))
      return rows
    },
    onSuccess: (rows) => {
      const removedIds = new Set(rows.map((row) => row.id))
      queryClient.setQueryData<EpisodeRow[]>(queryKeys.savedEpisodes, (prev) =>
        (prev ?? []).filter((row) => !removedIds.has(row.id)),
      )
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

  const handlePlay = useCallback(async (rows: ShowEpisodeRow[]) => {
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

  const handleQueue = useCallback(async (rows: ShowEpisodeRow[]) => {
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

  const error =
    !showId
      ? 'Missing show id'
      : showQuery.error
        ? formatSpotifyError(showQuery.error, 'Failed to load show')
        : episodesQuery.error
          ? formatSpotifyError(episodesQuery.error, 'Failed to load episodes')
          : null

  const loading =
    Boolean(showId) &&
    (showQuery.isPending ||
      episodesQuery.isPending ||
      savedEpisodesQuery.isPending)

  return (
    <Box py="6">
      <Container maxW="7xl">
        <VStack align="stretch" gap="6">
          <Button asChild variant="ghost" size="sm" alignSelf="flex-start">
            <RouterLink to="/shows">
              <LuArrowLeft />
              All shows
            </RouterLink>
          </Button>

          {error ? <Text color="fg.error">{error}</Text> : null}

          {showRow ? (
            <HStack align="start" gap="4" flexWrap="wrap">
              {showRow.imageUrl ? (
                <Image
                  src={showRow.imageUrl}
                  alt=""
                  boxSize={{ base: '96px', md: '140px' }}
                  rounded="md"
                  objectFit="cover"
                />
              ) : (
                <Box
                  boxSize={{ base: '96px', md: '140px' }}
                  bg="bg.muted"
                  rounded="md"
                />
              )}
              <VStack align="start" gap="2" flex="1" minW="0">
                <Heading size="xl" lineClamp={3}>
                  {showRow.name}
                </Heading>
                <Text color="fg.muted">{showRow.publisher}</Text>
                {showRow.totalEpisodes != null ? (
                  <Text fontSize="sm" color="fg.muted">
                    {showRow.totalEpisodes} episode
                    {showRow.totalEpisodes === 1 ? '' : 's'}
                  </Text>
                ) : null}
                <Link
                  href={showRow.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  fontSize="sm"
                >
                  Open in Spotify
                </Link>
              </VStack>
            </HStack>
          ) : null}

          <ShowEpisodeTable
            data={episodes}
            loading={loading}
            total={total}
            hasMore={Boolean(episodesQuery.hasNextPage)}
            loadingMore={episodesQuery.isFetchingNextPage}
            onLoadMore={() => {
              void episodesQuery.fetchNextPage()
            }}
            onSave={async (rows) => {
              await saveMutation.mutateAsync(rows)
            }}
            onRemove={async (rows) => {
              await removeMutation.mutateAsync(rows)
            }}
            onPlay={handlePlay}
            onQueue={handleQueue}
            libraryBusy={saveMutation.isPending || removeMutation.isPending}
            playbackBusy={playbackBusy}
            playbackAllowed={isPremium}
          />
        </VStack>
      </Container>
    </Box>
  )
}
