---
id: B-001
title: 'Inline π digits corrupted near the end'
status: done
severity: medium
found-in: legacy/simpleHtml/index.js:5
fixed-by: S01.2.1
---

# B-001 — Inline π digits corrupted near the end

## Observed

The 1,000,004-character digit string in `index.js` has three extra `9`s inserted at position 999,638 (`…4730**999**94534366…`), so every digit after that point is shifted. `pie_mill.js` is correct.

## Expected

Exactly the digits of π (verified against an independent Chudnovsky computation).

## Fix

The bundled data is regenerated, sha256-pinned, validated at load time, and tests document the legacy corruption.
