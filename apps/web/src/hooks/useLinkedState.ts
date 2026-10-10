import { useCallback, useEffect, useState } from 'react'
import type { CompositionConfig } from '../core/composition/config'
import { DEFAULT_PRESET_ID, getPreset, PRESETS } from '../core/composition/presets'
import { buildShareHash, parseShareHash } from '../core/piece/shareLink'
import type { VisualConfig } from '../core/piece/visualConfig'
import { DEFAULT_SOURCE_CONFIG, sameSource, type SourceConfig } from '../core/series/sourceConfig'

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
  /** Which number plays (π unless a link or piece names another). */
  source: SourceConfig
  setSource: (source: SourceConfig) => void
  /**
   * The link named a number this version does not know (made by a newer app). π plays meanwhile;
   * the value stays in the link until another number is chosen, so updating the app opens it.
   */
  newerSource: string | null
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
      source: shared.source ?? DEFAULT_SOURCE_CONFIG,
      newerSource: shared.newerSource,
      invalidLink: Boolean(hash) && shared.invalid,
    }
  })
  const [config, setConfig] = useState(initial.config)
  const [visual, setVisual] = useState(initial.visual)
  const [start, setStart] = useState(initial.start)
  const [source, setSourceState] = useState(initial.source)
  const [newerSource, setNewerSource] = useState(initial.newerSource)
  const setSource = useCallback((next: SourceConfig) => {
    setNewerSource(null)
    // Keep the same object for the same number, so playback does not reload it.
    setSourceState((prev) => (sameSource(prev, next) ? prev : next))
  }, [])

  useEffect(() => {
    const { pathname, search } = window.location
    const hash = buildShareHash(config, visual, start, newerSource ?? source)
    window.history.replaceState(null, '', `${pathname}${search}${hash}`)
    try {
      localStorage.setItem(LAST_SESSION_KEY, hash)
    } catch {
      // not remembered (private mode)
    }
  }, [config, visual, start, source, newerSource])

  return {
    config,
    setConfig,
    visual,
    setVisual,
    start,
    setStart,
    source,
    setSource,
    newerSource,
    invalidLink: initial.invalidLink,
  }
}
