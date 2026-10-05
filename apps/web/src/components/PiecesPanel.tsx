import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { CompositionConfig } from '../core/composition/config'
import { createBackup, piecesInFile } from '../core/piece/backup'
import { createPiece, pieceToDocument, type Piece } from '../core/piece/piece'
import type { VisualConfig } from '../core/piece/visualConfig'
import type { Doc } from '../core/schema/migrate'
import { downloadBlob, exportFileName } from '../media/sessionRecorder'
import { requestPersistence, type PieceStore, type StoredPiece } from '../storage/pieceStore'

interface PiecesPanelProps {
  store: PieceStore
  sound: CompositionConfig
  visual: VisualConfig
  /** Digits played so far: saved so the piece resumes there. */
  position: number
  /** Suggested name, e.g. "Lydian dream · Music clock". */
  suggestedName: string
  getCanvas: () => HTMLCanvasElement | null
  onOpen: (piece: Piece) => void
  /** Shown when signed in: the account's pieces (cloud backup and sharing). */
  accountSection?: ReactNode
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** A small WebP (or PNG) of the current view for the list. */
async function thumbnailOf(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  if (!canvas || canvas.width === 0) return null
  const width = 240
  const height = Math.max(1, Math.round((canvas.height / canvas.width) * width))
  const small = document.createElement('canvas')
  small.width = width
  small.height = height
  const ctx = small.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#0b0b12'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(canvas, 0, 0, width, height)
  return new Promise((resolve) => small.toBlob((blob) => resolve(blob), 'image/webp', 0.8))
}

function Thumbnail({ store, id, stamp }: { store: PieceStore; id: string; stamp: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let created: string | null = null
    void store.thumbnail(id).then((blob) => {
      if (!alive || !blob) return
      created = URL.createObjectURL(blob)
      setUrl(created)
    })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [store, id, stamp])
  return url ? (
    <img className="piece-thumb" src={url} alt="" />
  ) : (
    <span className="piece-thumb" aria-hidden="true" />
  )
}

/** Formatted dates, cached: the list re-renders on every digit while playing. */
const formatted = new Map<string, string>()
const when = (iso: string) => {
  let text = formatted.get(iso)
  if (text === undefined) {
    const date = new Date(iso)
    text = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    if (formatted.size > 500) formatted.clear()
    formatted.set(iso, text)
  }
  return text
}

/**
 * "My pieces" (F10.4): save the current sound + view + position on this device, and reopen,
 * rename, duplicate, delete (with undo), export or import them. Pieces this version can't fully
 * read are kept and shown read-only (R-007 contract).
 */
export function PiecesPanel({
  store,
  sound,
  visual,
  position,
  suggestedName,
  getCanvas,
  onOpen,
  accountSection,
}: PiecesPanelProps) {
  const ids = { name: useId(), file: useId() }
  const [pieces, setPieces] = useState<StoredPiece[]>([])
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [undo, setUndo] = useState<{ doc: Doc; thumbnail: Blob | null; name: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    store.list().then(setPieces, () => setStatus('Saved pieces could not be read on this device.'))
  }, [store])

  useEffect(() => {
    refresh()
    return store.subscribe(refresh)
  }, [store, refresh])

