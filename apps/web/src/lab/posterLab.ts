/**
 * Poster lab: deterministic poster renders for the image regression tests
 * (e2e/poster-snapshots.spec.ts). Always the first digits of π in the original rainbow palette.
 */
import { loadPiDigits } from '../core/digits/pi'
import type { DigitSource } from '../core/digits/digitSource'
import { getPalette } from '../viz/palettes'
import { POSTER_KINDS, renderPoster, type PosterKind } from '../viz/render/posters'

let source: Promise<DigitSource> | null = null
const digits = () => (source ??= loadPiDigits())

export async function renderPosterDataUrl(
  kind: PosterKind,
  { count = 2_000, size = 512, palette = 'rainbow' } = {},
): Promise<string> {
  const pi = await digits()
  const canvas = await renderPoster({
    kind,
    size,
    count,
    digitAt: (i) => pi.digitAt(i),
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
