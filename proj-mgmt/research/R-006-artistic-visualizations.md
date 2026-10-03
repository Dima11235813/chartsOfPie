---
id: R-006
title: Artistic visualizations of π — research and roadmap
status: done
feeds: [E03, E04, E05, E08, E09]
---

# R-006 — Artistic visualizations of π

## Question

Today we have three _analytical_ views: the digit-frequency chart, sheet music and a live
spectrogram. Which **artistic** visualizations should come next so the app feels like "math is art"
— beautiful on its own, honest to the math, and tied to the music?

## What makes a π visualization "art" rather than a chart

1. **One clear rule, applied relentlessly.** The best-known π artworks each follow a single simple
   mapping (digit → direction, digit → segment, digit → colour), and the beauty emerges from the
   digits. The rule is the lesson.
2. **Growth over time.** Watching structure appear as digits accumulate is more compelling than a
   finished image, and it pairs naturally with the music.
3. **Many scales.** It should look good at 100 digits and at 1,000,000 — zoom from detail to texture.
4. **Music coupling.** Every view should react to the same playback (notes, chords, loudness), so
   sound and image are one piece.
5. **Keepsakes.** It can be exported as a poster (high-res PNG/SVG), a video (we have recording) or
   a share link.

## Prior art (references)

- **Cristian Ilies Vasile** — links between successive digits drawn around a circle divided into ten
  segments, using Circos; the path becomes a "weaving mandala" ([Krzywinski, method][mk-method];
  [Cool Infographics][ci]).
- **Martin Krzywinski** — extended Vasile's idea for π, φ and e, adding transition-count bubbles
  outside the ring. The Feynman point (six 9s at decimal 762) appears as a big 9→9 bubble
  ([Popular Science][popsci]; [Scientific American, "Pi in the Sky"][sa-sky]).
- **Nadieh Bremer, "The Art in Pi" (2015)** — each base-10 digit is a step in one of ten directions.
  Between 1,000 and 10,000 digits the walk starts to resemble folded proteins or crystals
  ([Visual Cinnamon][vc]; [Scientific American, "The Boundless Beauty of Pi"][sa-beauty]).
  It inspired similar walks for other constants ([c82 "Number Walks"][c82]).
- **Scriabin's clavier à lumières (1915)** — a keyboard that emitted a colour per note, for
  _Prometheus: Poem of Fire_. It is the classic note → colour (synaesthesia) mapping
  ([Wikipedia][clavier]; [Music Theory Online, "Scriabin and the Possible"][mto]).
- **Modular "times tables" on a circle** (popularised by Mathologer): connect point _n_ to _k·n
  mod N_. Cardioids, nephroids and Mandelbrot links emerge
  ([Wolfram demonstration][wolfram]; [Red Blob Games][redblob]).
- Our own inspiration images in `docs/inspiration/`: π spiral, gradient transition lines,
  neighbour-linked dot rows.

## Candidate catalogue

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week. ★ = recommended for the next slice.

| #   | Visualization                          | Rule                                                                                                                                              | Music coupling                                                                                           | Renderer                       | Effort |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| 1 ★ | **Digit ring / chord ribbons**         | 10 arcs; a gradient ribbon from each digit to the next (Vasile/Krzywinski); transition bubbles outside                                            | ribbon flashes on each note; chords light their arcs                                                     | Canvas 2D → SVG for posters    | M      |
| 2 ★ | **π walk**                             | each digit = a step in one of 10 directions (Bremer); colour = position in π                                                                      | pen follows the melody; step length ∝ note length                                                        | Canvas 2D (+ zoom)             | M      |
| 3 ★ | **Sunflower (phyllotaxis)**            | digit _n_ placed at r ∝ √n, θ = n·137.508° (golden angle), coloured by digit — our "π spiral" image                                               | new seed blooms per note; drone tints the centre                                                         | Canvas 2D / WebGL              | S      |
| 4 ★ | **Music clock**                        | 12 pitch classes on a circle; consecutive notes joined; chords drawn as glowing polygons                                                          | is the music: intervals as chord lengths, triads as triangles, circle-of-fifths toggle                   | SVG/Canvas                     | S      |
| 5   | **Neighbour mosaic**                   | rows of dots coloured by digit; equal neighbours linked (our 3rd inspiration image)                                                               | current row scrolls with playback                                                                        | Canvas 2D                      | S      |
| 6   | **Times-table string art**             | points 0…N−1 on a circle, link n → k·n mod N, with k and N taken from digits                                                                      | k changes on each chord; tone ~ k                                                                        | Canvas 2D                      | S      |
| 7   | **Harmonograph / Lissajous**           | x = sin(f₁t), y = sin(f₂t + φ) for the frequencies of the sounding notes                                                                          | consonant intervals (3:2, 5:4) draw stable figures, dissonant ones churn — a visual lesson on consonance | Canvas / WebGL                 | M      |
| 8   | **Synaesthetic colour field**          | soft colour washes from a note → colour map (Scriabin, Newton, or the digit rainbow); shapes à la Kandinsky                                       | colours follow the notes and dynamics                                                                    | Canvas 2D / WebGL              | M      |
| 9   | **Hilbert carpet of a million digits** | 1,000,000 digits on a 1024×1024 Hilbert curve (≈1,048,576 cells — a natural fit), coloured by digit; neighbours in π stay neighbours in the image | playhead highlights the current cell; zoom from texture to single digits                                 | WebGL / OffscreenCanvas worker | M      |
| 10  | **Flow field / particles**             | particles steered by a vector field seeded from digit blocks                                                                                      | particle bursts on notes, field swirls with loudness (from the analyser)                                 | WebGL (regl/PixiJS)            | L      |
| 11  | **Cymatics / Chladni plates**          | standing-wave patterns of a square plate for the current note's mode numbers                                                                      | the plate "sings" each note — physics of sound                                                           | WebGL fragment shader          | M      |
| 12  | **3D π helix / tower**                 | digits stacked on a helix (10 per turn), height = position                                                                                        | camera rides along with playback                                                                         | three.js                       | L      |
| 13  | **Fractal tree (L-system)**            | branching angles and lengths from successive digits                                                                                               | grows a branch per phrase                                                                                | Canvas 2D                      | M      |
| 14  | **Stained glass (Voronoi)**            | Voronoi cells around walk or sunflower points, coloured by digit                                                                                  | cells light up as notes play                                                                             | Canvas / d3-delaunay           | M      |
| 15  | **Oscilloscope music**                 | plot left vs right channel (XY) of the audio output                                                                                               | it is the audio — a literal picture of the sound                                                         | Canvas from analyser           | S      |
| 16  | **Typographic π**                      | the digits themselves as type art; runs and the Feynman point highlighted                                                                         | current digit pulses                                                                                     | Canvas / SVG                   | S      |

