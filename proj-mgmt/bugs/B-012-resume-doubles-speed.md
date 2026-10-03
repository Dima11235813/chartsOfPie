---
id: B-012
title: 'Pause then quick resume can double the tempo'
status: done
severity: medium
found-in: legacy/simpleHtml/index.js:314-355
fixed-by: S01.3.1
---

# B-012 — Pause then quick resume can double the tempo

## Observed

Pause only sets a flag; the pending `setTimeout` is not cancelled. Resuming before it fires starts a second chain, so two loops run in parallel.

## Expected

Exactly one loop at any time.

## Fix

`PlaybackEngine.pause()` cancels the pending tick (unit-tested).
