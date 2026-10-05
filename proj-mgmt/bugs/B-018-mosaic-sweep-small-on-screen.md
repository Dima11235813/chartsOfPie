---
id: B-018
title: Zoomed-out mosaic sweep fills only a small rectangle of the screen
status: done
severity: medium
found-in: apps/web/src/viz/mosaicShapes.ts (sweepFrame), apps/web/src/styles.css (.viz-layer-with-bar)
fixed-by: F03.4 follow-up (this commit)
---

# B-018 — Zoomed-out mosaic sweep fills only a small rectangle of the screen

## Observed

Owner report (phone, portrait, full screen, 51 columns, Groups of 4+, Sweep): the mosaic was a
small rectangle at the top and most of the screen stayed empty.

`sweepFrame` used one cell size for the whole sweep (the widest width fills the screen width) and
one window (as many digits as fill the screen at the narrowest width). At any width _c_ the grid
covered (c / high) of the width and (low / c) of the height, so about low / high ≈ ⅓ of the frame,
at every width. Separately, the canvas height reserved a fixed 116 px for the control bar, which
wraps onto three rows on a phone once Sweep is on, so the newest rows could hide under it.

## Fix

- Each sweep width gets its own frame: the columns span the width (cells 2.5–30 px) and as many
  recent digits as fill the height are shown (capped at 12,000 per frame). Dots still glide to
  their new place; the dot size eases between widths; digits leaving the window slide out of the
  top and fade instead of vanishing, and older digits fade in as the grid widens.
- The mosaic view is a flex column: the canvas takes exactly the space above the control bar,
  however many rows the bar wraps onto.
- Unit test for the per-width frame; e2e check that the canvas ends above the control bar.
