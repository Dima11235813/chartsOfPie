import * as z from 'zod/mini'
import {
  assertMigrationChain,
  decodeJson,
  encodeJson,
  migrate,
  type Migrations,
} from '../schema/migrate'

/** Largest column count the mosaic offers. */
export const MAX_MOSAIC_COLUMNS = 120
export const MIN_MOSAIC_COLUMNS = 2

/*
 * Ids below are persisted in share links and saved pieces: never rename or remove one (retire it
 * with a migration instead). Adding one is fine. Tests keep them in step with the UI lists
 * (components/views.ts, viz/palettes.ts, components/chartConfig.ts).
 */
export const VIEW_IDS = [
  'chart',
  'staff',
  'spectrogram',
  'ring',
  'walk',
  'sunflower',
  'mosaic',
  'hilbert',
  'type',
  'strings',
  'clock',
  'harmonograph',
  'scope',
  'fretboard',
  'cymatics',
] as const
export const PALETTE_IDS = ['rainbow', 'colour-blind', 'scriabin', 'ink'] as const
export const CHART_STYLE_IDS = [
  'bar',
  'horizontalBar',
  'line',
  'polarArea',
  'doughnut',
  'pie',
  'radar',
] as const

/**
 * Field builders shared by the strict schema (what this version writes, and what the schema
 * snapshot pins) and the lenient one (what it reads). Lenient reading swaps a value this version
 * does not know — e.g. a view added by a newer app — for the default, and reports it.
 */
function build(lenient: boolean) {
  const field = <T extends z.ZodMiniType>(schema: T, fallback: z.output<T>) =>
    lenient
      ? z._default(z.catch(schema, fallback as never), fallback as never)
      : z._default(schema, fallback as never)

  return z.object({
    version: z.literal(1),
    view: field(z.enum(VIEW_IDS), 'chart'),
    palette: field(z.enum(PALETTE_IDS), 'rainbow'),
    chartStyle: field(z.enum(CHART_STYLE_IDS), 'bar'),
    /** Options of individual views; a missing block or field takes its default. */
    viewOptions: z.prefault(
      z.object({
        clock: z.prefault(
          z.object({ order: field(z.enum(['chromatic', 'fifths']), 'chromatic') }),
          {},
        ),
        harmonograph: z.prefault(z.object({ pure: field(z.boolean(), false) }), {}),
        scope: z.prefault(z.object({ mode: field(z.enum(['vector', 'wave']), 'vector') }), {}),
        /** Guitar fretboard: tuning (additive after v1). */
        fretboard: z.prefault(
          z.object({
            tuning: field(z.enum(['standard', 'drop-d', 'dadgad', 'open-g']), 'standard'),
          }),
          {},
        ),
        /** Neighbour mosaic: column count, 0 = fill the width (added after v1: additive). */
        mosaic: z.prefault(
          z.object({
            columns: field(z.int().check(z.gte(0), z.lte(MAX_MOSAIC_COLUMNS)), 0),
            /** Groups only: minimum group size shown, 0 = everything (added later: additive). */
            minGroup: field(z.int().check(z.gte(0), z.lte(9)), 0),
            /** Sweep the column count back and forth (added later: additive). */
            sweep: field(z.boolean(), false),
          }),
          {},
        ),
      }),
      {},
    ),
  })
}

/** How the stage looks: view, colours and per-view options. Saved with pieces and shared in links. */
export const visualConfigSchema = build(false)
const lenientVisualConfigSchema = build(true)

export type VisualConfig = z.infer<typeof visualConfigSchema>
export type ViewOptions = VisualConfig['viewOptions']

export const VISUAL_CONFIG_VERSION = 1

/** `[n]` upgrades a version-n visual config to n + 1. Never delete one. */
const MIGRATIONS: Migrations = {}
assertMigrationChain(VISUAL_CONFIG_VERSION, MIGRATIONS, 'VisualConfig')

export const DEFAULT_VISUAL_CONFIG: VisualConfig = visualConfigSchema.parse({ version: 1 })

export type VisualParse =
  | { status: 'ok'; config: VisualConfig; /** values replaced by defaults */ replaced: boolean }
  | { status: 'too-new'; version: number }
  | { status: 'invalid'; reason: string }

/** Read a visual config from anywhere (link, storage, file), migrating older versions. */
export function readVisualConfig(input: unknown): VisualParse {
  const migrated = migrate(input, VISUAL_CONFIG_VERSION, MIGRATIONS)
  if (migrated.status !== 'ok') return migrated
  const lenient = lenientVisualConfigSchema.safeParse(migrated.doc)
  if (!lenient.success) return { status: 'invalid', reason: lenient.error.message }
  const replaced = !visualConfigSchema.safeParse(migrated.doc).success
  return { status: 'ok', config: lenient.data, replaced }
}

export const MAX_ENCODED_VISUAL_LENGTH = 1000

/** Share-link encoding (`v=…`). */
export const encodeVisualConfig = (config: VisualConfig) => encodeJson(config)

export function decodeVisualConfig(encoded: string): VisualConfig | null {
  const result = readVisualConfig(decodeJson(encoded, MAX_ENCODED_VISUAL_LENGTH))
  return result.status === 'ok' ? result.config : null
}

export const sameVisualConfig = (a: VisualConfig, b: VisualConfig) =>
  JSON.stringify(a) === JSON.stringify(b)
