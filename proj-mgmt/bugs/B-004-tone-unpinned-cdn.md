---
id: B-004
title: 'Tone.js loaded unpinned from unpkg'
status: done
severity: medium
found-in: legacy/simpleHtml/index.html:56
fixed-by: S01.1.1
---

# B-004 — Tone.js loaded unpinned from unpkg

## Observed

`https://unpkg.com/tone` always resolves to the latest release, so any breaking change in a new major silently breaks the app. The code also uses `toMaster()`, which is deprecated in favour of `toDestination()`.

## Expected

A locked, compatible version.

## Fix

Tone 15 from npm via the lockfile, using `toDestination()`.
