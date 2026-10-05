import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PRESET_ID, getPreset } from '../core/composition/presets'
import { buildShareHash } from '../core/piece/shareLink'
import { DEFAULT_VISUAL_CONFIG, type VisualConfig } from '../core/piece/visualConfig'
import { LAST_SESSION_KEY, useLinkedState } from './useLinkedState'

const groupsOnly: VisualConfig = {
  ...DEFAULT_VISUAL_CONFIG,
  view: 'mosaic',
  viewOptions: {
    ...DEFAULT_VISUAL_CONFIG.viewOptions,
    mosaic: { ...DEFAULT_VISUAL_CONFIG.viewOptions.mosaic, columns: 12, minGroup: 3 },
  },
}
const hash = buildShareHash(getPreset(DEFAULT_PRESET_ID)!.config, groupsOnly)

describe('useLinkedState', () => {
  afterEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('opens a remembered mosaic on every digit: groups only is opt-in per visit (B-019)', () => {
    localStorage.setItem(LAST_SESSION_KEY, hash)
    window.history.replaceState(null, '', '/')
    const { result } = renderHook(() => useLinkedState(() => DEFAULT_VISUAL_CONFIG))
    expect(result.current.visual.view).toBe('mosaic')
    expect(result.current.visual.viewOptions.mosaic.columns).toBe(12)
    expect(result.current.visual.viewOptions.mosaic.minGroup).toBe(0)
  })

  it('keeps groups only when a shared link asks for it', () => {
    window.history.replaceState(null, '', `/${hash}`)
    const { result } = renderHook(() => useLinkedState(() => DEFAULT_VISUAL_CONFIG))
    expect(result.current.visual.viewOptions.mosaic.minGroup).toBe(3)
  })
})
