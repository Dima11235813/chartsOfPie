---
id: B-013
title: 'Indigo digits 1 and 8 have low contrast on the dark background'
status: backlog
severity: low
found-in: apps/web/src/components/chartConfig.ts
fixed-by: F09.3
---

# B-013 — Indigo digits 1 and 8 have low contrast on the dark background

## Observed

The legacy palette's `rgb(75, 0, 130)` (digits 1 and 8) and `rgb(0, 0, 255)` (2 and 7) are hard to read as text in the digit stream; the palette also repeats colours (1 = 8, 2 = 7, 0 = 9), so digits are not distinguishable by colour alone.

## Expected

Every digit distinguishable and ≥ 3:1 contrast for graphical objects.

## Fix

Kept for parity in this pass; add an alternative palette (F09.3) and consider outlining dark digits.