### Why these five first

- **Ring, walk, sunflower** are the three canonical π artworks. Users will recognise them, and two
  are our own inspiration images.
- **Music clock** is the strongest bridge between "math is music" (E02) and "math is art". It also
  makes the coincidental chords from the sheet-music view visible as shapes.
- **Neighbour mosaic** is small and completes the set of inspiration images.

## Engineering approach

1. **Visualization registry.** Each view is a module
   `{ id, name, kind: 'live' | 'static' | 'both', component, palettes, exportable }`. Views
   consume the shared playback state:
   - `PerformanceLog` (notes, chords)
   - step events (digits)
   - the analyser (audio)
   - the digit source (random access for posters)

   Adding a view then never touches playback code. The `View` selector is generated from the
   registry.

2. **Canvas first, WebGL where needed.** Canvas 2D covers views 1–8, 13, 15 and 16. Views 9–12 need
   WebGL (regl or PixiJS; three.js only for 12). Heavy static renders (Hilbert carpet, a
   million-digit walk) run in an OffscreenCanvas worker.
3. **Palettes as data.** Keep the legacy rainbow as default, plus colour-blind-safe (fixes B-013),
   Scriabin, monochrome ink and "print" palettes, shared by every view.
4. **Poster mode.** Each view can render at print size (e.g. 4800×4800 PNG, or SVG where the view
   is vector) for a chosen digit range. This becomes a natural "save/share" artefact for E08.
5. **Recording works for free.** Every view draws to a canvas, so the existing recorder captures
   video of any of them.
6. **Testing.**
   - Pure geometry (walk positions, phyllotaxis coordinates, Hilbert index → xy, ring arcs) is
     unit-tested in `src/viz/`.
   - Each view gets an e2e smoke test that checks it draws (non-empty pixels) on all three viewports.
   - Static posters get image snapshots, like the audio spectrograms.
7. **Performance budget.** 60 fps on a mid-range phone; batch drawing per animation frame;
   incremental rendering (draw only new digits) for growing views.

## Recommendation (roadmap)

| Slice | Contents                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------- |
| 2b-1  | Registry + palettes (F03.1), **Digit ring** (F03.3), **π walk** (F03.5), **Sunflower** (F03.2)           |
| 2b-2  | **Music clock** (F03.10), Neighbour mosaic (F03.4), Times-table string art (F03.11), poster mode (F03.7) |
| 2b-3  | Harmonograph (F03.12), Hilbert carpet (F03.13), Oscilloscope (F03.14), Typographic π (F03.15)            |
| 2b-4  | WebGL: particles/flow (F03.16), cymatics (F03.17), 3D helix (F03.18); synaesthetic field (F03.19)        |

Each slice ends with a "gallery" listening/viewing review with the owner, as for the sound presets.

[mk-method]: https://mk.bcgsc.ca/pi/art/circular-art/method.mhtml
[ci]: https://coolinfographics.com/blog/2014/2/3/the-beautiful-flow-of-pi.html
[popsci]: https://www.popsci.com/article/science/youve-never-seen-pi-0/
[sa-sky]: https://www.scientificamerican.com/article/pi-in-the-sky
[vc]: https://www.visualcinnamon.com/art/the-art-in-pi/
[sa-beauty]: https://www.scientificamerican.com/blog/sa-visual/the-boundless-beauty-of-pi
[c82]: https://www.c82.net/work/number-walks
[clavier]: https://en.wikipedia.org/wiki/Clavier_%C3%A0_lumi%C3%A8res
[mto]: https://mtosmt.org/issues/mto.12.18.2/mto.12.18.2.gawboy_townsend.html
[wolfram]: https://demonstrations.wolfram.com/ModularMultiplicationOnACircle/
[redblob]: https://redblobgames.com/x/1847-mathologer-modulo-circle
