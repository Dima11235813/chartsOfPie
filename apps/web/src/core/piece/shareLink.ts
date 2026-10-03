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
 * Every part is optional; links made by earlier versions must keep opening the same way
 * (fixtures/share-links.json).
 */

export interface SharedState {
  /** null: the link names no sound (use the default). */
  sound: CompositionConfig | null
  /** null: the link names no view (keep the current one). */
  visual: VisualConfig | null
  /** Part of the link was present but unreadable. */
  invalid: boolean
}

export function parseShareHash(hash: string): SharedState {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const presetId = params.get('p')
  const encodedSound = params.get('c')
  const encodedVisual = params.get('v')
  const sound = presetId
    ? (getPreset(presetId)?.config ?? null)
    : encodedSound
      ? decodeConfig(encodedSound)
      : null
  const visual = encodedVisual ? decodeVisualConfig(encodedVisual) : null
  const invalid =
    ((presetId !== null || encodedSound !== null) && !sound) ||
    (encodedVisual !== null && !visual) ||
    (hash.replace(/^#/, '') !== '' &&
      presetId === null &&
      encodedSound === null &&
      encodedVisual === null)
  return { sound, visual, invalid }
}

/** Presets get a readable hash, custom sounds are encoded; defaults are left out entirely. */
export function buildShareHash(sound: CompositionConfig, visual: VisualConfig): string {
  const parts: string[] = []
  const preset = findMatchingPreset(sound)
  if (preset?.id !== DEFAULT_PRESET_ID) {
    parts.push(preset ? `p=${preset.id}` : `c=${encodeConfig(sound)}`)
  }
  if (!sameVisualConfig(visual, DEFAULT_VISUAL_CONFIG))
    parts.push(`v=${encodeVisualConfig(visual)}`)
  return parts.length ? `#${parts.join('&')}` : ''
}
