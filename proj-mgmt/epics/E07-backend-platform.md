---
id: E07
title: 'Backend platform: API, authN & authZ'
status: backlog
phase: 5
---

# E07 — Backend platform: API, authN & authZ

## Outcome

A secure API that knows who the user is (authentication) and what they may do (authorization), as
the foundation for saving and sharing (E08).

## Features (to be broken down when phase 5 starts — see R-003 for the recommended design)

- [ ] F07.1 — `apps/api` service (TypeScript, Fastify or Hono), shared `packages/core` +
      `packages/schema` (zod) with the web app; OpenAPI generated from schemas
- [ ] F07.2 — PostgreSQL with migrations (Drizzle or Prisma); local dev via Docker Compose
- [ ] F07.3 — Authentication via OpenID Connect (managed IdP: Auth0/Clerk/Supabase Auth/Cognito,
      or self-hosted Keycloak/Zitadel) — Authorization Code + PKCE, social + email login, MFA
      option; secure HTTP-only session cookies (BFF pattern), CSRF protection
- [ ] F07.4 — Authorization: resource ownership + roles (`user`, `moderator`, `admin`) and
      per-item visibility (`private`, `unlisted`, `public`), enforced in one policy module with
      tests for every rule
- [ ] F07.5 — Account lifecycle: profile, delete account & data export (GDPR), rate limiting,
      audit log
- [ ] F07.6 — Deployment: containers, CI/CD, secrets management, observability (logs, traces)

## Research

[R-003 — Full-stack architecture, authN & authZ](../research/R-003-platform-architecture.md)
