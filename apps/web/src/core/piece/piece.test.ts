import * as z from 'zod/mini'
import { compositionConfigSchema, migrateConfig } from '../composition/config'
import { getPreset, PRESETS } from '../composition/presets'
import { migrate, preserveUnknown } from '../schema/migrate'
import { createPiece, pieceSchema, pieceToDocument, readPiece } from './piece'
import { buildShareHash, parseShareHash } from './shareLink'
import { createBackup, piecesInFile } from './backup'
import shareLinks from './fixtures/share-links.json'
import { DEFAULT_SOURCE_CONFIG, sourceConfigSchema } from '../series/sourceConfig'
import {
  DEFAULT_VISUAL_CONFIG,
  decodeVisualConfig,
  encodeVisualConfig,
  readVisualConfig,
  visualConfigSchema,
} from './visualConfig'

/*
 * Backward-compatibility suite (contract: proj-mgmt/research/R-007). Saved pieces and share links
 * written by every past version of the app must keep opening. Never delete a fixture or loosen an
 * expectation here; a breaking change adds a migration and new fixtures instead.
 */

const fixtures = import.meta.glob<unknown>('./fixtures/**/*.json', {
  eager: true,
  import: 'default',
})
const fixture = (path: string) => {
  const value = fixtures[`./fixtures/${path}`]
  if (value === undefined) throw new Error(`missing fixture ${path}`)
  return structuredClone(value)
}

/** Every golden piece ever committed. Adding is fine; removing one fails this suite. */
const GOLDEN_PIECES = [
  'v1/minimal.json',
  'v1/full.json',
  'v1/unicode-name.json',
  'v1/with-source.json',
]

describe('golden piece fixtures', () => {
  test('the manifest lists exactly the committed fixtures', () => {
    const committed = Object.keys(fixtures)
      .filter((path) => path.startsWith('./fixtures/pieces/'))
      .map((path) => path.replace('./fixtures/pieces/', ''))
      .sort()
    expect(committed).toEqual([...GOLDEN_PIECES].sort())
  })

  test.each(GOLDEN_PIECES)('%s opens cleanly in the current version', (path) => {
    const read = readPiece(fixture(`pieces/${path}`))
    expect(read.status).toBe('ok')
    if (read.status !== 'ok') return
    expect(read.replaced).toBe(false)
    expect(pieceSchema.safeParse(read.piece).success).toBe(true)
  })

  test('v1 minimal: missing view fields take their defaults', () => {
    const read = readPiece(fixture('pieces/v1/minimal.json'))
    expect(read.status === 'ok' && read.piece.visual).toEqual(DEFAULT_VISUAL_CONFIG)
    expect(read.status === 'ok' && read.piece.sound).toEqual(getPreset('original')!.config)
  })

  test('v1 pieces without a number play π; a named number is kept', () => {
    const minimal = readPiece(fixture('pieces/v1/minimal.json'))
    expect(minimal.status === 'ok' && minimal.piece.source).toEqual(DEFAULT_SOURCE_CONFIG)
    const named = readPiece(fixture('pieces/v1/with-source.json'))
    expect(named.status === 'ok' && named.piece.source).toEqual(DEFAULT_SOURCE_CONFIG)
    expect(named.status === 'ok' && named.piece.position).toEqual({ digitIndex: 42, start: 762 })
  })

  test('v1 full: every field survives', () => {
    const read = readPiece(fixture('pieces/v1/full.json'))
    if (read.status !== 'ok') throw new Error(read.status)
    expect(read.piece.name).toBe('Lydian dream · Music clock')
    // Saved before starting points existed: it started at the beginning.
    expect(read.piece.position).toEqual({ digitIndex: 1234, start: 0 })
    // Expectations are normalised through the current schema, so later additive fields (with
    // defaults) need no edit here — while any change to these values still fails.
    expect(read.piece.visual).toEqual(
      visualConfigSchema.parse({
        version: 1,
        view: 'clock',
        palette: 'scriabin',
        chartStyle: 'radar',
        viewOptions: {
          clock: { order: 'fifths' },
          harmonograph: { pure: true },
          scope: { mode: 'wave' },
        },
      }),
    )
  })
})

