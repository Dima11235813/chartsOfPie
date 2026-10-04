import { readPiece, type PieceRead } from '../core/piece/piece'
import type { Doc } from '../core/schema/migrate'

/**
 * Saved pieces on this device (F10.3). Documents are stored exactly as written — never rewritten
 * on read — so a piece from a newer app or one that fails to parse is kept untouched ("needs
 * attention") instead of being lost. Thumbnails live in a separate store as Blobs.
 */
export interface StoredPiece {
  id: string
  read: PieceRead
  /** For sorting/listing even when the document can't be read. */
  updatedAt: string
}

export interface PieceStore {
  list(): Promise<StoredPiece[]>
  get(id: string): Promise<StoredPiece | null>
  /** Save the document (it must carry a string `id`). */
  put(doc: Doc, thumbnail?: Blob | null): Promise<void>
  delete(id: string): Promise<void>
  thumbnail(id: string): Promise<Blob | null>
  /** Called after any change made by this tab or another one. */
  subscribe(listener: () => void): () => void
}

const toStored = (doc: unknown): StoredPiece => {
  const read = readPiece(doc)
  const raw = (doc ?? {}) as Record<string, unknown>
  return {
    id: String(raw.id ?? ''),
    read,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  }
}

const newestFirst = (a: StoredPiece, b: StoredPiece) => b.updatedAt.localeCompare(a.updatedAt)

const DB = 'charts-of-pie'
const PIECES = 'pieces'
const THUMBS = 'thumbnails'
const CHANNEL = 'charts-of-pie:pieces'

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })

function open(factory: IDBFactory): Promise<IDBDatabase> {
  const req = factory.open(DB, 1)
  req.onupgradeneeded = () => {
    const db = req.result
    // Version 1. Later versions add stores/indexes in `onupgradeneeded` steps — never drop data.
    if (!db.objectStoreNames.contains(PIECES)) db.createObjectStore(PIECES, { keyPath: 'id' })
    if (!db.objectStoreNames.contains(THUMBS)) db.createObjectStore(THUMBS)
  }
  return request(req)
}

/** IndexedDB-backed store; `factory` is injectable for tests (fake-indexeddb). */
export function createIndexedDbStore(factory: IDBFactory = indexedDB): PieceStore {
  const db = open(factory)
  const listeners = new Set<() => void>()
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
  const notify = (broadcast: boolean) => {
    listeners.forEach((listener) => listener())
    if (broadcast) channel?.postMessage('changed')
  }
  if (channel) channel.onmessage = () => notify(false)

  return {
    async list() {
      const tx = (await db).transaction(PIECES)
      const all = await request(tx.objectStore(PIECES).getAll())
      return all.map(toStored).sort(newestFirst)
    },
    async get(id) {
      const doc = await request((await db).transaction(PIECES).objectStore(PIECES).get(id))
      return doc === undefined ? null : toStored(doc)
    },
    async put(doc, thumbnail) {
      if (typeof doc.id !== 'string' || !doc.id) throw new Error('A piece needs an id')
      const tx = (await db).transaction([PIECES, THUMBS], 'readwrite')
      tx.objectStore(PIECES).put(doc)
      if (thumbnail) tx.objectStore(THUMBS).put(thumbnail, doc.id)
      await done(tx)
      notify(true)
    },
    async delete(id) {
      const tx = (await db).transaction([PIECES, THUMBS], 'readwrite')
      tx.objectStore(PIECES).delete(id)
      tx.objectStore(THUMBS).delete(id)
      await done(tx)
      notify(true)
    },
    async thumbnail(id) {
      const blob = await request((await db).transaction(THUMBS).objectStore(THUMBS).get(id))
      return (blob as Blob | undefined) ?? null
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** In-memory store (tests, and the fallback when IndexedDB is unavailable, e.g. some private modes). */
export function createMemoryStore(): PieceStore {
  const docs = new Map<string, Doc>()
  const thumbs = new Map<string, Blob>()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  return {
    list: async () => [...docs.values()].map(toStored).sort(newestFirst),
    get: async (id) => (docs.has(id) ? toStored(docs.get(id)) : null),
    async put(doc, thumbnail) {
      if (typeof doc.id !== 'string' || !doc.id) throw new Error('A piece needs an id')
      docs.set(doc.id, structuredClone(doc))
      if (thumbnail) thumbs.set(doc.id, thumbnail)
      notify()
    },
    async delete(id) {
      docs.delete(id)
      thumbs.delete(id)
      notify()
    },
    thumbnail: async (id) => thumbs.get(id) ?? null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Ask the browser not to evict our storage (shown in the UI); harmless if unsupported. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Default store for the app: IndexedDB when available, else memory (session only). */
export function createDefaultStore(): PieceStore {
  try {
    if (typeof indexedDB !== 'undefined') return createIndexedDbStore()
  } catch {
    // fall through
  }
  return createMemoryStore()
}
