import * as z from 'zod/mini'
import {
  assertMigrationChain,
  decodeJson,
  encodeJson,
  migrate,
  type Migrations,
} from '../schema/migrate'
import { MAPPING_STRATEGIES } from '../music/mapping'
import { PITCH_CLASSES } from '../music/notes'
import { SCALE_CATALOGUE } from '../music/scaleCatalogue'

/** Instruments offered by the audio layer; ids are persisted in configs, so never rename one. */
export const INSTRUMENT_IDS = [
  'classic',
  'piano',
  'electric-piano',
  'music-box',
  'marimba',
  'harp',
  'warm-pad',
  'pure-sine',
  'electric-guitar',
  'acoustic-guitar',
  'wurlitzer',
  'clavinet',
  'organ',
  'analog-synth',
] as const
export type InstrumentId = (typeof INSTRUMENT_IDS)[number]

export const RHYTHMS = [
  { id: 'legacy', name: 'Original', description: 'Each digit has its own note length (16n … 1n)' },
  { id: 'steady', name: 'Steady', description: 'Every digit gets one step' },
  { id: 'steady-rests', name: 'Steady, 0 = rest', description: 'One step each; zeros are silent' },
  {
    id: 'digit-length',
    name: 'Digit length',
    description: 'A digit lasts that many steps; zeros are short rests',
  },
] as const
export type Rhythm = (typeof RHYTHMS)[number]['id']

export const TIMINGS = [
  { id: 'legacy-random', name: 'Original (random gaps)' },
  { id: 'tempo', name: 'Steady tempo' },
] as const
export type Timing = (typeof TIMINGS)[number]['id']

export const DYNAMICS = [
  { id: 'flat', name: 'Flat' },
  { id: 'accented', name: 'Accented beats' },
] as const

const ids = <T extends readonly { id: string }[]>(items: T) =>
  items.map((item) => item.id) as [T[number]['id'], ...T[number]['id'][]]

/**
 * Everything that determines how digits become sound. Versioned because configs live in share
 * links and saved pieces: a new optional field gets a default; any other shape change bumps
 * `COMPOSITION_CONFIG_VERSION` and adds a migration below (contract: proj-mgmt R-007).
 */
export const compositionConfigSchema = z.object({
  version: z.literal(1),
  scale: z.enum(ids(SCALE_CATALOGUE)),
  root: z.enum(PITCH_CLASSES),
  /** Above 5 the ascending mapping reaches past A7 and gets shrill. */
  octave: z.int().check(z.gte(2), z.lte(5)),
  mapping: z.enum(ids(MAPPING_STRATEGIES)),
  rhythm: z.enum(ids(RHYTHMS)),
  timing: z.enum(ids(TIMINGS)),
  /** Beats per minute in tempo timing. */
  bpm: z.number().check(z.gte(30), z.lte(240)),
  /** Steps per beat: 1 = quarter notes, 2 = eighths, 4 = sixteenths. */
  subdivision: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  /** Note length as a multiple of its step (values > 1 overlap and blend). */
  legato: z.number().check(z.gte(0.25), z.lte(4)),
  dynamics: z.enum(ids(DYNAMICS)),
  /** Random velocity variation, 0–1. */
  humanize: z.number().check(z.gte(0), z.lte(1)),
  instrument: z.enum(INSTRUMENT_IDS),
  /** Effect sends, 0 = dry, 1 = maximum. */
  reverb: z.number().check(z.gte(0), z.lte(1)),
  echo: z.number().check(z.gte(0), z.lte(1)),
  /** Sustain the root and fifth underneath the melody. */
  drone: z.boolean(),
  /** Master “glue” compression + soft ceiling: evens out loud and soft notes. */
  compress: z.boolean(),
  /** Master volume offset in dB. */
  volume: z.number().check(z.gte(-30), z.lte(6)),
})

export type CompositionConfig = z.infer<typeof compositionConfigSchema>

export const COMPOSITION_CONFIG_VERSION = 1

/** `[n]` upgrades a version-n config to n + 1. Never delete one. */
const MIGRATIONS: Migrations = {}
assertMigrationChain(COMPOSITION_CONFIG_VERSION, MIGRATIONS, 'CompositionConfig')

/** Upgrade any past config version to the current one. */
export function migrateConfig(input: unknown) {
  return migrate(input, COMPOSITION_CONFIG_VERSION, MIGRATIONS)
}

/** Validate unknown input (URL, storage, API). Returns null when it cannot be used. */
export function parseConfig(input: unknown): CompositionConfig | null {
  const migrated = migrateConfig(input)
  if (migrated.status !== 'ok') return null
  const result = compositionConfigSchema.safeParse(migrated.doc)
  return result.success ? result.data : null
}

/** Compact, URL-safe encoding for share links (`#c=…`). */
export function encodeConfig(config: CompositionConfig): string {
  return encodeJson(config)
}

export const MAX_ENCODED_CONFIG_LENGTH = 2000

export function decodeConfig(encoded: string): CompositionConfig | null {
  return parseConfig(decodeJson(encoded, MAX_ENCODED_CONFIG_LENGTH))
}
