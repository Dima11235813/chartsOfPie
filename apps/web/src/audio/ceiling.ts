/**
 * Transfer curves for the master ceiling (the WaveShaper at the end of the sound chain).
 *
 * A WaveShaper clamps any input beyond ±1 to the ends of its curve, so a curve over ±1 hard-clips
 * everything louder than full scale. The chain therefore scales the signal by 1 / CEILING_RANGE
 * before the shaper, and these curves cover ±CEILING_RANGE: up to +12 dB of overload is shaped
 * smoothly instead of being cut off.
 */
export const CEILING_RANGE = 4
const POINTS = 8193

/** Identity up to `knee`, then a tanh shoulder that approaches (never reaches) `ceiling`. */
export function softKnee(knee: number, ceiling: number): (x: number) => number {
  const width = ceiling - knee
  return (x) => {
    const magnitude = Math.abs(x)
    const shaped =
      magnitude <= knee ? magnitude : knee + width * Math.tanh((magnitude - knee) / width)
    return Math.sign(x) * shaped
  }
}

/** Polished presets (compression on): linear to 0.8 (-1.9 dBFS), never above 0.98. */
export const SOFT_CLIP = softKnee(0.8, 0.98)

/**
 * Compression off with anything added to the bare signal (volume up, reverb, echo, drone):
 * linear to 0.85 (-1.4 dBFS), then rounded off below 0.97 instead of hard-clipping at full scale
 * (B-020). The ceiling sits a little under 1 because the 4x-oversampled shaper's filters overshoot
 * slightly on bright, heavily shaped peaks.
 */
export const SAFETY = softKnee(0.85, 0.97)

/** Exact identity over the whole range. */
export const TRANSPARENT = (x: number) => x

export type CeilingMode = 'transparent' | 'safety' | 'soft-clip'

/**
 * Which curve the ceiling uses. The Original preset's bare signal peaks at -0.1 dBFS, so any knee
 * below full scale would round its triangle-wave peaks and change the 2019 sound; it stays exactly
 * transparent until something is added on top of it, which is precisely when it used to clip.
 */
export function ceilingMode(s: {
  compress: boolean
  volume: number
  reverb: number
  echo: number
  drone: unknown
}): CeilingMode {
  if (s.compress) return 'soft-clip'
  const bare = s.volume <= 0 && s.reverb === 0 && s.echo === 0 && !s.drone
  return bare ? 'transparent' : 'safety'
}

/** Samples `transfer` over ±CEILING_RANGE for a WaveShaper fed with input / CEILING_RANGE. */
export function ceilingCurve(transfer: (x: number) => number): Float32Array<ArrayBuffer> {
  return Float32Array.from({ length: POINTS }, (_, i) =>
    transfer(((2 * i) / (POINTS - 1) - 1) * CEILING_RANGE),
  )
}
