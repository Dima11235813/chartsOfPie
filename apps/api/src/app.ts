import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { readPiece } from '../../web/src/core/piece/piece'
import { randomToken, sha256 } from './crypto'
import { can, type Actor, type Role, type Visibility } from './policy'

/** The slice of Cloudflare D1 we use (also implemented over node:sqlite in tests). */
export interface Db {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<unknown>
}
export interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface Env {
  DB: Db
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  /** Comma-separated origins the web app runs on (CORS + where sign-in may return to). */
  ALLOWED_ORIGINS: string
  /** Comma-separated GitHub user ids that get the admin (moderation) role. */
  ADMIN_GITHUB_IDS?: string
}

export interface Deps {
  /** Injected for tests; the real `fetch` in production. */
  fetch: typeof fetch
  now: () => Date
}

const SESSION_DAYS = 30
const STATE_MINUTES = 10
const LOGIN_CODE_SECONDS = 60
const MAX_DOCUMENT_BYTES = 64 * 1024
const VISIBILITIES: Visibility[] = ['private', 'unlisted', 'public']

const later = (now: Date, ms: number) => new Date(now.getTime() + ms).toISOString()
const origins = (env: Env) =>
  env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean)

interface UserRow {
  id: string
  name: string
  avatar_url: string | null
  role: Role
}
interface PieceRow {
  id: string
  owner_id: string
  name: string
  visibility: Visibility
  document: string
  created_at: string
  updated_at: string
}

type App = Hono<{ Bindings: Env; Variables: { user: UserRow | null } }>
type Ctx = Context<{ Bindings: Env; Variables: { user: UserRow | null } }>

const publicUser = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  avatarUrl: u.avatar_url,
  role: u.role,
})
const pieceOut = (row: PieceRow) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  visibility: row.visibility,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  document: JSON.parse(row.document) as unknown,
})

/**
 * Charts of Pie API (E07): GitHub sign-in (authN), bearer sessions, and pieces with owner /
 * visibility rules (authZ, see policy.ts). Runs on Cloudflare Workers with D1.
 */
