import {
  cellsOfKey,
  enumeratePolyplets,
  fixedKey,
  FREE_POLYPLET_COUNTS,
  freeKey,
  shapeName,
} from './polyplets'
import {
  approach,
  mosaicGroups,
  shapeCensus,
  SWEEP_MAX_WINDOW,
  sweepFrame,
  sweepTarget,
} from './mosaicShapes'

describe('polyplets (cells joined by edges or corners)', () => {
  test('fixed counts match OEIS A006770: 1, 4, 20, 110, 638', () => {
    expect([1, 2, 3, 4, 5].map((n) => enumeratePolyplets(n).size)).toEqual([1, 4, 20, 110, 638])
  })

  test('free counts match OEIS A030222: 1, 2, 5, 22, 94', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const free = new Set([...enumeratePolyplets(n)].map((k) => freeKey(cellsOfKey(k))))
      expect(free.size).toBe(FREE_POLYPLET_COUNTS[n])
    }
  })

  test('fixed keys ignore position; free keys also ignore rotation and reflection', () => {
    const horizontal = [
      [5, 7],
      [6, 7],
    ] as const
    const vertical = [
      [2, 2],
      [2, 3],
    ] as const
    expect(fixedKey(horizontal)).toBe('0,0;1,0')
    expect(fixedKey(vertical)).not.toBe(fixedKey(horizontal))
    expect(freeKey(vertical)).toBe(freeKey(horizontal))
    // The two diagonal pairs (\ and /) are one free shape.
    expect(
      freeKey([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(
      freeKey([
        [1, 0],
        [0, 1],
      ]),
    )
  })

  test('names for the common small shapes', () => {
    const name = (cells: [number, number][]) => shapeName(freeKey(cells))
    expect(
      name([
        [0, 0],
        [1, 0],
      ]),
    ).toBe('pair')
    expect(
      name([
        [0, 0],
        [1, 1],
      ]),
    ).toBe('diagonal pair')
    expect(
      name([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toBe('line of 3')
    expect(
      name([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBe('diagonal of 3')
    expect(
      name([
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]),
    ).toBe('square')
    expect(
      name([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toBeNull()
  })
})

describe('shapes of the mosaic groups', () => {
  // 4 columns:
  //   1 1 2 3
  //   4 1 5 3
  //   6 7 1 9
  const grid = [1, 1, 2, 3, 4, 1, 5, 3, 6, 7, 1, 9]

  test('extracts each group with its digit, cells and shape', () => {
    const groups = mosaicGroups(grid, 4)
    expect(groups.map((g) => [g.digit, g.indices])).toEqual([
      [1, [0, 1, 5, 10]],
      [3, [3, 7]],
    ])
    // The 3s stack vertically: a pair, same free shape as a horizontal pair, different fixed shape.
    expect(groups[1]!.shape).toBe(
      freeKey([
        [0, 0],
        [1, 0],
      ]),
    )
    expect(groups[1]!.fixed).toBe('0,0;0,1')
  })

  test('the same digits in another width make other shapes', () => {
    const census = (cols: number) =>
      shapeCensus(mosaicGroups(grid, cols)).map((c) => [shapeName(c.shape) ?? c.shape, c.count])
    // 4 columns: the 3s stack into a pair; the 1s make a 4-cell hook.
    expect(census(4)).toEqual([
      ['pair', 1],
      ['0,0;0,1;1,1;2,2', 1],
    ])
    // 3 columns: the same 3s become a diagonal pair and the 1s lose a member (a 3-cell bend).
    expect(census(3)).toEqual([
      ['diagonal pair', 1],
      ['0,0;0,1;1,2', 1],
    ])
  })

  test('respects size limits and absolute row positions', () => {
    expect(mosaicGroups([7, 7, 7, 7, 7, 7], 10, 0, 2, 5)).toEqual([])
    expect(mosaicGroups([7, 7], 4, 3)).toEqual([]) // row end + next row start: not neighbours
  })
})

describe('sweep geometry', () => {
  test('each width fills the frame: columns span the width, recent digits fill the height', () => {
    const wide = sweepFrame(820, 520, 1, 30, 5000)
    expect(wide.cell).toBeCloseTo(800 / 30)
    expect(wide.window).toBe(30 * Math.floor(500 / (800 / 30)))
    // Fewer columns: bigger cells (capped at 30 px) and fewer rows.
    const narrow = sweepFrame(820, 520, 1, 10, 5000)
    expect(narrow.cell).toBe(30)
    expect(narrow.window).toBe(10 * Math.floor(500 / 30))
    // Never more than has been played, nor more than a frame can afford.
    expect(sweepFrame(820, 520, 1, 30, 7).window).toBe(7)
    expect(sweepFrame(820, 5200, 1, 120, 1e6).window).toBe(SWEEP_MAX_WINDOW)
  })

  test('targets are centred and rows count from the first shown digit', () => {
    const frame = sweepFrame(820, 520, 1, 30, 5000)
    const [x, y] = sweepTarget(frame, 20, 40, 45)
    expect(x).toBeCloseTo(10 + (800 - 20 * frame.cell) / 2 + 5.5 * frame.cell)
    expect(y).toBeCloseTo(10 + 0.5 * frame.cell)
  })

  test('smoothing is frame-rate independent', () => {
    let a = 0
    for (let i = 0; i < 10; i++) a = approach(a, 100, 0.01, 0.1)
    expect(approach(0, 100, 0.1, 0.1)).toBeCloseTo(a)
    expect(a).toBeCloseTo(100 * (1 - Math.exp(-1)))
  })
})

test('the rarest five-digit shapes have names: plus and X', () => {
  const plus: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ]
  const x: [number, number][] = [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ]
  expect(shapeName(freeKey(plus))).toBe('plus')
  expect(shapeName(freeKey(x))).toBe('X')
})
