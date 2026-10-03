---
id: B-007
title: 'Duplicate DOM ids and unused containers'
status: done
severity: low
found-in: legacy/simpleHtml/index.html:20-29
fixed-by: S01.5.1
---

# B-007 — Duplicate DOM ids and unused containers

## Observed

Two elements share `id="0-num"`; ten `.num-tracker-container` divs are never used.

## Expected

Valid, meaningful markup.

## Fix

Replaced by the React UI.
