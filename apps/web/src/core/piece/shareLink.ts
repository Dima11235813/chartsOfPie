import { decodeConfig, encodeConfig, type CompositionConfig } from '../composition/config'
import { DEFAULT_PRESET_ID, findMatchingPreset, getPreset } from '../composition/presets'
import {
  decodeVisualConfig,
  DEFAULT_VISUAL_CONFIG,
  encodeVisualConfig,
  sameVisualConfig,
  type VisualConfig,
} from './visualConfig'

/*
 * Share links put the whole piece in the URL hash, so they need no server:
 *   #p=<preset id>   or   #c=<encoded CompositionConfig>     — the sound (since S02.5.1)
 *   &v=<encoded VisualConfig>                                — the view (since S10.2.2)
 *   &at=<decimal place>                                      — where in π it starts (S01.7.1)
 * Every part is optional; links made by earlier versions must keep opening the same way
 * (fixtures/share-links.json).
 */

export interface SharedState {
  /** null: the link names no sound (use the default). */
  sound: CompositionConfig | null
  /** null: the link names no view (keep the current one). */
  visual: VisualConfig | null
  /** null: the link names no starting point (start at the beginning). */
  start: number | null
  /** Part of the link was present but unreadable. */
  invalid: boolean
}

/** Starting points are plain decimal places, at most nine digits (π data may grow). */
const START = /^\d{1,9}$/

export function parseShareHash(hash: string): SharedState {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const presetId = params.get('p')
  const encodedSound = params.get('c')
  const encodedVisual = params.get('v')
  const at = params.get('at')
  const start = at !== null && START.test(at) ? Number(at) : null
  const sound = presetId
    ? (getPreset(presetId)?.config ?? null)
    : encodedSound
      ? decodeConfig(encodedSound)
      : null
  const visual = encodedVisual ? decodeVisualConfig(encodedVisual) : null
  const invalid =
    ((presetId !== null || encodedSound !== null) && !sound) ||
    (encodedVisual !== null && !visual) ||
    (at !== null && start === null) ||
    (hash.replace(/^#/, '') !== '' &&
      presetId === null &&
      encodedSound === null &&
      encodedVisual === null &&
      at === null)
  return { sound, visual, start, invalid }
}

/** Presets get a readable hash, custom sounds are encoded; defaults are left out entirely. */
export function buildShareHash(sound: CompositionConfig, visual: VisualConfig, start = 0): string {
  const parts: string[] = []
  const preset = findMatchingPreset(sound)
  if (preset?.id !== DEFAULT_PRESET_ID) {
    parts.push(preset ? `p=${preset.id}` : `c=${encodeConfig(sound)}`)
  }
  if (!sameVisualConfig(visual, DEFAULT_VISUAL_CONFIG))
    parts.push(`v=${encodeVisualConfig(visual)}`)
  if (start > 0) parts.push(`at=${Math.floor(start)}`)
  return parts.length ? `#${parts.join('&')}` : ''
}
