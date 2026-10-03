---
id: B-008
title: '`Math.random(0, 9)` arguments ignored; delay can be 0 ms'
status: done
severity: low
found-in: legacy/simpleHtml/index.js:184
fixed-by: S01.3.2
---

# B-008 — `Math.random(0, 9)` arguments ignored; delay can be 0 ms

## Observed

`Math.random` takes no arguments, so `getRandomTime` returns 0–10 (not 0–9) and floating error makes e.g. 7.000000000000001. A 0 ms wait can schedule two Tone attacks at the same audio time, which Tone rejects with an error.

## Expected

Behaviour preserved intentionally (0–420 ms in 42 ms steps) but computed exactly, and simultaneous attacks are nudged 1 ms apart.

## Fix

`legacyStepDelayMs()` rounds; `createToneNotePlayer` enforces strictly increasing start times.
