---
id: B-017
title: My pieces "Name + Save" row overflows at 360 px
status: done
severity: low
found-in: apps/web/src/components/PiecesPanel.tsx (.field grid)
fixed-by: S10.4 follow-up (this commit)
---

# B-017 — My pieces "Name + Save" row overflows at 360 px

## Observed

At 360 px wide the page scrolled sideways by 3 px: the name input + Save row kept the input's
natural width (CLAUDE.md rule 6). The e2e "mobile" project is a Pixel 7 (412 px), so it passed.

## Fix

`.field` grid columns are `minmax(0, 1fr)` so rows can shrink. New e2e test checks there is no
horizontal scroll at exactly 360 px with the Customize and MIDI panels open, on several views.
