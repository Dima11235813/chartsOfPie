import { describe, expect, it } from 'vitest'
import { identifyChord, intervalName } from './chords'
import { noteToMidi } from './notes'

const chord = (...notes: string[]) => identifyChord(notes.map(noteToMidi))?.symbol ?? null

describe('identifyChord', () => {
  it('names triads in root position', () => {
    expect(chord('C4', 'E4', 'G4')).toBe('C')
    expect(chord('A3', 'C4', 'E4')).toBe('Am')
    expect(chord('B3', 'D4', 'F4')).toBe('Bdim')
    expect(chord('C4', 'E4', 'G#4')).toBe('Caug')
    expect(chord('D4', 'E4', 'A4')).toBe('Dsus2')
    expect(chord('D4', 'G4', 'A4')).toBe('Dsus4')
  })

  it('names seventh and sixth chords', () => {
    expect(chord('G3', 'B3', 'D4', 'F4')).toBe('G7')
    expect(chord('C4', 'E4', 'G4', 'B4')).toBe('Cmaj7')
    expect(chord('A3', 'C4', 'E4', 'G4')).toBe('Am7')
    expect(chord('B3', 'D4', 'F4', 'A4')).toBe('Bm7♭5')
    expect(chord('B3', 'D4', 'F4', 'G#4')).toBe('Bdim7')
    expect(chord('C4', 'E4', 'G4', 'A4')).toBe('C6') // bass decides between C6 and Am7
    expect(chord('C4', 'D4', 'E4', 'G4')).toBe('Cadd9')
  })

  it('handles inversions, octave doublings and spread voicings', () => {
    expect(chord('E3', 'G4', 'C5')).toBe('C/E')
    expect(chord('G2', 'C4', 'E5')).toBe('C/G')
    expect(chord('C3', 'G3', 'C4', 'E4', 'G4', 'C5')).toBe('C')
  })

  it('returns null for dyads, unisons and clusters', () => {
    expect(chord('C4', 'G4')).toBeNull()
    expect(chord('C4', 'C5', 'C6')).toBeNull()
    expect(chord('C4', 'C#4', 'D4')).toBeNull()
    expect(identifyChord([])).toBeNull()
  })

  it('reports root, bass and quality', () => {
    const result = identifyChord(['E3', 'G4', 'C5'].map(noteToMidi))!
    expect(result.root).toBe('C')
    expect(result.bass).toBe('E')
    expect(result.quality.name).toBe('major')
    expect(result.pitchClasses).toEqual([0, 4, 7])
  })
})

describe('intervalName', () => {
  it('names intervals within and beyond an octave', () => {
    expect(intervalName(60, 67)).toBe('perfect 5th')
    expect(intervalName(67, 60)).toBe('perfect 5th')
    expect(intervalName(60, 66)).toBe('tritone')
    expect(intervalName(60, 72)).toBe('octave')
    expect(intervalName(60, 76)).toBe('major 3rd')
    expect(intervalName(60, 60)).toBe('unison')
  })
})
