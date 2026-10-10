import { withSymbol } from '../../core/series/series'
import { stringArtMultiplier } from '../art'
import { ART, type ArtKind, type ArtSettings } from './registry'
import type { DigitAt } from './renderer'
import { drawStringArt } from './stringArtRenderer'

export type PosterKind = ArtKind | 'string-art'

export const POSTER_KINDS: readonly { kind: PosterKind; name: string; maxDigits: number }[] = [
  ...Object.values(ART).map(({ kind, name, maxPosterDigits }) => ({
    kind,
    name,
    maxDigits: maxPosterDigits,
  })),
  { kind: 'string-art', name: 'Times-table string art', maxDigits: 1_000_000 },
]

export const POSTER_DIGIT_COUNTS = [1_000, 10_000, 100_000, 1_000_000] as const
export const POSTER_SIZES = [2048, 4096] as const

export interface PosterOptions {
  kind: PosterKind
  /** Square size in pixels. */
  size: number
  /** Digits to draw (from the start). */
  count: number
  digitAt: DigitAt
  colors: readonly string[]
  /** Caption under the artwork (off for snapshot tests). */
  caption?: boolean
  background?: string
  /** Layout choices from the live view (e.g. mosaic columns). */
  settings?: ArtSettings
  /** Symbol of the number drawn, for the caption and title (default π). */
  symbol?: string
}

/** Digits drawn per slice before yielding to the browser (keeps the page responsive). */
const SLICE = 4_000

/**
 * Render a print-size artwork of the first `count` digits — the same renderers as the live views,
 * drawn at high resolution in slices so the page stays responsive. `onProgress` gets 0–1.
 */
export async function renderPoster(
  {
    kind,
    size,
    count,
    digitAt,
    colors,
    caption = true,
    background = '#0b0b12',
    settings,
    symbol = 'π',
  }: PosterOptions,
  onProgress?: (fraction: number) => void,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = size / 800
  const captionHeight = caption ? Math.round(56 * scale) : 0
  const art = document.createElement('canvas')
  art.width = size
  art.height = size - captionHeight
  const artCtx = art.getContext('2d')!
  let name: string

  if (kind === 'string-art') {
    name = 'Times-table string art'
    const multiplier = count >= 2 ? stringArtMultiplier(digitAt(count - 2), digitAt(count - 1)) : 2
    drawStringArt(artCtx, art.width, art.height, scale, { multiplier, colors, label: caption })
  } else {
    const definition = ART[kind]
    name = withSymbol(definition.name, symbol)
    if (kind === 'mosaic' && settings?.mosaicColumns) {
      name += ` · ${settings.mosaicColumns} columns`
    }
    if (kind === 'mosaic' && settings?.mosaicMinGroup && settings.mosaicMinGroup > 1) {
      name += ` · groups of ${settings.mosaicMinGroup}+`
    }
    const renderer = definition.poster(
      { width: art.width, height: art.height, scale, colors },
      count,
      settings,
    )
    for (let from = 0; from < count; from += SLICE) {
      renderer.draw(from, Math.min(count, from + SLICE), digitAt)
      onProgress?.(Math.min(count, from + SLICE) / count)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    renderer.compose(artCtx, { highlight: false })
  }

  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(art, 0, 0)
  if (caption) {
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8fd3ff'
    ctx.font = `600 ${Math.round(28 * scale)}px Georgia, serif`
    ctx.fillText(symbol, 24 * scale, size - captionHeight / 2)
    ctx.fillStyle = '#c9d6e8'
    ctx.font = `${Math.round(18 * scale)}px system-ui, sans-serif`
    ctx.fillText(
      `${name} · the first ${count.toLocaleString()} digits of ${symbol} · Charts of Pie`,
      58 * scale,
      size - captionHeight / 2,
    )
  }
  return canvas
}
