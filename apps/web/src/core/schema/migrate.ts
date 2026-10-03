/**
 * Versioned-document migrations. Every persisted shape (sound config, visual config, saved piece)
 * carries an integer `version`. A breaking change bumps it and adds a pure migration from the
 * previous version; migrations are kept forever and chained, so a document written by any past
 * version of the app still opens. See proj-mgmt/research/R-007 for the full contract.
 */

export type Doc = Record<string, unknown>

/** `migrations[n]` upgrades a version-n document to version n + 1. */
export type Migrations = Readonly<Record<number, (doc: Doc) => Doc>>

export type MigrationResult =
  | { status: 'ok'; doc: Doc; from: number }
  /** Written by a newer app: keep it, never overwrite it, ask the user to update. */
  | { status: 'too-new'; version: number }
  | { status: 'invalid'; reason: string }

export const isDoc = (value: unknown): value is Doc =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function migrate(input: unknown, current: number, migrations: Migrations): MigrationResult {
  if (!isDoc(input)) return { status: 'invalid', reason: 'not an object' }
  const from = input.version
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    return { status: 'invalid', reason: 'missing or bad version' }
  }
  if (from > current) return { status: 'too-new', version: from }
  let doc: Doc = input
  for (let version = from; version < current; version++) {
    const step = migrations[version]
    if (!step) return { status: 'invalid', reason: `no migration from version ${version}` }
    doc = { ...step(doc), version: version + 1 }
  }
  return { status: 'ok', doc, from }
}

/** Throws at module load if a migration step is missing (also asserted in tests). */
export function assertMigrationChain(current: number, migrations: Migrations, name: string) {
  for (let version = 1; version < current; version++) {
    if (!migrations[version]) throw new Error(`${name}: no migration from version ${version}`)
  }
}

/**
 * Keep keys this version of the app does not know about (written by a newer version) when saving
 * a document back, one level deep — so an older app never silently drops newer data.
 */
export function preserveUnknown(original: unknown, next: Doc): Doc {
  if (!isDoc(original)) return next
  const merged: Doc = { ...original, ...next }
  for (const [key, value] of Object.entries(next)) {
    const before = original[key]
    if (isDoc(value) && isDoc(before)) merged[key] = { ...before, ...value }
  }
  return merged
}

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** Compact, URL-safe JSON for share links. */
export const encodeJson = (value: unknown) => toBase64Url(JSON.stringify(value))

export function decodeJson(encoded: string, maxLength: number): unknown {
  if (encoded.length > maxLength) return undefined
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}
