---
name: add-visualization
description: Add a new visualization mode (digit ring, π walk, sunflower, music clock, etc.) that reacts to the playback engine. Use when implementing anything from proj-mgmt/research/R-006-artistic-visualizations.md or R-002.
---

# Adding a visualization

1. Read `proj-mgmt/research/R-006-artistic-visualizations.md` (rule, music coupling, renderer,
   effort) and the matching feature in `proj-mgmt/epics/E03-visualization-gallery.md`.
2. Put pure geometry/colour maths in `apps/web/src/viz/<name>.ts` with unit tests (no DOM), e.g.
   walk positions, golden-angle coordinates, ring arcs.
3. **Growing digit artworks** (ring, walk, sunflower, mosaic…): write a React-free renderer in
   `apps/web/src/viz/render/<name>Renderer.ts` implementing `DigitRenderer` (`draw(from, to,
digitAt)` onto a layer, `compose(ctx, overlay)`), and register it in `viz/render/registry.ts`
   with live and poster variants. `DigitArtView` then shows it, and the poster panel and poster
   snapshot test pick it up automatically. Other views (e.g. note-driven, like the music clock),
   go in `apps/web/src/components/viz/<Name>View.tsx`, following `MusicClockView` /
   `SpectrogramView`:
   - Draw on a canvas via `useCanvas(onCanvas)`, so the video recorder and "Save image" capture it
     automatically.
   - Read playback data from props: `PerformanceLog` (notes, chords; `subscribe()` for changes),
     `counts`/`recent`, or the analyser (`player.getAnalyser()`). Never control playback.
   - Batch drawing per `requestAnimationFrame`, draw incrementally for growing pictures, and
     respect `prefersReducedMotion()`.
   - Give it `role="img"` and an `aria-label` that summarises what is shown.
4. Register it in `apps/web/src/components/views.ts` and render it in `App.tsx`. Keep "Digit chart"
   as the default.
5. Extend `apps/web/e2e/smoke.spec.ts`: select the view and assert it draws (non-empty pixels) on
   all three viewports. Poster kinds are snapshot-tested by `e2e/poster-snapshots.spec.ts`. Add
   the new kind to its expected list and create its baseline with `--update-snapshots`, after
   looking at the image.
   **Every option the view has** (toggles, selects, modes, animations) gets a case in
   `e2e/view-toggles.spec.ts`: switch it on and back off **while paused** and assert the canvas
   still has drawn pixels (`inkedPixels`). Never assert only on labels — B-018 shipped because a
   test checked the column label while the canvas was blank. If a view swaps its canvas element,
   `useCanvas` must see the new element and the redraw key must change.
6. **Life board** (CLAUDE.md rule 10, [R-013](../../../proj-mgmt/research/R-013-life-from-any-grid.md)):
   decide how the view feeds Conway's Game of Life and fill its row in R-013's table:
   - its board: square (cols × rows, wrap or not), graph (neighbour lists) or line (1-D rules);
   - what is alive at the start, from the shared seed policies (`linked`, `runs`, `threshold`,
     `visited`, `digitSet`, `shape`), respecting what the view is showing (its filters);
   - where each cell is drawn (`cellAt`), so Life plays in place on the view's geometry;
   - optional `noteOf(cell)` for sound;
     or write in the feature file why the raster fallback is enough. Add an e2e case: launch Life
     while paused, step a generation, go back, and the view is still drawn.
7. Run `npm run check && npm run test:e2e`, look at the screenshots, then update the story in
   `proj-mgmt/`.
