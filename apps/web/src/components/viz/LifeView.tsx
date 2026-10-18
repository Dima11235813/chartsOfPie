import { useEffect, useRef, useState } from 'react'
import { createFrameBudget } from '../../viz/frameBudget'
import {
  DEAD,
  LifeHistory,
  lifeStep,
  population,
  type LifeGrid,
  type LifeStatus,
} from '../../viz/life'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface LifeViewProps {
  /** First generation (from the mosaic, see viz/life.ts). */
  seed: LifeGrid
  cols: number
  rows: number
  onExit: () => void
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

interface LifeState {
  grid: LifeGrid
  generation: number
  status: LifeStatus
  history: LifeHistory
}

/** Generations per second. */
const SPEEDS = [
  { value: 3, label: 'Slow' },
  { value: 8, label: 'Medium' },
  { value: 20, label: 'Fast' },
] as const

/**
 * Conway's Game of Life on the paused neighbour mosaic: the same grid, cells in their digit
 * colours, edges wrapping round. Runs on its own (silent) clock with Run / Next generation / Restart, says
 * when the board dies out or settles into a still life or oscillator, and goes back to the mosaic.
 */
export function LifeView({ seed, cols, rows, onExit, onCanvas }: LifeViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [running, setRunning] = useState(!prefersReducedMotion())
  const [speed, setSpeed] = useState<number>(SPEEDS[1].value)
  const start = (): LifeState => {
    const history = new LifeHistory()
    return { grid: seed, generation: 0, status: history.record(seed, 0), history }
  }
  const [state, setState] = useState(start)
  // The game runs outside React's updaters (which may run twice); state mirrors it for drawing.
  const game = useRef(state)

  const restart = () => {
    game.current = start()
    setState(game.current)
  }

  const advance = () => {
    const current = game.current
    if (current.status.kind === 'extinct') return
    const grid = lifeStep(current.grid, cols, rows)
    const generation = current.generation + 1
    const recorded = current.history.record(grid, generation)
    // Once repeating, keep the first period found (the board keeps cycling through it).
    const status = current.status.kind === 'repeating' ? current.status : recorded
    game.current = { ...current, grid, generation, status }
    setState(game.current)
  }

  // The clock: one generation per 1/speed s, never more often than the frame budget allows.
  useEffect(() => {
    if (!running || state.status.kind === 'extinct') return
    const budget = createFrameBudget({ minIntervalMs: 1000 / speed, watchFrames: true })
    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (budget.due(now)) budget.run(now, advance)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // advance only reads refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, state.status.kind, cols, rows])

  // Draw the current generation on the mosaic's grid (same cell size and position).
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const w = canvas.width
    const h = canvas.height
    const pad = 10 * size.ratio
    const cell = Math.min((w - pad * 2) / cols, (h - pad * 2) / rows)
    const x0 = pad + (w - pad * 2 - cols * cell) / 2
    ctx.clearRect(0, 0, w, h)
    const r = Math.max(0.6, cell * 0.42)
    const paths = colors.map(() => new Path2D())
    const { grid } = state
    for (let i = 0; i < grid.length; i++) {
      const digit = grid[i]!
      if (digit === DEAD) continue
      const x = x0 + (i % cols) * cell + cell / 2
      const y = pad + Math.floor(i / cols) * cell + cell / 2
      const path = paths[digit] ?? paths[0]!
      if (r < 2) path.rect(x - r, y - r, r * 2, r * 2)
      else {
        path.moveTo(x + r, y)
        path.arc(x, y, r, 0, Math.PI * 2)
      }
    }
    paths.forEach((path, digit) => {
      ctx.fillStyle = colors[digit]!
      ctx.fill(path)
    })
  }, [canvasRef, size, colors, state, cols, rows])

  const alive = population(state.grid)
  const { status, generation } = state
  const summary =
    status.kind === 'extinct'
      ? `Died out at generation ${generation}.`
      : status.kind === 'repeating'
        ? status.period === 1
          ? `Settled into a still life at generation ${status.since}: ${alive.toLocaleString()} cells alive.`
          : `Settled into an oscillator of period ${status.period} at generation ${status.since}: ${alive.toLocaleString()} cells alive.`
        : `Generation ${generation}: ${alive.toLocaleString()} cells alive.`
  // The bar has room for one line on wide stages: the long form is in the canvas's label.
  const short =
    status.kind === 'extinct'
      ? `Died out · gen ${generation}`
      : status.kind === 'repeating'
        ? `${status.period === 1 ? 'Still life' : `Period ${status.period}`} · gen ${generation} · ${alive.toLocaleString()} alive`
        : `Gen ${generation} · ${alive.toLocaleString()} alive`

  return (
    <div className="viz-layer viz-layer-with-bar">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={`Game of Life on the neighbour mosaic, ${cols} × ${rows}, edges wrapping round; cells keep their digit colours and newborns take their parents' colour. ${summary}`}
      />
      <div className="viz-columns" role="group" aria-label="Game of Life">
        <button
          type="button"
          className="btn"
          aria-pressed={running}
          disabled={status.kind === 'extinct'}
          onClick={() => setRunning(!running)}
        >
          {running ? 'Pause Life' : 'Run Life'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={running || status.kind === 'extinct'}
          aria-label="Next generation"
          onClick={advance}
        >
          Next
        </button>
        <label className="viz-columns-select">
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <output className="viz-columns-count" data-testid="life-status" aria-live="off">
          {short}
        </output>
        <button type="button" className="btn" onClick={restart}>
          Restart
        </button>
        <button type="button" className="btn" aria-label="Back to mosaic" onClick={onExit}>
          Mosaic
        </button>
      </div>
    </div>
  )
}
