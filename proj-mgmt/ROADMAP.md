# Roadmap — from "Charts of Pie" to "Math is Art"

**Vision.** A mobile-, tablet- and desktop-friendly full-stack application where anyone can
_discover_ how mathematics, music and visual art are the same thing seen from different angles:
listen to π in Lydian, watch the Fibonacci sequence become a sunflower, learn why an octave is a
2 : 1 ratio, then save and share what they made.

**Principles.** One step at a time · no regressions · pure, tested math core · accessible and
responsive by default · every item tracked in this folder.

## Phases

| Phase | Theme                                      | Epics                  | Status     |
| ----- | ------------------------------------------ | ---------------------- | ---------- |
| 0     | Modernise the original app, no regressions | E01, E06 (first slice) | **done**   |
| 1     | Music is math: scales, modes, rhythm       | E02                    | **next**   |
| 2     | Visualization gallery & playgrounds        | E03                    | backlog    |
| 3     | Beyond π: Fibonacci, φ, e, √2, primes      | E05                    | backlog    |
| 4     | Learn: guided lessons                      | E04                    | backlog    |
| 5     | Accounts: backend, authN/authZ             | E07                    | backlog    |
| 6     | Save, gallery & share                      | E08                    | backlog    |
| ∞     | Platform quality (PWA, a11y, perf, i18n)   | E09, E06               | continuous |

Phases 2–4 can interleave once E02's configuration model (F02.5) exists, because every
visualization, sequence and lesson plugs into the same `CompositionConfig`.

## Why this order

1. **E01 first** — a typed, tested, responsive base makes every later feature cheaper and lets us
   prove "no regressions" mechanically (`verify-parity` skill).
2. **E02 before E03** — the user's headline ask ("music is math") is about encodings; and the
   versioned config model it introduces is what saving/sharing (E08) persists later.
3. **Fibonacci (E05) after the gallery** — Fibonacci's best experiences are visual (spiral,
   phyllotaxis) and rhythmic (Pisano period), so it reuses E02 + E03 rather than building twice.
4. **Backend late (E07)** — until there is something worth saving, URL-encoded configs (F02.5)
   give free, account-less sharing. The backend then adds identity, persistence and permissions.

## Epics

- [E01 — Modernise the foundation](epics/E01-modernize-foundation.md) — done
- [E02 — Music theory engine: scales, modes & rhythm](epics/E02-music-theory-engine.md) — in progress
- [E03 — Visualization gallery & playgrounds](epics/E03-visualization-gallery.md)
- [E04 — Learn: guided lessons](epics/E04-learn-lessons.md)
- [E05 — More numbers: Fibonacci, φ, e, √2, primes](epics/E05-number-sources-fibonacci.md)
- [E06 — Developer experience & AI agents](epics/E06-dev-experience-ai-agents.md)
- [E07 — Backend platform: API, authN & authZ](epics/E07-backend-platform.md)
- [E08 — Save, gallery & share](epics/E08-save-and-share.md)
- [E09 — Platform quality: PWA, accessibility, performance](epics/E09-platform-quality.md)

## Research

- [R-001 — Encoding numbers as music](research/R-001-music-encoding.md)
- [R-002 — Visualization catalogue](research/R-002-visualization-catalog.md)
- [R-003 — Full-stack architecture, authN & authZ](research/R-003-platform-architecture.md)
- [R-004 — Fibonacci and other sequences](research/R-004-fibonacci-and-sequences.md)
- [R-005 — Making π sound pleasant](research/R-005-pleasant-sound-design.md)
