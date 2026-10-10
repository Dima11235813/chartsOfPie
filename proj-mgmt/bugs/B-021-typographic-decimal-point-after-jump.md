---
id: B-021
title: 'Typographic view draws a decimal point after a jump, and for whole-number sequences'
status: done
severity: low
found-in: apps/web/src/viz/render/typeRenderer.ts (since PR #24)
fixed-by: this commit
---

# B-021 — Typographic decimal point in the wrong place

**What happened:** the typographic renderer always drew "." after cell 0. Since Where in π (#24)
a performance can start part-way in, so after jumping to the Feynman point a stray point
appeared after the first 9 shown. Fibonacci numbers (#29) are whole numbers, yet "0." appeared.

**Fix:** `decimalPointCell(kind, offset)` (unit-tested): the point follows cell 0 only for a
constant played from its start; the renderer takes `decimalPoint` (default 0, so posters and
their snapshots are unchanged) and `null` disables it.

**Prevention:** the test pins the three cases (π from the start, π after a jump, Fibonacci).
