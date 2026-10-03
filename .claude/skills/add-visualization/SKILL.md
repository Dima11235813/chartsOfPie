---
name: add-visualization
description: Add a new visualization mode (spiral, chord diagram, digit grid, walk, etc.) that reacts to the playback engine. Use when implementing anything from proj-mgmt/research/R-002-visualization-catalog.md.
---

# Adding a visualization

1. Read `proj-mgmt/research/R-002-visualization-catalog.md` for the design and data needs.
2. Put pure geometry/colour math in `apps/web/src/core/viz/` (unit-tested, no DOM), and the
   renderer in `apps/web/src/components/viz/<Name>.tsx`.
3. Renderer contract: props `{ counts, total, recent, lastStep, reducedMotion }` (extend the
   `usePiPlayback` state rather than reading the engine directly). Batch drawing per
   `requestAnimationFrame`.
4. Register it in the visualization selector; keep the bar chart as default.
5. Accessibility: `role="img"` + `aria-label` summary; honour `prefers-reduced-motion`.
6. Extend `apps/web/e2e/smoke.spec.ts` to select it on all three viewports; run
   `npm run check && npm run test:e2e` and inspect the screenshots.
