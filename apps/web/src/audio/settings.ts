import { droneNotesFor } from '../core/composition/arranger'
import type { CompositionConfig } from '../core/composition/config'
import type { SoundSettings } from './soundChain'

export function soundSettingsFor(config: CompositionConfig): SoundSettings {
  return {
    instrument: config.instrument,
    reverb: config.reverb,
    echo: config.echo,
    volume: config.volume,
    drone: config.drone ? droneNotesFor(config) : null,
    bpm: config.bpm,
    compress: config.compress,
  }
}
