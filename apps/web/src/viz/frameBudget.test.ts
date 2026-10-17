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
