---
id: B-024
title: 'Mosaic sweep ignored Fit: narrow widths drew a small grid in the middle of the frame'
status: done
severity: medium
found-in: apps/web/src/components/viz/MosaicSweep.tsx (found by the owner, 2026-10-12)
fixed-by: this commit
---

# B-024 — The sweep did not fit the width

## Observed

Owner: "when the Fit checkbox is toggled the illustration should be scaled to fit the width of
the viewport". With Fit and Sweep on, the sweeping mosaic kept one dot size for its whole range,
sized so the widest step fits, so at narrower steps the grid covered only 44–49 % of the frame's
width (measured on desktop, tablet and mobile). The bottom row could also be cut off, because
the window of recent digits did not start on a row boundary. Fit only chose the sweep's starting
width; without the sweep, Fit already filled the width (F03.4 "Fills the stage").

## Fix

`sweepFrame` takes the current column count in Fit mode: cell = width ÷ columns (at most a third
of the height) and a window of whole rows that fills the height. `MosaicSweep` eases the dot size
along with the positions, so dots grow and shrink as they glide. Fit off keeps the fixed-size
sweep (the grid narrowing and widening is the point there).

## Tests

e2e `view-toggles` "mosaic sweep with Fit fills the width…" failed first (span 0.44–0.49), then
passes on all three viewports; unit test for `sweepFrame` in Fit mode.
