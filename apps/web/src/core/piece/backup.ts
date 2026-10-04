import { isDoc, type Doc } from '../schema/migrate'
import { PIECE_SCHEMA } from './piece'

/**
 * Backup file: every saved piece in one JSON file (F10.3 S10.3.5), so pieces survive clearing site
 * data or moving device. Documents are copied verbatim; they are validated/migrated when imported.
 */
export const BACKUP_SCHEMA = 'charts-of-pie/backup'
export const BACKUP_VERSION = 1

export interface Backup {
  schema: typeof BACKUP_SCHEMA
  version: number
  exportedAt: string
  pieces: Doc[]
}

export function createBackup(pieces: readonly Doc[], now: Date): Backup {
  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    pieces: [...pieces],
  }
}

/**
 * The piece documents in an imported file: a backup (any version — its `pieces` array is the
 * stable part) or a single exported piece. Null if the file is neither.
 */
export function piecesInFile(input: unknown): Doc[] | null {
  if (!isDoc(input)) return null
  if (input.schema === BACKUP_SCHEMA && Array.isArray(input.pieces)) {
    return input.pieces.filter(isDoc)
  }
  if (input.schema === PIECE_SCHEMA) return [input]
  return null
}
