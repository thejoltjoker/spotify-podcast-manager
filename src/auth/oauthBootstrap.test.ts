import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  bootstrapAuth,
  resetOAuthBootstrapForTests,
} from './oauthBootstrap'
import type { StoredTokens } from '@/lib/spotify/types'

const fullScope =
  'user-library-read user-library-modify user-read-playback-position user-read-playback-state user-modify-playback-state'

const sampleTokens: StoredTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 3_600_000,
  scope: fullScope,
}

function deps(
  overrides: Partial<Parameters<typeof bootstrapAuth>[0]> = {},
): Parameters<typeof bootstrapAuth>[0] {
  return {
    pathname: '/',
    search: '',
    replaceState: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    loadTokens: () => null,
    clearTokens: vi.fn(),
    ...overrides,
  }
}

describe('bootstrapAuth', () => {
  beforeEach(() => {
    resetOAuthBootstrapForTests()
  })

  it('restores an existing session from storage', async () => {
    const result = await bootstrapAuth(
      deps({
        loadTokens: () => sampleTokens,
      }),
    )

    expect(result).toEqual({ status: 'authenticated', tokens: sampleTokens })
  })

  it('returns unauthenticated when there is no session', async () => {
    const result = await bootstrapAuth(deps())

    expect(result).toEqual({ status: 'unauthenticated' })
  })

  it('clears tokens missing the playback scope and requires re-login', async () => {
    const clearTokens = vi.fn()
    const staleTokens: StoredTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
      scope:
        'user-library-read user-library-modify user-read-playback-position',
    }

    const result = await bootstrapAuth(
      deps({
        loadTokens: () => staleTokens,
        clearTokens,
      }),
    )

    expect(clearTokens).toHaveBeenCalled()
    expect(result).toEqual({
      status: 'unauthenticated',
      error: 'Please log in again to grant playback permissions.',
    })
  })

  it('clears tokens with no stored scope field', async () => {
    const clearTokens = vi.fn()
    const legacyTokens: StoredTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
    }

    const result = await bootstrapAuth(
      deps({
        loadTokens: () => legacyTokens,
        clearTokens,
      }),
    )

    expect(clearTokens).toHaveBeenCalled()
    expect(result.status).toBe('unauthenticated')
  })

  it('exchanges the OAuth code on /callback', async () => {
    const exchangeCodeForTokens = vi.fn().mockResolvedValue(sampleTokens)
    const replaceState = vi.fn()

    const result = await bootstrapAuth(
      deps({
        pathname: '/callback',
        search: '?code=abc&state=xyz',
        replaceState,
        exchangeCodeForTokens,
      }),
    )

    expect(replaceState).toHaveBeenCalledWith('/')
    expect(exchangeCodeForTokens).toHaveBeenCalledWith('abc', 'xyz')
    expect(result).toEqual({ status: 'authenticated', tokens: sampleTokens })
  })

  it('surfaces Spotify OAuth errors from the callback', async () => {
    const result = await bootstrapAuth(
      deps({
        pathname: '/callback',
        search: '?error=access_denied',
      }),
    )

    expect(result).toEqual({
      status: 'unauthenticated',
      error: 'Spotify login failed: access_denied',
    })
  })

  it('shares an in-flight callback exchange across a StrictMode remount', async () => {
    let resolveExchange!: (tokens: StoredTokens) => void
    const exchangePromise = new Promise<StoredTokens>((resolve) => {
      resolveExchange = resolve
    })
    const exchangeCodeForTokens = vi.fn(() => exchangePromise)
    const loadTokens = vi.fn(() => null)

    // First mount: on /callback, starts exchange, clears the URL immediately
    const first = bootstrapAuth(
      deps({
        pathname: '/callback',
        search: '?code=abc&state=xyz',
        exchangeCodeForTokens,
        loadTokens,
      }),
    )

    // Remount: URL already cleaned; exchange still in flight; tokens not stored yet
    const second = bootstrapAuth(
      deps({
        pathname: '/',
        search: '',
        exchangeCodeForTokens,
        loadTokens,
      }),
    )

    resolveExchange(sampleTokens)

    await expect(first).resolves.toEqual({
      status: 'authenticated',
      tokens: sampleTokens,
    })
    await expect(second).resolves.toEqual({
      status: 'authenticated',
      tokens: sampleTokens,
    })
    expect(exchangeCodeForTokens).toHaveBeenCalledTimes(1)
  })
})
