---
id: B-019
title: Neighbour mosaic opens filtered to groups, hiding most digits
status: done
severity: medium
found-in: apps/web/src/components/viz/DigitArtView.tsx, hooks/useLinkedState.ts (since PR #15)
fixed-by: this commit
---

# B-019 — Neighbour mosaic opens filtered to groups, hiding most digits

## Observed (owner)

On a phone the mosaic opened with **Show: Groups of 3+**, so most digits were hidden. The owner
wants every digit shown by default, as the original feature did, with grouping opt-in.

## Cause

The schema default was already "every digit" (`minGroup: 0`), but a plain visit restores the last
session (owner decision D3, R-007), filters included. Once someone had picked a group size, every
later visit opened filtered, and the only way back was a "Show" dropdown whose first option
("Every digit") did not read as turning a filter off.

## Fix

- The filter is now an opt-in **Groups only** checkbox; a **Group size** picker (2+ … 5+) appears only
  while it is on, and turning it back on returns to the size last picked.
- A remembered session opens with the groups filter off; a share link still restores it (the
  link names exactly what to show). No schema change: `minGroup` keeps its meaning and default.

## Prevention

- `hooks/useLinkedState.test.ts`: last session → `minGroup` 0; share link → kept. Fails without
  the fix.
- `e2e/view-toggles.spec.ts`: Groups only starts unchecked, is switched on (3+) and back off while
  paused, and the canvas must be drawn like before.
