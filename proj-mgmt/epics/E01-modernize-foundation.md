---
id: E01
title: Modernise the foundation
status: done
phase: 0
---

# E01 — Modernise the foundation

## Outcome

The original 2019 "Charts of Pie" (vanilla JS, Chart.js 2 and an unpinned Tone.js from CDNs, one
2 MB script) runs as a typed, tested, responsive React app with **the same musical and visual
behaviour**, plus the quality gates needed to grow it safely.

## Features

- [x] [F01.1 — Tooling & project structure](../features/F01.1-tooling-and-structure.md)
- [x] [F01.2 — Verified digit data](../features/F01.2-verified-digit-data.md)
- [x] [F01.3 — Playback engine with legacy parity](../features/F01.3-playback-engine-parity.md)
- [x] [F01.4 — Chart parity on Chart.js 4](../features/F01.4-chart-parity.md)
- [x] [F01.5 — Responsive, accessible UI shell](../features/F01.5-responsive-ui-shell.md)
- [x] [F01.6 — Quality gates: tests & CI](../features/F01.6-quality-gates.md)

## Legacy behaviour that is preserved (see `verify-parity` skill)

C major pentatonic from C4 · digit → duration table · 0–420 ms random wait in 42 ms steps ·
per-digit counts in a rainbow bar chart whose axis spans min..max · 594 ms animation · redraw
throttle in the first 100 digits · Play/Pause · all seven chart types.

## Intentional changes

Fixed bugs B-001…B-012 (no autoplay before a click, corrected digits, no double-speed after
resume…). Added: Step, Reset, Mute, chart-style selector (the legacy UI for it was commented out),
live digit stream, per-digit share table.
