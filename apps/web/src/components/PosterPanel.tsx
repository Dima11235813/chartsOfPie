import { useId, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { downloadBlob, exportFileName } from '../media/sessionRecorder'
import {
  POSTER_DIGIT_COUNTS,
  POSTER_KINDS,
  POSTER_SIZES,
  renderPoster,
  type PosterKind,
} from '../viz/render/posters'
import { useDigitColors } from './palette'

interface PosterPanelProps {
  source: DigitSource
}

/** Print-size PNG of an artistic view for the first N digits of π, in the current palette. */
export function PosterPanel({ source }: PosterPanelProps) {
  const colors = useDigitColors()
  const [kind, setKind] = useState<PosterKind>('ring')
  const [count, setCount] = useState<number>(10_000)
  const [size, setSize] = useState<number>(POSTER_SIZES[0])
  /** null when idle, else 0–1 while rendering. */
  const [progress, setProgress] = useState<number | null>(null)
  const busy = progress !== null
  const ids = { kind: useId(), count: useId(), size: useId() }
  const maxDigits = Math.min(
    source.length,
    POSTER_KINDS.find((p) => p.kind === kind)?.maxDigits ?? 10_000,
  )
  const counts = POSTER_DIGIT_COUNTS.filter((c) => c <= maxDigits)
  const effectiveCount = Math.min(count, counts.at(-1) ?? 1_000)

  const download = async () => {
    setProgress(0)
    try {
      const canvas = await renderPoster(
        { kind, size, count: effectiveCount, digitAt: (i) => source.digitAt(i), colors },
        setProgress,
      )
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (blob) downloadBlob(blob, exportFileName(`poster-${kind}-${effectiveCount}`, 'png'))
    } finally {
      setProgress(null)
    }
  }

  return (
    <section className="export-panel" aria-labelledby="poster-heading">
      <h2 id="poster-heading">Poster</h2>
      <div className="field">
        <label htmlFor={ids.kind}>Artwork</label>
        <select id={ids.kind} value={kind} onChange={(e) => setKind(e.target.value as PosterKind)}>
          {POSTER_KINDS.map((p) => (
            <option key={p.kind} value={p.kind}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={ids.count}>Digits of π</label>
          <select
            id={ids.count}
            value={effectiveCount}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {counts.map((c) => (
              <option key={c} value={c}>
                {c.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={ids.size}>Size</label>
          <select id={ids.size} value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {POSTER_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} × {s}px
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => void download()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? `Rendering… ${Math.round((progress ?? 0) * 100)}%` : 'Download poster'}
      </button>
      <p className="hint">Uses the current colours. Large renders can take a few seconds.</p>
    </section>
  )
}
