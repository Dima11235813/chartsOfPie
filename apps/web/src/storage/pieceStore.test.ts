import { IDBFactory } from 'fake-indexeddb'
import { getPreset } from '../core/composition/presets'
import { createPiece, pieceToDocument } from '../core/piece/piece'
import { DEFAULT_VISUAL_CONFIG } from '../core/piece/visualConfig'
import { createIndexedDbStore, createMemoryStore, type PieceStore } from './pieceStore'

const piece = (id: string, minute: number) =>
  pieceToDocument(
    createPiece({
      id,
      name: `Piece ${id}`,
      now: new Date(`2026-10-05T10:${String(minute).padStart(2, '0')}:00Z`),
      sound: getPreset('lydian-dream')!.config,
      visual: DEFAULT_VISUAL_CONFIG,
      position: { digitIndex: 42 },
    }),
  )

describe.each([
  ['IndexedDB', () => createIndexedDbStore(new IDBFactory())],
  ['memory', () => createMemoryStore()],
] as [string, () => PieceStore][])('%s piece store', (_, make) => {
  test('saves, lists newest first, reads back, deletes', async () => {
    const store = make()
    await store.put(piece('a', 1))
    await store.put(piece('b', 2), new Blob(['png'], { type: 'image/png' }))
    const listed = await store.list()
    expect(listed.map((p) => p.id)).toEqual(['b', 'a'])
    expect(listed[0]!.read.status).toBe('ok')
    const b = await store.get('b')
    expect(b?.read.status === 'ok' && b.read.piece.position).toEqual({ digitIndex: 42, start: 0 })
    expect(await store.thumbnail('b')).not.toBeNull()
    await store.delete('b')
    expect((await store.list()).map((p) => p.id)).toEqual(['a'])
    expect(await store.thumbnail('b')).toBeNull()
  })

  test('documents it cannot read are kept and reported, never dropped', async () => {
    const store = make()
    await store.put({ schema: 'charts-of-pie/piece', version: 99, id: 'future', updatedAt: 'z' })
    await store.put({ schema: 'charts-of-pie/piece', version: 1, id: 'broken', name: '' })
    const listed = await store.list()
    expect(listed.map((p) => [p.id, p.read.status])).toEqual([
      ['future', 'too-new'],
      ['broken', 'invalid'],
    ])
  })

  test('notifies subscribers on change', async () => {
    const store = make()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    await store.put(piece('a', 1))
    off()
    await store.delete('a')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('refuses documents without an id', async () => {
    await expect(make().put({ name: 'x' })).rejects.toThrow(/id/)
  })
})
