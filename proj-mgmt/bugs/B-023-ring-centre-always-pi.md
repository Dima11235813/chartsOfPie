---
id: B-023
title: 'Digit ring drew "π" in its centre for every number'
status: done
severity: low
found-in: apps/web/src/viz/render/ringRenderer.ts (found while generalising views, F05.5)
fixed-by: this commit
---

# B-023 — Digit ring centre always said π

## Observed

With φ, e, √2 or Fibonacci playing, the digit ring (live and poster) still showed "π" in the
middle: the symbol was a literal in the renderer, while every label around it used the number's
own symbol.

## Fix

`RendererOptions.symbol` (default π, so π's poster baseline is unchanged); the live view and the
poster pass the number's symbol, shrunk to fit a long one ("Fibonacci"). Pinned by the
`mod12-ring` poster baseline.
