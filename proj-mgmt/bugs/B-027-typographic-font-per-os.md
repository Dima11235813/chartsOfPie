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
