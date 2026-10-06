import { act, renderHook } from '@testing-library/react'
import { useOnScreen } from './useOnScreen'

type Callback = (entries: { isIntersecting: boolean }[]) => void
let observed: Callback | null = null

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: Callback) {
        observed = callback
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

function mount() {
  const element = document.createElement('section')
  document.body.append(element)
  const hook = renderHook(() => useOnScreen<HTMLElement>())
  act(() => hook.result.current[0](element))
  return { element, hook }
}

test('follows scrolling in and out of the viewport', () => {
  const { hook } = mount()
  expect(hook.result.current[1]).toBe(true)
  act(() => observed!([{ isIntersecting: false }]))
  expect(hook.result.current[1]).toBe(false)
  act(() => observed!([{ isIntersecting: true }]))
  expect(hook.result.current[1]).toBe(true)
})

test('is hidden in a background tab', () => {
  const { hook } = mount()
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  act(() => void document.dispatchEvent(new Event('visibilitychange')))
  expect(hook.result.current[1]).toBe(false)
})

test('is hidden while something else is full screen, but not when it is inside it', () => {
  const { element, hook } = mount()
  const stage = document.createElement('div')
  Object.defineProperty(document, 'fullscreenElement', { value: stage, configurable: true })
  act(() => void document.dispatchEvent(new Event('fullscreenchange')))
  expect(hook.result.current[1]).toBe(false)
  stage.append(element)
  Object.defineProperty(document, 'fullscreenElement', { value: stage, configurable: true })
  act(() => void document.dispatchEvent(new Event('fullscreenchange')))
  expect(hook.result.current[1]).toBe(true)
})
