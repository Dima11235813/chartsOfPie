import { beforeEach, describe, expect, test } from 'vitest'
import { getPreset } from '../../web/src/core/composition/presets'
import { createPiece, pieceToDocument } from '../../web/src/core/piece/piece'
import { DEFAULT_VISUAL_CONFIG } from '../../web/src/core/piece/visualConfig'
import { createApp, type Env } from '../src/app'
import { sqliteDb } from './sqliteDb'

const WEB = 'https://dima11235813.github.io'
const API = 'https://api.example.test'

/** A fake GitHub: hands out an access token and profile per OAuth code. */
function fakeGitHub(profiles: Record<string, { id: number; login: string; name?: string }>) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === 'https://github.com/login/oauth/access_token') {
      const { code } = JSON.parse(String(init?.body)) as { code: string }
      return Response.json(
        profiles[code] ? { access_token: `gho_${code}` } : { error: 'bad_verification_code' },
      )
    }
    if (url === 'https://api.github.com/user') {
      const code = String((init?.headers as Record<string, string>).Authorization).replace(
        'Bearer gho_',
        '',
      )
      const p = profiles[code]!
      return Response.json({ id: p.id, login: p.login, name: p.name ?? null, avatar_url: null })
    }
    return new Response('unexpected', { status: 500 })
  }) as typeof fetch
}

let env: Env
let clock: Date
const app = createApp({
  fetch: fakeGitHub({
    'code-ada': { id: 1, login: 'ada', name: 'Ada' },
    'code-bob': { id: 2, login: 'bob' },
    'code-mod': { id: 10522147, login: 'owner' },
  }),
  now: () => clock,
})
const call = (path: string, init: RequestInit = {}) => app.request(`${API}${path}`, init, env)
const auth = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
})

/** Run the whole OAuth round trip and return a session token. */
async function signIn(code: string): Promise<string> {
  const start = await call(
    `/auth/github?return_to=${encodeURIComponent(`${WEB}/chartsOfPie/#p=lydian-dream`)}`,
  )
  expect(start.status).toBe(302)
  const authorize = new URL(start.headers.get('Location')!)
  expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize')
  const state = authorize.searchParams.get('state')!
  const back = await call(`/auth/github/callback?code=${code}&state=${state}`)
  expect(back.status).toBe(302)
  const landing = new URL(back.headers.get('Location')!)
  expect(landing.origin).toBe(WEB)
  expect(landing.hash).toBe('#p=lydian-dream') // the app's state survives the round trip
  const loginCode = landing.searchParams.get('login')!
  const exchanged = await call('/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: loginCode }),
  })
  expect(exchanged.status).toBe(200)
  const { token } = (await exchanged.json()) as { token: string }
  // One-time: the same code can't be used twice.
  const again = await call('/auth/exchange', {
    method: 'POST',
    body: JSON.stringify({ code: loginCode }),
  })
  expect(again.status).toBe(401)
  return token
}

const pieceDoc = (id: string, name = 'My π') =>
  pieceToDocument(
    createPiece({
      id,
      name,
      now: new Date('2026-10-05T10:00:00Z'),
      sound: getPreset('lydian-dream')!.config,
      visual: DEFAULT_VISUAL_CONFIG,
    }),
  )
const put = (token: string, id: string, body: unknown) =>
  call(`/pieces/${id}`, auth(token, { method: 'PUT', body: JSON.stringify(body) }))

beforeEach(() => {
  clock = new Date('2026-10-05T12:00:00Z')
  env = {
    DB: sqliteDb(),
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    ALLOWED_ORIGINS: `${WEB},http://localhost:5173`,
    ADMIN_GITHUB_IDS: '10522147',
  }
})

