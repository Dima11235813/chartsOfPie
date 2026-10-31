---
id: R-013
title: 'Life from any grid: one abstraction, every visualization'
status: done
feeds: [E03, E04]
---

# R-013 — Life from any grid: one abstraction, every visualization

## Question

The neighbour mosaic can now launch Conway's Game of Life from its paused picture (F03.4,
PR #38). The owner wants the same for **any view that has a grid**, and wants it planned so that
**every visualization we build from now on** says how it feeds Life. What is the abstraction, how
does each existing view fit it, and in what order do we build it?

## What we have (2026-10-31)

- `viz/life.ts`: square grid, wrapping edges (torus), Moore neighbourhood (8), rule B3/S23, colour
  Life (newborn = parents' majority colour, else the middle digit), settling detection
  (`LifeHistory`). The seed function is **mosaic-specific** (`lifeSeed`: linked groups, Show
  filter, census shape).
- `LifeView`: draws the board on the mosaic's geometry, own clock on the frame budget, Run/Next/
  Speed/Restart/Mosaic. Entered from the mosaic's bar; one tap pauses the digits and launches.
- **Cost** of today's step (measured, Node, one core): 100 × 60 cells 0.6 ms per generation,
  256 × 256 3.1 ms, **1024 × 1024 64 ms** — fine on the main thread up to ~64k cells; a full
  Hilbert carpet needs a faster step and a worker (R-010: stalls over ~140 ms are audible).

## The abstraction

Split today's code into four parts. A view supplies a **board**; everything else is shared.

```ts
/** What a view hands to Life: where the cells are, who neighbours whom, and who starts alive. */
interface LifeBoard {
  id: string // e.g. 'mosaic', 'fretboard' (persisted later, like view ids: never renamed)
  topology: Topology // who is next to whom
  rule: LifeRule // default for this topology (user can change later)
  seed: LifeGrid // −1 dead, else a colour index (the digit / symbol)
  /** Where to draw cell i, in the view's own canvas pixels, and how big. */
  cellAt(i: number): { x: number; y: number; r: number }
  /** What "alive" meant for this seed, for the status line and the lesson text. */
  describeSeed: string
  /** Optional: the note a cell plays when it is born (sound, S03.21.9). */
  noteOf?(i: number): string | null
}

type Topology =
  | { kind: 'square'; cols: number; rows: number; wrap: boolean } // fast path (typed arrays)
  | { kind: 'graph'; neighbours: Int32Array; offsets: Int32Array } // any lattice (CSR lists)
  | { kind: 'line'; cells: number; wrap: boolean } // 1-D automata

type LifeRule =
  | { kind: 'life-like'; birth: number[]; survive: number[] } // B3/S23 Conway, B36/S23 HighLife…
  | { kind: 'elementary'; rule: number } // Wolfram rules 30, 90, 110 for lines
```

1. **Engine** (`viz/life/engine.ts`, pure): `step(board grid, topology, rule)` for all three
   topologies. Square keeps a fast path (neighbour counts in one pass over typed arrays; the
   speed-up over today's per-cell loop is to be measured, target 1024² under 16 ms in a worker); graphs use compressed neighbour lists; lines run 1-D
   elementary rules (each generation a new row, like Wolfram's pictures). Colour rule and
   settling detection unchanged and shared.
2. **Seeds** (`viz/life/seeds.ts`, pure): reusable "what is alive" policies so a view picks one
   rather than writing its own: `linked` (equal to a neighbour, group ≥ N), `runs` (part of a run
   of ≥ N equal digits), `threshold` (a value over a level, e.g. spectrogram energy), `visited`
   (a cell the picture touched), `digitSet` (chosen digits, e.g. odd), `shape` (one census
   shape). Each is unit-tested on small hand-made grids.
3. **Board renderer** (`viz/render/lifeRenderer.ts` + generic `LifeView`): draws any board with
   `cellAt`, one path per colour, frame-budgeted; same controls as today. A view's Life plays
   **in place**, on the view's own geometry (dots stay where the picture had them).
4. **Registry hook**: `ArtDefinition` / view definitions gain an optional
   `lifeBoard(state): LifeBoard | null`. The stage shows one **Game of Life** action (the view's
   bar, or the stage toolbar for views without a bar, key `L`) whenever the current view returns
   a board; one tap pauses the digits and launches, as the mosaic does now.

**Raster fallback** (`rasterBoard(canvas, cols)`): any canvas can be sampled into a square grid
(a cell is alive where the picture has ink; its colour = the nearest palette colour). That gives
**every** view Life on day one; a view's own board replaces the fallback when it has a better
meaning (e.g. the fretboard's real strings and frets). Large boards (> 64k cells) step in a
**Web Worker** with transferable typed arrays, so the main thread only draws (R-010).

## Every view, one row (the plan)

| View                       | Natural board (topology)                           | Alive at the start                                     | Sound (births)                      | Priority |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------ | ----------------------------------- | -------- |
| Neighbour mosaic           | columns × rows (square, wrap)                      | linked / groups N+ / census shape (**done**, PR #38)   | the digit's note                    | done     |
| Guitar fretboard           | 6 strings × 15 frets (square, no wrap)             | positions played recently (fading log)                 | the fret's real note                | 1        |
| Sheet music                | pitch × time "piano roll" (square, wrap in time)   | notes in the visible bars                              | the cell's pitch → generative music | 1        |
| Golden rectangle           | Fₖ × Fₖ₊₁ cells (square, wrap)                     | linked digits; spiral stays drawn                      | the digit's note                    | 2        |
| Typographic π              | text grid (square, wrap)                           | glowing runs (≥ 3 equal); Feynman point a seed         | the digit's note                    | 2        |
| Hilbert carpet             | 1024 × 1024 (square, wrap; **worker**)             | digits equal to a grid neighbour, or one chosen digit  | none (too many)                     | 2        |
| Digit ring                 | the k × k transition table (square, wrap: 10 × 10) | transitions seen at least N times                      | from→to as an interval              | 3        |
| Sunflower                  | seeds joined to Fibonacci neighbours (**graph**)   | linked along the spirals                               | the digit's note                    | 3        |
| π walk                     | the walk's points binned to a grid (square)        | cells the walk visited                                 | none                                | 3        |
| Cymatics                   | sand grains binned to a grid (square)              | cells where sand gathered (the nodal lines)            | the plate mode's note               | 3        |
| Spectrogram                | frequency × time pixels (square)                   | energy over a threshold                                | the bin's pitch                     | 3        |
| Digit chart / stream       | the digit stream as a line (**line**, 1-D rules)   | digits by parity (odd = 1), Wolfram rule 30 / 90 / 110 | one note per live cell per row      | 3        |
| String art                 | the 240 circle points (line, wrap)                 | points with a string drawn to them                     | none                                | 4        |
| Music clock                | 12 pitch classes (line, wrap)                      | pitch classes heard; a 12-cell elementary automaton    | the pitch class                     | 4        |
| Harmonograph, oscilloscope | raster fallback only (continuous curves)           | the curve's ink                                        | none                                | fallback |
| Future views               | must fill this row before they ship (rule below)   |                                                        |                                     |          |

## Recommendation

- Build in this order: **(1) engine + seeds + board renderer, mosaic moved onto them with no
  visible change; (2) raster fallback so every view has Life; (3) the musical boards
  (fretboard, sheet music) with sound for births; (4) the grid views (golden rectangle,
  typographic, Hilbert with the worker); (5) graph and line topologies (sunflower, ring table,
  1-D automata for the stream).** Tracked as F03.21.
- **Going forward (standing rule):** every new visualization declares its Life board, or says in
  its feature file why the raster fallback is enough, and ships with an e2e case that launches
  Life from it while paused and returns (CLAUDE.md rule 10, the `add-visualization` skill, the
  feature template's "Life board" section).
- Persisted Life settings (rule, edges, speed) come later as an additive `viewOptions.life` block
  with defaults (rule 8); Life itself stays a mode, not saved state, until then.
- Lessons (E04): "Why gliders exist", "Life on a hexagon vs a square", "Rule 30 makes
  randomness" — each opened from a view's board.

## Sources

- Conway's Game of Life (B3/S23), Life-like rule notation B/S; HighLife B36/S23.
- Hexagonal Life (Callahan): B2/S34 on the 6-neighbour lattice, a starting rule for graph
  topologies with ~6 neighbours (the sunflower).
- Wolfram, _A New Kind of Science_: elementary cellular automata, rules 30, 90, 110.
- R-010 (note timing, frame budgets, stall limit), R-009 (mosaic shapes), PR #38 (Life from the
  mosaic), PR #39 (one-tap launch on phones).
