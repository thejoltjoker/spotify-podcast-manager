import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setTokenChangeListener } from '@/lib/spotify/client'
import {
  beginLogin,
  clearTokens,
  exchangeCodeForTokens,
  loadTokens,
} from '@/lib/spotify/pkce'
import { fetchCurrentUser } from '@/lib/spotify/episodes'
import type { SpotifyUser, StoredTokens } from '@/lib/spotify/types'
import { bootstrapAuth } from '@/auth/oauthBootstrap'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  status: AuthStatus
  user: SpotifyUser | null
  /** Player API requires Spotify Premium */
  isPremium: boolean
  error: string | null
  login: () => Promise<void>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearSession = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setUser(null)
    setStatus('unauthenticated')
  }, [queryClient])

  const applyTokens = useCallback(
    async (tokens: StoredTokens | null) => {
      if (!tokens) {
        queryClient.clear()
        setUser(null)
        setStatus('unauthenticated')
        return
      }
      try {
        const me = await fetchCurrentUser()
        setUser(me)
        setStatus('authenticated')
      } catch (err) {
        clearTokens()
        queryClient.clear()
        setUser(null)
        setStatus('unauthenticated')
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      }
    },
    [queryClient],
  )

  useEffect(() => {
    setTokenChangeListener((tokens) => {
      void applyTokens(tokens)
    })
    return () => setTokenChangeListener(null)
  }, [applyTokens])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const result = await bootstrapAuth({
        pathname: window.location.pathname,
        search: window.location.search,
        replaceState: (url) => {
          window.history.replaceState({}, '', url)
        },
        exchangeCodeForTokens,
        loadTokens,
        clearTokens,
      })

      if (cancelled) return

      if (result.status === 'authenticated') {
        await applyTokens(result.tokens)
        return
      }

      setError(result.error ?? null)
      setUser(null)
      setStatus('unauthenticated')
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [applyTokens])

  const login = useCallback(async () => {
    setError(null)
    try {
      await beginLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start login')
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({
      status,
      user,
      // `product` requires user-read-private and may be absent; only treat
      // explicitly free/open accounts as non-Premium so Premium users aren't blocked.
      isPremium:
        user?.product == null ||
        user.product === 'premium',
      error,
      login,
      logout,
      clearError: () => setError(null),
    }),
    [status, user, error, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
