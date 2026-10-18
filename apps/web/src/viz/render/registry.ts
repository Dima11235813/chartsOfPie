import { createGoldenRenderer } from './goldenRenderer'
import { createHilbertRenderer } from './hilbertRenderer'
import { createMosaicRenderer } from './mosaicRenderer'
import type { DigitRenderer, RendererOptions } from './renderer'
import { createRingRenderer } from './ringRenderer'
import { createSunflowerRenderer } from './sunflowerRenderer'
import { createTypeRenderer } from './typeRenderer'
import { createWalkRenderer } from './walkRenderer'
import { createWallRenderer } from './wallRenderer'
import { hilbertSide } from '../art'
import { goldenLayout, goldenSquaresFor } from '../golden'
import { TRIANGLE_LAYOUT, wallExtent, type WallLayout } from '../placeValue'

export type ArtKind =
  'ring' | 'walk' | 'sunflower' | 'mosaic' | 'hilbert' | 'golden' | 'type' | 'wall'

/** User choices that change how an artwork is laid out (from the view's options). */
export interface ArtSettings {
  /** Neighbour mosaic: fixed column count; undefined = fill the frame. */
  mosaicColumns?: number
  /** Neighbour mosaic: only groups of at least this many equal neighbours (0 = everything). */
  mosaicMinGroup?: number
  /** Neighbour mosaic: only groups of this free shape (a polyplet key), if set. */
  mosaicShape?: string
  /** Golden rectangle: outline the squares and draw the spiral (default on). */
  goldenSpiral?: boolean
  /** Sunflower: join every seed to its two Fibonacci neighbours (the spirals). */
  sunflowerSpirals?: boolean
  /** Typographic: the cell the decimal point follows (default 0), or null for none. */
  typeDecimalPoint?: number | null
  /** Typographic: true where a new term of a whole-number sequence begins. */
  termStartAt?: (index: number) => boolean
  /** Place-value wall: rows and places (`wallLayoutFor(source)`); default the triangle. */
  wallLayout?: WallLayout
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
  /** Digits a poster of `count` actually draws, when the layout needs fewer (default: all). */
  posterDigits?: (count: number) => number
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
  golden: {
    kind: 'golden',
    name: 'Golden rectangle',
    describe:
      'Golden rectangle: digits of π fill the Fibonacci squares 1, 1, 2, 3, 5, 8… from the centre outwards, with the golden spiral drawn through them.',
    summary: (count) => {
      const { squares, width, height } = goldenLayout(goldenSquaresFor(count))
      const [short, long] = [Math.min(width, height), Math.max(width, height)]
      return `${n(count)} digits in ${squares.length} squares, the largest ${squares.at(-1)!.side} × ${squares.at(-1)!.side}; the rectangle is ${short} × ${long}, and ${long}/${short} = ${(long / short).toFixed(5)} closes in on φ = 1.61803.`
    },
    live: (options, settings) => createGoldenRenderer(options, { spiral: settings?.goldenSpiral }),
    poster: (options, count, settings) =>
      createGoldenRenderer(options, { count: Math.max(1, count), spiral: settings?.goldenSpiral }),
    maxPosterDigits: 1_000_000,
    // A print shows whole squares only: the digits that fill Fₖ × Fₖ₊₁ (e.g. 6,765 of 10,000).
    posterDigits: (count) => {
      let k = goldenSquaresFor(count)
      while (k > 1 && goldenLayout(k).cells > count) k--
      return Math.min(count, goldenLayout(k).cells)
    },
  },
  type: {
    kind: 'type',
    name: 'Typographic π',
    describe:
      'Typographic π: the digits themselves, coloured; runs of three or more equal digits glow.',
    summary: (count) => `${n(count)} digits set in type.`,
    live: (options, settings) =>
      createTypeRenderer(options, {
        decimalPoint: settings?.typeDecimalPoint,
        termStartAt: settings?.termStartAt,
      }),
    poster: (options, count, settings) =>
      createTypeRenderer(options, {
        fitCount: Math.max(1, count),
        decimalPoint: settings?.typeDecimalPoint,
        termStartAt: settings?.termStartAt,
      }),
    maxPosterDigits: 100_000,
  },
  wall: {
    kind: 'wall',
    name: 'Place-value wall',
    describe:
      'Place-value wall: each number of the sequence is a row, right-aligned, so digits of equal place value line up in columns (a constant’s digits make a triangle, one more per row).',
    summary: (count) => `${n(count)} digits.`,
    live: (options, settings) => createWallRenderer(options, { layout: settings?.wallLayout }),
    poster: (options, count, settings) =>
      createWallRenderer(options, { layout: settings?.wallLayout, fitCount: Math.max(1, count) }),
    maxPosterDigits: 1_000_000,
  },
}

/** "12 rows, the widest 3 digits" for the wall's description. */
export function describeWall(layout: WallLayout = TRIANGLE_LAYOUT, count: number): string {
  if (count === 0) return 'No digits yet.'
  const { rows, width } = wallExtent(layout, count)
  return layout.kind === 'terms'
    ? `${n(count)} digits in ${n(rows)} numbers; the longest has ${n(width)} digits. Each column is one place value, units on the right.`
    : `${n(count)} digits in a triangle of ${n(rows)} rows, each one digit longer than the last.`
}
