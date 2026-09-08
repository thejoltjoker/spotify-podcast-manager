import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  ButtonGroup,
  Container,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Link,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { NavLink } from 'react-router'
import { LuLayoutGrid, LuList } from 'react-icons/lu'
import { fetchAllFollowedShows } from '@/lib/spotify/shows'
import type { ShowRow } from '@/lib/spotify/types'

type ShowsView = 'grid' | 'list'

const VIEW_KEY = 'followed_shows_view'

function loadView(): ShowsView {
  try {
    const stored = localStorage.getItem(VIEW_KEY)
    return stored === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function ShowArtwork({
  show,
  size,
}: {
  show: ShowRow
  size: string
}) {
  if (show.imageUrl) {
    return (
      <Image
        src={show.imageUrl}
        alt=""
        boxSize={size}
        rounded="sm"
        objectFit="cover"
        flexShrink={0}
      />
    )
  }
  return <Box boxSize={size} bg="bg.muted" rounded="sm" flexShrink={0} />
}

function ShowMeta({ show, compact }: { show: ShowRow; compact?: boolean }) {
  return (
    <VStack align="start" gap={compact ? '0' : '1'} minW="0" flex="1">
      <Text fontWeight="medium" lineClamp={compact ? 1 : 2}>
        {show.name}
      </Text>
      <Text fontSize="sm" color="fg.muted" lineClamp={1}>
        {show.publisher}
      </Text>
      {show.totalEpisodes != null ? (
        <Text fontSize="xs" color="fg.muted">
          {show.totalEpisodes} episode{show.totalEpisodes === 1 ? '' : 's'}
        </Text>
      ) : null}
    </VStack>
  )
}

export function ShowsPage() {
  const [shows, setShows] = useState<ShowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<ShowsView>(loadView)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // ignore quota / private mode
    }
  }, [view])

  const loadShows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllFollowedShows()
      setShows(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shows')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadShows()
  }, [loadShows])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return shows
    return shows.filter(
      (show) =>
        show.name.toLowerCase().includes(q) ||
        show.publisher.toLowerCase().includes(q),
    )
  }, [shows, filter])

  return (
    <Box py="6">
      <Container maxW="7xl">
        <VStack align="stretch" gap="6">
          <VStack align="start" gap="1">
            <Heading size="xl">Followed shows</Heading>
            <Text fontSize="sm" color="fg.muted">
              Browse shows you follow and find episodes not yet in your library
            </Text>
          </VStack>

          <HStack gap="3" flexWrap="wrap">
            <Input
              flex="1"
              minW="2xs"
              maxW="md"
              placeholder="Filter shows…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ButtonGroup size="sm" variant="outline" attached>
              <IconButton
                aria-label="Grid view"
                title="Grid view"
                variant={view === 'grid' ? 'solid' : 'outline'}
                onClick={() => setView('grid')}
              >
                <LuLayoutGrid />
              </IconButton>
              <IconButton
                aria-label="List view"
                title="List view"
                variant={view === 'list' ? 'solid' : 'outline'}
                onClick={() => setView('list')}
              >
                <LuList />
              </IconButton>
            </ButtonGroup>
          </HStack>

          {error ? <Text color="fg.error">{error}</Text> : null}

          {loading ? (
            <VStack py="16" gap="3">
              <Spinner size="lg" />
              <Text color="fg.muted">Loading followed shows…</Text>
            </VStack>
          ) : shows.length === 0 ? (
            <Box py="12" textAlign="center">
              <Text color="fg.muted">
                You are not following any podcast shows yet.
              </Text>
            </Box>
          ) : filtered.length === 0 ? (
            <Box py="12" textAlign="center">
              <Text color="fg.muted">No shows match your filter.</Text>
            </Box>
          ) : view === 'grid' ? (
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap="4">
              {filtered.map((show) => (
                <Link
                  key={show.id}
                  asChild
                  display="block"
                  rounded="md"
                  borderWidth="1px"
                  overflow="hidden"
                  transition="background 0.15s"
                  _hover={{ textDecoration: 'none', bg: 'bg.muted' }}
                >
                  <NavLink to={`/shows/${show.id}`}>
                    <VStack align="stretch" gap="0">
                      {show.imageUrl ? (
                        <Image
                          src={show.imageUrl}
                          alt=""
                          aspectRatio={1}
                          objectFit="cover"
                          w="full"
                        />
                      ) : (
                        <Box aspectRatio={1} bg="bg.muted" w="full" />
                      )}
                      <Box p="3">
                        <ShowMeta show={show} />
                      </Box>
                    </VStack>
                  </NavLink>
                </Link>
              ))}
            </SimpleGrid>
          ) : (
            <VStack
              align="stretch"
              gap="0"
              borderWidth="1px"
              rounded="md"
              overflow="hidden"
              divideY="1px"
            >
              {filtered.map((show) => (
                <Link
                  key={show.id}
                  asChild
                  display="block"
                  transition="background 0.15s"
                  _hover={{ textDecoration: 'none', bg: 'bg.muted' }}
                >
                  <NavLink to={`/shows/${show.id}`}>
                    <HStack gap="3" px="3" py="2.5" align="center">
                      <ShowArtwork show={show} size="48px" />
                      <ShowMeta show={show} compact />
                    </HStack>
                  </NavLink>
                </Link>
              ))}
            </VStack>
          )}

          {!loading && shows.length > 0 ? (
            <HStack justify="flex-end">
              <Text fontSize="sm" color="fg.muted">
                {filtered.length} of {shows.length} shows
              </Text>
            </HStack>
          ) : null}
        </VStack>
      </Container>
    </Box>
  )
}
