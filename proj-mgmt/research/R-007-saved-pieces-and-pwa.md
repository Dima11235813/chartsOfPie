---
id: R-007
title: Saving view configurations on the device & installable PWA — design
status: done
feeds: [E10, E08, E09, E07]
---

# R-007 — Saving view configurations on the device & installable PWA

## Goal

Let people save what they made — the sound **and** the view — on their device, reopen it later
(offline too), and install the app like a native one. The saved format must stay readable by
every future version of the app (**backward compatibility**) and must not be damaged by an older
copy of the app (**forward safety**). It is also the format the backend will sync later (E07/E08).

## 1. What a saved "piece" contains

```jsonc
{
  "schema": "charts-of-pie/piece", // document type (never changes)
  "version": 1, // document version (bumped only by breaking changes, with a migration)
  "id": "6f1c…", // UUID v4 — stable across devices once sync exists
  "name": "Lydian dream · Digit ring",
  "createdAt": "2026-10-04T10:00:00.000Z",
  "updatedAt": "2026-10-04T10:05:00.000Z",
  "sound": {/* CompositionConfig — already versioned (v1), shared with share links */},
  "visual": {
    "version": 1,
    "view": "ring", // stage view id
    "palette": "scriabin",
    "chartStyle": "bar",
    "viewOptions": {
      "clock": { "order": "fifths" },
      "harmonograph": { "pure": false },
      "scope": { "mode": "vector" },
    },
  },
  "position": { "digitIndex": 0 }, // see decision D2
  "thumbnail": "<blob key>", // small WebP of the view, stored separately (not inline)
}
```

Sub-configs (`sound`, `visual`) carry their **own** versions because they also travel alone in
share links. The document version covers the envelope.

## 2. Compatibility rules (the contract)

1. **Additive changes need no version bump.** A new optional field gets a schema default, so
   older documents still parse. Example: adding `viewOptions.walk.colorBy` with a default.
2. **Breaking changes bump the version and add a migration.** Renames, removed fields, changed
   meaning or units all count. Migrations are pure functions `vN → vN+1`, kept forever, and
   chained (`v1 → v2 → v3`).
3. **Ids are forever.** Persisted ids (scale, instrument, preset, view, palette) are never renamed.
   Retiring one means a migration that maps it to its replacement.
4. **Never lose user data.**
   - A stored document that fails to migrate or validate is kept untouched in a "needs
     attention" state, never deleted or overwritten.
   - Unknown fields are preserved when an older app saves a document written by a newer one
     (round-trip of unknown keys).
5. **Forward safety.** A document with `version` > the app's known version opens read-only and is
   not overwritten. The app asks you to update, which the service-worker update prompt makes easy.
6. **Golden fixtures, forever.**
   - `fixtures/pieces/v1/*.json` (and later v2, …) are committed sample documents.
   - A unit test migrates and validates every fixture of every version on every CI run.
   - Deleting a fixture is never allowed.
7. **Schema snapshot guard.**
   - The current schemas are exported with zod's `toJSONSchema()` and compared with a committed
     snapshot.
   - Any shape change fails CI until the snapshot is updated deliberately. The update must
     either be additive with defaults, or come with a version bump, a migration and new fixtures.

The same rules also govern share links (`#c=…`, `#p=…`), which already exist in the wild.

## 3. Where to store it on the device

| Option         | Capacity                                 | Fits                             | Verdict                                       |
| -------------- | ---------------------------------------- | -------------------------------- | --------------------------------------------- |
| `localStorage` | ~5 MB per origin, sync API, strings only | small preferences                | Keep for prefs (palette, last view, settings) |
| **IndexedDB**  | hundreds of MB+, async, binary (Blobs)   | pieces, thumbnails, history      | **Recommended** for saved pieces              |
| Cache Storage  | large, request/response                  | app shell, digits, piano samples | Used by the service worker                    |

Thumbnails and many pieces would exhaust `localStorage` quickly, and its synchronous API blocks
the main thread, so: **IndexedDB for pieces and thumbnails, `localStorage` for small
preferences**.

The storage layer sits behind a `PieceStore` interface (`list`, `get`, `put`, `delete`,
`export`, `import`) with three implementations:

- IndexedDB (`idb`, about 1 kB) for the app
- in-memory, for tests (plus `fake-indexeddb`)
- later, a remote/sync store for E07/E08, with the same interface

### Durability caveats (honest)

