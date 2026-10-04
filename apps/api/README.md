# Charts of Pie API

Cloudflare Workers + D1 (owner decision, R-003/E07). Front end stays on GitHub Pages.

- **AuthN:** "Sign in with GitHub" (OAuth). The API sends the browser back to the web app with a
  one-time `?login=` code (60 s); the app trades it for a bearer session token (30 days). Only
  SHA-256 hashes of codes and tokens are stored. `return_to` must be one of `ALLOWED_ORIGINS`
  (no open redirect); the OAuth `state` is single-use and expires in 10 minutes.
- **AuthZ:** `src/policy.ts` (table-tested): owners do everything with their pieces; `unlisted`
  pieces open by link, `public` ones are listed in `/gallery`; admins (`ADMIN_GITHUB_IDS`) can
  remove visible pieces but never read private ones. Not-allowed reads answer 404.
- **Pieces** are the versioned documents from `apps/web/src/core/piece` — validated with the same
  code (`readPiece`), stored verbatim (unknown keys from newer apps survive), max 64 KB; documents
  from a newer app version are refused with 409 rather than mangled.

| Endpoint                       | Who                      | What                                      |
| ------------------------------ | ------------------------ | ----------------------------------------- |
| `GET /auth/github?return_to`   | anyone                   | start sign-in                             |
| `POST /auth/exchange`          | anyone with a code       | `{ code }` → `{ token, user }`            |
| `POST /auth/logout`, `GET /me` | signed in                | end session / who am I                    |
| `GET /pieces`                  | signed in                | my pieces                                 |
| `PUT /pieces/:id`              | owner (or new id)        | `{ document, visibility? }` create/update |
| `PATCH /pieces/:id`            | owner                    | `{ visibility }`                          |
| `GET /pieces/:id`              | owner, or if not private | one piece                                 |
| `DELETE /pieces/:id`           | owner; admin if visible  | delete                                    |
| `GET /gallery?before=`         | anyone                   | public pieces, newest first, 50 per page  |

## Develop & test

```bash
npm test -w @charts-of-pie/api        # Hono app against node:sqlite with the real migrations
npx wrangler dev                      # from apps/api, with a local D1
```

## One-time setup (owner)

1. **Cloudflare:** create an account, then from `apps/api`:
   `npx wrangler login` → `npx wrangler d1 create charts-of-pie` → put the printed
   `database_id` into `wrangler.toml` (commit it; it's not a secret).
2. **First deploy** (prints the URL, e.g. `https://charts-of-pie-api.<you>.workers.dev`):
   `npx wrangler d1 migrations apply charts-of-pie --remote && npx wrangler deploy`.
3. **GitHub OAuth app:** GitHub → Settings → Developer settings → OAuth Apps → New.
   Homepage `https://dima11235813.github.io/chartsOfPie/`; callback
   `https://charts-of-pie-api.<you>.workers.dev/auth/github/callback`.
   Then `npx wrangler secret put GITHUB_CLIENT_ID` and `… GITHUB_CLIENT_SECRET`.
4. **Automatic deploys:** repo → Settings → Secrets and variables → Actions:
   secrets `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers" + D1 edit) and
   `CLOUDFLARE_ACCOUNT_ID`; variable `API_URL` = the Worker URL (the web build then shows
   "Sign in with GitHub").
