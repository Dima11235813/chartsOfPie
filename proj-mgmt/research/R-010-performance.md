---
id: R-010
title: Performance pass — playback glitches and CPU use
status: done
feeds: [E09]
---

# R-010 — Performance pass: playback glitches and CPU use

Owner report: playback glitches, likely from overused resources.

## How we measure (repeatable)

`npm run perf` (`apps/web/scripts/perf.spec.ts`) plays ~13 digits/s (Dorian marimba at 200 BPM,
sixteenths) on every view against an unminified production build in Chromium and records
main-thread **busy %** (CDP `TaskDuration`), **long tasks** (> 50 ms — these delay note scheduling,
i.e. audible glitches) and the **max gap between frames**; each view fresh and after opening a
piece positioned at digit 20,000 (long sessions). `PROFILE=1` adds a self-time profile per run.
Audio-thread headroom was checked separately: every preset renders offline at 8–20 % of real
time, so the audio graph itself is not the bottleneck — main-thread stalls are.

Caveat: headless Chromium rasterises canvases in software, so canvas-heavy numbers are worse than
on a GPU-accelerated desktop browser — but low-end devices behave similarly, so it is the right
budget to optimise against.

## Findings and fixes (busy %, after 20k digits; long tasks)

| View              | before                         |         after | cause → fix                                                                                                                                                                                                                        |
| ----------------- | ------------------------------ | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mosaic (any mode) | 55–64 %, 132–272 ms long tasks | 17–27 %, none | shape census re-scanned 20,000 digits **on every digit** → throttled to every 0.75 s (`useThrottled`), canonical shape keys cached (≤ 772 shapes exist)                                                                            |
| Cymatics          | 62 %                           |          21 % | 9,000 grains × 8 trig calls × 3 sub-steps per frame, forever → plate fields tabulated once per mode (bilinear lookup), simulate only for 2.5 s after a mode change, grains drawn into one `ImageData` instead of 9,000 `fillRect`s |
| Harmonograph      | 59–66 %                        |          24 % | ~4,800-point gradient curve redrawn 60×/s → 24 fps, ≤ 28 turns, half the samples, no redraw when idle (4 s after the last note)                                                                                                    |
| Oscilloscope      | 43 %                           |          26 % | `shadowBlur` glow re-blurred the 2,048-point trace each frame → two-pass stroke glow, ≤ 512 points per trace                                                                                                                       |
| Sheet music       | 23 %                           |          22 % | note/chord range queries scanned the whole log every frame → binary search; log trimming batched (no 50,000-element shift per note)                                                                                                |
| others            | 10–19 %                        |       10–19 % | already fine                                                                                                                                                                                                                       |

Audio robustness: the live `AudioContext` now uses `latencyHint: 'balanced'` (larger output
buffer, rides out short CPU spikes) and Tone's look-ahead is 0.15 s (was 0.1 s), so a main-thread
stall of up to 150 ms no longer makes notes late. MIDI out uses the same lead.

## Second pass: the mosaic, and nothing computed off screen

Owner request: don't compute what isn't on screen (the shape census when nobody is looking at that
card), and optimise the mosaic specifically. Two new worst-case scenarios have thousands of dots on
screen: `mosaic groups wide` (100 columns, groups of 2+) and `mosaic sweep wide` (sweeping 40–120
columns).

| Scenario (after 20k digits) | before |   after | fix                                                                                                                                                                    |
| --------------------------- | -----: | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mosaic                      |   16 % |  9–10 % | census counts only while its card is on screen                                                                                                                         |
| mosaic groups               |   22 % |    13 % | census as above; groups redraw batched                                                                                                                                 |
| mosaic sweep                |   20 % | 12–13 % | census no longer recounts on every sweep step; sweep batched                                                                                                           |
| mosaic groups wide          |   36 % |    26 % | groups-only redraw: one path per digit colour instead of a fill/stroke per dot and link                                                                                |
| mosaic sweep wide           |   54 % |    27 % | sweep: one path per colour for settled dots and links, layout inlined (no per-digit allocations), frames skipped once everything has settled, ~30 fps above 1,500 dots |

- **Off-screen work stops.** `useOnScreen` (IntersectionObserver plus tab visibility plus "another
  element is full screen") gates the census. It pauses while the card is scrolled away, under the
  full-screen stage or in a background tab, and catches up when the card is back. The card also
  has **Hide / Show** (remembered on this device); hidden means not counting at all.
- **"My pieces"** formatted every date on every digit (`toLocaleString` showed in the profile);
  the dates are now cached.
- What's left in the wide sweep is mostly rasterising ~2,000 anti-aliased dots; a WebGL or sprite
  renderer would be the next step if it matters on low-end devices.

## Rules of thumb kept for new views

- Never recompute over the whole history per digit; throttle derived panels (`useThrottled`) and
  cache pure results.
- Don't compute what can't be seen: gate panels and canvases on `useOnScreen`.
- Animations stop drawing when nothing changes (idle detection), cap at the frame rate they need,
  and avoid `shadowBlur`; batch many small primitives into one `ImageData` or path.
- Run `npm run perf` before/after touching a view; no long tasks, ≲ 30 % busy at ~13 digits/s.

## Third pass: note timing and the Chrome DevTools MCP (in progress)

Owner request: heavy computation must never make the audio glitch; set up the Chrome DevTools
MCP server to profile the app and find what really needs optimising.

- `.mcp.json` registers `chrome-devtools` (`scripts/chrome-devtools-mcp.sh`, pinned 1.10.1, own
  throwaway profile, usage statistics and CrUX off; local Chrome, or headless Chromium in the
  cloud). Verified: navigate, 4× CPU throttling, performance trace recorded and saved.
- What "glitch" means here: notes are scheduled from the main thread 150 ms ahead of the audio
  clock (`LOOK_AHEAD_SEC`). The note player now counts steps scheduled after their time (late),
  rhythm re-anchors and the least headroom (`audio/timingStats.ts`,
  `window.chartsOfPieAudioTiming()`). Chrome 141 headless has no `AudioContext.playoutStats`.
- `npm run perf` reports those per view, takes `CPU=4` and `LONG=0`, and covers the Golden
  rectangle and a mod-12 ring.
- At full speed (6 s at ~13 digits/s, fresh): **no late notes in any view**; least headroom
  118–150 ms; busiest views oscilloscope 32 %, harmonograph 29 %, cymatics 26 %.
