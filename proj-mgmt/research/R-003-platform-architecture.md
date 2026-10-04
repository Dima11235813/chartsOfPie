---
id: R-003
title: Full-stack architecture, authN & authZ
status: done
feeds: [E06, E07, E08, E09]
---

# R-003 — Full-stack architecture, authN & authZ

> **Update 2026-10-05 — decision:** the owner chose **Cloudflare Workers + D1** (Hono) with
> GitHub sign-in; implemented in `apps/api` (E07). Sessions are bearer tokens (cross-site
> front end), the policy module and visibility model below are implemented as recommended.

## Question

What should the full-stack architecture be once we add accounts, saving and sharing — without
over-building before it is needed?

## Constraints

- Mobile, tablet and desktop web first (installable PWA later); no native apps planned.
- Most compute (audio, visuals) stays client-side; the server stores small JSON configs, thumbnails
  and user data.
- Small team + AI agents: one language end to end, strong typing, shared validation.

## Recommended shape

```
apps/web        React + Vite (today)                         ─┐
apps/api        TypeScript HTTP API (Fastify or Hono)          ├─ npm workspaces monorepo
packages/core   pure math/music engine (moved from apps/web)   │
packages/schema zod schemas: CompositionConfig, API DTOs      ─┘
Postgres        users, pieces, likes, audit log (Drizzle ORM + migrations)
Object storage  thumbnails / exported audio (S3-compatible)
IdP             OpenID Connect provider
```

- **Shared schemas** (`packages/schema`, zod): the same `CompositionConfig` validator runs in the
  browser (URL import) and the API (save), and generates OpenAPI docs.
- **API style:** REST + OpenAPI is enough (resources: `/me`, `/pieces`, `/pieces/:id`,
  `/gallery`). tRPC is an alternative if we never need third-party clients.

## Authentication (authN)

- Use **OpenID Connect** with Authorization Code + PKCE via a managed or self-hosted IdP rather
  than storing passwords ourselves. Options:
  - Managed: Auth0, Clerk, Supabase Auth, AWS Cognito, Firebase Auth — fastest, social login, MFA.
  - Self-hosted: Keycloak, Zitadel, Authentik — more control, more ops.
- **Backend-for-frontend (BFF) session pattern:** the API completes the OIDC flow and issues an
  HTTP-only, `Secure`, `SameSite=Lax` session cookie; tokens never touch JavaScript (mitigates XSS
  token theft). Add CSRF protection for state-changing requests.
- Decision deferred to E07 kickoff; criteria: cost at hobby scale, social providers, data
  residency, export/lock-in.

## Authorization (authZ)

- Model: **resource ownership + roles + visibility**.
  - Roles: `user`, `moderator`, `admin`.
  - Piece visibility: `private` (owner only), `unlisted` (anyone with link), `public` (gallery).
- One policy module (`can(user, action, resource)`) used by every route, with a table-driven
  test per rule. Database queries always scope by owner for private data (defence in depth;
  Postgres row-level security is an option).
- Deny by default; log authorization failures to the audit log.

## Security & privacy checklist (E07)

Rate limiting · input size limits on configs · CSP headers · dependency scanning · secrets in a
manager, never in the repo · account deletion and data export (GDPR) · minimal PII.

## Deployment (when E07 starts)

Static web on a CDN (Cloudflare Pages / Netlify / Vercel / GitHub Pages) — usable **now** for the
front end. API as a container (Fly.io, Render, Railway, Cloud Run, or AWS ECS) + managed Postgres
(Neon, Supabase, RDS). Preview environments per PR.

## Before the backend exists

F02.5 encodes `CompositionConfig` into the URL, giving account-free sharing immediately and a
stable format for the backend to persist later.

## Recommendation

1. Now: extract `packages/core` when E02 is done (F06.3).
2. E07 kickoff: spike two IdPs (one managed, one self-hosted) against the BFF pattern; pick one.
3. Build `apps/api` with Fastify + zod + Drizzle + Postgres; authZ policy module with tests first.
