/**
 * Performance harness: plays ~13 digits/s (Dorian marimba at 200 BPM, sixteenths) on each view and
 * measures, over a fixed window:
 *   - busy %   main-thread task time / wall time (CDP Performance.TaskDuration)
 *   - long     tasks over 50 ms (they delay note scheduling → audible glitches) and their total
 *   - max gap  longest gap between animation frames
 *   - notes    late notes and rhythm re-anchors, and the least scheduling headroom left (notes are
 *              scheduled 150 ms ahead from the main thread: a stall longer than that is audible)
 * "after 20k": the same after opening a saved piece positioned at digit 20,000 (long sessions).
 *
 *   npm run perf                      # every view
 *   VIEWS=mosaic,staff npm run perf   # some views
 *   CPU=4 npm run perf                # CPU slowed 4× (a mid-range phone)
 *   LONG=0 npm run perf               # skip the "after 20k" runs
 *   PROFILE=1 npm run perf            # also print the 12 functions with the most self time
 * Writes apps/web/perf-report/report.md (git-ignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { encodeConfig } from '../src/core/composition/config'
import { getPreset } from '../src/core/composition/presets'
import { createPiece, pieceToDocument } from '../src/core/piece/piece'
import { DEFAULT_VISUAL_CONFIG, type VisualConfig } from '../src/core/piece/visualConfig'
import { parseSourceLinkParam } from '../src/core/series/sourceConfig'

const parseSource = (param: string) => {
  const read = parseSourceLinkParam(param)
  if (read.status !== 'ok') throw new Error(`Bad source ${param}`)
  return read.config
}

const SECONDS = Number(process.env.SECONDS ?? 6)
const CPU = Number(process.env.CPU ?? 1)
const LONG = process.env.LONG !== '0'
const sound = { ...getPreset('dorian-marimba')!.config, bpm: 200, subdivision: 4 as const }

const SCENARIOS: { name: string; visual: Partial<VisualConfig>; source?: string }[] = [
  { name: 'chart', visual: { view: 'chart' } },
  { name: 'staff', visual: { view: 'staff' } },
  { name: 'spectrogram', visual: { view: 'spectrogram' } },
  { name: 'ring', visual: { view: 'ring' } },
  { name: 'walk', visual: { view: 'walk' } },
  { name: 'sunflower', visual: { view: 'sunflower' } },
  { name: 'mosaic', visual: { view: 'mosaic' } },
  {
    name: 'mosaic groups',
    visual: {
      view: 'mosaic',
      viewOptions: {
        ...DEFAULT_VISUAL_CONFIG.viewOptions,
        mosaic: { columns: 16, minGroup: 3, sweep: false, sweepSpeed: 1 },
      },
    },
  },
  {
    name: 'mosaic sweep',
    visual: {
      view: 'mosaic',
      viewOptions: {
        ...DEFAULT_VISUAL_CONFIG.viewOptions,
        mosaic: { columns: 16, minGroup: 3, sweep: true, sweepSpeed: 1 },
      },
    },
  },
  // Thousands of dots on screen: the worst case for the per-frame and per-digit redraws.
  {
    name: 'mosaic groups wide',
    visual: {
      view: 'mosaic',
      viewOptions: {
        ...DEFAULT_VISUAL_CONFIG.viewOptions,
        mosaic: { columns: 100, minGroup: 2, sweep: false, sweepSpeed: 1 },
      },
    },
  },
  {
    name: 'mosaic sweep wide',
    visual: {
      view: 'mosaic',
      viewOptions: {
        ...DEFAULT_VISUAL_CONFIG.viewOptions,
        mosaic: { columns: 80, minGroup: 0, sweep: true, sweepSpeed: 1 },
      },
    },
  },
  { name: 'hilbert', visual: { view: 'hilbert' } },
  { name: 'type', visual: { view: 'type' } },
  { name: 'strings', visual: { view: 'strings' } },
  { name: 'clock', visual: { view: 'clock' } },
  { name: 'harmonograph', visual: { view: 'harmonograph' } },
  { name: 'scope', visual: { view: 'scope' } },
  { name: 'fretboard', visual: { view: 'fretboard' } },
  { name: 'cymatics', visual: { view: 'cymatics' } },
  { name: 'golden', visual: { view: 'golden' } },
  { name: 'ring mod 12', visual: { view: 'ring' }, source: 'fibonacci.mod-12' },
]

interface Row {
  name: string
  busy: number
  longTasks: number
  longMs: number
  maxGapMs: number
  digits: number
  late: number
  reanchors: number
  minHeadroomMs: number
}

interface Timing {
  steps: number
  late: number
  reanchors: number
  minHeadroomMs: number
}
const timing = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { chartsOfPieAudioTiming?: () => Timing }
      ).chartsOfPieAudioTiming?.() ?? {
        steps: 0,
        late: 0,
        reanchors: 0,
        minHeadroomMs: Infinity,
      },
  )

async function measure(page: Page): Promise<Omit<Row, 'name'>> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const metric = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    return metrics.find((m) => m.name === 'TaskDuration')!.value
  }
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { long: number[]; maxGap: number } }
    w.__perf = { long: [], maxGap: 0 }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__perf.long.push(entry.duration)
    }).observe({ type: 'longtask' })
    let last = performance.now()
    const tick = (now: number) => {
      w.__perf.maxGap = Math.max(w.__perf.maxGap, now - last)
      last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const count = () =>
    page
      .getByTestId('total-count')
      .textContent()
      .then((t) => Number((t ?? '0').replace(/\D/g, '')))
  const digits0 = await count()
  const profiling = Boolean(process.env.PROFILE)
  if (profiling) {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.start')
  }
  const timing0 = await timing(page)
  const task0 = await metric()
  const wall0 = Date.now()
  await page.waitForTimeout(SECONDS * 1000)
  const task1 = await metric()
  if (profiling) {
    // Self time per function (top 12): where the main thread actually goes.
    const { profile } = await cdp.send('Profiler.stop')
    const self = new Map<string, number>()
    const dt =
      (profile.timeDeltas ?? []).reduce((a, b) => a + b, 0) / (profile.samples?.length || 1)
    const byId = new Map(profile.nodes.map((n) => [n.id, n]))
    for (const id of profile.samples ?? []) {
      const node = byId.get(id)!
      const { functionName, url, lineNumber } = node.callFrame
      const key = `${functionName || '(anon)'} ${url.split('/').pop()}:${lineNumber}`
      self.set(key, (self.get(key) ?? 0) + dt / 1000)
    }
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 12)
    console.log('PROFILE', top.map(([k, ms]) => `${ms.toFixed(0)}ms ${k}`).join('\n  '))
  }
  const wall1 = Date.now()
  const timing1 = await timing(page)
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const digits1 = await count()
  const perf = await page.evaluate(
    () => (window as unknown as { __perf: { long: number[]; maxGap: number } }).__perf,
  )
  return {
    busy: ((task1 - task0) / ((wall1 - wall0) / 1000)) * 100,
    longTasks: perf.long.length,
    longMs: perf.long.reduce((a, b) => a + b, 0),
    maxGapMs: perf.maxGap,
    digits: digits1 - digits0,
    late: timing1.late - timing0.late,
    reanchors: timing1.reanchors - timing0.reanchors,
    // Least headroom over the run so far (the counter is cumulative from the first note).
    minHeadroomMs: timing1.minHeadroomMs,
  }
}

const hashFor = (visual: Partial<VisualConfig>, source?: string) => {
  const full = { ...DEFAULT_VISUAL_CONFIG, ...visual }
  const v = btoa(JSON.stringify(full)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `#c=${encodeConfig(sound)}&v=${v}${source ? `&s=${source}` : ''}`
}

const rows: { fresh: Row; long: Row | null }[] = []

test('performance of every view at a fast tempo', async ({ page }) => {
  const only = process.env.VIEWS?.split(',').filter(Boolean)
  for (const scenario of SCENARIOS) {
    if (only && !only.includes(scenario.name)) continue
    const run = async (atDigit: number): Promise<Row> => {
      // A hash-only change would not reload the app: start from a blank page every time.
      await page.goto('about:blank')
      await page.goto(`/${hashFor(scenario.visual, scenario.source)}`)
      await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 20_000 })
      if (atDigit > 0) {
        // Open a saved piece positioned at `atDigit` (rebuilds every view up to there).
        const doc = pieceToDocument(
          createPiece({
            id: `perf-${atDigit}`,
            name: `Perf at ${atDigit}`,
            now: new Date(),
            sound,
            visual: { ...DEFAULT_VISUAL_CONFIG, ...scenario.visual } as VisualConfig,
            ...(scenario.source ? { source: parseSource(scenario.source) } : {}),
            position: { digitIndex: atDigit },
          }),
        )
        await page.evaluate(async (piece) => {
          await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open('charts-of-pie', 1)
            req.onupgradeneeded = () => {
              req.result.createObjectStore('pieces', { keyPath: 'id' })
              req.result.createObjectStore('thumbnails')
            }
            req.onsuccess = () => {
              const tx = req.result.transaction('pieces', 'readwrite')
              tx.objectStore('pieces').put(piece)
              tx.oncomplete = () => resolve()
              tx.onerror = () => reject(tx.error)
            }
          })
        }, doc)
        await page.reload()
        await page.getByRole('button', { name: `Open Perf at ${atDigit}` }).click()
        await expect(page.getByTestId('total-count')).toHaveText(atDigit.toLocaleString('en-US'), {
          timeout: 60_000,
        })
      }
      await page.getByRole('button', { name: 'Play' }).click()
      await page.waitForTimeout(1000) // warm up (audio start, lazy chunks)
      const result = await measure(page)
      await page.getByRole('button', { name: 'Pause' }).click()
      return { name: scenario.name, ...result }
    }
    rows.push({ fresh: await run(0), long: LONG ? await run(20_000) : null })
  }

  const fmt = (r: Row | null) =>
    r
      ? `${r.busy.toFixed(0)}% | ${r.longTasks} (${r.longMs.toFixed(0)} ms) | ${r.maxGapMs.toFixed(0)} ms | ${r.late} / ${r.reanchors} | ${Number.isFinite(r.minHeadroomMs) ? r.minHeadroomMs.toFixed(0) : '–'} ms | ${r.digits}`
      : '– | – | – | – | – | –'
  const head = 'busy | long tasks | max frame gap | late / re-anchored | least headroom | digits'
  const lines = [
    `# Performance — ${SECONDS}s at ~13 digits/s, CPU ${CPU}× slower (production build, Chromium)`,
    '',
    `| View | ${head} | after 20k: ${head} |`,
    `| --- |${' --: |'.repeat(12)}`,
    ...rows.map(({ fresh, long }) => `| ${fresh.name} | ${fmt(fresh)} | ${fmt(long)} |`),
  ]
  const out = join(import.meta.dirname, '..', 'perf-report')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, CPU > 1 ? `report-cpu${CPU}.md` : 'report.md'), `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
})
