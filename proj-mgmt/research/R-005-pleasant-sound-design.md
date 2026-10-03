---
id: R-005
title: Making π sound pleasant — sound design research
status: in-progress
feeds: [E02, E04, E09]
---

# R-005 — Making π sound pleasant

## Question

The original sound is fun but tiring after a minute. Why, and what makes digit-driven music
pleasant to listen to for a long time — and how do we test that without relying on taste alone?

## 1. Why the original is fatiguing (diagnosed from offline renders)

Rendered with `npm run audio:render` (see §5) and inspected as spectrograms:

| Cause                    | Evidence                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Bright, buzzy timbre     | Triangle oscillator: dense harmonics up to 8 kHz on every note                                  |
| Notes cut each other off | Monophonic synth + durations up to 2 s + gaps as short as 0 ms → abrupt retriggers (hard edges) |
| No pulse                 | Random 0–420 ms gaps: the ear can't entrain to a beat, so it hears "random beeping"             |
| No space or dynamics     | Dry signal, every note at full velocity, no reverb                                              |
| Loud                     | Peaks at -0.1 dBFS, gated loudness ≈ -13.5 dB                                                   |

## 2. Principles (what we applied)

1. **Pulse.** A steady tempo (40–240 BPM) with a subdivision is the single biggest step from
   "data" to "music". Rhythm encodings then vary _where_ notes fall without losing the grid.
2. **Consonant pitch sets.** Pentatonic scales contain no semitone steps, so any two notes sound
   fine together — great for overlapping notes. Modes give mood (Lydian bright, Aeolian sad).
3. **Range.** Keep melodies roughly in C3–C6. Below ~C3, overlapping notes get muddy; above ~C6,
   they turn shrill. The "centred" mapping keeps contours around the root.
4. **Timbre with natural decay.** Acoustic-like envelopes (piano, mallets, plucks, FM tines with
   decaying modulation index) start bright and mellow quickly — pleasant at any density.
5. **Polyphony.** Notes ring out instead of cutting each other off (PolySynth, sampler).
6. **Dynamics.** Accent the first step of each beat (0.85 vs 0.68 velocity) and humanize ±15%.
   Equal velocities sound mechanical.
7. **Space.** A little reverb (send, not insert) and an optional dotted-eighth echo glue the notes
   into a phrase.
8. **Harmonic anchor.** A soft drone (root + fifth an octave below) makes even random melodies
   sound "in a key".
9. **Rests.** Treating 0 as a rest gives the listener breathing room.
10. **Loudness discipline.** Every preset is loudness-matched (±1.5 dB) to the Original. Otherwise
    comparisons are biased: listeners prefer whichever version is louder.

## 3. What was built (E02, this slice)

- 8 instruments: classic (legacy), sampled grand piano (Salamander, CC BY 3.0), FM electric piano,
  FM music box, FM marimba (4:1 overtone like a real bar), subtractive plucked strings, warm pad,
  pure sine.
- Master chain: reverb & echo sends → optional glue compressor (-24 dB, 2.5:1, +2 dB makeup) →
  limiter → soft-clip ceiling. Original bypasses the compressor and ceiling (2019 signal path).
- Per-instrument trims calibrated to -20 dB gated loudness on a neutral phrase (`CALIBRATE=1`).
- 8 new presets + Original, loudness-matched, none clipping (20 s and 30 s renders, two different
  stretches of π, two seeds).
- Drift-free timing: the engine aims each tick at an absolute target time, and the player places
  notes on an exact audio-clock grid (`gapMs`), so timer jitter never reaches the ear.

Measured after the music-theory review fixes (20 s from digit 0, seed 1):

| Preset           | Gated loudness dB | Peak dBFS | Spectral centroid Hz |
| ---------------- | ----------------: | --------: | -------------------: |
| Original (2019)  |             -13.4 |      -0.1 |                  529 |
| Pentatonic piano |             -14.0 |      -1.1 |                  614 |
| Lydian dream     |             -14.4 |      -3.4 |                  343 |
| Dorian marimba   |             -14.4 |      -3.2 |                  504 |
| Minor nocturne   |             -14.7 |      -0.8 |                  374 |
| Music box        |             -14.6 |      -4.4 |                  944 |
| Blues pluck      |             -14.3 |      -5.6 |                  416 |
| Whole-tone mist  |             -13.8 |      -2.5 |                  653 |
| Raw digits       |             -13.7 |      -6.7 |                  353 |

