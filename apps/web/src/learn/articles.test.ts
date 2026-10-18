import { describe, expect, it } from 'vitest'
import { VIEWS } from '../components/views'
import { getPreset } from '../core/composition/presets'
import { parseShareHash } from '../core/piece/shareLink'
import { READING_IDS, SERIES, SERIES_IDS } from '../core/series/series'
import { ARTICLES, getArticle, readingArticleId, seriesArticleId, viewArticleId } from './articles'
import { learnHref, tryItHash } from './links'

describe('the Learn series', () => {
  it('has an article for every number, every reading and every view', () => {
    for (const id of SERIES_IDS) expect(getArticle(seriesArticleId(id))?.group).toBe('number')
    for (const id of READING_IDS) expect(getArticle(readingArticleId(id))?.group).toBe('reading')
    for (const { id } of VIEWS) expect(getArticle(viewArticleId(id))?.group).toBe('view')
  })

  it('uses unique ids that are safe as URL fragments', () => {
    const ids = ARTICLES.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(learnHref('reading-base-12')).toBe('/learn.html#reading-base-12')
  })

  it('every article has a summary, a section and https references', () => {
    for (const a of ARTICLES) {
      expect(a.summary.length, a.id).toBeGreaterThan(10)
      expect(a.sections.length, a.id).toBeGreaterThan(0)
      for (const r of a.references) expect(r.url, a.id).toMatch(/^https:\/\//)
    }
  })

  it('each number cites the OEIS entry the app cites', () => {
    for (const series of SERIES) {
      const urls = getArticle(seriesArticleId(series.id))!.references.map((r) => r.url)
      expect(urls).toContain(`https://oeis.org/${series.oeis}`)
    }
  })

  it('every Try it link opens the app on the article’s number, reading and view', () => {
    for (const a of ARTICLES) {
      const shared = parseShareHash(tryItHash(a.tryIt))
      expect(shared.invalid, a.id).toBe(false)
      expect(shared.source?.series ?? 'pi', a.id).toBe(a.tryIt.series ?? 'pi')
      if (a.tryIt.reading) expect(shared.source?.reading, a.id).toBe(a.tryIt.reading)
      expect(shared.visual?.view ?? 'chart', a.id).toBe(a.tryIt.view ?? 'chart')
      if (a.tryIt.preset) expect(getPreset(a.tryIt.preset), a.id).toBeDefined()
    }
    expect(tryItHash({ series: 'fibonacci', reading: 'base-12', view: 'type' })).toMatch(
      /s=fibonacci\.base-12/,
    )
    // π on the chart is the default state: still named, so it never restores another session.
    expect(tryItHash({})).toBe('#s=pi')
  })

  it('a reading’s Try it uses a series that offers that reading', () => {
    for (const a of ARTICLES.filter((x) => x.tryIt.reading)) {
      const series = SERIES.find((s) => s.id === (a.tryIt.series ?? 'pi'))!
      expect(series.readings, a.id).toContain(a.tryIt.reading)
    }
  })
})
