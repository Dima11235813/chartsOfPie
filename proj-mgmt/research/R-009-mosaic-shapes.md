---
id: R-009
title: Shapes in the neighbour mosaic (polyplets) and a seamless sweep
status: done
feeds: [E03, E04]
---

# R-009 — Shapes in the neighbour mosaic (polyplets) and a seamless sweep

Owner request: study the shapes that groups of 2, 3, 4 and 5 equal neighbours make, find ways to
capture and show them as they move between widths, and make the column sweep seamless.

## 1. What a group is, mathematically

The mosaic joins a digit to every equal neighbour across, down and diagonally, so a group is a
set of grid cells connected edge-to-edge **or** corner-to-corner: a **polyplet** (also called a
polyking — the cells a chess king can walk between). Polyominoes, the Tetris family, are the
edge-only cousins.

| cells | fixed shapes (translation only) — OEIS A006770 | free shapes (also rotation/reflection) — A030222 |
| ----- | ---------------------------------------------- | ------------------------------------------------ |
| 2     | 4                                              | 2 — pair, diagonal pair                          |
| 3     | 20                                             | 5                                                |
| 4     | 110                                            | 22                                               |
| 5     | 638                                            | 94                                               |

These counts are reproduced by `enumeratePolyplets` (grow every shape cell by cell, deduplicate
by a canonical key) in `viz/polyplets.test.ts`, so "found 17 of 22" in the app rests on tested
maths, not a table.

## 2. Why the shapes change with the width

In a grid of _c_ columns, the neighbours of digit _i_ are the digits at distance **1** (across),
**c** (down), **c − 1** and **c + 1** (diagonals). A group is therefore a pattern of equal digits
at those distances, so:

- Horizontal links (equal _consecutive_ digits, e.g. "999999" at decimal 762) never depend on the
  width — they are the anchors that stay while everything else moves.
- Vertical and diagonal links are equalities at distance _c_ and _c ± 1_: change the width by one
  and every one of them is tested against a different digit. Groups break up and new ones form,
  which is exactly the "groups migrating past their neighbours" seen while sweeping.

## 3. What π shows (first 100,000 digits, measured)

| columns | groups of 2 / 3 / 4 / 5 in π | same for random digits (seeded) |
| ------- | ---------------------------- | ------------------------------- |
| 10      | 12,661 / 4,515 / 1,767 / 706 | 12,823 / 4,530 / 1,788 / 710    |
| 32      | 12,664 / 4,582 / 1,889 / 822 | 12,803 / 4,473 / 1,916 / 859    |
| 100     | 12,669 / 4,671 / 2,027 / 871 | 12,471 / 4,745 / 1,910 / 868    |

- **π behaves like random digits** at every width — what we'd expect if π is _normal_ (believed,
  never proven). A lovely lesson for E04: patterns appear, but no more than chance predicts.
- **Upright pairs outnumber diagonal pairs ≈ 5 : 4** (3,500 vs 2,800 at 32 columns). Not a
  property of π: to stay _exactly_ a pair, an across/down pair needs its 10 surrounding cells to
  differ, a diagonal pair 12, and 0.9¹⁰ : 0.9¹² ≈ 1 : 0.81 — matches.
- **The rarest 5-shapes are the most enclosed:** the **plus** and the **X** (most surrounding
  cells that must differ) were the only shapes missing from the first 100,000 digits; with the
  full million, all 94 appear.

## 4. Capturing and showing the shapes (built)

- **Shape census** (panel beside the mosaic): for 2, 3, 4 and 5 digits, every free shape present
  at the current width, drawn the way the mosaic draws it, with its count, plus **"found X of N"
  across all widths visited** — a collection that grows while you change the width or sweep.
- **Isolate a shape:** pick one in the census and the mosaic shows only groups of that shape
  (live and in the sweep); "Show all" returns.
- **Groups only** (2+ … 5+) — from the previous slice — fades the rest to faint dots.

## 5. The seamless sweep (built)

Why the first sweep felt glitchy: every width change threw the drawing away and rebuilt it (new
cell size, re-centred grid, reset scroll), driven by a React timer.

The new sweep (`MosaicSweep`) keeps **one cell size for the whole sweep** (the widest layout fits
the width; the window holds as many recent digits as fill the narrowest), runs on its own
animation loop, and moves every dot towards its place in the current width with frame-rate
independent exponential smoothing (τ = 0.14 s). Links are drawn between the dots' _current_
positions, so they stretch as dots glide; groups fade in after each step. Each width holds for
1/speed seconds (Slow 0.5, Medium 1, Fast 2 columns/s) so shapes can be read. Measured: pixels
changing per frame decay smoothly from ~3,400 to 0 over ~0.7 s after each step, instead of one
jump.

**Update ([B-018](../bugs/B-018-mosaic-sweep-small-on-screen.md)):** one cell size for the whole
sweep meant every width used only about low / high ≈ ⅓ of the frame. Each width now has its own
frame that fills the screen; smoothness comes from the glide, an eased dot size, and digits
fading in and out at the top as the window grows and shrinks.

## 6. Next ideas

- **Shape trails across the sweep:** keep a group's colour/identity as it travels between widths
  (match groups by shared digits) and draw its path — a "migration map".
- **Width spectrum:** a small chart of how many 3+/4+/5+ groups each width 2–120 produces; peaks
  would point at widths where π's digits line up unusually (expected: flat — a normality lesson).
- **Shape posters & cards:** export the census as a poster ("the 94 five-digit shapes of π, first
  sighting of each"), and first-sighting positions ("the plus first appears at digit …").
- **Lesson (E04):** polyominoes vs polyplets, counting by symmetry, and why the plus is rare.
