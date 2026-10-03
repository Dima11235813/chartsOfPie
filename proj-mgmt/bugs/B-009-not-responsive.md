---
id: B-009
title: 'Layout not usable on phones or tablets'
status: done
severity: medium
found-in: legacy/simpleHtml/index.css
fixed-by: S01.5.1
---

# B-009 — Layout not usable on phones or tablets

## Observed

Fixed 93vh/90vw chart, 97vw data strip with overflowing text, tiny grey button.

## Expected

Works from 360 px wide with touch-sized controls.

## Fix

New responsive layout, verified by e2e on three viewports.