export function createApp(deps: Deps): App {
  const app: App = new Hono()

  app.use('*', (c, next) =>
    cors({
      origin: (origin) => (origins(c.env).includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    })(c, next),
  )

  // Resolve the signed-in user (if any) from `Authorization: Bearer <token>`.
  app.use('*', async (c, next) => {
    c.set('user', null)
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (token) {
      const row = await c.env.DB.prepare(
        `SELECT u.id, u.name, u.avatar_url, u.role FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
        .bind(await sha256(token), deps.now().toISOString())
        .first<UserRow>()
      c.set('user', row)
    }
    await next()
  })

  const requireUser = (c: Ctx) => {
    const user = c.get('user')
    return user ?? null
  }
  const actor = (c: Ctx): Actor | null => {
    const user = c.get('user')
    return user ? { id: user.id, role: user.role } : null
  }

  app.get('/health', (c) => c.json({ ok: true }))

  // ── Sign-in with GitHub ─────────────────────────────────────────────────────────────────
  app.get('/auth/github', async (c) => {
    const returnTo = c.req.query('return_to') ?? ''
    let target: URL
    try {
      target = new URL(returnTo)
    } catch {
      return c.json({ error: 'return_to must be a URL' }, 400)
    }
    // Only ever send people (and login codes) back to the web app itself: no open redirect.
    if (!origins(c.env).includes(target.origin))
      return c.json({ error: 'return_to not allowed' }, 400)
    const state = randomToken()
    await c.env.DB.prepare(
      'INSERT INTO oauth_states (state, return_to, expires_at) VALUES (?, ?, ?)',
    )
      .bind(state, target.toString(), later(deps.now(), STATE_MINUTES * 60_000))
      .run()
    const authorize = new URL('https://github.com/login/oauth/authorize')
    authorize.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID)
    authorize.searchParams.set(
      'redirect_uri',
      new URL('/auth/github/callback', c.req.url).toString(),
    )
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('scope', 'read:user')
    authorize.searchParams.set('allow_signup', 'true')
    return c.redirect(authorize.toString(), 302)
  })

  app.get('/auth/github/callback', async (c) => {
    const state = c.req.query('state') ?? ''
    const code = c.req.query('code') ?? ''
    const now = deps.now()
    const saved = await c.env.DB.prepare(
      'SELECT return_to, expires_at FROM oauth_states WHERE state = ?',
    )
      .bind(state)
      .first<{ return_to: string; expires_at: string }>()
    await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ? OR expires_at < ?')
      .bind(state, now.toISOString())
      .run()
    if (!saved || saved.expires_at < now.toISOString() || !code) {
      return c.text('Sign-in expired or was not started here. Please try again.', 400)
    }

    const tokenResponse = await deps.fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: new URL('/auth/github/callback', c.req.url).toString(),
      }),
    })
    const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string }
    if (!accessToken) return c.text('GitHub did not confirm the sign-in.', 502)
    const profileResponse = await deps.fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'charts-of-pie-api',
      },
    })
    if (!profileResponse.ok) return c.text('Could not read the GitHub profile.', 502)
    const profile = (await profileResponse.json()) as {
      id: number
      login: string
      name: string | null
      avatar_url: string | null
    }

    const githubId = String(profile.id)
    const admins = (c.env.ADMIN_GITHUB_IDS ?? '').split(',').map((s) => s.trim())
    const role: Role = admins.includes(githubId) ? 'admin' : 'user'
    const identity = await c.env.DB.prepare(
      "SELECT user_id FROM identities WHERE provider = 'github' AND provider_user_id = ?",
    )
      .bind(githubId)
      .first<{ user_id: string }>()
    const userId = identity?.user_id ?? crypto.randomUUID()
    const name = profile.name || profile.login
    if (identity) {
      await c.env.DB.prepare('UPDATE users SET name = ?, avatar_url = ?, role = ? WHERE id = ?')
        .bind(name, profile.avatar_url, role, userId)
        .run()
    } else {
      await c.env.DB.batch([
        c.env.DB.prepare(
          'INSERT INTO users (id, name, avatar_url, role, created_at) VALUES (?, ?, ?, ?, ?)',
        ).bind(userId, name, profile.avatar_url, role, now.toISOString()),
        c.env.DB.prepare(
          "INSERT INTO identities (provider, provider_user_id, user_id) VALUES ('github', ?, ?)",
        ).bind(githubId, userId),
      ])
    }

    // Hand the web app a short-lived one-time code (not the session itself) in the URL.
    const loginCode = randomToken()
    await c.env.DB.prepare(
      'INSERT INTO login_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)',
    )
      .bind(await sha256(loginCode), userId, later(now, LOGIN_CODE_SECONDS * 1000))
      .run()
    const back = new URL(saved.return_to)
    back.searchParams.set('login', loginCode)
    return c.redirect(back.toString(), 302)
  })

  app.post('/auth/exchange', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { code?: unknown }
    if (typeof body.code !== 'string') return c.json({ error: 'code required' }, 400)
    const now = deps.now()
    const hash = await sha256(body.code)
    const row = await c.env.DB.prepare(
      'SELECT user_id, expires_at FROM login_codes WHERE code_hash = ?',
    )
      .bind(hash)
      .first<{ user_id: string; expires_at: string }>()
    await c.env.DB.prepare('DELETE FROM login_codes WHERE code_hash = ? OR expires_at < ?')
      .bind(hash, now.toISOString())
      .run()
    if (!row || row.expires_at < now.toISOString())
      return c.json({ error: 'invalid or expired code' }, 401)
    const token = randomToken()
    await c.env.DB.prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind(
        await sha256(token),
        row.user_id,
        now.toISOString(),
        later(now, SESSION_DAYS * 86_400_000),
      )
      .run()
    const user = await c.env.DB.prepare('SELECT id, name, avatar_url, role FROM users WHERE id = ?')
      .bind(row.user_id)
      .first<UserRow>()
    return c.json({ token, user: user && publicUser(user) })
  })

  app.post('/auth/logout', async (c) => {
    const header = c.req.header('Authorization') ?? ''
    if (header.startsWith('Bearer ')) {
      await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(await sha256(header.slice(7).trim()))
        .run()
    }
    return c.json({ ok: true })
  })

  app.get('/me', (c) => {
    const user = requireUser(c)
    return user ? c.json({ user: publicUser(user) }) : c.json({ error: 'not signed in' }, 401)
  })

  // ── Pieces ──────────────────────────────────────────────────────────────────────────────
  app.get('/pieces', async (c) => {
    const user = requireUser(c)
    if (!user) return c.json({ error: 'not signed in' }, 401)
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM pieces WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 500',
    )
      .bind(user.id)
      .all<PieceRow>()
    return c.json({ pieces: results.map(pieceOut) })
  })

  app.get('/gallery', async (c) => {
    const before = c.req.query('before') ?? '9999'
    const { results } = await c.env.DB.prepare(
      `SELECT p.*, u.name AS owner_name FROM pieces p JOIN users u ON u.id = p.owner_id
       WHERE p.visibility = 'public' AND p.updated_at < ? ORDER BY p.updated_at DESC LIMIT 50`,
    )
      .bind(before)
      .all<PieceRow & { owner_name: string }>()
    return c.json({
      pieces: results.map((row) => ({ ...pieceOut(row), ownerName: row.owner_name })),
    })
  })

  app.get('/pieces/:id', async (c) => {
    const row = await c.env.DB.prepare('SELECT * FROM pieces WHERE id = ?')
      .bind(c.req.param('id'))
      .first<PieceRow>()
    // Not found and not allowed look the same, so private ids can't be probed.
    if (!row || !can(actor(c), 'read', { ownerId: row.owner_id, visibility: row.visibility })) {
      return c.json({ error: 'not found' }, 404)
    }
    return c.json({ piece: pieceOut(row) })
  })

  // Create or update by id (ids are client-generated UUIDs, so offline saves sync later).
  app.put('/pieces/:id', async (c) => {
    const user = requireUser(c)
    if (!user) return c.json({ error: 'not signed in' }, 401)
    const id = c.req.param('id')
    const text = await c.req.text()
    if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES) {
      return c.json({ error: 'piece too large' }, 413)
    }
    let body: { document?: unknown; visibility?: unknown }
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      return c.json({ error: 'invalid JSON' }, 400)
    }
    const read = readPiece(body.document)
    if (read.status === 'too-new') return c.json({ error: 'made with a newer app version' }, 409)
    if (read.status === 'invalid') return c.json({ error: `invalid piece: ${read.reason}` }, 422)
    if (read.piece.id !== id) return c.json({ error: 'id mismatch' }, 422)
    const visibility = VISIBILITIES.includes(body.visibility as Visibility)
      ? (body.visibility as Visibility)
      : null

    const existing = await c.env.DB.prepare('SELECT owner_id, visibility FROM pieces WHERE id = ?')
      .bind(id)
      .first<{ owner_id: string; visibility: Visibility }>()
    if (
      existing &&
      !can(actor(c), 'update', { ownerId: existing.owner_id, visibility: existing.visibility })
    ) {
      return c.json({ error: 'not allowed' }, 403)
    }
    const now = deps.now().toISOString()
    // Stored verbatim (unknown keys from newer apps survive).
    const document = JSON.stringify(body.document)
    if (existing) {
      await c.env.DB.prepare(
        'UPDATE pieces SET name = ?, document = ?, visibility = ?, updated_at = ? WHERE id = ?',
      )
        .bind(read.piece.name, document, visibility ?? existing.visibility, now, id)
        .run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO pieces (id, owner_id, name, visibility, document, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, user.id, read.piece.name, visibility ?? 'private', document, now, now)
        .run()
    }
    const row = await c.env.DB.prepare('SELECT * FROM pieces WHERE id = ?')
      .bind(id)
      .first<PieceRow>()
    return c.json({ piece: row && pieceOut(row) }, existing ? 200 : 201)
  })

  app.patch('/pieces/:id', async (c) => {
    const row = await c.env.DB.prepare('SELECT * FROM pieces WHERE id = ?')
      .bind(c.req.param('id'))
      .first<PieceRow>()
    if (!row || !can(actor(c), 'read', { ownerId: row.owner_id, visibility: row.visibility })) {
      return c.json({ error: 'not found' }, 404)
    }
    if (!can(actor(c), 'update', { ownerId: row.owner_id, visibility: row.visibility })) {
      return c.json({ error: 'not allowed' }, 403)
    }
    const body = (await c.req.json().catch(() => ({}))) as { visibility?: unknown }
    if (!VISIBILITIES.includes(body.visibility as Visibility)) {
      return c.json({ error: 'visibility must be private, unlisted or public' }, 422)
    }
    await c.env.DB.prepare('UPDATE pieces SET visibility = ?, updated_at = ? WHERE id = ?')
      .bind(body.visibility, deps.now().toISOString(), row.id)
      .run()
    return c.json({ ok: true })
  })

  app.delete('/pieces/:id', async (c) => {
    const row = await c.env.DB.prepare('SELECT owner_id, visibility FROM pieces WHERE id = ?')
      .bind(c.req.param('id'))
      .first<{ owner_id: string; visibility: Visibility }>()
    const access = row && { ownerId: row.owner_id, visibility: row.visibility }
    if (!access || !can(actor(c), 'read', access)) return c.json({ error: 'not found' }, 404)
    if (!can(actor(c), 'delete', access)) return c.json({ error: 'not allowed' }, 403)
    await c.env.DB.prepare('DELETE FROM pieces WHERE id = ?').bind(c.req.param('id')).run()
    return c.json({ ok: true })
  })

  return app
}
