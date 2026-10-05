---
id: B-018
title: Neighbour mosaic blank after turning Sweep off
status: done
severity: high
found-in: apps/web/src/components/viz/DigitArtView.tsx, useCanvas.ts (since PR #15)
fixed-by: this commit
---

# B-018 — Neighbour mosaic blank after turning Sweep off

## Observed (owner)

Turning **Sweep** off left the mosaic empty; it only came back when new digits played.

## Cause

The seamless sweep (PR #15) draws on its own canvas. Turning it off mounts a fresh static canvas,
but:

1. `useCanvas` measured and observed only the **first** canvas element it saw (effect with `[]`
   deps), so the new element kept the default 300 × 150 backing store;
2. the static mosaic only rebuilds when its redraw key changes (size, colours, width, filters) —
   none had, so nothing was drawn until the next digit.

The e2e test for the sweep only checked the column-count **label** after turning it off, not
the pixels — so it passed with a blank canvas.

## Fix

- `useCanvas` tracks the attached element (stable ref callback + generation counter) and
  measures/observes every new one.
- The sweep state is part of the mosaic's redraw key.
- Found by the full e2e run while fixing it: once the canvas ref callback was made stable, the
  old view's unmount effect (which reported "no canvas") ran _after_ the new view registered its
  canvas, so "Save image" had nothing to save. Removed that effect; React already detaches refs
  before attaching the next view's. The exports e2e test covers it.

## Prevention

- New `e2e/view-toggles.spec.ts`: every view option (mosaic sweep, groups, shape isolation,
  Fit, width, leaving/returning; clock fifths; harmonograph pure; fretboard tuning; every chart
  style) is switched on and back off **while paused** and the canvas must still have drawn
  pixels. Verified: with the fix reverted, the mosaic case fails; with it, all pass.
- CLAUDE.md rule 9, the `add-visualization` skill and the `regression-guardian` agent now
  require this both-ways, pixels-not-labels check for every control.
