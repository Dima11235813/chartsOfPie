# `core/` — framework-free math & music engine

Everything in this folder is **pure TypeScript with no DOM, React, Chart.js or Tone.js imports**.
That keeps it unit-testable in isolation and lets us lift it into a shared package
(`packages/core`) once the backend needs to validate saved configurations (see
`proj-mgmt/epics/E07-backend-platform.md`).

| Module    | Responsibility                                                                           |
| --------- | ---------------------------------------------------------------------------------------- |
| `digits/` | Digit sources (π today; φ, e, √2, Fibonacci later), parsing, running stats               |
| `series/` | Number series and readings (R-011), `SourceConfig` (`s=` links, piece `source`), loaders |
| `music/`  | Note names ↔ MIDI, interval-based scales, digit → note/duration mappings                 |
| `engine/` | Playback engine: steps through a digit source on an injectable scheduler                 |
