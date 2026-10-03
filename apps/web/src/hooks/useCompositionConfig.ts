import { useCallback, useEffect, useState } from 'react'
import { decodeConfig, encodeConfig, type CompositionConfig } from '../core/composition/config'
import {
  DEFAULT_PRESET_ID,
  findMatchingPreset,
  getPreset,
  PRESETS,
} from '../core/composition/presets'

const defaultConfig = () => (getPreset(DEFAULT_PRESET_ID) ?? PRESETS[0]!).config

/** Read `#p=<preset>` or `#c=<encoded config>` from a URL hash. */
export function configFromHash(hash: string): CompositionConfig | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const presetId = params.get('p')
  if (presetId) return getPreset(presetId)?.config ?? null
  const encoded = params.get('c')
  return encoded ? decodeConfig(encoded) : null
}

/** Presets get a readable hash; custom configs are encoded; the default gets none. */
export function hashForConfig(config: CompositionConfig): string {
  const preset = findMatchingPreset(config)
  if (preset?.id === DEFAULT_PRESET_ID) return ''
  return preset ? `#p=${preset.id}` : `#c=${encodeConfig(config)}`
}

export interface CompositionConfigState {
  config: CompositionConfig
  setConfig: (config: CompositionConfig) => void
  /** True when the URL held a config that could not be read. */
  invalidLink: boolean
}

/** Composition config kept in sync with the URL hash, so every sound is a shareable link. */
export function useCompositionConfig(): CompositionConfigState {
  const [initial] = useState(() => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash
    const fromHash = hash ? configFromHash(hash) : null
    return { config: fromHash ?? defaultConfig(), invalidLink: Boolean(hash) && !fromHash }
  })
  const [config, setConfigState] = useState(initial.config)

  useEffect(() => {
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}${hashForConfig(config)}`)
  }, [config])

  const setConfig = useCallback((next: CompositionConfig) => setConfigState(next), [])
  return { config, setConfig, invalidLink: initial.invalidLink }
}