describe('authentication', () => {
  test('GitHub sign-in → one-time code → session → /me; logout ends it', async () => {
    const token = await signIn('code-ada')
    const me = await call('/me', auth(token))
    expect(await me.json()).toEqual({
      user: expect.objectContaining({ name: 'Ada', role: 'user' }),
    })
    await call('/auth/logout', auth(token, { method: 'POST' }))
    expect((await call('/me', auth(token))).status).toBe(401)
  })

  test('signing in twice is the same user; the owner id gets the admin role', async () => {
    const a = await signIn('code-ada')
    const b = await signIn('code-ada')
    const idOf = async (t: string) =>
      ((await (await call('/me', auth(t))).json()) as { user: { id: string } }).user.id
    expect(await idOf(a)).toBe(await idOf(b))
    const mod = await signIn('code-mod')
    expect(
      ((await (await call('/me', auth(mod))).json()) as { user: { role: string } }).user.role,
    ).toBe('admin')
  })

  test('refuses to return to another site (no open redirect)', async () => {
    const res = await call(
      `/auth/github?return_to=${encodeURIComponent('https://evil.example/steal')}`,
    )
    expect(res.status).toBe(400)
  })

  test('rejects unknown or expired state, bad codes and expired login codes', async () => {
    expect((await call('/auth/github/callback?code=code-ada&state=nope')).status).toBe(400)
    const start = await call(`/auth/github?return_to=${encodeURIComponent(`${WEB}/`)}`)
    const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
    clock = new Date(clock.getTime() + 11 * 60_000)
    expect((await call(`/auth/github/callback?code=code-ada&state=${state}`)).status).toBe(400)

    clock = new Date('2026-10-05T12:00:00Z')
    const s2 = new URL(
      (await call(`/auth/github?return_to=${encodeURIComponent(`${WEB}/`)}`)).headers.get(
        'Location',
      )!,
    ).searchParams.get('state')!
    expect((await call(`/auth/github/callback?code=wrong&state=${s2}`)).status).toBe(502)

    const s3 = new URL(
      (await call(`/auth/github?return_to=${encodeURIComponent(`${WEB}/`)}`)).headers.get(
        'Location',
      )!,
    ).searchParams.get('state')!
    const back = await call(`/auth/github/callback?code=code-ada&state=${s3}`)
    const loginCode = new URL(back.headers.get('Location')!).searchParams.get('login')!
    clock = new Date(clock.getTime() + 61_000)
    const late = await call('/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code: loginCode }),
    })
    expect(late.status).toBe(401)
  })

  test('sessions expire after 30 days', async () => {
    const token = await signIn('code-ada')
    clock = new Date(clock.getTime() + 31 * 86_400_000)
    expect((await call('/me', auth(token))).status).toBe(401)
  })

  test('CORS only for the web app origins', async () => {
    const ok = await call('/health', { headers: { Origin: WEB } })
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(WEB)
    const no = await call('/health', { headers: { Origin: 'https://evil.example' } })
    expect(no.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('pieces and permissions', () => {
  test('owner saves, lists, updates and deletes; others cannot see private pieces', async () => {
    const ada = await signIn('code-ada')
    const bob = await signIn('code-bob')
    expect((await put(ada, 'p1', { document: pieceDoc('p1') })).status).toBe(201)
    expect((await put(ada, 'p1', { document: pieceDoc('p1', 'Renamed') })).status).toBe(200)
    const mine = (await (await call('/pieces', auth(ada))).json()) as {
      pieces: { name: string; visibility: string }[]
    }
    expect(mine.pieces).toEqual([
      expect.objectContaining({ name: 'Renamed', visibility: 'private' }),
    ])

    // Private: invisible to others and to anonymous visitors (404, not 403 — ids can't be probed).
    expect((await call('/pieces/p1', auth(bob))).status).toBe(404)
    expect((await call('/pieces/p1')).status).toBe(404)
    // Nobody else may overwrite or delete it.
    expect((await put(bob, 'p1', { document: pieceDoc('p1', 'Hijack') })).status).toBe(403)
    expect((await call('/pieces/p1', auth(bob, { method: 'DELETE' }))).status).toBe(404)

    expect((await call('/pieces/p1', auth(ada, { method: 'DELETE' }))).status).toBe(200)
    expect((await call('/pieces/p1', auth(ada))).status).toBe(404)
  })

  test('unlisted pieces open by link, public ones are in the gallery; admins can moderate', async () => {
    const ada = await signIn('code-ada')
    const bob = await signIn('code-bob')
    const mod = await signIn('code-mod')
    await put(ada, 'u1', { document: pieceDoc('u1', 'Unlisted'), visibility: 'unlisted' })
    await put(ada, 'g1', { document: pieceDoc('g1', 'Public'), visibility: 'private' })
    const patch = (token: string, visibility: string) =>
      call('/pieces/g1', auth(token, { method: 'PATCH', body: JSON.stringify({ visibility }) }))
    expect((await patch(bob, 'public')).status).toBe(404)
    expect((await patch(ada, 'everyone')).status).toBe(422)
    expect((await patch(ada, 'public')).status).toBe(200)

    expect((await call('/pieces/u1')).status).toBe(200)
    const gallery = (await (await call('/gallery')).json()) as {
      pieces: { id: string; ownerName: string }[]
    }
    expect(gallery.pieces.map((p) => [p.id, p.ownerName])).toEqual([['g1', 'Ada']])

    expect((await call('/pieces/g1', auth(bob, { method: 'DELETE' }))).status).toBe(403)
    expect((await call('/pieces/g1', auth(mod, { method: 'DELETE' }))).status).toBe(200)
  })

  test('validates documents with the shared schema; stores them verbatim', async () => {
    const ada = await signIn('code-ada')
    expect((await call('/pieces', {})).status).toBe(401)
    expect((await put(ada, 'x', { document: { hello: 'world' } })).status).toBe(422)
    expect((await put(ada, 'other-id', { document: pieceDoc('p2') })).status).toBe(422)
    const future = { ...pieceDoc('p3'), version: 99 }
    expect((await put(ada, 'p3', { document: future })).status).toBe(409)
    const withExtra = { ...pieceDoc('p4'), tags: ['from', 'a', 'newer', 'app'] }
    await put(ada, 'p4', { document: withExtra })
    const got = (await (await call('/pieces/p4', auth(ada))).json()) as {
      piece: { document: unknown }
    }
    expect(got.piece.document).toEqual(withExtra)
    const huge = { document: { ...pieceDoc('p5'), padding: 'x'.repeat(70_000) } }
    expect((await put(ada, 'p5', huge)).status).toBe(413)
  })
})
