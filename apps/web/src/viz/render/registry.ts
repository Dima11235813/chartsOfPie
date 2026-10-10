import { createHilbertRenderer } from './hilbertRenderer'
import { createMosaicRenderer } from './mosaicRenderer'
import type { DigitRenderer, RendererOptions } from './renderer'
import { createRingRenderer } from './ringRenderer'
import { createSunflowerRenderer } from './sunflowerRenderer'
import { createTypeRenderer } from './typeRenderer'
import { createWalkRenderer } from './walkRenderer'
import { hilbertSide } from '../art'

export type ArtKind = 'ring' | 'walk' | 'sunflower' | 'mosaic' | 'hilbert' | 'type'

/** User choices that change how an artwork is laid out (from the view's options). */
export interface ArtSettings {
  /** Neighbour mosaic: fixed column count; undefined = fill the frame. */
  mosaicColumns?: number
  /** Neighbour mosaic: only groups of at least this many equal neighbours (0 = everything). */
  mosaicMinGroup?: number
  /** Neighbour mosaic: only groups of this free shape (a polyplet key), if set. */
  mosaicShape?: string
  /** Sunflower: join every seed to its two Fibonacci neighbours (the spirals). */
  sunflowerSpirals?: boolean
}

export interface ArtDefinition {
  kind: ArtKind
  name: string
  /** Accessible description prefix. */
  describe: string
  /** Summary after `count` digits, out of `total` in the source. */
  summary: (count: number, total: number) => string
  /** Live renderer. */
  live: (options: RendererOptions, settings?: ArtSettings) => DigitRenderer
  /** Poster renderer for exactly `count` digits (may lay out differently from live). */
  poster: (options: RendererOptions, count: number, settings?: ArtSettings) => DigitRenderer
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
    live: (options, settings) =>
      createSunflowerRenderer(options, { spirals: settings?.sunflowerSpirals }),
    poster: (options, count) => createSunflowerRenderer(options, { capacity: Math.max(1, count) }),
    maxPosterDigits: 1_000_000,
  },
  mosaic: {
    kind: 'mosaic',
    name: 'Neighbour mosaic',
    describe:
      'Neighbour mosaic: digits as coloured dots in rows; equal neighbours are joined, so runs show as chains.',
    summary: (count) => `${n(count)} digits in rows; equal neighbours linked.`,
    live: (options, settings) =>
      createMosaicRenderer(options, {
        columns: settings?.mosaicColumns,
        minGroup: settings?.mosaicMinGroup,
        shape: settings?.mosaicShape,
      }),
    poster: (options, count, settings) =>
      createMosaicRenderer(options, {
        fitCount: Math.max(1, count),
        columns: settings?.mosaicColumns,
        minGroup: settings?.mosaicMinGroup,
        shape: settings?.mosaicShape,
      }),
    maxPosterDigits: 250_000,
  },
  hilbert: {
    kind: 'hilbert',
    name: 'Hilbert carpet',
    describe:
      'Hilbert carpet: all million digits of π, one pixel each along a space-filling curve; digits light up as they play.',
    summary: (count, total) => `${n(count)} of ${n(total)} digits lit.`,
    live: (options) => createHilbertRenderer(options),
    poster: (options, count) => createHilbertRenderer(options, { side: hilbertSide(count) }),
    maxPosterDigits: 1_000_000,
  },
  type: {
    kind: 'type',
    name: 'Typographic π',
    describe:
      'Typographic π: the digits themselves, coloured; runs of three or more equal digits glow.',
    summary: (count) => `${n(count)} digits set in type.`,
    live: (options) => createTypeRenderer(options),
    poster: (options, count) => createTypeRenderer(options, { fitCount: Math.max(1, count) }),
    maxPosterDigits: 100_000,
  },
}
