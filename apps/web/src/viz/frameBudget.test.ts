import { describe, expect, it } from 'vitest'
import { createFrameBudget } from './frameBudget'

/** A clock that advances by `cost` ms during each draw. */
function budgetWithCost(cost: number, options = {}) {
  let t = 0
  const budget = createFrameBudget({ ...options, clock: () => t })
  const frame = (now: number) => {
    if (!budget.due(now)) return false
    budget.run(now, () => {
      t += cost
    })
    return true
  }
  return { budget, frame }
}

describe('frame budget', () => {
  it('cheap drawing runs every frame (down to the minimum interval)', () => {
    const { frame } = budgetWithCost(1, { minIntervalMs: 0 })
    const drawn = [0, 16, 33, 50, 66].filter((now) => frame(now))
    expect(drawn).toHaveLength(5)
  })

  it('expensive drawing is spaced to take at most `share` of the time', () => {
    // 30 ms per draw at share 0.3 → one frame per 100 ms.
    const { frame, budget } = budgetWithCost(30, { share: 0.3 })
    let drawn = 0
    for (let now = 0; now <= 1000; now += 16.7) if (frame(now)) drawn++
    expect(budget.cost).toBeCloseTo(30)
    expect(drawn).toBeGreaterThanOrEqual(9)
    expect(drawn).toBeLessThanOrEqual(11)
  })

  it('still draws at least every `maxIntervalMs`, and never faster than `minIntervalMs`', () => {
    const slow = budgetWithCost(400, { share: 0.3, maxIntervalMs: 500 })
    expect(slow.frame(0)).toBe(true)
    expect(slow.frame(499)).toBe(false)
    expect(slow.frame(500)).toBe(true)
    const capped = budgetWithCost(0.1, { minIntervalMs: 40 })
    expect(capped.frame(0)).toBe(true)
    expect(capped.frame(20)).toBe(false)
    expect(capped.frame(40)).toBe(true)
  })
})

describe('frame budget watching frame gaps', () => {
  it('backs off when drawing makes the next frame late, though the JavaScript is cheap', () => {
    // Each drawn frame costs 1 ms of script but 60 ms of rasterising, so the next frame is late.
    const budget = createFrameBudget({ watchFrames: true, clock: () => 0 })
    let now = 0
    let drawn = 0
    let lateNext = false
    while (now < 3000) {
      now += lateNext ? 60 : 16.7
      lateNext = false
      if (budget.due(now)) {
        budget.run(now, () => {})
        drawn++
        lateNext = true
      }
    }
    // Unthrottled it would draw every frame (~40 frames of 76 ms); spaced, rasterising takes
    // well under half the time.
    expect(drawn).toBeLessThan(25)
    expect((drawn * 60) / 3000).toBeLessThan(0.45)
    expect(drawn).toBeGreaterThan(8) // still animates
  })

  it('ignores long gaps from a hidden tab', () => {
    const budget = createFrameBudget({ watchFrames: true, clock: () => 0 })
    budget.due(0)
    budget.run(0, () => {})
    expect(budget.due(5000)).toBe(true)
    expect(budget.due(5016)).toBe(true)
  })
})
