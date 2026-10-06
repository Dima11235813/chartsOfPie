import type { SymbolSource } from '../digits/digitSource'
import { loadPiDigits } from '../digits/pi'
import type { ReadingId, SeriesId } from './series'
import type { SourceConfig } from './sourceConfig'

/** How each series obtains its symbols: a verified data file, or (later) a pure generator. */
const LOADERS: Record<SeriesId, (reading: ReadingId) => Promise<SymbolSource>> = {
  pi: () => loadPiDigits(),
}

/** Fetch or generate the symbols a source config names. */
export function loadSource(config: SourceConfig): Promise<SymbolSource> {
  return LOADERS[config.series](config.reading)
}
