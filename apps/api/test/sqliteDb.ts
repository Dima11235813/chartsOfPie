import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { Db, Statement } from '../src/app'

/** D1's API over Node's built-in SQLite, with the real migrations applied (tests only). */
export function sqliteDb(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'))
  const statement = (sql: string, values: unknown[] = []): Statement & { exec(): void } => ({
    bind: (...next) => statement(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(values as never[])),
    exec: () => db.prepare(sql).run(...(values as never[])),
  })
  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      db.exec('BEGIN')
      try {
        for (const s of statements) (s as ReturnType<typeof statement>).exec()
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}
