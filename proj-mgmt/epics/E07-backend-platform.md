---
id: E07
title: 'Backend platform: API, authN & authZ'
status: in-progress
phase: 5
---

# E07 — Backend platform: API, authN & authZ

## Outcome

A secure API that knows who the user is (authentication) and what they may do (authorization), as
the foundation for saving and sharing (E08## Decision (owner, 2026-10-05)

**Cloudflare Workers + D1** (SQLite) with Hono, front end stays on GitHub Pages. Sign-in with
GitHub first. Bearer sessions instead of cookies: the web app (github.io) and the API
(workers.dev) are different sites, and third-party cookies are being phased out. Supersedes the
PostgreSQL/OIDC-BFF sketch below; R-003 updated.

## Features

- [x] F07.1 — `apps/api` (Hono on Workers) sharing the piece schema/validation with the web app
      (imports `apps/web/src/core` until F06.3 extracts `packages/core`); OpenAPI later
- [x] F07.2 — D1 with SQL migrations (`apps/api/migrations`), tests on `node:sqlite` with the same
      migrations
- [x] F07.3 — AuthN: GitHub OAuth (single-use `state`, allow-listed `return_to`), one-time login
      code → bearer session (30 days), only hashes stored; logout. Next: Google, passkeys
- [x] F07.4 — AuthZ: `policy.ts` (owner / unlisted / public / admin moderation), table-tested;
      404 for unreadable pieces
- [x] F07.4b — Web: "Sign in with GitHub", back up pieces to the account, visibility, open,
      delete (hidden unless `VITE_API_URL` is set)
- [ ] F07.5 — Account lifecycle: delete account & data export, rate limiting (Workers rate
      limiting binding), audit log
- [x] F07.6 — Deployment: `deploy-api.yml` (wrangler, D1 migrations) after CI — **owner setup
      pending** (Cloudflare account, D1 id, GitHub OAuth app, secrets; `apps/api/README.md`)

## Research

[R-003 — Full-stack architecture, authN & authZ](../research/R-003-platform-architecture.md)
