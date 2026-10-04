import { useCallback, useEffect, useState } from 'react'
import type { AccountApi, RemotePiece, Visibility } from '../account/accountApi'
import { readPiece, type Piece } from '../core/piece/piece'
import type { Doc } from '../core/schema/migrate'
import type { PieceStore } from '../storage/pieceStore'

interface AccountPiecesProps {
  api: AccountApi
  token: string
  store: PieceStore
  onOpen: (piece: Piece) => void
}

const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: 'Private',
  unlisted: 'Anyone with the link',
  public: 'Public gallery',
}

/** Pieces in the signed-in account: back up the device's pieces, open, share or delete them. */
export function AccountPieces({ api, token, store, onOpen }: AccountPiecesProps) {
  const [pieces, setPieces] = useState<RemotePiece[]>([])
  const [status, setStatus] = useState('')

  const refresh = useCallback(() => {
    api
      .listPieces(token)
      .then(setPieces, (error: unknown) =>
        setStatus(`Account pieces unavailable: ${error instanceof Error ? error.message : error}`),
      )
  }, [api, token])
  useEffect(refresh, [refresh])

  const backUp = async () => {
    const local = await store.list()
    let sent = 0
    for (const stored of local) {
      if (stored.read.status !== 'ok') continue
      const remote = pieces.find((p) => p.id === stored.id)
      if (remote && remote.updatedAt >= stored.updatedAt) continue
      await api.putPiece(token, stored.read.raw as Doc)
      sent++
    }
    setStatus(`Backed up ${sent} piece${sent === 1 ? '' : 's'} to your account.`)
    refresh()
  }

  return (
    <div className="account-pieces">
      <h3>In your account</h3>
      <button type="button" className="btn btn-small" onClick={() => void backUp()}>
        Back up this device’s pieces
      </button>
      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}
      <ul className="piece-list">
        {pieces.map((remote) => {
          const read = readPiece(remote.document)
          return (
            <li key={remote.id} className="piece-item piece-item-remote">
              <div className="piece-meta">
                <strong className="piece-name">{remote.name}</strong>
                <span className="piece-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={read.status !== 'ok'}
                    aria-label={`Open ${remote.name} from your account`}
                    onClick={() => read.status === 'ok' && onOpen(read.piece)}
                  >
                    Open
                  </button>
                  <select
                    aria-label={`Who can see ${remote.name}`}
                    value={remote.visibility}
                    onChange={(e) => {
                      const visibility = e.target.value as Visibility
                      void api.setVisibility(token, remote.id, visibility).then(refresh)
                    }}
                  >
                    {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-small"
                    aria-label={`Delete ${remote.name} from your account`}
                    onClick={() => void api.deletePiece(token, remote.id).then(refresh)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
