---
name: verify-parity
description: Checklist proving the modern app still behaves like the legacy π app. Use before committing changes to playback, mapping, digit data, timing or chart code.
---

# Legacy parity checklist

Reference implementation: `legacy/simpleHtml/index.js` (open `legacy/simpleHtml/index.html` in a
browser to compare by ear and eye). Each row is pinned by a test — run `npm test` and confirm:

| Behaviour                                                                | Pinned by                             |
| ------------------------------------------------------------------------ | ------------------------------------- |
| Digits start at the leading 3 and follow the verified 1M digits of π     | `core/digits/digits.test.ts`          |
| Digit → note: C4 D4 E4 G4 A4 C5 D5 E5 G5 A5                              | `core/music/music.test.ts`            |
| Digit → duration: 16n 1n 1t 2n 2t 4n 4t 8n 8t 16t                        | `core/music/music.test.ts`            |
| Wait between digits: random 0–10 × 42 ms                                 | `core/music/music.test.ts`            |
| Count per digit; value axis spans min..max count; 594 ms animation       | `components/chartConfig.test.ts`      |
| Redraw throttle: even counts only during the first 100 digits            | `components/chartConfig.test.ts`      |
| Play/Pause toggles; pause stops new notes                                | `App.test.tsx`, `e2e/smoke.spec.ts`   |
| Chart types: bar, horizontal bar, line, polar area, doughnut, pie, radar | `components/chartConfig.test.ts`, e2e |

Intentional differences (recorded in `proj-mgmt/bugs/`): no autoplay on load (B-002), corrupted
digits fixed (B-001), pause/resume no longer doubles speed (B-012).
