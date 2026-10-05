# Charts of Pie — guide for AI agents

**Vision:** a "Math is Art" platform where people discover how mathematics, music and visual art
connect — starting with the digits of π, then scales/modes, Fibonacci and other sequences, and
eventually saved/shared compositions on a full-stack, mobile/tablet/desktop app.
The long-term plan lives in [`proj-mgmt/ROADMAP.md`](proj-mgmt/ROADMAP.md).

## Repository map

| Path                                 | What it is                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/`                          | React 19 + TypeScript + Vite app (Chart.js 4, Tone.js 15)                                                                                             |
| `apps/web/src/core/`                 | Framework-free math/music engine — **no DOM/React/Tone/Chart imports**                                                                                |
| `apps/web/src/audio/`                | Tone.js: instruments, sound chain, `NotePlayer` (analyser + recording taps), offline render & analysis                                                |
| `apps/web/src/components/`, `hooks/` | UI                                                                                                                                                    |
| `apps/web/public/data/`              | Verified digit data (`pi-1m.txt`, sha256 pinned in tests)                                                                                             |
| `apps/api/`                          | Cloudflare Workers + D1 API (Hono): GitHub sign-in, sessions, pieces + `policy.ts` authZ; tests on `node:sqlite`                                      |
| `apps/web/e2e/`                      | Playwright smoke tests on desktop, tablet and mobile viewports                                                                                        |
| `apps/web/src/core/composition/`     | `CompositionConfig` (zod), presets, `Arranger`, `PerformanceLog` (what was played, chords)                                                            |
| `apps/web/src/core/piece/`           | Saved-piece + `VisualConfig` schemas, share links, migrations, golden fixtures, schema snapshots                                                      |
| `apps/web/src/core/midi/`            | Dependency-free MIDI writer and performance → MIDI export                                                                                             |
| `apps/web/src/viz/`                  | Pure geometry/colour maths for views (spectrogram, staff), unit-tested                                                                                |
| `apps/web/src/viz/render/`           | React-free renderers + registry shared by live art views and posters (`posters.ts`)                                                                   |
| `apps/web/src/components/viz/`       | Canvas views: sheet music, spectrogram, `DigitArtView` (ring/walk/sunflower/mosaic/Hilbert/type), music clock, harmonograph, oscilloscope, string art |
| `apps/web/src/media/`                | `SessionRecorder` (video + audio via MediaRecorder), download helpers                                                                                 |
| `apps/web/src/lab/`, `lab.html`      | Lab page: deterministic offline renders (audio spectrograms, posters) for tests and the harness                                                       |
| `apps/web/e2e/__snapshots__/`        | Baselines: spectrogram per sound preset, poster per artwork (regression tests)                                                                        |
| `apps/web/scripts/`                  | Listening harness (`render-presets.spec.ts`, `npm run audio:render`)                                                                                  |
| `legacy/simpleHtml/`                 | The original 2019 app, kept read-only as the behavioural reference                                                                                    |
| `proj-mgmt/`                         | Epics, features, stories, tasks, bugs, research — **keep it up to date**                                                                              |
| `docs/`                              | Inspiration images and notes                                                                                                                          |

## Commands (run from the repo root)

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # format:check + lint + typecheck + unit tests + build — run before every push
npm run test:e2e     # Playwright (builds and serves the app itself)
npm run audio:render # offline-render every preset → apps/web/audio-renders/*.wav, spectrograms, report.md
npm run perf         # main-thread load / long tasks per view at ~13 digits/s → apps/web/perf-report/ (R-010)
npm run test:e2e -- audio-snapshots --update-snapshots   # after an INTENDED sound change only
npm run test:e2e -- poster-snapshots --update-snapshots  # after an INTENDED artwork change only
```

In the cloud container, Playwright uses the pre-installed Chromium; never run `playwright install` there.

## Rules

1. **No regressions to the legacy behaviour** without a recorded decision. The legacy encoding
   (C major pentatonic from C4, digit → duration table, 0–420 ms random wait in 42 ms steps,
   min..max-scaled bar chart) lives in `core/music/legacyMapping.ts` and the **“Original (2019)”
   preset**, both pinned by tests. New sounds are new presets — never edit the Original preset,
   the `classic` instrument or their 0 dB trim.
2. **Sound changes are measured.** After touching instruments, effects or presets, run
   `npm run audio:render` (and `CALIBRATE=1 …` for instruments): no clipping, presets within
   -14 ± 1.5 dB gated loudness. The e2e audio snapshot test fails on any audible change to a preset;
   update its baselines only for intended changes, and look at the new spectrogram images first.
   Bump `version` + add a migration if `CompositionConfig` changes shape (configs live in share links).
3. `core/` stays pure and deterministic: inject randomness and scheduling (see `PlaybackEngine`).
4. Every musical fact (scale intervals, mode names) needs a unit test citing the expected notes.
5. Audio must only start from a user gesture (`NotePlayer.start()` inside a click handler).
6. Layouts must work at 360 px wide with no horizontal scroll, 44 px touch targets, and visible focus.
7. Track work in `proj-mgmt/` (see the `proj-mgmt` skill): update the story/task status in the same
   commit as the code, and log any bug you find as `proj-mgmt/bugs/B-xxx-*.md`.
8. **Saved data stays readable forever** (contract: `proj-mgmt/research/R-007`). Share links and
   saved pieces use the versioned schemas in `core/composition/config.ts` and `core/piece/`. A new
   field needs a default; any other shape change bumps that schema's version and adds a migration.
   Persisted ids (views, palettes, scales, instruments, presets) are never renamed. Never delete or
   edit the golden fixtures in `core/piece/fixtures/`; the schema snapshots in
   `core/piece/__schemas__/` change only together with a default, or a version bump with a migration.
9. **Every control is regression-tested both ways.** A new view option, toggle or mode needs an e2e
   case in `e2e/view-toggles.spec.ts` that switches it on **and back off while paused** and asserts
   the canvas still has drawn pixels (not just a label). Bugs found by the owner get a failing test
   first, then the fix (B-018).

## Agents, skills and MCP

- Subagents in `.claude/agents/`: `music-theory-expert`, `visualization-engineer`,
  `regression-guardian`, `product-steward`.
- Skills in `.claude/skills/`: `proj-mgmt`, `add-scale`, `add-visualization`, `verify-parity`.
- `.mcp.json` registers the [Serena](https://github.com/oraios/serena) MCP server for semantic,
  symbol-level code navigation and editing. Requires [`uv`](https://docs.astral.sh/uv/)
  (`uvx` on PATH). Prefer Serena's symbol tools (`find_symbol`, `find_referencing_symbols`,
  `replace_symbol_body`) for refactors that cross files. Serena generates `.serena/project.yml` on
  first activation — commit it; its cache/logs are git-ignored.
