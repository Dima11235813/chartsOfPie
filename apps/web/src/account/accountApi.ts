import type { Doc } from '../core/schema/migrate'

export type Visibility = 'private' | 'unlisted' | 'public'

export interface AccountUser {
  id: string
  name: string
  avatarUrl: string | null
  role: 'user' | 'admin'
}

export interface RemotePiece {
  id: string
  ownerId: string
  name: string
  visibility: Visibility
  createdAt: string
  updatedAt: string
  document: unknown
}

/** The Charts of Pie API (apps/api) as the web app sees it; tests pass a fake. */
export interface AccountApi {
  /** Where to send the browser to sign in with GitHub, coming back to `returnTo`. */
  signInUrl(returnTo: string): string
  exchange(code: string): Promise<{ token: string; user: AccountUser }>
  me(token: string): Promise<AccountUser | null>
  logout(token: string): Promise<void>
  listPieces(token: string): Promise<RemotePiece[]>
  putPiece(token: string, doc: Doc, visibility?: Visibility): Promise<RemotePiece>
  setVisibility(token: string, id: string, visibility: Visibility): Promise<void>
  deletePiece(token: string, id: string): Promise<void>
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** HTTP client for the API at `baseUrl` (VITE_API_URL at build time). */
export function createAccountApi(baseUrl: string, fetchImpl: typeof fetch = fetch): AccountApi {
  const base = baseUrl.replace(/\/$/, '')
  const request = async <T>(path: string, init: RequestInit = {}, token?: string): Promise<T> => {
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) throw new ApiError(response.status, body.error ?? response.statusText)
    return body as T
  }
  return {
    signInUrl: (returnTo) => `${base}/auth/github?return_to=${encodeURIComponent(returnTo)}`,
    exchange: (code) =>
      request('/auth/exchange', { method: 'POST', body: JSON.stringify({ code }) }),
    async me(token) {
      try {
        return (await request<{ user: AccountUser }>('/me', {}, token)).user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    logout: async (token) => {
      await request('/auth/logout', { method: 'POST' }, token)
    },
    listPieces: async (token) =>
      (await request<{ pieces: RemotePiece[] }>('/pieces', {}, token)).pieces,
    putPiece: async (token, doc, visibility) =>
      (
        await request<{ piece: RemotePiece }>(
          `/pieces/${encodeURIComponent(String(doc.id))}`,
          { method: 'PUT', body: JSON.stringify({ document: doc, visibility }) },
          token,
        )
      ).piece,
    setVisibility: async (token, id, visibility) => {
      await request(
        `/pieces/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify({ visibility }) },
        token,
      )
    },
    deletePiece: async (token, id) => {
      await request(`/pieces/${encodeURIComponent(id)}`, { method: 'DELETE' }, token)
    },
  }
}

/** The configured API, or null when this build has none (accounts are then hidden). */
export function defaultAccountApi(): AccountApi | null {
  const url = import.meta.env.VITE_API_URL as string | undefined
  return url ? createAccountApi(url) : null
}
