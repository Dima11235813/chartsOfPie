import { act, renderHook } from '@testing-library/react'
import { useThrottled } from './useThrottled'

test('updates at most once per window and always ends on the latest value', () => {
  vi.useFakeTimers()
  const { result, rerender } = renderHook(({ v }) => useThrottled(v, 500), {
    initialProps: { v: 0 },
  })
  act(() => vi.advanceTimersByTime(600))
  for (let v = 1; v <= 5; v++) {
    rerender({ v })
    act(() => vi.advanceTimersByTime(50))
  }
  expect(result.current).toBe(0) // still inside the window: no recompute per change
  act(() => vi.advanceTimersByTime(600))
  expect(result.current).toBe(5) // …and the latest value lands
  vi.useRealTimers()
})
