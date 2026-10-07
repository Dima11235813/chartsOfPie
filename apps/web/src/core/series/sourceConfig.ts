import * as z from 'zod/mini'
import { assertMigrationChain, migrate, type Migrations } from '../schema/migrate'
import {
  getReading,
  getSeries,
  isReadingId,
  isSeriesId,
  READING_IDS,
  SERIES_IDS,
  type ReadingId,
  type SeriesId,
} from './series'

/**
 * Which number plays: a series and how it is read. Saved with pieces (`source`) and shared in
 * links (`s=`); absent means π, so everything made before series existed reads unchanged.
 * Versioned like the sound and visual configs (contract: proj-mgmt R-007, R-011 §6).
 */
export const sourceConfigSchema = z.object({
  version: z.literal(1),
  series: z.enum(SERIES_IDS),
  reading: z.enum(READING_IDS),
})

export type SourceConfig = z.infer<typeof sourceConfigSchema>

export const SOURCE_CONFIG_VERSION = 1

/** `[n]` upgrades a version-n source config to n + 1. Never delete one. */
const MIGRATIONS: Migrations = {}
assertMigrationChain(SOURCE_CONFIG_VERSION, MIGRATIONS, 'SourceConfig')

export const DEFAULT_SOURCE_CONFIG: SourceConfig = { version: 1, series: 'pi', reading: 'digits' }

export type SourceRead =
  | { status: 'ok'; config: SourceConfig }
  /** Written by a newer app: a newer version, or a series or reading this app does not know. */
  | { status: 'too-new' }
  | { status: 'invalid'; reason: string }

/** Read a source config from anywhere (piece, link), migrating older versions. */
export function readSourceConfig(input: unknown): SourceRead {
  const migrated = migrate(input, SOURCE_CONFIG_VERSION, MIGRATIONS)
  if (migrated.status === 'too-new') return { status: 'too-new' }
  if (migrated.status === 'invalid') return migrated
  const { series, reading } = migrated.doc
  // A well-formed id this app does not know was written by a newer one: never read it as π.
  if (
    typeof series === 'string' &&
    typeof reading === 'string' &&
    (!isSeriesId(series) || !isReadingId(reading))
  ) {
    return { status: 'too-new' }
  }
  const parsed = sourceConfigSchema.safeParse(migrated.doc)
  if (!parsed.success) return { status: 'invalid', reason: parsed.error.message }
  if (!getSeries(parsed.data.series).readings.includes(parsed.data.reading)) {
    return {
      status: 'invalid',
      reason: `${parsed.data.series} cannot be read as ${parsed.data.reading}`,
    }
  }
  return { status: 'ok', config: parsed.data }
}

export const isDefaultSource = (config: SourceConfig) => sameSource(config, DEFAULT_SOURCE_CONFIG)

export const sameSource = (a: SourceConfig, b: SourceConfig) =>
  a.series === b.series && a.reading === b.reading

const ID = '[a-z0-9]+(?:-[a-z0-9]+)*'
/** `s=<series>` or `s=<series>.<reading>`: lower-case ids, at most 32 characters each. */
const SOURCE_PARAM = new RegExp(`^(${ID})(?:\\.(${ID}))?$`)

/**
 * The `s=` value for a source: readable (`fibonacci.last-digit`), with the reading left out when
 * it is the series' default. Empty for π, which links leave out entirely.
 */
export function sourceLinkParam(config: SourceConfig): string {
  if (isDefaultSource(config)) return ''
  const series = getSeries(config.series)
  return config.reading === series.readings[0]
    ? config.series
    : `${config.series}.${config.reading}`
}

/** Parse an `s=` value. An unknown series or reading is `too-new`, never π. */
export function parseSourceLinkParam(value: string): SourceRead {
  const match = value.length <= 65 ? SOURCE_PARAM.exec(value) : null
  if (!match) return { status: 'invalid', reason: 'malformed source' }
  const [, series, reading] = match
  if (!isSeriesId(series)) return { status: 'too-new' }
  return readSourceConfig({
    version: SOURCE_CONFIG_VERSION,
    series,
    reading: reading ?? getSeries(series).readings[0],
  })
}

/** Label text for a source, e.g. "π (pi)" or "Fibonacci · last digit". */
export function sourceName(config: SourceConfig): string {
  const series = getSeries(config.series)
  return config.reading === series.readings[0]
    ? series.name
    : `${series.name} · ${getReading(config.reading).name.toLowerCase()}`
}

/** Id of the symbol source a config loads ("pi", later "fibonacci:last-digit"). */
export function sourceKey(config: SourceConfig): string {
  return config.reading === getSeries(config.series).readings[0]
    ? config.series
    : `${config.series}:${config.reading}`
}

/** The short symbol of a source's series, for labels such as "π walk". */
export const sourceSymbol = (config: SourceConfig) => getSeries(config.series).symbol

export type { ReadingId, SeriesId }
