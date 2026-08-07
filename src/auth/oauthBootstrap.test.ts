import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  bootstrapAuth,
  resetOAuthBootstrapForTests,
} from './oauthBootstrap'
import type { StoredTokens } from '@/lib/spotify/types'

const sampleTokens: StoredTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 3_600_000,
}

describe('bootstrapAuth', () => {
  beforeEach(() => {
    resetOAuthBootstrapForTests()
  })

  it('restores an existing session from storage', async () => {
    const result = await bootstrapAuth({
      pathname: '/',
      search: '',
      replaceState: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      loadTokens: () => sampleTokens,
    })

    expect(result).toEqual({ status: 'authenticated', tokens: sampleTokens })
  })

  it('returns unauthenticated when there is no session', async () => {
    const result = await bootstrapAuth({
      pathname: '/',
      search: '',
      replaceState: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      loadTokens: () => null,
    })

    expect(result).toEqual({ status: 'unauthenticated' })
  })

  it('exchanges the OAuth code on /callback', async () => {
    const exchangeCodeForTokens = vi.fn().mockResolvedValue(sampleTokens)
    const replaceState = vi.fn()

    const result = await bootstrapAuth({
      pathname: '/callback',
      search: '?code=abc&state=xyz',
      replaceState,
      exchangeCodeForTokens,
      loadTokens: () => null,
    })

    expect(replaceState).toHaveBeenCalledWith('/')
    expect(exchangeCodeForTokens).toHaveBeenCalledWith('abc', 'xyz')
    expect(result).toEqual({ status: 'authenticated', tokens: sampleTokens })
  })

  it('surfaces Spotify OAuth errors from the callback', async () => {
    const result = await bootstrapAuth({
      pathname: '/callback',
      search: '?error=access_denied',
      replaceState: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      loadTokens: () => null,
    })

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
    const first = bootstrapAuth({
      pathname: '/callback',
      search: '?code=abc&state=xyz',
      replaceState: vi.fn(),
      exchangeCodeForTokens,
      loadTokens,
    })

    // Remount: URL already cleaned; exchange still in flight; tokens not stored yet
    const second = bootstrapAuth({
      pathname: '/',
      search: '',
      replaceState: vi.fn(),
      exchangeCodeForTokens,
      loadTokens,
    })

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
