import { useCallback, useEffect, useState } from 'react'
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
import { Link as RouterLink, useParams } from 'react-router'
import { LuArrowLeft } from 'react-icons/lu'
import { useAuth } from '@/auth/AuthContext'
import { ShowEpisodeTable } from '@/components/ShowEpisodeTable'
import { toaster } from '@/components/ui/toaster'
import { libraryContains, removeFromLibrary, saveToLibrary } from '@/lib/spotify/library'
import {
  formatPlaybackError,
  playbackPositionMs,
  playEpisodes,
  queueEpisodes,
} from '@/lib/spotify/playback'
import {
  fetchShow,
  fetchShowEpisodesPage,
  toShowRow,
} from '@/lib/spotify/shows'
import type { ShowEpisodeRow, ShowRow, SpotifyShow } from '@/lib/spotify/types'

export function ShowDetailPage() {
  const { isPremium } = useAuth()
  const { showId } = useParams<{ showId: string }>()
  const [show, setShow] = useState<SpotifyShow | null>(null)
  const [showRow, setShowRow] = useState<ShowRow | null>(null)
  const [episodes, setEpisodes] = useState<ShowEpisodeRow[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [playbackBusy, setPlaybackBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applySavedFlags = useCallback(
    async (rows: ShowEpisodeRow[]): Promise<ShowEpisodeRow[]> => {
      if (rows.length === 0) return rows
      const flags = await libraryContains(rows.map((row) => row.uri))
      return rows.map((row) => ({
        ...row,
        savedInLibrary: flags.get(row.uri) ?? false,
      }))
    },
    [],
  )

  const loadInitial = useCallback(async () => {
    if (!showId) {
      setError('Missing show id')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const loadedShow = await fetchShow(showId)
      setShow(loadedShow)
      setShowRow(toShowRow(loadedShow, ''))
      const page = await fetchShowEpisodesPage(showId, loadedShow, 0)
      const withFlags = await applySavedFlags(page.rows)
      setEpisodes(withFlags)
      setTotal(page.total)
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load show')
    } finally {
      setLoading(false)
    }
  }, [applySavedFlags, showId])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const handleLoadMore = useCallback(async () => {
    if (!showId || !show || !hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchShowEpisodesPage(showId, show, nextOffset)
      const withFlags = await applySavedFlags(page.rows)
      setEpisodes((prev) => [...prev, ...withFlags])
      setTotal(page.total)
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
    } catch (err) {
      toaster.create({
        title: 'Could not load more episodes',
        description: err instanceof Error ? err.message : 'Unknown error',
        type: 'error',
      })
    } finally {
      setLoadingMore(false)
    }
  }, [applySavedFlags, hasMore, loadingMore, nextOffset, show, showId])

  const handleSave = useCallback(async (rows: ShowEpisodeRow[]) => {
    if (rows.length === 0) return
    setLibraryBusy(true)
    try {
      await saveToLibrary(rows.map((row) => row.uri))
      const ids = new Set(rows.map((row) => row.id))
      setEpisodes((prev) =>
        prev.map((row) =>
          ids.has(row.id) ? { ...row, savedInLibrary: true } : row,
        ),
      )
      toaster.create({
        title: `Saved ${rows.length} episode${rows.length === 1 ? '' : 's'}`,
        type: 'success',
      })
    } catch (err) {
      toaster.create({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        type: 'error',
      })
    } finally {
      setLibraryBusy(false)
    }
  }, [])

  const handleRemove = useCallback(async (rows: ShowEpisodeRow[]) => {
    if (rows.length === 0) return
    setLibraryBusy(true)
    try {
      await removeFromLibrary(rows.map((row) => row.uri))
      const ids = new Set(rows.map((row) => row.id))
      setEpisodes((prev) =>
        prev.map((row) =>
          ids.has(row.id) ? { ...row, savedInLibrary: false } : row,
        ),
      )
      toaster.create({
        title: `Removed ${rows.length} episode${rows.length === 1 ? '' : 's'}`,
        type: 'success',
      })
    } catch (err) {
      toaster.create({
        title: 'Remove failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        type: 'error',
      })
    } finally {
      setLibraryBusy(false)
    }
  }, [])

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
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={() => void handleLoadMore()}
            onSave={handleSave}
            onRemove={handleRemove}
            onPlay={handlePlay}
            onQueue={handleQueue}
            libraryBusy={libraryBusy}
            playbackBusy={playbackBusy}
            playbackAllowed={isPremium}
          />
        </VStack>
      </Container>
    </Box>
  )
}
