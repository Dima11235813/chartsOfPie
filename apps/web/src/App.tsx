import { useState } from 'react'
import { createToneNotePlayer, type NotePlayer } from './audio/notePlayer'
import type { DigitSource } from './core/digits/digitSource'
import { loadPiDigits } from './core/digits/pi'
import { Controls } from './components/Controls'
import { DigitChart } from './components/DigitChart'
import { SoundPanel } from './components/SoundPanel'
import { StatsPanel } from './components/StatsPanel'
import { DEFAULT_CHART_STYLE, type ChartStyle } from './components/chartConfig'
import { useCompositionConfig } from './hooks/useCompositionConfig'
import { usePiPlayback } from './hooks/usePiPlayback'

interface AppProps {
  createPlayer?: () => NotePlayer
  loadSource?: () => Promise<DigitSource>
}

export default function App({
  createPlayer = createToneNotePlayer,
  loadSource = loadPiDigits,
}: AppProps) {
  const [player] = useState(createPlayer)
  const [chartStyle, setChartStyle] = useState<ChartStyle>(DEFAULT_CHART_STYLE)
  const { config, setConfig, invalidLink } = useCompositionConfig()
  const playback = usePiPlayback(player, config, loadSource)
  const { load } = playback

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="logo" aria-hidden="true">
            π
          </span>{' '}
          Charts of Pie
        </h1>
        <p className="tagline">Watch and listen to the first million digits of π.</p>
      </header>

      <main className="layout">
        <section className="stage" aria-label="Digit frequency chart">
          {load.status === 'loading' && <p className="notice">Loading a million digits of π…</p>}
          {load.status === 'error' && (
            <p className="notice error" role="alert">
              {load.message}
            </p>
          )}
          {load.status === 'ready' && (
            <div className="chart-container">
              <DigitChart style={chartStyle} counts={playback.counts} total={playback.total} />
            </div>
          )}
        </section>

        <aside className="panel">
          {invalidLink && (
            <p className="notice error" role="status">
              That share link could not be read, so the default sound is loaded.
            </p>
          )}
          <SoundPanel config={config} onChange={setConfig} />
          <StatsPanel
            counts={playback.counts}
            total={playback.total}
            lastStep={playback.lastStep}
            recent={playback.recent}
          />
          {playback.audioError && (
            <p className="notice error" role="status">
              Audio unavailable: {playback.audioError}
            </p>
          )}
        </aside>
      </main>

      <footer className="app-footer">
        <Controls
          disabled={load.status !== 'ready'}
          isPlaying={playback.isPlaying}
          isFinished={playback.isFinished}
          muted={playback.muted}
          chartStyle={chartStyle}
          onToggle={() => void playback.toggle()}
          onStep={() => void playback.step()}
          onReset={playback.reset}
          onMutedChange={playback.setMuted}
          onChartStyleChange={setChartStyle}
        />
      </footer>
    </div>
  )
}