- **Eviction.** Browsers may evict site storage under pressure. We call
  `navigator.storage.persist()` after the first save, and show the result.
- **Safari / iOS.** WebKit can delete script-written storage of sites not used for 7 days. Apps
  added to the Home Screen are exempt, which is one more reason to make it an installable PWA.
- **Backups.** "Export all" (JSON file) and "Import" give a manual backup that survives clearing
  site data. Real cross-device safety arrives with accounts (E07).
- **Multi-tab.** A `BroadcastChannel` keeps the "My pieces" list in sync across tabs, and writes are
  last-write-wins on `updatedAt`.

## 4. PWA

- **Manifest:**
  - name, short name, theme/background colours, `display: standalone`, `start_url`, `scope`
  - icons at 192/512 px, plus maskable variants
  - screenshots
- **Service worker** (`vite-plugin-pwa` 2.x, Workbox; supports Vite 8):
  - Precache the app shell: HTML, JS, CSS, favicon, manifest, icons.
  - Runtime cache, cache-first: `data/pi-1m.txt` (1 MB) and the piano samples (1.5 MB), so
    everything works offline after first use. Optionally a "Download for offline" button
    pre-caches the samples.
  - **Update flow `prompt`, not auto.** A banner says "New version available — Reload", so a
    running session is never swapped out mid-performance, and old/new code don't mix on one page.
- **Install UX:** use `beforeinstallprompt` on Chromium; on iOS show a short "Share → Add to Home
  Screen" hint.
- **Tests:**
  - e2e checks that the manifest and service worker are registered.
  - Offline test: load, go offline (`context.setOffline(true)`), reload, play.
  - Update-prompt test.

## 5. User experience

- **Save** (Export panel): saves the current sound, view, palette and view options. It suggests a
  name ("Lydian dream · Digit ring"), which can be edited.
- **My pieces** (drawer or panel), with a thumbnail and date for each piece:
  - open, rename, duplicate
  - delete, with Undo
  - share link
  - export (single piece or all) and import a `.json` file
- **Share links** also carry the visual config (`#c=…&v=…`). Old links without `v` keep working
  exactly as today.
- **Restore last session** on launch is optional (decision D3).

## 6. Decisions needed from the owner

**Owner decisions (2026-10-05):** D1 — IndexedDB for pieces + `localStorage` for preferences.
D2 — a saved piece resumes at its digit. D3 — a plain visit restores the last session (a link
always wins; Original (2019) is one click away). Backend for cloud saving: Cloudflare Workers + D1
(E07).

- **D1 — Storage:** IndexedDB for pieces + `localStorage` for prefs (recommended), or
  `localStorage` only.
- **D2 — Position:** should a saved piece remember where in π it was (resume from digit N, with
  counts replayed), or always start from the beginning?
- **D3 — Launch:** keep opening on Original (2019) as now, or restore the last session?

## 7. Delivery plan (stories, in order)

| #   | Story                                                                                                           | Size |
| --- | --------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Versioned document schema, migration pipeline, golden fixtures, schema snapshot guard                           | M    |
| 2   | `VisualConfig`: lift view/palette/chart style/view options into one state; extend share links (back-compatible) | M    |
| 3   | `PieceStore` (IndexedDB) + persist request + multi-tab sync + quota/error handling                              | M    |
| 4   | Save + "My pieces" UI (thumbnails, open/rename/duplicate/delete-undo)                                           | M    |
| 5   | Export / import JSON backups (single + all), with validation and migration on import                            | S    |
| 6   | PWA: manifest, icons, service worker (precache + runtime caches), update prompt, install UX, offline e2e        | M    |
| 7   | Resume position / restore last session (per D2, D3)                                                             | S–M  |
| 8   | (E07/E08) Cloud sync using the same documents                                                                   | L    |

Stories 1–2 are the foundation: getting the schema and compatibility contract right first is
what makes everything after it safe.

## Sources

- MDN: IndexedDB API; Storage API (`navigator.storage.persist`, `estimate`); Web app manifests;
  Service Worker API; `BroadcastChannel`.
- WebKit blog, "Full Third-Party Cookie Blocking and More" (2020) — the 7-day cap on
  script-writable storage, and the exemption for Home Screen web apps.
- vite-plugin-pwa 2.0 (peer: Vite ^3–^8), Workbox 7.4.
- zod 4 `toJSONSchema()`.
