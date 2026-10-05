---
id: B-019
title: Sound distorts when volume, reverb, echo or drone is added to Original
status: done
severity: high
found-in: apps/web/src/audio/soundChain.ts (master ceiling)
fixed-by: this commit
---

# B-019 — Sound distorts when volume, reverb, echo or drone is added to Original

## Observed (owner)

"There has been distortion with the sound" while playing on a phone (deployed GitHub Pages site).

## Investigation

Three suspects were measured (Chromium 141, Pixel 7 emulation):

1. **Main-thread jank from rendering.** With 4x CPU throttling, Neighbour mosaic and Digit ring
   keep the main thread ~12 % busy while playing, with no long tasks after the first second
   (startup only: Tone import, reverb impulse). Not the cause; it also cannot glitch native
   Web Audio nodes directly.
2. **Audio-thread overload (too many voices/nodes).** Measured with `AudioContext.playoutStats`
   (`--enable-blink-features=AudioContextPlayoutStats`): 0 ms of fallback (dropout) frames over
   12–15 s for Original, Lydian dream, Blues pluck, Acoustic folk, Pentatonic rock and Whole-tone
   mist — even with the browser pinned to one core shared with two busy loops. The meter does
   catch overload (2,000 oscillator+filter pairs → 300 ms of dropouts), and our heaviest preset is
   far below that. PolySynth voices are reused and idle ones disposed by Tone's own GC.
3. **Clipping.** Original (compression off, the default) peaks at -0.1 dBFS on its own, and with
   compression off the only protection was `Tone.Limiter(-1)` (which barely acts: Chrome's
   compressor adds automatic make-up gain and Tone's limiter has a 30 dB knee) followed by a
   WaveShaper with a linear curve over ±1 — which **hard-clips** anything above full scale.
   Offline renders (20 s from digit 0, seed 1):

   | Original with…    | Hard-clipped samples |
   | ----------------- | -------------------: |
   | nothing (default) |              0.000 % |
   | +3 dB             |              0.525 % |
   | +6 dB             |              2.040 % |
   | reverb 1, echo 1  |              0.079 % |
   | drone             |              0.001 % |

   Clavinet funk with compression off also clipped (0.057 %). Every other preset/variant tried,
   including all presets at +6 dB with full reverb and echo, stayed clean thanks to the soft clip.

The last session is restored on load, so a volume or effect change made once keeps distorting.

## Fix

`audio/ceiling.ts`: the ceiling WaveShaper now sees the signal scaled by 1/4 and its curves cover
±4 (+12 dB of overload), so nothing is clamped at ±1 any more.

- Compression on: the same soft clip as before (linear to 0.8, never above 0.98).
- Compression off at the bare level (volume ≤ 0 dB, no reverb, echo or drone): exactly
  transparent, so Original's 2019 sound is unchanged (its spectrogram baseline still matches).
- Compression off with anything added: linear to 0.85, rounded off below 0.97 (tanh) instead of
  hard-clipping. A knee below full scale for bare Original was tried first; it rounded the
  triangle wave's peaks and changed Original's spectrogram, so it was dropped.

Also: `dispose()` now disposes the glue compressor, make-up gain and ceiling it used to leak.

## Prevention

- `e2e/audio-headroom.spec.ts` renders Original at +3/+6 dB, with full reverb and echo, with a
  drone, and Clavinet funk without compression and asserts no hard-clipped samples and a peak
  below 0 dBFS. It failed before the fix (11,300 clipped samples at +6 dB in 8 s) and passes now.
- `audio/ceiling.test.ts` pins the curves (identity below the knee, bounded, monotonic) and when
  each one is used.
