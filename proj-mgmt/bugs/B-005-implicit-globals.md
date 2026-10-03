---
id: B-005
title: 'Functions leak as implicit globals'
status: done
severity: low
found-in: legacy/simpleHtml/index.js:283-299
fixed-by: S01.3.1
---

# B-005 — Functions leak as implicit globals

## Observed

`updateNumberTrackerData`, `updateDataSection`, `getPlayingSoundInfoString`, `updateSoundSection` are assigned without `const`, creating `window` globals (and would throw in strict mode).

## Expected

Module-scoped code.

## Fix

ES modules + TypeScript strict mode.
