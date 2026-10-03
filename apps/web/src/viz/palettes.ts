import { noteToMidi } from '../core/music/notes'

/**
 * Colour palettes shared by every view (chart, staff, stream, ring, walk, sunflower). A palette
 * turns the ten digits into colours; the Scriabin palette goes through the notes the current
 * scale assigns to each digit, so colour follows pitch.
 */
export interface Palette {
  readonly id: string
  readonly name: string
  readonly description: string
  /** Colour per digit (index = digit). `noteTable` is the note each digit plays. */
  digitColors(noteTable: readonly string[]): string[]
}

/** The original 2019 rainbow (digits 0/9, 1/8 and 2/7 share colours). */
export const RAINBOW = [
  'rgb(148, 0, 211)',
  'rgb(75, 0, 130)',
  'rgb(0, 0, 255)',
  'rgb(255, 0, 0)',
  'rgb(255, 127, 0)',
  'rgb(255, 255, 0)',
  'rgb(0, 255, 0)',
  'rgb(0, 0, 255)',
  'rgb(75, 0, 130)',
  'rgb(148, 0, 211)',
] as const

/**
 * Paul Tol's "light" qualitative scheme (designed to stay distinguishable with colour-vision
 * deficiencies and readable on dark backgrounds) plus white for the tenth digit.
 */
export const TOL_LIGHT = [
  '#77AADD',
  '#EE8866',
  '#EEDD88',
  '#FFAABB',
  '#99DDFF',
  '#44BB99',
  '#BBCC33',
  '#AAAA00',
  '#DDDDDD',
  '#FFFFFF',
] as const

/**
 * Scriabin's colour-for-pitch-class scheme from the score of Prometheus (1910) — approximate
 * screen colours, index = pitch class (0 = C).
 */
export const SCRIABIN = [
  '#FF2A2A', // C  red
  '#9B4DFF', // C♯ violet
  '#FFE94D', // D  yellow
  '#B7468B', // D♯ flesh / glint of steel
  '#C3F2FF', // E  sky blue (moonlight)
  '#C2185B', // F  deep red
  '#7F8BFD', // F♯ bright blue
  '#FF8C1A', // G  orange
  '#BB75FC', // G♯ purple
  '#3CCB5A', // A  green
  '#C98AA0', // A♯ rose / steel
  '#8EC9FF', // B  pearly blue
] as const

/** Sequential deep-blue → pale-cyan ramp: low digits dark, high digits light. */
export const INK = [
  '#2B4C7E',
  '#33608F',
  '#3C74A0',
  '#4888B0',
  '#579CBF',
  '#6AAFCC',
  '#81C1D8',
  '#9BD2E2',
  '#B9E2EC',
  '#DAF1F5',
] as const

export const PALETTES: readonly Palette[] = [
  {
    id: 'rainbow',
    name: 'Rainbow (original)',
    description: 'The 2019 colours',
    digitColors: () => [...RAINBOW],
  },
  {
    id: 'colour-blind',
    name: 'Colour-blind friendly',
    description: "Paul Tol's light scheme: ten distinct, high-contrast colours",
    digitColors: () => [...TOL_LIGHT],
  },
  {
    id: 'scriabin',
    name: 'Scriabin (by pitch)',
    description: "Each digit takes the colour Scriabin gave its note's pitch class",
    digitColors: (noteTable) =>
      Array.from({ length: 10 }, (_, digit) => {
        const note = noteTable[digit]
        return note ? SCRIABIN[((noteToMidi(note) % 12) + 12) % 12]! : RAINBOW[digit]!
      }),
  },
  {
    id: 'ink',
    name: 'Ink (sequential)',
    description: 'Calm blues from dark (0) to light (9)',
    digitColors: () => [...INK],
  },
]

export const DEFAULT_PALETTE_ID = 'rainbow'

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!
}

/** `rgb(…)`/`#rrggbb` → `rgba(r, g, b, a)`. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(color)
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`
  return color
}
