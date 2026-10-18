---
id: B-026
title: Mosaic columns e2e fails when Fit already shows 7 columns
status: done
severity: low
found-in: apps/web/e2e/smoke.spec.ts (the neighbour mosaic narrows and widens)
fixed-by: PR #36
---

# B-026 — Mosaic columns e2e fails when Fit already shows 7 columns

## Observed

On CI (desktop, both attempts) and locally on master, "the neighbour mosaic narrows and widens"
failed: after `fill('7')` on the Columns slider, Fit was still checked.

## Expected

Choosing a width turns Fit off.

## Steps to reproduce

Play the mosaic and pause after only a digit or two: Fit lays the grid out in 7 columns at the
desktop viewport, so the slider already reads 7. Filling the same value fires no change event,
so nothing turns Fit off. How many digits play before Pause decides the Fit width, so the test
depended on timing. The app behaves correctly; only the test was fragile.

## Fix

The test fills 6, then 7, so the second fill is always a change.
