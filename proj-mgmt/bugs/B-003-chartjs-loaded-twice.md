---
id: B-003
title: 'Chart.js loaded twice from CDN'
status: done
severity: low
found-in: legacy/simpleHtml/index.html:10-11
fixed-by: S01.1.1
---

# B-003 — Chart.js loaded twice from CDN

## Observed

Both `Chart.bundle.js` and `Chart.js` 2.8.0 are loaded; the second overwrites the first.

## Expected

One copy, bundled and tree-shaken.

## Fix

Chart.js 4 installed from npm; only used controllers are registered.
