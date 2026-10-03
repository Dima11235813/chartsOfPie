---
id: R-001
title: Encoding numbers as music
status: done
feeds: [E02, E04, E05]
---

# R-001 — Encoding numbers as music

## Question

How should a stream of digits become music so that (a) it sounds musical, (b) the user can
explore many encodings, and (c) each encoding teaches something true about math?

## 1. Pitch is already math

- In 12-tone equal temperament (12-TET) the frequency of MIDI note _m_ is
  **f = 440 · 2^((m − 69) / 12)** Hz. Each semitone multiplies frequency by 2^(1/12) ≈ 1.05946;
  12 semitones double it (the octave, 2 : 1).
- Consonant intervals approximate small whole-number ratios: perfect fifth 3 : 2 (12-TET:
  2^(7/12) ≈ 1.4983), perfect fourth 4 : 3, major third 5 : 4 (12-TET ≈ 1.2599 — noticeably sharp).
  This gap between "pure" ratios and 12-TET is a great lesson (E04).
- Pitch classes form the group ℤ/12: transposition is addition mod 12, and the circle of fifths
  is repeated addition of 7 mod 12 — since gcd(7, 12) = 1 it visits all 12 notes.

## 2. Scales and modes as data

A scale is a subset of ℤ/12 containing 0, written as ascending semitone offsets from the root.
Modes of a scale are its **rotations**: rotate the step pattern and re-base at 0.

| Scale / mode              | Intervals      | Steps (W = 2, H = 1, m3 = 3) | Character                |
| ------------------------- | -------------- | ---------------------------- | ------------------------ |
| Ionian (major)            | 0 2 4 5 7 9 11 | W W H W W W H                | bright, resolved         |
| Dorian                    | 0 2 3 5 7 9 10 | W H W W W H W                | minor but hopeful        |
| Phrygian                  | 0 1 3 5 7 8 10 | H W W W H W W                | dark, Spanish flavour    |
| Lydian                    | 0 2 4 6 7 9 11 | W W W H W W H                | dreamy, raised 4th       |
| Mixolydian                | 0 2 4 5 7 9 10 | W W H W W H W                | bluesy major, ♭7         |
| Aeolian (natural minor)   | 0 2 3 5 7 8 10 | W H W W H W W                | sad, minor               |
| Locrian                   | 0 1 3 5 6 8 10 | H W W H W W W                | unstable, diminished 5th |
| Major pentatonic (legacy) | 0 2 4 7 9      | W W m3 W m3                  | open, no dissonance      |
| Minor pentatonic          | 0 3 5 7 10     | m3 W W m3 W                  | rock/blues               |
| Blues                     | 0 3 5 6 7 10   | m3 W H H m3 W                | minor pentatonic + ♭5    |
| Harmonic minor            | 0 2 3 5 7 8 11 | W H W W H m3 H               | exotic leading tone      |
| Melodic minor (ascending) | 0 2 3 5 7 9 11 | W H W W W W H                | jazz minor               |
| Whole tone                | 0 2 4 6 8 10   | W W W W W W                  | floating, ambiguous      |
| Chromatic                 | 0 1 2 … 11     | H × 12                       | every note               |

Implementation: `ScaleDefinition` already stores intervals (`core/music/scales.ts`), so the
catalogue is pure data plus a `rotate()` helper. Later: non-Western scales (e.g. Hirajōshi,
Bhairav) and user-defined scales.

## 3. Mapping 10 digits onto N scale notes

| Strategy                   | Rule                                                   | Feel                              |
| -------------------------- | ------------------------------------------------------ | --------------------------------- |
| Ascending degrees (legacy) | digit _d_ → degree _d_, spilling upward over octaves   | wide range; 9 always highest      |
| Wrap                       | degree = _d_ mod N, single octave                      | compact; repeats notes for N < 10 |
| Centred                    | 5 → root; lower digits descend, higher ascend          | melodic contour around a centre   |
| Chromatic                  | _d_ semitones above root                               | atonal, shows "raw" digits        |
| Digit pairs                | two digits → index 0–99 into a long scale range        | slower, more varied melody        |
| Change-based               | next note = previous ± _d_ − 4.5 scale steps (clamped) | stepwise, singable lines          |

Alphabet sizes other than 10 (E05: base-n, residues mod 12) make "chromatic mod 12" exact —
e.g. Fibonacci mod 12 is one pitch class per term.

## 4. Rhythm and time

- **Legacy:** duration by digit table, random 0–420 ms gaps (kept as the default "legacy" mode).
- **Tempo-locked:** use `Tone.Transport` (BPM, swing) and schedule visual updates with
  `Tone.Draw` so the chart stays in sync with audio.
- **Euclidean rhythms** _E(k, n)_ distribute _k_ onsets as evenly as possible over _n_ steps
  (Bjorklund's algorithm; Toussaint, 2005, showed many world rhythms are Euclidean). Using the digit
  as _k_ gives each digit a characteristic groove.
- **Rests:** treating 0 as a rest adds breathing room.

## 5. Tuning beyond 12-TET (later)

Tone.js accepts raw frequencies, so just intonation (ratios), Pythagorean tuning (stacked 3 : 2)
and other equal temperaments (19-TET, 24-TET quarter tones) are feasible as an "advanced" option
and an excellent teaching tool. Deferred until after E02's core.

## 6. Sound and export

- Tone.js 15 provides `Synth`, `FMSynth`, `AMSynth`, `PluckSynth`, `PolySynth`, `Sampler`, effects,
  and `Tone.Offline` for faster-than-real-time rendering → WAV export (E08).
- MIDI export: `@tonejs/midi` writes standard MIDI files.

## 7. Facts worth surfacing in the UI (verified against our data)

- Counts of each digit in the first 1,000,000 decimals of π:
  0: 99,959 · 1: 99,758 · 2: 100,026 · 3: 100,229 · 4: 100,230 · 5: 100,359 · 6: 99,548 ·
  7: 99,800 · 8: 99,985 · 9: 100,106. All within ±0.5 % of 100,000 — consistent with (but not a
  proof of) π being a _normal_ number, which remains an open problem.
- The **Feynman point**: six 9s in a row starting at decimal 762.

## Recommendation

Ship E02 in this order: scale catalogue (S02.1.1) → UI selection (S02.1.2) → mapping strategies
(S02.2.1) → config/URL (S02.5.1) → tempo (S02.3.1) → rhythm encodings (S02.3.2) → explainer
(S02.1.3) → sound design (F02.4). Keep the legacy encoding as the default preset.

## Sources

- Tone.js documentation — https://tonejs.github.io/
- G. Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms", BRIDGES 2005.
- Equal temperament & interval ratios — any standard theory text (e.g. Benson, _Music: A
  Mathematical Offering_, 2006).
- Digit counts and Feynman point computed from `apps/web/public/data/pi-1m.txt`.
