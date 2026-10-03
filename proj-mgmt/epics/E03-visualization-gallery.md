---
id: E03
title: Visualization gallery & playgrounds
status: in-progress
phase: 2
---

# E03 — Visualization gallery & playgrounds

## Outcome

Users pick from a gallery of analytical **and** artistic visualizations that all react to the same
playback. They can play with the stream (speed, start position, search) and keep what they make
(poster, video).

## Features

Shipped:

- [x] [F03.8 — Sheet music & coincidental chords](../features/F03.8-sheet-music.md)
- [x] [F03.9 — Live spectrogram](../features/F03.9-live-spectrogram.md)

Artistic gallery, ordered by [R-006](../research/R-006-artistic-visualizations.md):

| Slice | Feature                                                                                            | Status   |
| ----- | -------------------------------------------------------------------------------------------------- | -------- |
| 2b-1  | F03.1 — Visualization registry & shared palettes (colour-blind-safe, Scriabin, print; fixes B-013) | **done** |
| 2b-1  | F03.3 — Digit ring / chord ribbons (Vasile/Krzywinski), transition bubbles                         | **done** |
| 2b-1  | F03.5 — π walk (Bremer), 10 directions, zoomable                                                   | **done** |
| 2b-1  | F03.2 — Sunflower: digits on a golden-angle (Fermat) spiral                                        | **done** |
| 2b-2  | F03.10 — Music clock: notes on the 12-tone circle, chords as polygons, circle-of-fifths toggle     | **done** |
| 2b-2  | F03.4 — Neighbour mosaic (dot rows, equal neighbours linked)                                       | **done** |
| 2b-2  | F03.11 — Times-table string art (k·n mod N driven by digits)                                       | **done** |
| 2b-2  | F03.7 — Poster mode: print-size PNG/SVG export of any view for a digit range                       | **done** |
| 2b-3  | F03.12 — Harmonograph / Lissajous of sounding intervals                                            | backlog  |
| 2b-3  | F03.13 — Hilbert carpet of the full million digits (1024² Hilbert curve)                           | backlog  |
| 2b-3  | F03.14 — Oscilloscope (XY) view of the audio                                                       | backlog  |
| 2b-3  | F03.15 — Typographic π (runs, Feynman point)                                                       | backlog  |
| 2b-4  | F03.16 — WebGL particles / flow field                                                              | backlog  |
| 2b-4  | F03.17 — Cymatics / Chladni plates per note                                                        | backlog  |
| 2b-4  | F03.18 — 3D π helix (three.js)                                                                     | backlog  |
| 2b-4  | F03.19 — Synaesthetic colour field (Scriabin / Kandinsky)                                          | backlog  |

Playground controls (any slice):

- [ ] F03.6 — speed multiplier, start offset, jump to position, digit-string search (e.g. the
      Feynman point "999999" at decimal 762), loop a range

## Research

- [R-002 — Visualization catalogue](../research/R-002-visualization-catalog.md)
- [R-006 — Artistic visualizations of π](../research/R-006-artistic-visualizations.md)
