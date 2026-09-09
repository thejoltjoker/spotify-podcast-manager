import {
  Box,
  Button,
  Text,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListInfoBar } from '@/components/ListChrome'
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

  const refreshButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void refetch()}
      loading={isFetching && !isPending}
      disabled={isPending}
    >
      Refresh
    </Button>
  )

  return (
    <Box
      flex="1"
      bg="bg.muted"
      px={{ base: '4', md: '6' }}
      py={{ base: '4', md: '6' }}
    >
      {error ? (
        <>
          <ListInfoBar
            title="Followed shows"
            description="Browse shows you follow and open a show to find episodes not yet in your library"
          >
            {refreshButton}
          </ListInfoBar>
          <Text color="fg.error" mt="4">
            {formatSpotifyError(error, 'Failed to load shows')}
          </Text>
        </>
      ) : (
        <ShowTable
          title="Followed shows"
          description="Browse shows you follow and open a show to find episodes not yet in your library"
          headerActions={refreshButton}
          data={shows}
          loading={isPending}
          onUnfollow={async (unfollowed) => {
            await unfollowMutation.mutateAsync(unfollowed)
          }}
          unfollowing={unfollowMutation.isPending}
        />
      )}
    </Box>
  )
}
