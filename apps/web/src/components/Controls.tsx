import { VIEWS, type ViewId } from './views'
import { CHART_STYLES, type ChartStyle } from './chartConfig'

interface ControlsProps {
  disabled: boolean
  isPlaying: boolean
  isFinished: boolean
  muted: boolean
  chartStyle: ChartStyle
  view: ViewId
  onToggle: () => void
  onStep: () => void
  onReset: () => void
  onMutedChange: (muted: boolean) => void
  onChartStyleChange: (style: ChartStyle) => void
  onViewChange: (view: ViewId) => void
}

export function Controls(props: ControlsProps) {
  const { disabled, isPlaying, isFinished, muted, chartStyle, view } = props
  return (
    <div className="controls" role="toolbar" aria-label="Playback controls">
      <button
        type="button"
        id="action"
        className="btn btn-primary"
        onClick={props.onToggle}
        disabled={disabled || isFinished}
        aria-pressed={isPlaying}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        className="btn"
        onClick={props.onStep}
        disabled={disabled || isFinished}
      >
        Step
      </button>
      <button type="button" className="btn" onClick={props.onReset} disabled={disabled}>
        Reset
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => props.onMutedChange(!muted)}
        aria-pressed={muted}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <div className="view-selects">
        <label className="select">
          <span>View</span>
          <select value={view} onChange={(e) => props.onViewChange(e.target.value as ViewId)}>
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        {view === 'chart' && (
          <label className="select">
            <span>Chart style</span>
            <select
              value={chartStyle}
              onChange={(e) => props.onChartStyleChange(e.target.value as ChartStyle)}
            >
              {CHART_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
