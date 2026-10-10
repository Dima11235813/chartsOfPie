import { describe, expect, it } from 'vitest'
import {
  legacyDurationForDigit,
  legacyNoteForDigit,
  legacyStepDelayMs,
} from '../music/legacyMapping'
import { seededRandom } from '../random/seededRandom'
import { Arranger, droneNotesFor, notationToSeconds, noteTableFor } from './arranger'
import {
  GOLDEN_SWING,
  compositionConfigSchema,
  decodeConfig,
  encodeConfig,
  MAX_ENCODED_CONFIG_LENGTH,
  parseConfig,
  type CompositionConfig,
} from './config'
import { DEFAULT_PRESET_ID, findMatchingPreset, getPreset, PRESETS, sameConfig } from './presets'

const original = getPreset('original')!.config
const PI = [
  3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8, 3, 2, 7, 9, 5, 0,
]

describe('presets', () => {
  it('every preset is a valid config with a unique id and name', () => {
    const ids = new Set(PRESETS.map((p) => p.id))
    expect(ids.size).toBe(PRESETS.length)
    for (const preset of PRESETS) {
      expect(compositionConfigSchema.safeParse(preset.config).success).toBe(true)
      expect(findMatchingPreset(preset.config)?.id).toBe(preset.id)
    }
    expect(DEFAULT_PRESET_ID).toBe('original')
  })

  it('“Original (2019)” arranges every digit exactly like the legacy app', () => {
    const arranger = new Arranger(original, seededRandom(7))
    const legacyRandom = seededRandom(7)
    for (const digit of [...PI, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const step = arranger.arrange(digit)
      expect(step.note).toBe(legacyNoteForDigit(digit))
      expect(step.durationLabel).toBe(legacyDurationForDigit(digit))
      expect(step.durationSec).toBeCloseTo(notationToSeconds(legacyDurationForDigit(digit), 120))
      expect(step.velocity).toBe(1)
      expect(step.delayMs).toBe(legacyStepDelayMs(legacyRandom))
    }
  })

  it('sameConfig compares values, not key order', () => {
    const reordered = Object.fromEntries(Object.entries(original).reverse()) as CompositionConfig
    expect(sameConfig(original, reordered)).toBe(true)
    expect(sameConfig(original, { ...original, bpm: 121 })).toBe(false)
  })
})

describe('Arranger', () => {
  const tempo: CompositionConfig = {
    ...original,
    timing: 'tempo',
    rhythm: 'steady',
    bpm: 120,
    subdivision: 2,
    legato: 1.5,
  }

  it('steady rhythm: one step per digit on a tempo grid', () => {
    const step = new Arranger(tempo).arrange(4)
    expect(step.delayMs).toBe(250) // eighth note at 120 BPM
    expect(step.durationSec).toBeCloseTo(0.375)
    expect(step.note).toBe('A4')
  })

  it('swing 1/3 is triplet swing: eighths alternate 2:1 (≈333 ms + 167 ms at 120 BPM)', () => {
    const swung = new Arranger({ ...tempo, swing: 1 / 3 })
    const delays = [1, 2, 3, 4].map((d) => swung.arrange(d).delayMs)
    expect(delays[0]).toBeCloseTo(333.33, 1)
    expect(delays[1]).toBeCloseTo(166.67, 1)
    expect(delays[0]! / delays[1]!).toBeCloseTo(2) // long : short = 2 : 1
    expect(delays[2]! + delays[3]!).toBeCloseTo(500) // each beat keeps its length
  })

  it('golden swing: eighths alternate long : short = φ ≈ 1.618 (≈309 ms + 191 ms at 120 BPM)', () => {
    expect(GOLDEN_SWING).toBeCloseTo(0.2360679775, 9) // √5 − 2 = 1/φ³
    const swung = new Arranger({ ...tempo, swing: GOLDEN_SWING })
    const delays = [1, 2, 3, 4].map((d) => swung.arrange(d).delayMs)
    expect(delays[0]).toBeCloseTo(309.02, 1)
    expect(delays[1]).toBeCloseTo(190.98, 1)
    expect(delays[0]! / delays[1]!).toBeCloseTo((1 + Math.sqrt(5)) / 2, 9)
    expect(delays[2]! + delays[3]!).toBeCloseTo(500)
  })

  it('Fibonacci word rhythm: long and short in the ratio φ, following 0100101001…', () => {
    const word = new Arranger({ ...tempo, rhythm: 'fibonacci-word', swing: 0.3 })
    const delays = Array.from({ length: 10 }, (_, i) => word.arrange(4, i).delayMs)
    const long = delays[0]!
    const short = delays[1]!
    expect(long / short).toBeCloseTo((1 + Math.sqrt(5)) / 2, 9)
    // 0 1 0 0 1 0 1 0 0 1: long, short, long, long, short… (swing is ignored: it has its own)
    expect(delays.map((d) => (d === long ? 'L' : 'S')).join('')).toBe('LSLLSLSLLS')
    expect(long).toBeCloseTo(292.7, 1) // 250 ms grid step × φ³/(φ² + 1)
    // Position, not call order, decides: the same digit at index 1 is short after a jump.
    expect(new Arranger({ ...tempo, rhythm: 'fibonacci-word' }).arrange(4, 1).delayMs).toBeCloseTo(
      short,
    )
  })

  it('Zeckendorf ruler rhythm: notes last 1 2 3 1 5 1 2 5 steps', () => {
    const ruler = new Arranger({ ...tempo, rhythm: 'zeckendorf' })
    const delays = Array.from({ length: 8 }, (_, i) => ruler.arrange(4, i).delayMs)
    expect(delays.map((d) => d / 250)).toEqual([1, 2, 3, 1, 5, 1, 2, 5])
    expect(ruler.arrange(4, 0).note).toBe('A4') // every digit sounds; zeros are not rests
    expect(ruler.arrange(0, 0).note).not.toBeNull()
  })

  it('swing spans the steps a long digit covers, and is ignored for quarter notes', () => {
    // digit-length: digit 3 covers steps 0,1,2 → (1+s)+(1−s)+(1+s) units.
    const long = new Arranger({ ...tempo, rhythm: 'digit-length', swing: 0.2 }).arrange(3)
    expect(long.delayMs).toBeCloseTo((1.2 + 0.8 + 1.2) * 250)
    const quarters = new Arranger({ ...tempo, subdivision: 1, swing: 0.3 })
    expect(quarters.arrange(5).delayMs).toBe(500)
  })

  it('old configs without swing read as straight', () => {
    const withoutSwing: Record<string, unknown> = { ...tempo }
    delete withoutSwing.swing
    expect(parseConfig(withoutSwing)?.swing).toBe(0)
  })

  it('steady-rests: zero is silent but still takes a step', () => {
    const step = new Arranger({ ...tempo, rhythm: 'steady-rests' }).arrange(0)
    expect(step.note).toBeNull()
    expect(step.durationLabel).toBe('rest')
    expect(step.delayMs).toBe(250)
  })

  it('digit-length: a digit lasts that many steps', () => {
    const arranger = new Arranger({ ...tempo, rhythm: 'digit-length', legato: 1 })
    expect(arranger.arrange(3).delayMs).toBe(750)
    const zero = arranger.arrange(0)
    expect(zero.note).toBeNull()
    expect(zero.delayMs).toBe(250)
  })

  it('accents the first step of each beat', () => {
    const arranger = new Arranger({ ...tempo, dynamics: 'accented', subdivision: 2 })
    const velocities = [1, 2, 3, 4].map((d) => arranger.arrange(d).velocity)
    expect(velocities).toEqual([0.85, 0.68, 0.85, 0.68])
    arranger.arrange(5)
    arranger.reset()
    expect(arranger.arrange(5).velocity).toBe(0.85)
  })

  it('humanize varies velocity within bounds', () => {
    const arranger = new Arranger({ ...tempo, humanize: 1 }, seededRandom(1))
    const velocities = PI.map((d) => arranger.arrange(d).velocity)
    expect(new Set(velocities).size).toBeGreaterThan(5)
    velocities.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0.75)
      expect(v).toBeLessThanOrEqual(1)
    })
  })

  it('original note lengths on a tempo play back to back', () => {
    const step = new Arranger({ ...original, timing: 'tempo', bpm: 60 }).arrange(3) // 2n
    expect(step.durationSec).toBeCloseTo(2)
    expect(step.delayMs).toBeCloseTo(2000)
  })

  it('setConfig changes the mapping from the next digit on', () => {
    const arranger = new Arranger(original)
    expect(arranger.arrange(0).note).toBe('C4')
    arranger.setConfig({ ...original, root: 'D' })
    expect(arranger.arrange(0).note).toBe('D4')
    expect(arranger.noteTable[9]).toBe('B5')
  })

  it('drone: root + fifth below the melody, only when the scale has a perfect fifth', () => {
    expect(droneNotesFor({ ...original, root: 'F', octave: 4 })).toEqual(['F3', 'C4'])
    // centred melodies reach below the root, so the drone drops two octaves
    expect(droneNotesFor({ ...original, root: 'A', octave: 4, mapping: 'centred' })).toEqual([
      'A2',
      'E3',
    ])
    // never below octave 2
    expect(droneNotesFor({ ...original, octave: 2 })).toEqual(['C2', 'G2'])
    // no perfect fifth in Locrian or whole tone → root doubled an octave up
    expect(droneNotesFor({ ...original, scale: 'locrian', root: 'B' })).toEqual(['B3', 'B4'])
    expect(droneNotesFor({ ...original, scale: 'whole-tone' })).toEqual(['C3', 'C4'])
    expect(droneNotesFor({ ...original, scale: 'chromatic', mapping: 'semitones' })).toEqual([
      'C3',
      'C4',
    ])
    expect(noteTableFor(original)).toHaveLength(10)
  })

  it('humanize varies flat dynamics in both directions around 0.9', () => {
    const arranger = new Arranger({ ...original, humanize: 1 }, seededRandom(4))
    const velocities = PI.map((d) => arranger.arrange(d).velocity)
    expect(Math.min(...velocities)).toBeLessThan(0.9)
    expect(Math.max(...velocities)).toBeGreaterThan(0.9)
  })
})

describe('config parsing and share encoding', () => {
  it('round-trips through the URL encoding', () => {
    for (const preset of PRESETS) {
      expect(decodeConfig(encodeConfig(preset.config))).toEqual(preset.config)
    }
  })

  it('rejects invalid, out-of-range, unknown and oversized input', () => {
    expect(parseConfig(null)).toBeNull()
    expect(parseConfig({ ...original, version: 2 })).toBeNull()
    expect(parseConfig({ ...original, bpm: 9999 })).toBeNull()
    expect(parseConfig({ ...original, octave: 6 })).toBeNull()
    expect(parseConfig({ ...original, scale: 'nope' })).toBeNull()
    expect(parseConfig({ ...original, instrument: '<script>' })).toBeNull()
    expect(decodeConfig('%%%')).toBeNull()
    expect(decodeConfig('a'.repeat(MAX_ENCODED_CONFIG_LENGTH + 1))).toBeNull()
  })

  it('drops unknown keys', () => {
    expect(parseConfig({ ...original, evil: true })).toEqual(original)
  })
})

describe('seededRandom', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    for (let i = 0; i < 1000; i++) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
    expect(seededRandom(1)()).not.toBe(seededRandom(2)())
  })
})
