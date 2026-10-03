---
id: B-002
title: 'Playback auto-starts on load and audio is blocked'
status: done
severity: high
found-in: legacy/simpleHtml/index.js:359
fixed-by: S01.3.2
---

# B-002 — Playback auto-starts on load and audio is blocked

## Observed

`action()` is called on load “for dev purposes”. Browsers block AudioContext until a user gesture, so the first notes are silent (or Tone logs warnings) and the chart runs before the user asked.

## Expected

Nothing plays until the user presses Play; audio is unlocked inside that click.

## Fix

No autoplay; `NotePlayer.start()` (which calls `Tone.start()`) runs in the Play/Step click handler.
