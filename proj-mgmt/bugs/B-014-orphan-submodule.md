---
id: B-014
title: 'Orphaned `charts-of-pie` submodule pointer'
status: backlog
severity: low
found-in: charts-of-pie (gitlink from the initial commit)
fixed-by: S06.2.1
---

# B-014 — Orphaned `charts-of-pie` submodule pointer

## Observed

The initial commit tracks `charts-of-pie` as a gitlink (submodule, commit `4b1d00c`) but there is
no `.gitmodules`, so it has no URL and clones as an empty folder. It was probably a nested repo
(e.g. an app scaffold) on the original machine.

## Expected

Either a real submodule with a URL, or the content committed normally, or nothing.

## Fix

Owner to check the local `charts-of-pie` folder during the relocation (S06.2.1): if it holds
work, copy it in as normal files (or publish it and add `.gitmodules`); otherwise
`git rm --cached charts-of-pie`. Left untouched in the E01 modernisation so nothing is lost.