A review by the `music-theory-expert` agent led to these fixes:

- The drone only adds a perfect fifth when the scale has one; otherwise it doubles the root.
- With the centred mapping, the drone drops two octaves so it stays below the melody (never under octave 2).
- Octave capped at 5 to avoid shrillness.
- Whole-tone mist now uses the ascending mapping, because centred was muddy.
- "Blues harp" renamed "Blues pluck".
- Humanize now varies velocity both ways around 0.9.
- Original note lengths on a tempo now play back to back.
- Scale descriptions corrected.

Dead end recorded: Tone.js `PluckSynth` (Karplus–Strong) has an onset peak about 23 dB above its
body. A compressor and lower noise didn't help, so it couldn't be levelled without clipping.
Replaced by a subtractive pluck (crest ≈ 10.6 dB).

## 4. Next research items (ranked)

1. **Owner listening review.** Metrics can't judge taste. Listen to the renders, rank presets, and
   note what to change (S02.6.3).
2. **Harmony under the melody.** A slow chord progression (e.g. I–V–vi–IV, one chord per bar), with
   digits on strong beats snapped to chord tones. Expected: the biggest jump in musicality after
   pulse. (S02.4.2)
3. **Melodic shaping.** A "stepwise" mapping (next note = previous ± f(digit)), phrase grouping
   (4-bar phrases, repetition/variation), octave folding. Large random leaps are the main
   remaining source of "randomness" in the melody.
4. **Euclidean rhythms and swing.** E(k, 16) patterns from digits; swing for blues/jazz presets.
5. **Dissonance as a metric.** Compute sensory roughness of simultaneous notes (Plomp–Levelt /
   Sethares models) in the render harness, to flag harsh scale × legato × instrument combinations
   automatically.
6. **True loudness.** Add the K-weighting filter to make the harness's gated loudness true
   LUFS (ITU-R BS.1770-4), and add a true-peak check.
7. **More sampled instruments.** Candidates, each licence to be verified before vendoring:
   - VSCO 2 Community Edition (reported CC0)
   - University of Iowa Musical Instrument Samples (free use)
   - Salamander drum kit
   - Freesound packs (check each pack's licence)

   Keep them lazy-loaded with a total size budget per instrument.

8. **Mobile audio quirks.** On iOS, Web Audio is silenced by the ringer switch unless playback is
   unlocked through an HTML `<audio>` element. Test on real devices (E09).
9. **Just intonation drones.** Tune the drone fifth to an exact 3 : 2 ratio. This sounds smoother,
   and also makes a nice E04 lesson.
10. **Blind A/B voting in the app.** After E07, collect preferences (opt-in) to tune presets with
    real data.

## 5. How to iterate on a preset (workflow)

```bash
npm run audio:render                                  # all presets → apps/web/audio-renders/*.wav + report.md
PRESETS=lydian-dream SECONDS=40 START=1000 npm run audio:render
CALIBRATE=1 npm run audio:render                      # after changing an instrument → new trims
```

The run fails if a preset clips or drifts outside -14 ± 1.5 dB. Listen to the WAVs, then edit
`core/composition/presets.ts` or `audio/instruments.ts` and re-render.

## Sources

- ITU-R BS.1770-4, _Algorithms to measure audio programme loudness and true-peak audio level_.
- R. Plomp & W. J. M. Levelt, "Tonal consonance and critical bandwidth", JASA 38 (1965).
- W. A. Sethares, _Tuning, Timbre, Spectrum, Scale_ (2nd ed., Springer, 2005).
- J. Chowning, "The synthesis of complex audio spectra by means of frequency modulation",
  JAES 21 (1973) — FM bells and electric pianos.
- K. Karplus & A. Strong, "Digital synthesis of plucked-string and drum timbres", CMJ 7 (1983).
- G. Toussaint, "The Euclidean algorithm generates traditional musical rhythms" (2005).
- Tone.js documentation — https://tonejs.github.io/
- Salamander Grand Piano V3, Alexander Holm, CC BY 3.0.
