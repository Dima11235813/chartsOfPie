/**
 * Guitar fretboard maths (pure): where a pitch can be played, and which of those positions a
 * player's hand would most likely use next.
 */

export interface Tuning {
  readonly id: FretboardTuning
  readonly name: string
  /** Open-string MIDI notes, lowest string first (string 6 → string 1). */
  readonly strings: readonly number[]
}

export type FretboardTuning = 'standard' | 'drop-d' | 'dadgad' | 'open-g'

/** E2 A2 D3 G3 B3 E4 = MIDI 40 45 50 55 59 64. */
export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard (E A D G B E)', strings: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', strings: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G (D G D G B D)', strings: [38, 43, 50, 55, 59, 62] },
]

export const getTuning = (id: string): Tuning => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]!

export const FRETS = 15

export interface FretPosition {
  /** 0 = lowest string. */
  string: number
  fret: number
}

/** Every position of `midi` on the board (lowest string first). */
export function positionsOf(
  midi: number,
  strings: readonly number[],
  frets = FRETS,
): FretPosition[] {
  const out: FretPosition[] = []
  strings.forEach((open, string) => {
    const fret = midi - open
    if (fret >= 0 && fret <= frets) out.push({ string, fret })
  })
  return out
}

/** Fold a pitch by octaves into the playable range; `folded` tells whether it moved. */
export function foldIntoRange(
  midi: number,
  strings: readonly number[],
  frets = FRETS,
): { midi: number; folded: boolean } {
  const low = Math.min(...strings)
  const high = Math.max(...strings) + frets
  let m = midi
  while (m < low) m += 12
  while (m > high) m -= 12
  return { midi: m, folded: m !== midi }
}

/**
 * Pick the position a player would most likely use: closest to the hand's current fret, with a
 * gentle preference for lower frets (and open strings) — a small, predictable fingering model.
 */
export function choosePosition(
  options: readonly FretPosition[],
  handFret: number | null,
): FretPosition | null {
  let best: FretPosition | null = null
  let bestCost = Infinity
  for (const option of options) {
    const reach = handFret === null || option.fret === 0 ? 0 : Math.abs(option.fret - handFret)
    const cost = reach + option.fret * 0.15
    if (cost < bestCost) {
      bestCost = cost
      best = option
    }
  }
  return best
}

/** Frets with inlay dots on a real guitar (12 has a double dot). */
export const INLAYS = [3, 5, 7, 9, 12, 15] as const
