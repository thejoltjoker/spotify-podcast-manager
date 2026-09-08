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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShowTable } from '@/components/ShowTable'
import { toaster } from '@/components/ui/toaster'
import { queryKeys } from '@/lib/query'
import { formatSpotifyError } from '@/lib/spotify/errors'
import { removeFromLibrary } from '@/lib/spotify/library'
import { fetchAllFollowedShows } from '@/lib/spotify/shows'
import type { ShowRow } from '@/lib/spotify/types'

export function ShowsPage() {
  const queryClient = useQueryClient()

  const {
    data: shows = [],
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.followedShows,
    queryFn: fetchAllFollowedShows,
  })

  const unfollowMutation = useMutation({
    mutationFn: async (unfollowed: ShowRow[]) => {
      await removeFromLibrary(unfollowed.map((row) => row.uri))
      return unfollowed
    },
    onSuccess: (unfollowed) => {
      const removedIds = new Set(unfollowed.map((row) => row.id))
      queryClient.setQueryData<ShowRow[]>(queryKeys.followedShows, (prev) =>
        (prev ?? []).filter((show) => !removedIds.has(show.id)),
      )
      toaster.create({
        title: `Unfollowed ${unfollowed.length} show${unfollowed.length === 1 ? '' : 's'}`,
        type: 'success',
      })
    },
    onError: (err) => {
      toaster.create({
        title: 'Unfollow failed',
        description: formatSpotifyError(err),
        type: 'error',
      })
    },
  })

  return (
    <Box py="6">
      <Container maxW="7xl">
        <VStack align="stretch" gap="6">
          <HStack justify="space-between" align="start" flexWrap="wrap" gap="3">
            <VStack align="start" gap="1">
              <Heading size="xl">Followed shows</Heading>
              <Text fontSize="sm" color="fg.muted">
                Browse shows you follow and open a show to find episodes not yet
                in your library
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
            <Text color="fg.error">{formatSpotifyError(error, 'Failed to load shows')}</Text>
          ) : null}

          {isPending ? (
            <VStack py="16" gap="3">
              <Spinner size="lg" />
              <Text color="fg.muted">Loading followed shows…</Text>
            </VStack>
          ) : (
            <ShowTable
              data={shows}
              onUnfollow={async (unfollowed) => {
                await unfollowMutation.mutateAsync(unfollowed)
              }}
              unfollowing={unfollowMutation.isPending}
            />
          )}
        </VStack>
      </Container>
    </Box>
  )
}
