---
id: B-026
title: 'CI e2e: Playwright 1.56 cannot install Chromium on Ubuntu 26.04 (ubuntu-latest)'
status: done
severity: high
found-in: .github/workflows/ci.yml, e2e job (PR #40, 2026-10-31)
fixed-by: this commit
---

# B-026 — e2e job fails at browser install on the new runner image

## Observed

On PR #40 (documents only) the e2e job failed before any test ran:
`Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.56.1!` and
`ERROR: Playwright does not support chromium on ubuntu26.04-x64`. GitHub's `ubuntu-latest` image
had moved to Ubuntu 26.04; every branch, master included, would fail the same way.

## Fix

The e2e job runs on `ubuntu-24.04` (pinned, with a comment). The other jobs (check, deploys)
install no browser and stay on `ubuntu-latest`.

## Follow-up

Upgrade Playwright to a release that supports Ubuntu 26.04 and unpin. The cloud containers use a
pre-installed Chromium matched to 1.56 (`/opt/pw-browsers`), so the upgrade needs that path
checked (or `executablePath`) at the same time.
