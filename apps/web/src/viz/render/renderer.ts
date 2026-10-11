/**
 * Canvas renderers for the growing (digit-driven) art views. They are React-free so the same code
 * draws the live view and a print-size poster (see posters.ts).
 */

export type DigitAt = (index: number) => number

export interface RendererOptions {
  width: number
  height: number
  /** UI scale: devicePixelRatio for live views, ≈ width / 800 for posters. */
  scale: number
  /**
   * One colour per symbol: ten for decimal digits. Its length is the alphabet size, so a renderer
   * with one arc, direction or glyph per symbol draws k of them for a k-symbol source (F05.5).
   */
  colors: readonly string[]
  /** Symbol of the number drawn (the digit ring shows it in the middle); default π. */
  symbol?: string
  /**
   * The whole digit source, for renderers that show what is still to come (the Hilbert carpet
   * draws all million digits faintly and lights them up as they play).
   */
  ghost?: { count: number; digitAt: DigitAt }
}

export interface ComposeOverlay {
  /** Draw "now" markers (newest link, current position). Off for posters. */
  highlight: boolean
  /** Digits whose arcs/dots should glow (a chord just formed). */
  chordDigits?: ReadonlySet<number>
}

export interface DigitRenderer {
  /** Draw digits for steps [from, to) onto the accumulation layer. */
  draw(from: number, to: number, digitAt: DigitAt): void
  /** Paint the layer plus decorations onto `ctx` (clears it first). */
  compose(ctx: CanvasRenderingContext2D, overlay: ComposeOverlay): void
  /** Grid renderers report their current column count (shown and used as a starting point). */
  columns?(): number
}

export type RendererFactory = (options: RendererOptions) => DigitRenderer

export function createLayer(width: number, height: number): HTMLCanvasElement {
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  return layer
}
