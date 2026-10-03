---
id: B-006
title: 'Memory logger runs forever and is Chrome-only'
status: done
severity: low
found-in: legacy/simpleHtml/performance.js
fixed-by: S01.1.1
---

# B-006 — Memory logger runs forever and is Chrome-only

## Observed

`performance.memory` is a non-standard Chrome API (undefined in Firefox/Safari → TypeError every 5 s) and logs to the console forever.

## Expected

No production console noise; profiling via browser dev tools.

## Fix

Not ported.
