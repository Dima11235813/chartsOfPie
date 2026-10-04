---
id: E10
title: Local-first saved pieces & installable PWA
status: in-progress
phase: 2.5
---

# E10 — Local-first saved pieces & installable PWA

## Outcome

Anyone can save the exact sound **and** view they made on their own device, reopen it later
(offline too), back it up as a file, and install the app to their home screen. Pieces saved today
open in every future version of the app. Design and contract: [R-007](../research/R-007-saved-pieces-and-pwa.md).

Pulled ahead of E07 (accounts) by the owner: local saving needs no backend, and the document
format defined here is what E08 later syncs to the cloud.

## Features

- [x] [F10.1 — Versioned piece schema & compatibility contract](../features/F10.1-piece-schema-compat.md)
- [x] [F10.2 — VisualConfig: one state for the view](../features/F10.2-visual-config.md)
- [x] [F10.3 — On-device piece store](../features/F10.3-piece-store.md)
- [x] [F10.4 — Save & "My pieces"](../features/F10.4-my-pieces-ui.md)
- [ ] [F10.5 — Installable, offline PWA](../features/F10.5-pwa.md)

## Out of scope

Accounts, cloud sync, the public gallery (E07/E08). These reuse the F10.1 documents unchanged.
