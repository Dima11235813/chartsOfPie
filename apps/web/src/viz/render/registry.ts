import { createMosaicRenderer } from './mosaicRenderer'
import type { DigitRenderer, RendererOptions } from './renderer'
import { createRingRenderer } from './ringRenderer'
import { createSunflowerRenderer } from './sunflowerRenderer'
import { createWalkRenderer } from './walkRenderer'

export type ArtKind = 'ring' | 'walk' | 'sunflower' | 'mosaic'

export interface ArtDefinition {
  kind: ArtKind
  name: string
  /** Accessible description prefix. */
  describe: string
  /** Summary after `count` digits. */
  summary: (count: number) => string
  /** Live renderer. */
  live: (options: RendererOptions) => DigitRenderer
  /** Poster renderer for exactly `count` digits (may lay out differently from live). */
  poster: (options: RendererOptions, count: number) => DigitRenderer
  /** Largest poster digit count that renders in a few seconds. */
  maxPosterDigits: number
}

const n = (count: number) => count.toLocaleString()

export const ART: Record<ArtKind, ArtDefinition> = {
  ring: {
    kind: 'ring',
    name: 'Digit ring',
    describe:
      'Digit ring: each digit of π is linked to the next around a circle of ten coloured arcs.',
    summary: (count) => `${n(count)} digits woven between the ten digit arcs.`,
    live: (options) => createRingRenderer(options),
    poster: (options) => createRingRenderer(options, { maxRedraw: Infinity }),
    maxPosterDigits: 100_000,
  },
  walk: {
    kind: 'walk',
    name: 'π walk',
    describe: 'π walk: each digit is a step in one of ten directions.',
    summary: (count) => `${n(count)} steps.`,
    live: (options) => createWalkRenderer(options),
    poster: (options, count) => createWalkRenderer(options, { positionTotal: count }),
    maxPosterDigits: 1_000_000,
  },
  sunflower: {
    kind: 'sunflower',
    name: 'Sunflower',
    describe: 'Sunflower: digits of π as seeds on a golden-angle spiral.',
    summary: (count) => `${n(count)} seeds, one per digit, on a golden-angle spiral.`,
    live: (options) => createSunflowerRenderer(options),
    poster: (options, count) => createSunflowerRenderer(options, { capacity: Math.max(1, count) }),
    maxPosterDigits: 1_000_000,
  },
  mosaic: {
    kind: 'mosaic',
    name: 'Neighbour mosaic',
    describe:
      'Neighbour mosaic: digits as coloured dots in rows; equal neighbours are joined, so runs show as chains.',
    summary: (count) => `${n(count)} digits in rows; equal neighbours linked.`,
    live: (options) => createMosaicRenderer(options),
    poster: (options, count) => createMosaicRenderer(options, { fitCount: Math.max(1, count) }),
    maxPosterDigits: 250_000,
  },
}