describe('documents from newer versions of the app', () => {
  test('additive changes open, unknown values fall back and are reported', () => {
    // The fixture was written when "cymatics" did not exist yet; it does now, and still opens.
    const read = readPiece(fixture('forward/additive-from-newer-app.json'))
    if (read.status !== 'ok') throw new Error(read.status)
    expect(read.piece.visual.view).toBe('cymatics')
    expect(read.piece.visual.viewOptions.scope.mode).toBe('vector')

    // A view this version does not know falls back to the default and is reported.
    const raw = fixture('forward/additive-from-newer-app.json') as { visual: { view: string } }
    raw.visual.view = 'view-from-the-future'
    const unknown = readPiece(raw)
    if (unknown.status !== 'ok') throw new Error(unknown.status)
    expect(unknown.replaced).toBe(true)
    expect(unknown.piece.visual.view).toBe('chart')
  })

  test('saving keeps keys this version does not know', () => {
    const raw = fixture('forward/additive-from-newer-app.json') as Record<string, unknown>
    const read = readPiece(raw)
    if (read.status !== 'ok') throw new Error(read.status)
    const saved = pieceToDocument({ ...read.piece, name: 'Renamed' }, raw)
    expect(saved).toMatchObject({ name: 'Renamed', tags: ['future'], thumbnailHash: 'abc' })
    expect((saved.visual as Record<string, unknown>).viewOptions).toBeDefined()
  })

  test.each([
    'forward/piece-v99.json',
    'forward/sound-v99.json',
    'forward/unknown-series.json',
    'forward/source-v99.json',
  ])('%s is reported too-new, not invalid', (path) => {
    expect(readPiece(fixture(path)).status).toBe('too-new')
  })

  test('garbage is invalid and handed back untouched', () => {
    for (const input of [null, 42, 'x', [], {}, { schema: 'other' }]) {
      const read = readPiece(input)
      expect(read.status).toBe('invalid')
      expect(read.status === 'invalid' && read.raw).toBe(input)
    }
    const broken = { ...(fixture('pieces/v1/full.json') as object), name: '' }
    expect(readPiece(broken).status).toBe('invalid')
  })
})

