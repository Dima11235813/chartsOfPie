/**
 * Grand-staff geometry for proportional ("space = time") notation. Positions are diatonic steps:
 * C0 = 0, D0 = 1 … so C4 (middle C) = 28. Each step is half a staff space.
 */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

export const MIDDLE_C_STEP = 28
/** Treble lines E4 G4 B4 D5 F5 and bass lines G2 B2 D3 F3 A3. */
export const TREBLE_LINES = [30, 32, 34, 36, 38] as const
export const BASS_LINES = [18, 20, 22, 24, 26] as const

export interface StaffPosition {
  step: number
  accidental: '' | '♯' | '♭'
}

/** Position of a note name such as `F#4` or `Bb3` on the staff. */
export function staffPosition(note: string): StaffPosition {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(note)
  if (!match) throw new Error(`Invalid note name: ${note}`)
  const letter = LETTERS.indexOf(match[1] as (typeof LETTERS)[number])
  const accidental = match[2] === '#' ? '♯' : match[2] === 'b' ? '♭' : ''
  return { step: letter + 7 * Number(match[3]), accidental }
}

/**
 * Ledger lines a note needs: above the treble staff (A5 = 40 and up), at middle C, and below the
 * bass staff (E2 = 16 and down). D4 and B3 sit just outside the staves and need none.
 */
export function ledgerSteps(step: number): number[] {
  const lines: number[] = []
  for (let s = 40; s <= step; s += 2) lines.push(s)
  if (step === MIDDLE_C_STEP) lines.push(MIDDLE_C_STEP)
  for (let s = 16; s >= step; s -= 2) lines.push(s)
  return lines
}
