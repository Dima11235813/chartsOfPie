---
name: add-scale
description: Add a musical scale, mode or digit-to-note encoding to the core engine with tests. Use when asked to support a new scale (minor, Lydian, blues, raga, microtonal…) or a new way to map digits to pitches/rhythms.
---

# Adding a scale or encoding

1. Read `apps/web/src/core/music/scales.ts` and `legacyMapping.ts`. Do not edit the legacy mapping.
2. Add the `ScaleDefinition` (id, name, `intervals` in semitones from the root, ascending, starting
   at 0) to the scale catalogue. Modes: derive by rotating the parent scale's intervals.
3. Add a unit test asserting the exact notes from a known root, e.g. D Dorian from D4 →
   `D4 E4 F4 G4 A4 B4 C5`. Cross-check with the `music-theory-expert` agent for anything unusual.
4. If the encoding changes how 10 digits map onto the scale (not just which scale), implement it as
   a named strategy function `(digit, scaleNotes) => note` and test digits 0 and 9 at minimum.
5. Expose it in the UI selector, keeping the default (legacy C major pentatonic) unchanged.
6. Run `npm run check`; update the story in `proj-mgmt/`.
