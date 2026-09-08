import {
  Box,
  Button,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { AppShell } from '@/components/AppShell'
import { REDIRECT_URI } from '@/lib/spotify/pkce'
import { SavedEpisodesPage } from '@/pages/SavedEpisodesPage'
import { ShowDetailPage } from '@/pages/ShowDetailPage'
import { ShowsPage } from '@/pages/ShowsPage'

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
          Browse saved episodes and followed shows, and save new episodes to
          your Spotify library.
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

function AuthenticatedApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<SavedEpisodesPage />} />
          <Route path="shows" element={<ShowsPage />} />
          <Route path="shows/:showId" element={<ShowDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
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

  return <AuthenticatedApp />
}
