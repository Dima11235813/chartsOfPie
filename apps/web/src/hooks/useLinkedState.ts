import { useEffect, useState } from 'react'
import type { CompositionConfig } from '../core/composition/config'
import { DEFAULT_PRESET_ID, getPreset, PRESETS } from '../core/composition/presets'
import { buildShareHash, parseShareHash } from '../core/piece/shareLink'
import type { VisualConfig } from '../core/piece/visualConfig'

const defaultSound = () => (getPreset(DEFAULT_PRESET_ID) ?? PRESETS[0]!).config

export interface LinkedState {
  config: CompositionConfig
  setConfig: (config: CompositionConfig) => void
  visual: VisualConfig
  setVisual: (visual: VisualConfig) => void
  /** True when the URL held something that could not be read. */
  invalidLink: boolean
}

/**
 * Sound and view kept in sync with the URL hash, so every moment is a shareable link
 * (format: core/piece/shareLink). `fallbackVisual` is used when the link names no view.
 */
export function useLinkedState(fallbackVisual: () => VisualConfig): LinkedState {
  const [initial] = useState(() => {
    const shared = parseShareHash(typeof window === 'undefined' ? '' : window.location.hash)
    return {
      config: shared.sound ?? defaultSound(),
      visual: shared.visual ?? fallbackVisual(),
      invalidLink: shared.invalid,
    }
  })
  const [config, setConfig] = useState(initial.config)
  const [visual, setVisual] = useState(initial.visual)

  useEffect(() => {
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}${buildShareHash(config, visual)}`)
  }, [config, visual])

  return { config, setConfig, visual, setVisual, invalidLink: initial.invalidLink }
}
