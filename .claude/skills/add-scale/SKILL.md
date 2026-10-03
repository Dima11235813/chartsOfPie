---
name: add-scale
description: Add a musical scale, mode or digit-to-note encoding to the core engine with tests. Use when asked to support a new scale (minor, Lydian, blues, raga, microtonal…) or a new way to map digits to pitches/rhythms.
---

# Adding a scale or encoding

1. Read `apps/web/src/core/music/scaleCatalogue.ts`, `mapping.ts` and `legacyMapping.ts`. Do not
   edit the legacy mapping.
2. Add a `CatalogueScale` (stable id, name, `intervals` in semitones from the root, ascending,
   starting at 0, family, one-line character) to `SCALE_CATALOGUE`. Modes: derive with
   `rotateIntervals`. Ids are persisted in share links — never rename one.
3. Add a unit test asserting the exact notes from a known root, e.g. D Dorian from D4 →
   `D4 E4 F4 G4 A4 B4 C5`. Cross-check with the `music-theory-expert` agent for anything unusual.
4. If the encoding changes how 10 digits map onto the scale (not just which scale), add a strategy
   to `MAPPING_STRATEGIES` / `digitToMidi` and test digits 0 and 9 at minimum.
5. The UI picks it up from the catalogue automatically. Consider a preset in
   `core/composition/presets.ts` that showcases it, then `npm run audio:render` to level it.
6. Run `npm run check`; update the story in `proj-mgmt/`.
