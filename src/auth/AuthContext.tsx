import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { setTokenChangeListener } from '@/lib/spotify/client'
import {
  beginLogin,
  clearTokens,
  exchangeCodeForTokens,
  loadTokens,
} from '@/lib/spotify/pkce'
import { fetchCurrentUser } from '@/lib/spotify/episodes'
import type { SpotifyUser, StoredTokens } from '@/lib/spotify/types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  status: AuthStatus
  user: SpotifyUser | null
  error: string | null
  login: () => Promise<void>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyTokens = useCallback(async (tokens: StoredTokens | null) => {
    if (!tokens) {
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
      setUser(null)
      setStatus('unauthenticated')
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    }
  }, [])

  useEffect(() => {
    setTokenChangeListener((tokens) => {
      void applyTokens(tokens)
    })
    return () => setTokenChangeListener(null)
  }, [applyTokens])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search)
      const isCallback = window.location.pathname === '/callback'

      if (isCallback) {
        const code = params.get('code')
        const state = params.get('state')
        const oauthError = params.get('error')

        window.history.replaceState({}, '', '/')

        if (oauthError) {
          if (!cancelled) {
            setError(`Spotify login failed: ${oauthError}`)
            setStatus('unauthenticated')
          }
          return
        }

        if (code && state) {
          try {
            const tokens = await exchangeCodeForTokens(code, state)
            if (!cancelled) await applyTokens(tokens)
          } catch (err) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : 'Login failed')
              setStatus('unauthenticated')
            }
          }
          return
        }
      }

      const existing = loadTokens()
      if (!cancelled) {
        await applyTokens(existing)
      }
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
    clearTokens()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
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
