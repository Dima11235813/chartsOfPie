---
id: B-016
title: 'Canvas views blank when opened while paused'
status: done
severity: medium
found-in: apps/web/src/components/viz/useCanvas.ts
fixed-by: F03.1
---

# B-016 — Canvas views blank when opened while paused

## Observed

Opening the Digit ring or Sunflower view while paused showed an empty canvas. During playback,
every new digit redrew it, so the bug was hidden (and e2e, which plays, passed).

## Cause

ResizeObserver reports the initial size too. `useCanvas` then re-assigned `canvas.width` to the same
value, which clears the canvas, after the view had already drawn.

## Fix

Only assign `width`/`height` and re-render when the backing size really changes; always report the
first measurement. Found while reviewing screenshots of paused views.
