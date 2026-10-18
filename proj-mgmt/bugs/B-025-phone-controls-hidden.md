---
id: B-025
title: "Phones: the mosaic's Game of Life button was hidden behind the sticky playback bar"
status: done
severity: high
found-in: owner's phone, published site (2026-10-18), Chrome on Android, ~412 × 757 CSS px visible
fixed-by: this commit
---

# B-025 — Mosaic controls hidden on a phone

## Observed

Owner: "I don't see the button, where is it". On the phone the sticky playback bar at the bottom
(Play, Step, Reset, Mute, Full screen, then View and Colours on rows of their own) took about 40 %
of the screen (225 CSS px). The mosaic's own bar wraps to three rows, and its second row (Show,
**Game of Life**) and third (Sweep) sat behind the sticky bar. While playing, the button was also
disabled, explained only by a hover tooltip, which phones never show.

## Fix

- Phones (≤ 520 px): the sticky bar is two short rows (122 px at 412 px wide): the transport buttons
  in one row (Full screen as an icon, same accessible name, 44 px), then View and Colours side by
  side (labels kept for screen readers).
- Game of Life works while playing: one tap pauses the digits and launches Life from the picture.

## Tests

`smoke.spec.ts` "phone 412×757 / 360×640: the whole mosaic and its controls fit above the sticky
bar" failed first (bar 225 px), then passes: bar under a quarter of the screen, More columns, Game
of Life and Sweep all above it with the stage scrolled into view, no horizontal scroll.
`view-toggles` Game of Life: one tap while playing pauses and launches.

## Also fixed on the way

The harmonograph toggle test failed intermittently on the phone viewport: it measured "before"
while a frame-budgeted redraw still showed an earlier note pair. The toggle tests now wait for the
picture to settle (`settledPixels`), and the harmonograph holds still while paused and keeps its
turn across redraws (it used to keep turning for 4 s, and jump back to the start on a toggle).
