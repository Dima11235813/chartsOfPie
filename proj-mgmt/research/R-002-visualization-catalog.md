---
id: R-002
title: Visualization catalogue
status: done
feeds: [E03, E05]
---

# R-002 — Visualization catalogue

## Question

Which visualizations should the gallery offer, what data does each need, and how do we render
them fast enough on phones?

## Candidates

| #   | Visualization                  | Data needed                   | Renderer     | Inspiration / notes                                                                                                                                                                                           |
| --- | ------------------------------ | ----------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Digit-frequency chart (done)   | counts                        | Chart.js     | Original app; 7 chart types                                                                                                                                                                                   |
| 2   | π spiral                       | digit stream (up to ~10⁴–10⁵) | Canvas 2D    | `docs/inspiration/put pie in a spiral.PNG` — dot per digit on a Fermat spiral (r ∝ √n, θ = n·137.5°) gives even packing                                                                                       |
| 3   | Transition chord diagram       | pair counts (10×10 matrix)    | Canvas/SVG   | `docs/inspiration/gradient lines …PNG` — ring of 10 arcs; each consecutive pair draws a curve from digit _a_ to _b_ with a colour gradient (style popularised by Cristian Ilies Vasile and Martin Krzywinski) |
| 4   | Neighbour grid                 | digit stream in rows          | Canvas/SVG   | `docs/inspiration/color for number …PNG` — one coloured dot per digit in a grid; link equal neighbours horizontally/vertically/diagonally to reveal runs                                                      |
| 5   | Random walk                    | digit stream                  | Canvas 2D    | digit → direction (10 directions at 36°); π looks like a random walk                                                                                                                                          |
| 6   | Circle of fifths walk          | digit stream + mapping        | SVG          | digit → step around the circle; ties to E02 lessons                                                                                                                                                           |
| 7   | Piano roll / staff             | step events (note, duration)  | Canvas       | makes the music legible; ties to E02                                                                                                                                                                          |
| 8   | Transition heat map            | 10×10 pair counts             | Canvas       | shows uniformity of digit pairs (normality, E04)                                                                                                                                                              |
| 9   | Phyllotaxis / Fibonacci spiral | sequence values               | Canvas/WebGL | E05 — golden angle 137.507…°                                                                                                                                                                                  |
| 10  | Ulam spiral                    | primes                        | Canvas       | E05                                                                                                                                                                                                           |

## Engineering notes

- Shared contract (see `add-visualization` skill): visualizations consume playback state, never
  own playback. Add a `pairCounts` 10×10 matrix to the engine/counter when #3/#8 are built.
- Render loop: accumulate digits between frames, draw once per `requestAnimationFrame`. Digits can
  arrive every 0 ms in legacy mode and at up to 16ths at 240 BPM in tempo mode.
- Canvas 2D handles ~10⁵ static dots if drawn incrementally to an offscreen buffer; beyond that,
  or for animated zooming, use WebGL (regl or raw WebGL2) — or OffscreenCanvas in a worker.
- "Fast-forward" mode (render the first N digits without audio) is essential for 2, 3, 4, 8.
- Colour: keep the legacy rainbow as default; add a colour-blind-safe 10-colour palette and a
  high-contrast palette (B-013). Never encode digits by colour alone in teaching contexts —
  add labels/tooltips.
- Export PNG via `canvas.toBlob`, SVG where the renderer is SVG (E03 F03.7, E08 F08.4).

## Recommendation

Phase 2 order: framework + selector (F03.1) → spiral (F03.2) → chord diagram (F03.3) →
neighbour grid (F03.4) → playground controls incl. seek/search (F03.6) → walks (F03.5) → export.
