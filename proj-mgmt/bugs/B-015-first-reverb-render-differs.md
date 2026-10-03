---
id: B-015
title: "Tone's first reverb render in a page differs from later ones"
status: done
severity: low
found-in: apps/web/src/audio/soundChain.ts (Tone.Reverb), offline renders
fixed-by: S02.6.4 (workaround)
---

# B-015 — Tone's first reverb render in a page differs from later ones

## Observed

Rendering the same preset twice offline:

- presets with reverb: the _first_ render in a page differed from all later ones (up to 63% of
  spectrogram pixels, no time shift; loudness equal to 1e-7 dB)
- the Original preset (no reverb): renders were identical

## Expected

Bit-for-bit (or near) identical renders for the same digits and seed.

## Fix

Workaround in the audio lab:

- seed `Math.random` during renders (Tone fills reverb noise with it)
- do one warm-up render before any comparison

After that, renders across fresh browsers differ by ≤ 1 colour level on ≤ 0.04% of pixels. Root
cause inside Tone.js not investigated. The live app is unaffected: the reverb is generated once.

The piano now also waits for its sampler's own `onload` instead of `Tone.loaded()`. This was
checked while chasing this bug and was not the cause, but it's the more reliable signal.
