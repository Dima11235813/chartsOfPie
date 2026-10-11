import { ApiUnreachableError, createAccountApi } from './accountApi'

test('the API client sends bearer tokens and JSON, and maps 401 on /me to "signed out"', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/me')) return Response.json({ error: 'not signed in' }, { status: 401 })
    if (url.includes('/pieces/')) return Response.json({ piece: { id: 'p1' } })
    return Response.json({ error: 'nope' }, { status: 500 })
  }) as unknown as typeof fetch
  const api = createAccountApi('https://api.test/', fetchImpl)

  expect(api.signInUrl('https://app.test/#p=x')).toBe(
    'https://api.test/auth/github?return_to=https%3A%2F%2Fapp.test%2F%23p%3Dx',
  )
  expect(await api.me('tok')).toBeNull()
  await api.putPiece('tok', { id: 'p 1', name: 'x' }, 'public')
  const put = calls.at(-1)!
  expect(put.url).toBe('https://api.test/pieces/p%201')
  expect(put.init.method).toBe('PUT')
  expect(put.init.headers).toMatchObject({
    Authorization: 'Bearer tok',
    'Content-Type': 'application/json',
  })
  expect(JSON.parse(String(put.init.body))).toEqual({
    document: { id: 'p 1', name: 'x' },
    visibility: 'public',
  })
  await expect(api.listPieces('tok')).rejects.toThrow('nope')
})

test('a fetch that never reaches the server is reported as unreachable (offline mode)', async () => {
  const api = createAccountApi('http://localhost:1', (async () => {
    throw new TypeError('Failed to fetch')
  }) as unknown as typeof fetch)
  await expect(api.me('tok')).rejects.toBeInstanceOf(ApiUnreachableError)
  await expect(api.listPieces('tok')).rejects.toBeInstanceOf(ApiUnreachableError)
})