describe('share links in the wild', () => {
  test.each(shareLinks.links)('$hash', ({ hash, sound, visual, invalid }) => {
    const expected = visual === null ? null : visualConfigSchema.parse(visual)
    const expectedSound = sound === null ? null : compositionConfigSchema.parse(sound)
    // Links from before starting points existed start at the beginning.
    expect(parseShareHash(hash)).toEqual({
      sound: expectedSound,
      visual: expected,
      start: null,
      source: null,
      newerSource: null,
      invalid,
    })
  })

  test('hashes round-trip and defaults are left out', () => {
    const original = getPreset('original')!.config
    expect(buildShareHash(original, DEFAULT_VISUAL_CONFIG)).toBe('')
    for (const preset of PRESETS) {
      const visual = { ...DEFAULT_VISUAL_CONFIG, view: 'ring' as const }
      const hash = buildShareHash(preset.config, visual)
      expect(parseShareHash(hash)).toEqual({
        sound: preset.id === 'original' ? null : preset.config,
        visual,
        start: null,
        source: null,
        newerSource: null,
        invalid: false,
      })
    }
    const custom = { ...original, bpm: 97 }
    expect(buildShareHash(custom, DEFAULT_VISUAL_CONFIG)).toMatch(/^#c=/)
  })

  test('the number travels as &s= and π is left out', () => {
    const original = getPreset('original')!.config
    expect(buildShareHash(original, DEFAULT_VISUAL_CONFIG, 0, DEFAULT_SOURCE_CONFIG)).toBe('')
    expect(parseShareHash('#s=pi')).toEqual({
      sound: null,
      visual: null,
      start: null,
      source: DEFAULT_SOURCE_CONFIG,
      newerSource: null,
      invalid: false,
    })
    expect(parseShareHash('#s=pi.digits').source).toEqual(DEFAULT_SOURCE_CONFIG)
    // Malformed values are reported like any unreadable part.
    for (const bad of ['#s=', '#s=PI', '#s=pi..digits', '#s=pi.digits.x', `#s=${'a'.repeat(70)}`])
      expect(parseShareHash(bad)).toMatchObject({ source: null, newerSource: null, invalid: true })
    // A series, or a reading of π, that this version does not know: never π silently.
    expect(parseShareHash('#s=pi.digits-in-base-12')).toMatchObject({
      source: null,
      invalid: false,
    })
  })

  test('a number from a newer app is reported and kept in the link', () => {
    const hash = '#p=lydian-dream&s=golden-ratio&at=5'
    const shared = parseShareHash(hash)
    expect(shared).toEqual({
      sound: getPreset('lydian-dream')!.config,
      visual: null,
      start: 5,
      source: null,
      newerSource: 'golden-ratio',
      invalid: false,
    })
    expect(buildShareHash(shared.sound!, DEFAULT_VISUAL_CONFIG, 5, shared.newerSource!)).toBe(hash)
    expect(parseShareHash('#s=pi.mod').newerSource).toBe('pi.mod')
  })

  test('a starting point travels as &at= and is left out at the beginning', () => {
    const original = getPreset('original')!.config
    expect(buildShareHash(original, DEFAULT_VISUAL_CONFIG, 0)).toBe('')
    expect(buildShareHash(original, DEFAULT_VISUAL_CONFIG, 762)).toBe('#at=762')
    expect(parseShareHash('#at=762')).toEqual({
      sound: null,
      visual: null,
      start: 762,
      source: null,
      newerSource: null,
      invalid: false,
    })
    const visual = { ...DEFAULT_VISUAL_CONFIG, view: 'mosaic' as const }
    const shared = parseShareHash(buildShareHash(getPreset('dorian-marimba')!.config, visual, 9))
    expect(shared.start).toBe(9)
    expect(shared.visual).toEqual(visual)
    // Not a decimal place: ignored and reported.
    for (const bad of ['#at=-1', '#at=1e6', '#at=', '#p=original&at=x'])
      expect(parseShareHash(bad)).toMatchObject({ start: null, invalid: true })
  })

  test('visual configs encode and decode', () => {
    const visual = visualConfigSchema.parse({
      version: 1,
      view: 'scope',
      viewOptions: { scope: { mode: 'wave' } },
    })
    expect(decodeVisualConfig(encodeVisualConfig(visual))).toEqual(visual)
    expect(decodeVisualConfig('x'.repeat(2000))).toBeNull()
  })
})

describe('migration pipeline', () => {
  const steps = {
    1: (doc: Record<string, unknown>) => ({ ...doc, title: doc.name }),
    2: (doc: Record<string, unknown>) => ({ ...doc, tempo: (doc.bpm as number) * 2 }),
  }

  test('chains every step from the stored version to the current one', () => {
    expect(migrate({ version: 1, name: 'a', bpm: 60 }, 3, steps)).toEqual({
      status: 'ok',
      from: 1,
      doc: { version: 3, name: 'a', title: 'a', bpm: 60, tempo: 120 },
    })
    expect(migrate({ version: 3 }, 3, steps)).toEqual({
      status: 'ok',
      from: 3,
      doc: { version: 3 },
    })
  })

  test('newer, missing and broken versions are told apart', () => {
    expect(migrate({ version: 4 }, 3, steps)).toEqual({ status: 'too-new', version: 4 })
    expect(migrate({}, 3, steps).status).toBe('invalid')
    expect(migrate({ version: 1.5 }, 3, steps).status).toBe('invalid')
    expect(migrate({ version: 1 }, 3, { 2: steps[2] }).status).toBe('invalid')
  })

  test('the real pipelines accept their current version', () => {
    expect(migrateConfig(getPreset('original')!.config).status).toBe('ok')
    expect(readVisualConfig({ version: 1 }).status).toBe('ok')
  })

  test('preserveUnknown keeps unknown keys one level deep', () => {
    expect(preserveUnknown({ a: 1, x: 9, o: { b: 1, y: 8 } }, { a: 2, o: { b: 2 } })).toEqual({
      a: 2,
      x: 9,
      o: { b: 2, y: 8 },
    })
  })
})

test('createPiece stamps, trims and validates', () => {
  const piece = createPiece({
    id: 'id-1',
    name: '  ',
    now: new Date('2026-10-04T10:00:00Z'),
    sound: getPreset('original')!.config,
    visual: DEFAULT_VISUAL_CONFIG,
  })
  expect(piece.name).toBe('Untitled')
  expect(piece.createdAt).toBe('2026-10-04T10:00:00.000Z')
  expect(readPiece(pieceToDocument(piece)).status).toBe('ok')
})

/*
 * Schema snapshot guard. If one of these fails you changed a persisted shape. That is fine only if
 * (a) the change is additive with a default, or (b) you bumped the version, added a migration and
 * new golden fixtures. Then update with `npx vitest run -u` and commit the new snapshot.
 */
describe('persisted schema snapshots', () => {
  const snapshot = (schema: z.ZodMiniType) =>
    `${JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2)}\n`
  test.each([
    ['composition-config.v1', compositionConfigSchema],
    ['visual-config.v1', visualConfigSchema],
    ['piece.v1', pieceSchema],
    ['source-config.v1', sourceConfigSchema],
  ] as const)('%s', async (name, schema) => {
    await expect(snapshot(schema)).toMatchFileSnapshot(`./__schemas__/${name}.json`)
  })
})

describe('backup files', () => {
  test('a backup round-trips its pieces verbatim; a single piece file is accepted too', () => {
    const doc = fixture('pieces/v1/full.json') as Record<string, unknown>
    const backup = createBackup([doc], new Date('2026-10-05T00:00:00Z'))
    expect(backup).toMatchObject({ schema: 'charts-of-pie/backup', version: 1 })
    expect(piecesInFile(JSON.parse(JSON.stringify(backup)))).toEqual([doc])
    expect(piecesInFile(doc)).toEqual([doc])
    // A future backup version keeps the `pieces` array, so it still imports.
    expect(piecesInFile({ ...backup, version: 7, extra: true })).toEqual([doc])
    expect(piecesInFile({ hello: 'world' })).toBeNull()
    expect(piecesInFile('nope')).toBeNull()
  })
})
