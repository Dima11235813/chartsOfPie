---
id: B-022
title: 'CI: "swing and full screen" e2e fails intermittently on the mobile viewport'
status: done
severity: medium
found-in: apps/web/e2e/smoke.spec.ts (failed on master CI 2026-10-07 and on PR #30)
fixed-by: this commit
---

# B-022 — Flaky full-screen e2e on CI

## Observed

On GitHub's runners only, `[mobile] › swing and full screen` sometimes fails: after pressing F
the page stays full screen (`document.fullscreenElement` still set). It failed on master's own
CI after a docs-only merge (#25) and twice on PR #30 (which does not touch full screen), then
passed on a re-run. It never failed locally: 5 repeats per viewport, the whole suite with 2
workers like CI, and 8 runs with the renderer CPU slowed 8×. The failure trace could not be read
(the artifact host is blocked from this environment).

## Cause (most likely)

The test pressed F the moment `fullscreenElement` appeared. On a slow runner Chrome can still be
finishing the transition into full screen and drops an exit requested then. A person cannot
press F that quickly, so the app is fine; the test raced the browser. (A first theory, that the
focused "Full screen" button swallowed the key, was disproved: focus is already on the body.)

## Fix

The test presses F again while the page is still full screen, until it exits (10 s budget). That
is safe because the shortcut only exits while full screen, and it still fails if F is broken
(checked by disabling the F shortcut: the test fails).

## Also in this change (CI/CD hygiene)

- A stray submodule entry `charts-of-pie` from the initial commit (no `.gitmodules`, an empty
  folder) made every checkout end with `fatal: No url found for submodule path`; removed.
- Actions moved off the deprecated Node 20 runtime: `actions/checkout@v5`, `actions/setup-node@v5`,
  `actions/upload-artifact@v6` (all on Node 24).
