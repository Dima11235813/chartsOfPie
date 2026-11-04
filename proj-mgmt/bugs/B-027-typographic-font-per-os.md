---
id: B-027
title: 'Typographic view set its digits in whatever `monospace` is on the OS, so posters differed per machine'
status: done
severity: medium
found-in: apps/web/src/viz/render/typeRenderer.ts (PR #41 CI, 2026-11-04)
fixed-by: this commit
---

# B-027 — Typographic poster baselines depended on the OS font

## Observed

On PR #41 the e2e job passed every test but the two typographic posters (`type.png`,
`mod12-type.png`): 5–6 % of pixels differed from baselines freshly made in the cloud container
with the same Chromium build. The view asked for `ui-monospace, Menlo, Consolas, monospace`; the
container resolves that to DejaVu Sans Mono, the Ubuntu 26.04 runner (with the fonts Playwright's
`install-deps` adds) to another face, so the glyph shapes, not just their anti-aliasing, differed.
Any baseline of OS-resolved text would keep breaking whenever either machine changed.

## Fix

The view bundles its face: JetBrains Mono SemiBold (Apache-2.0, licence beside the file in
`src/assets/fonts/`), loaded on demand through `FontFace` (`viz/typeFont.ts`, 270 KB, only when the
typographic view or its poster is used). The live view rebuilds its picture once the face has
loaded; `renderPoster` awaits it for the typographic kind. The two baselines are regenerated from
the bundled face, and the Typographic view now looks the same on every device.

## Second round

With the bundled face CI still differed by 6 %: the same Chromium build and the same font file
render glyph edges differently on the two machines (Linux fontconfig hinting applies to web fonts
too), and the CI artifact cannot be fetched from the container to look closer. Rasterised text is
the browser's work, not the renderer's, so the two typographic posters are now compared 4×
box-downscaled: per-glyph edge noise averages out, while a changed layout, colour, glow or run
still fails (measured: a repeat render differs by 0 %, another palette by 33 %, 100 fewer digits by
46 %, against the 0.2 % allowance). The test also asserts, by name, that the bundled face is the
one loaded, so a silent fallback cannot hide in the blur.

## Third round

The font-loaded assertion passed on CI, so the bundled face did draw there, and 3 % of the
downscaled pixels still differed: the runner hints glyph stems to whole pixels (its fontconfig),
the container does not (`12-unhinted-grayscale.conf`: hinting off, grayscale). Linux Chrome
applies those settings to web fonts and canvas text alike. The Playwright config now launches
Chromium with `--font-render-hinting=none --disable-lcd-text`, pinning the rasterisation the
baselines were made with on every machine.
