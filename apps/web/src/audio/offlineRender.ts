import * as Tone from 'tone'
import { Arranger } from '../core/composition/arranger'
import type { CompositionConfig } from '../core/composition/config'
import type { DigitSource } from '../core/digits/digitSource'
import { seededRandom } from '../core/random/seededRandom'
import { soundSettingsFor } from './settings'
import { createSoundChain } from './soundChain'

export interface RenderResult {
  channels: Float32Array[]
  sampleRate: number
  notes: number
}

/**
 * Render a config faster than real time with the exact live audio graph. Deterministic for a
 * given seed, so renders can be compared before/after a sound-design change.
 */
export async function renderConfig(
  config: CompositionConfig,
  source: DigitSource,
  { seconds = 20, tail = 3, seed = 1, startIndex = 0 } = {},
): Promise<RenderResult> {
  let notes = 0
  const buffer = await Tone.Offline(async () => {
    const chain = await createSoundChain(Tone, soundSettingsFor(config))
    const arranger = new Arranger(config, seededRandom(seed))
    let time = 0.05
    chain.startDrone(time)
    for (let index = startIndex; time < seconds - tail && index < source.length; index++) {
      const step = arranger.arrange(source.digitAt(index), index)
      if (step.note !== null) {
        chain.playNote(step.note, step.durationSec, time, step.velocity)
        notes++
      }
      time += step.delayMs / 1000
    }
    chain.stopDrone(seconds - tail)
  }, seconds)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i).slice(),
  )
  return { channels, sampleRate: buffer.sampleRate, notes }
}
