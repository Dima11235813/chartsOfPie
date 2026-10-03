---
id: B-011
title: "Pentatonic generator only correct for C (“Doesn't Work D#”)"
status: done
severity: medium
found-in: legacy/simpleHtml/index.js:75-168
fixed-by: S01.3.2
---

# B-011 — Pentatonic generator only correct for C (“Doesn't Work D#”)

## Observed

`generateNumberToNoteLookup` hard-codes step patterns by index and breaks for other roots (the TODO notes D# fails), blocking any other key.

## Expected

Any root and any scale.

## Fix

Replaced by interval-based `buildScaleNotes(root, octave, scale, count)`; output for C is identical to the legacy table (tested).
