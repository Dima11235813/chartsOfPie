/**
 * Poster lab: deterministic poster renders for the image regression tests
 * (e2e/poster-snapshots.spec.ts). The first digits of a number (π unless another series is named)
 * in the original rainbow palette.
 */
import type { DigitSource } from '../core/digits/digitSource'
import { loadSource } from '../core/series/load'
import { getSeries, isReadingId, isSeriesId } from '../core/series/series'
import { getPalette } from '../viz/palettes'
import { POSTER_KINDS, renderPoster, type PosterKind } from '../viz/render/posters'

function digits(series: string, reading?: string): Promise<DigitSource> {
  if (!isSeriesId(series)) throw new Error(`Unknown series: ${series}`)
  if (reading !== undefined && !isReadingId(reading)) throw new Error(`Unknown reading: ${reading}`)
  // loadSource keeps each number for the session.
  return loadSource({ version: 1, series, reading: reading ?? getSeries(series).readings[0] })
}

export async function renderPosterDataUrl(
  kind: PosterKind,
  {
    count = 2_000,
    size = 512,
    palette = 'rainbow',
    series = 'pi',
    reading,
  }: { count?: number; size?: number; palette?: string; series?: string; reading?: string } = {},
): Promise<string> {
  const number = await digits(series, reading)
  const canvas = await renderPoster({
    kind,
    size,
    count,
    digitAt: (i) => number.digitAt(i),
    colors: getPalette(palette).digitColors([]),
    caption: false,
  })
  return canvas.toDataURL('image/png')
}

const posterLab = { kinds: POSTER_KINDS.map((p) => p.kind), render: renderPosterDataUrl }
declare global {
  interface Window {
    posterLab: typeof posterLab
  }
}
window.posterLab = posterLab

document.getElementById('posters')?.addEventListener('click', async () => {
  const out = document.getElementById('out')!
  out.textContent = 'Rendering posters…'
  const items: string[] = []
  for (const kind of posterLab.kinds) {
    items.push(
      `<h2>${kind}</h2><img alt="${kind} poster" src="${await renderPosterDataUrl(kind)}">`,
    )
    out.innerHTML = items.join('')
  }
})
