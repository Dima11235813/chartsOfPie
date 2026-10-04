import { describe, expect, test } from 'vitest'
import { can, type Action, type Actor, type Visibility } from '../src/policy'

const owner: Actor = { id: 'owner', role: 'user' }
const other: Actor = { id: 'other', role: 'user' }
const admin: Actor = { id: 'admin', role: 'admin' }

// [actor, visibility, read, update, delete]
const table: [string, Actor | null, Visibility, boolean, boolean, boolean][] = [
  ['owner', owner, 'private', true, true, true],
  ['owner', owner, 'public', true, true, true],
  ['other user', other, 'private', false, false, false],
  ['other user', other, 'unlisted', true, false, false],
  ['other user', other, 'public', true, false, false],
  ['anonymous', null, 'private', false, false, false],
  ['anonymous', null, 'unlisted', true, false, false],
  ['anonymous', null, 'public', true, false, false],
  ['admin', admin, 'private', false, false, false],
  ['admin', admin, 'public', true, false, true],
]

describe('piece permissions', () => {
  test.each(table)('%s on a %s piece', (_, actor, visibility, read, update, remove) => {
    const piece = { ownerId: 'owner', visibility }
    const expected: Record<Action, boolean> = { read, update, delete: remove }
    for (const action of ['read', 'update', 'delete'] as const) {
      expect(can(actor, action, piece)).toBe(expected[action])
    }
  })
})
