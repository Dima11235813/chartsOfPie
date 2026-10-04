import { useCallback, useEffect, useState } from 'react'
import type { AccountApi, AccountUser } from './accountApi'

const SESSION_KEY = 'charts-of-pie:session'

const readToken = () => {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}
const writeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // not remembered
  }
}

export interface AccountState {
  /** False when this build has no API configured. */
  enabled: boolean
  user: AccountUser | null
  token: string | null
  busy: boolean
  error: string | null
  signIn(): void
  signOut(): Promise<void>
}

/**
 * Sign-in state (E07). GitHub sends the browser back with `?login=<one-time code>`; we trade it
 * for a session token, remove it from the address bar, and keep the token on this device.
 */
export function useAccount(api: AccountApi | null): AccountState {
  const [token, setToken] = useState(readToken)
  const [user, setUser] = useState<AccountUser | null>(null)
  const [busy, setBusy] = useState(() => Boolean(api && (readToken() || loginCode())))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!api) return
    let cancelled = false
    const run = async () => {
      try {
        const code = loginCode()
        let current = readToken()
        if (code) {
          const url = new URL(window.location.href)
          url.searchParams.delete('login')
          window.history.replaceState(null, '', url.toString())
          const session = await api.exchange(code)
          current = session.token
          writeToken(current)
          if (!cancelled) setToken(current)
        }
        const me = current ? await api.me(current) : null
        if (current && !me) writeToken(null)
        if (!cancelled) {
          setUser(me)
          if (!me) setToken(null)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Sign-in failed')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [api])

  const signIn = useCallback(() => {
    if (api) window.location.assign(api.signInUrl(window.location.href))
  }, [api])

  const signOut = useCallback(async () => {
    if (api && token) await api.logout(token).catch(() => {})
    writeToken(null)
    setToken(null)
    setUser(null)
  }, [api, token])

  return { enabled: api !== null, user, token: user ? token : null, busy, error, signIn, signOut }
}

function loginCode(): string | null {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get('login')
}
