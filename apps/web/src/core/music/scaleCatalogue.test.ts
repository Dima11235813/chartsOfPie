import { describe, expect, it } from 'vitest'
import { digitNoteTable, digitToMidi, MAPPING_STRATEGIES } from './mapping'
import { buildScaleNotes } from './scales'
import { getScale, rotateIntervals, SCALE_CATALOGUE } from './scaleCatalogue'

const notes = (id: string, root: Parameters<typeof buildScaleNotes>[0], count = 8) =>
  buildScaleNotes(root, 4, getScale(id), count)

describe('scale catalogue', () => {
  it('spells the seven modes correctly (each mode on the white keys from its own note)', () => {
    expect(notes('ionian', 'C')).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'])
    expect(notes('dorian', 'D')).toEqual(['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'])
    expect(notes('phrygian', 'E')).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'])
    expect(notes('lydian', 'F')).toEqual(['F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'])
    expect(notes('mixolydian', 'G')).toEqual(['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'])
    expect(notes('aeolian', 'A')).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'])
    expect(notes('locrian', 'B')).toEqual(['B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'])
  })

  it('has the textbook interval sets', () => {
    const intervals = (id: string) => getScale(id).intervals
    expect(intervals('lydian')).toEqual([0, 2, 4, 6, 7, 9, 11])
    expect(intervals('minor-pentatonic')).toEqual([0, 3, 5, 7, 10])
    expect(intervals('blues')).toEqual([0, 3, 5, 6, 7, 10])
    expect(intervals('harmonic-minor')).toEqual([0, 2, 3, 5, 7, 8, 11])
    expect(intervals('melodic-minor')).toEqual([0, 2, 3, 5, 7, 9, 11])
    expect(intervals('whole-tone')).toEqual([0, 2, 4, 6, 8, 10])
    expect(notes('minor-pentatonic', 'A', 6)).toEqual(['A4', 'C5', 'D5', 'E5', 'G5', 'A5'])
  })

  it('every scale is ascending, starts at 0, stays within an octave and has a unique id', () => {
    const ids = new Set<string>()
    for (const scale of SCALE_CATALOGUE) {
      expect(scale.intervals[0]).toBe(0)
      scale.intervals.forEach((value, i) => {
        expect(value).toBeLessThan(12)
        if (i > 0) expect(value).toBeGreaterThan(scale.intervals[i - 1]!)
      })
      expect(ids.has(scale.id)).toBe(false)
      ids.add(scale.id)
    }
    expect(() => getScale('nope')).toThrow()
  })

  it('rotating seven times returns the original scale', () => {
    const major = getScale('ionian').intervals
    expect(rotateIntervals(major, 7)).toEqual([...major])
    expect(rotateIntervals(major, -1)).toEqual(getScale('locrian').intervals)
  })
})

describe('digit → note mapping strategies', () => {
  const pent = getScale('major-pentatonic')

  it('ascending reproduces the original table', () => {
    expect(digitNoteTable(pent, 'C', 4, 'ascending')).toEqual([
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
      'C5',
      'D5',
      'E5',
      'G5',
      'A5',
    ])
  })

  it('centred puts 5 on the root', () => {
    expect(digitNoteTable(pent, 'C', 4, 'centred')).toEqual([
      'C3',
      'D3',
      'E3',
      'G3',
      'A3',
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
    ])
    expect(digitNoteTable(getScale('ionian'), 'C', 4, 'centred')[0]).toBe('E3')
  })

  it('wrap stays within one octave', () => {
    expect(digitNoteTable(pent, 'C', 4, 'wrap')).toEqual([
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
    ])
  })

  it('semitones ignores the scale', () => {
    expect(digitNoteTable(pent, 'C', 4, 'semitones')).toEqual([
      'C4',
      'C#4',
      'D4',
      'D#4',
      'E4',
      'F4',
      'F#4',
      'G4',
      'G#4',
      'A4',
    ])
  })

  it('rejects non-digits for every strategy', () => {
    for (const { id } of MAPPING_STRATEGIES) {
      expect(() => digitToMidi(10, id, pent, 60)).toThrow(RangeError)
    }
  })
})