  const save = async () => {
    const piece = createPiece({
      id: newId(),
      name: name.trim() || suggestedName,
      now: new Date(),
      sound,
      visual,
      position: { digitIndex: position },
    })
    try {
      await store.put(pieceToDocument(piece), await thumbnailOf(getCanvas()))
      setName('')
      const kept = await requestPersistence()
      setStatus(
        `Saved “${piece.name}”${kept ? '' : '. Tip: install the app or export a backup so the browser never clears it'}.`,
      )
    } catch (error) {
      setStatus(`Could not save: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const update = async (stored: StoredPiece, change: Partial<Piece>) => {
    if (stored.read.status !== 'ok') return
    const next = { ...stored.read.piece, ...change, updatedAt: new Date().toISOString() }
    await store.put(pieceToDocument(next, stored.read.raw))
  }

  const duplicate = async (stored: StoredPiece) => {
    if (stored.read.status !== 'ok') return
    const now = new Date().toISOString()
    const copy = {
      ...stored.read.piece,
      id: newId(),
      name: `${stored.read.piece.name} (copy)`.slice(0, 120),
      createdAt: now,
      updatedAt: now,
    }
    await store.put(pieceToDocument(copy, stored.read.raw), await store.thumbnail(stored.id))
  }

  const remove = async (stored: StoredPiece) => {
    const thumbnail = await store.thumbnail(stored.id)
    const label = stored.read.status === 'ok' ? stored.read.piece.name : 'piece'
    await store.delete(stored.id)
    setUndo({ doc: stored.read.raw as Doc, thumbnail, name: label })
  }

  const exportAll = () => {
    const docs = pieces.map((p) => p.read.raw as Doc)
    const backup = createBackup(docs, new Date())
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    downloadBlob(blob, exportFileName('charts-of-pie-pieces', 'json'))
  }

  const importFile = async (file: File) => {
    try {
      const docs = piecesInFile(JSON.parse(await file.text()))
      if (!docs) {
        setStatus('That file is not a Charts of Pie backup or piece.')
        return
      }
      let added = 0
      for (const doc of docs) {
        if (typeof doc.id !== 'string') continue
        const existing = await store.get(doc.id)
        // Keep whichever copy is newer; never overwrite with an older one.
        if (existing && existing.updatedAt >= String(doc.updatedAt ?? '')) continue
        await store.put(doc)
        added++
      }
      setStatus(`Imported ${added} of ${docs.length} piece${docs.length === 1 ? '' : 's'}.`)
    } catch {
      setStatus('That file could not be read.')
    }
  }

  return (
    <section className="export-panel pieces-panel" aria-labelledby="pieces-heading">
      <h2 id="pieces-heading">My pieces</h2>
      <div className="field">
        <label htmlFor={ids.name}>Name</label>
        <span className="inline-row">
          <input
            id={ids.name}
            className="text-input"
            value={name}
            placeholder={suggestedName}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            Save
          </button>
        </span>
      </div>
      <p className="hint">
        Saves the sound, the view and where you are in π ({position.toLocaleString()} digits) on
        this device.
      </p>
      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}
      {undo && (
        <p className="undo-bar" role="status">
          Deleted “{undo.name}”.{' '}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              void store.put(undo.doc, undo.thumbnail)
              setUndo(null)
            }}
          >
            Undo
          </button>
        </p>
      )}
      {pieces.length > 0 && (
        <ul className="piece-list">
          {pieces.map((stored) => {
            const ok = stored.read.status === 'ok' ? stored.read : null
            const title = ok ? ok.piece.name : `Piece ${stored.id.slice(0, 8)}`
            return (
              <li key={stored.id} className="piece-item">
                <Thumbnail store={store} id={stored.id} stamp={stored.updatedAt} />
                <div className="piece-meta">
                  {renaming?.id === stored.id ? (
                    <form
                      className="inline-row"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const next = renaming.name.trim()
                        if (next) void update(stored, { name: next.slice(0, 120) })
                        setRenaming(null)
                      }}
                    >
                      <input
                        className="text-input"
                        aria-label="New name"
                        value={renaming.name}
                        maxLength={120}
                        autoFocus
                        onChange={(e) => setRenaming({ id: stored.id, name: e.target.value })}
                      />
                      <button type="submit" className="btn btn-small">
                        OK
                      </button>
                    </form>
                  ) : (
                    <strong className="piece-name">{title}</strong>
                  )}
                  <span className="piece-sub">
                    {when(stored.updatedAt)}
                    {ok?.piece.position
                      ? ` · digit ${ok.piece.position.digitIndex.toLocaleString()}`
                      : ''}
                  </span>
                  {stored.read.status === 'too-new' && (
                    <span className="piece-warn">Made with a newer version — update to open.</span>
                  )}
                  {stored.read.status === 'invalid' && (
                    <span className="piece-warn">Can’t be read — kept untouched.</span>
                  )}
                  {ok?.replaced && (
                    <span className="piece-warn">
                      Uses features from a newer version — opens with defaults, read-only.
                    </span>
                  )}
                  <span className="piece-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!ok}
                      aria-label={`Open ${title}`}
                      onClick={() => ok && onOpen(ok.piece)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!ok || ok.replaced}
                      aria-label={`Rename ${title}`}
                      onClick={() => ok && setRenaming({ id: stored.id, name: ok.piece.name })}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!ok || ok.replaced}
                      aria-label={`Duplicate ${title}`}
                      onClick={() => void duplicate(stored)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      aria-label={`Delete ${title}`}
                      onClick={() => void remove(stored)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {accountSection}
      <div className="inline-row">
        <button
          type="button"
          className="btn btn-small"
          disabled={!pieces.length}
          onClick={exportAll}
        >
          Export backup
        </button>
        <button type="button" className="btn btn-small" onClick={() => fileInput.current?.click()}>
          Import…
        </button>
        <input
          id={ids.file}
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Import pieces"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </section>
  )
}
