import fontUrl from '../assets/fonts/JetBrainsMono-SemiBold.ttf'

/**
 * The face the Typographic view sets its digits in (B-027). Bundled rather than left to the
 * generic `monospace` family, which resolves to a different font on every OS: the view then looks
 * the same on every device, and the poster regression baselines match between machines.
 * Loaded on demand (270 KB) by the view and the poster renderer, never for other views.
 */
export const TYPE_FONT_FAMILY = 'JetBrains Mono'
export const TYPE_FONT_WEIGHT = 600

let loading: Promise<void> | null = null

/** Resolves once the face is available to canvas text (at once on later calls). */
export function loadTypeFont(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve()
  loading ??= new FontFace(TYPE_FONT_FAMILY, `url(${fontUrl})`, {
    weight: String(TYPE_FONT_WEIGHT),
  })
    .load()
    .then((face) => {
      document.fonts.add(face)
    })
    .catch(() => {
      // Offline or blocked: the fallback monospace face draws instead.
    })
  return loading
}
