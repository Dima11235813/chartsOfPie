import { DEFAULT_PRESET_ID, getPreset, PRESETS } from '../core/composition/presets'
import { buildShareHash } from '../core/piece/shareLink'
import { DEFAULT_VISUAL_CONFIG } from '../core/piece/visualConfig'
import { getSeries } from '../core/series/series'
import { DEFAULT_SOURCE_CONFIG, type SourceConfig } from '../core/series/sourceConfig'
import type { Article } from './articles'

const base = () => import.meta.env.BASE_URL

/** The Learn page, opened at one article. */
export const learnHref = (articleId: string) => `${base()}learn.html#${articleId}`

/** The app hash an article's "Try it" opens: its number, reading and view, default sound. */
export function tryItHash(tryIt: Article['tryIt']): string {
  const series = tryIt.series ?? DEFAULT_SOURCE_CONFIG.series
  const source: SourceConfig = {
    version: 1,
    series,
    reading: tryIt.reading ?? getSeries(series).readings[0],
  }
  const sound = (getPreset(DEFAULT_PRESET_ID) ?? PRESETS[0]!).config
  const visual = { ...DEFAULT_VISUAL_CONFIG, view: tryIt.view ?? DEFAULT_VISUAL_CONFIG.view }
  // An empty hash would restore the visitor's last session instead: name π explicitly.
  return buildShareHash(sound, visual, 0, source) || '#s=pi'
}

export const tryItHref = (tryIt: Article['tryIt']) => `${base()}${tryItHash(tryIt)}`
