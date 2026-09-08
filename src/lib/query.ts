import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Session-length cache — Refresh buttons and mutation setQueryData
      // are the only freshness sources under development-mode quota.
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

export const queryKeys = {
  followedShows: ['followedShows'] as const,
  savedEpisodes: ['savedEpisodes'] as const,
  show: (showId: string) => ['show', showId] as const,
  showEpisodes: (showId: string) => ['showEpisodes', showId] as const,
}
