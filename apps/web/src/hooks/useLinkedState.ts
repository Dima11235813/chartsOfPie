import { useEffect, useState } from 'react'
import type { CompositionConfig } from '../core/composition/config'
import { DEFAULT_PRESET_ID, getPreset, PRESETS } from '../core/composition/presets'
import { buildShareHash, parseShareHash } from '../core/piece/shareLink'
import type { VisualConfig } from '../core/piece/visualConfig'

/** The last sound + view, as a share-link hash, so a plain visit restores the last session. */
export const LAST_SESSION_KEY = 'charts-of-pie:last-session'

function readLastSession(): string {
  try {
    return localStorage.getItem(LAST_SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

const defaultSound = () => (getPreset(DEFAULT_PRESET_ID) ?? PRESETS[0]!).config

export interface LinkedState {
  config: CompositionConfig
  setConfig: (config: CompositionConfig) => void
  visual: VisualConfig
  setVisual: (visual: VisualConfig) => void
  /** Decimal place of π the performance starts at (0 = the beginning). */
  start: number
  setStart: (start: number) => void
  /** True when the URL held something that could not be read. */
  invalidLink: boolean
}

/**
 * Sound and view kept in sync with the URL hash, so every moment is a shareable link
 * (format: core/piece/shareLink). With no link, the last session is restored (owner decision
 * D3, R-007). `fallbackVisual` is used when neither names a view.
 */
export function useLinkedState(fallbackVisual: () => VisualConfig): LinkedState {
  const [initial] = useState(() => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash
    // A link always wins; otherwise pick up where the last visit left off (never an error).
    const shared = parseShareHash(hash || readLastSession())
    return {
      config: shared.sound ?? defaultSound(),
      visual: shared.visual ?? fallbackVisual(),
      start: shared.start ?? 0,
      invalidLink: Boolean(hash) && shared.invalid,
    }
  })
  const [config, setConfig] = useState(initial.config)
  const [visual, setVisual] = useState(initial.visual)
  const [start, setStart] = useState(initial.start)

  useEffect(() => {
    const { pathname, search } = window.location
    const hash = buildShareHash(config, visual, start)
    window.history.replaceState(null, '', `${pathname}${search}${hash}`)
    try {
      localStorage.setItem(LAST_SESSION_KEY, hash)
    } catch {
      // not remembered (private mode)
    }
  }, [config, visual, start])

  return {
    config,
    setConfig,
    visual,
    setVisual,
    start,
    setStart,
    invalidLink: initial.invalidLink,
  }
}
