import * as z from 'zod/mini'
import {
  COMPOSITION_CONFIG_VERSION,
  compositionConfigSchema,
  parseConfig,
  type CompositionConfig,
} from '../composition/config'
import {
  assertMigrationChain,
  isDoc,
  migrate,
  preserveUnknown,
  type Doc,
  type Migrations,
} from '../schema/migrate'
import { readVisualConfig, visualConfigSchema, type VisualConfig } from './visualConfig'

export const PIECE_SCHEMA = 'charts-of-pie/piece'
export const PIECE_VERSION = 1

/**
 * A saved piece: the sound and the look of a moment, with a name. The envelope is versioned on
 * its own; `sound` and `visual` carry their own versions because they also travel in share links.
 * Contract (proj-mgmt R-007): additive fields need defaults; anything else bumps a version and
 * adds a migration; golden fixtures in `fixtures/` must keep opening forever.
 */
export const pieceSchema = z.object({
  schema: z.literal(PIECE_SCHEMA),
  version: z.literal(1),
  /** Random UUID; stable across devices once sync exists. */
  id: z.string().check(z.minLength(1), z.maxLength(64)),
  name: z.string().check(z.minLength(1), z.maxLength(120)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  sound: compositionConfigSchema,
  visual: visualConfigSchema,
  /** Where playback was when saved (digits played). */
  position: z.optional(z.object({ digitIndex: z.int().check(z.gte(0)) })),
})

export type Piece = z.infer<typeof pieceSchema>

/** `[n]` upgrades a version-n piece envelope to n + 1. Never delete one. */
const MIGRATIONS: Migrations = {}
assertMigrationChain(PIECE_VERSION, MIGRATIONS, 'Piece')

export type PieceRead =
  /** `replaced`: some values were unknown to this version and fell back to defaults. */
  | { status: 'ok'; piece: Piece; replaced: boolean; raw: Doc }
  /** Written by a newer app (any part): keep it, open nothing, never overwrite. */
  | { status: 'too-new'; raw: Doc }
  /** Unreadable: keep it untouched and report; never delete user data automatically. */
  | { status: 'invalid'; reason: string; raw: unknown }

const envelopeSchema = z.object({
  schema: pieceSchema.shape.schema,
  version: pieceSchema.shape.version,
  id: pieceSchema.shape.id,
  name: pieceSchema.shape.name,
  createdAt: pieceSchema.shape.createdAt,
  updatedAt: pieceSchema.shape.updatedAt,
  position: pieceSchema.shape.position,
})

/** Read a piece from storage or an imported file, migrating every part to the current version. */
export function readPiece(input: unknown): PieceRead {
  if (!isDoc(input) || input.schema !== PIECE_SCHEMA) {
    return { status: 'invalid', reason: 'not a Charts of Pie piece', raw: input }
  }
  const envelope = migrate(input, PIECE_VERSION, MIGRATIONS)
  if (envelope.status === 'too-new') return { status: 'too-new', raw: input }
  if (envelope.status === 'invalid') return { ...envelope, raw: input }

  const soundVersion = isDoc(input.sound) ? input.sound.version : undefined
  const visual = readVisualConfig(input.visual)
  if (visual.status === 'too-new') return { status: 'too-new', raw: input }
  // parseConfig only reports success; detect a newer sound config by its version.
  const sound = parseConfig(input.sound)
  if (!sound) {
    if (typeof soundVersion === 'number' && soundVersion > COMPOSITION_CONFIG_VERSION) {
      return { status: 'too-new', raw: input }
    }
    return { status: 'invalid', reason: 'sound settings could not be read', raw: input }
  }
  if (visual.status === 'invalid') {
    return { status: 'invalid', reason: `view settings: ${visual.reason}`, raw: input }
  }
  const head = envelopeSchema.safeParse(envelope.doc)
  if (!head.success) return { status: 'invalid', reason: head.error.message, raw: input }

  const piece: Piece = { ...head.data, sound, visual: visual.config }
  return { status: 'ok', piece, replaced: visual.replaced, raw: input }
}

/**
 * The document to store. Pass the raw document it was read from so keys written by a newer app
 * survive the save (only when the piece read cleanly — never re-save a `replaced` piece over its
 * original, or the unknown values it replaced would be lost).
 */
export function pieceToDocument(piece: Piece, original?: Doc): Doc {
  return preserveUnknown(original, pieceSchema.parse(piece) as Doc)
}

export interface NewPieceInput {
  id: string
  name: string
  now: Date
  sound: CompositionConfig
  visual: VisualConfig
  position?: Piece['position']
}

export function createPiece({ id, name, now, sound, visual, position }: NewPieceInput): Piece {
  const stamp = now.toISOString()
  return pieceSchema.parse({
    schema: PIECE_SCHEMA,
    version: PIECE_VERSION,
    id,
    name: name.trim().slice(0, 120) || 'Untitled',
    createdAt: stamp,
    updatedAt: stamp,
    sound,
    visual,
    ...(position ? { position } : {}),
  })
}
