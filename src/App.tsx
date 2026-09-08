import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useAuth } from '@/auth/AuthContext'
import { EpisodeTable } from '@/components/EpisodeTable'
import { toaster } from '@/components/ui/toaster'
import {
  fetchAllSavedEpisodes,
  removeEpisodesFromLibrary,
} from '@/lib/spotify/episodes'
import {
  formatPlaybackError,
  playbackPositionMs,
  playThenQueue,
  queueEpisodes,
} from '@/lib/spotify/playback'
import { REDIRECT_URI } from '@/lib/spotify/pkce'
import type { EpisodeRow } from '@/lib/spotify/types'

function LoginScreen({
  error,
  onLogin,
}: {
  error: string | null
  onLogin: () => void
}) {
  return (
    <Box minH="100vh" display="grid" placeItems="center" px="4">
      <VStack gap="6" maxW="md" textAlign="center">
        <Heading size="2xl">Podcast Episode Manager</Heading>
        <Text color="fg.muted">
          Browse, filter, and remove podcast episodes saved in your Spotify
          library.
        </Text>
        {error ? (
          <Text color="fg.error" fontSize="sm">
            {error}
          </Text>
        ) : null}
        <Button colorPalette="green" size="lg" onClick={onLogin}>
          Log in with Spotify
        </Button>
        <Text fontSize="xs" color="fg.muted">
          Content provided by Spotify. Redirect URI must be{' '}
          <Text as="span" fontFamily="mono">
            {REDIRECT_URI}
          </Text>
        </Text>
      </VStack>
    </Box>
  )
}

function EpisodesPage() {
  const { user, logout } = useAuth()
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
      const result = await playThenQueue(
        rows.map((row) => ({
          id: row.id,
          uri: row.uri,
          showUri: row.showUri,
          positionMs: playbackPositionMs(row.playStatus, row.resumePositionMs),
        })),
      )
        const via =
        result.method === 'connect'
          ? 'on your Spotify device'
          : 'via the Spotify app link'
      if (result.remainingCount === 0) {
        toaster.create({
          title: 'Playing episode',
          description: `Started ${via}`,
          type: 'success',
        })
      } else if (result.queuedRemaining) {
        toaster.create({
          title: 'Playing episode',
          description: `Started ${via}; queued ${result.remainingCount} more`,
          type: 'success',
        })
      } else {
        toaster.create({
          title: 'Playing episode',
          description: `Started ${via}, but could not queue the rest`,
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
    <Box minH="100vh" py="6">
      <Container maxW="7xl">
        <VStack align="stretch" gap="6">
          <HStack justify="space-between" align="start" flexWrap="wrap" gap="3">
            <VStack align="start" gap="1">
              <Heading size="xl">Saved podcast episodes</Heading>
              <Text fontSize="sm" color="fg.muted">
                Signed in as {user?.display_name ?? user?.id} · Content from
                Spotify
              </Text>
            </VStack>
            <HStack>
              <Button size="sm" variant="outline" onClick={() => void loadEpisodes()}>
                Refresh
              </Button>
              <Button size="sm" variant="ghost" onClick={logout}>
                Log out
              </Button>
            </HStack>
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
            />
          )}
        </VStack>
      </Container>
    </Box>
  )
}

export default function App() {
  const { status, error, login } = useAuth()

  if (status === 'loading') {
    return (
      <Box minH="100vh" display="grid" placeItems="center">
        <VStack gap="3">
          <Spinner size="lg" />
          <Text color="fg.muted">Connecting…</Text>
        </VStack>
      </Box>
    )
  }

  if (status !== 'authenticated') {
    return <LoginScreen error={error} onLogin={() => void login()} />
  }

  return <EpisodesPage />
}
