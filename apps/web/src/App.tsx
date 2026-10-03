import { useCallback, useEffect, useRef, useState } from 'react'
import { createToneNotePlayer, type NotePlayer } from './audio/notePlayer'
import { findMatchingPreset } from './core/composition/presets'
import type { DigitSource } from './core/digits/digitSource'
import { loadPiDigits } from './core/digits/pi'
import { Controls } from './components/Controls'
import { VIEWS, type ViewId } from './components/views'
import { DigitChart } from './components/DigitChart'
import { ExportPanel } from './components/ExportPanel'
import { SoundPanel } from './components/SoundPanel'
import { SpectrogramView } from './components/viz/SpectrogramView'
import { StaffView } from './components/viz/StaffView'
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
  const [view, setView] = useState<ViewId>('chart')
  const { config, setConfig, invalidLink } = useCompositionConfig()
  const playback = usePiPlayback(player, config, loadSource)
  const { load } = playback
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // The old view's cleanup (null) runs before the new view registers its canvas.
  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
  }, [])
  const label = findMatchingPreset(config)?.name ?? 'Custom'
  const captionRef = useRef('')
  useEffect(() => {
    captionRef.current = `${label} · ${playback.total.toLocaleString()} digits of π${
      playback.lastChord ? ` · last chord ${playback.lastChord.chord.symbol}` : ''
    }`
  }, [label, playback.total, playback.lastChord])

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
        <section className="stage" aria-label={VIEWS.find((v) => v.id === view)?.label}>
          {load.status === 'loading' && <p className="notice">Loading a million digits of π…</p>}
          {load.status === 'error' && (
            <p className="notice error" role="alert">
              {load.message}
            </p>
          )}
          {load.status === 'ready' && (
            <div className="chart-container">
              {view === 'chart' && (
                <DigitChart
                  style={chartStyle}
                  counts={playback.counts}
                  total={playback.total}
                  onCanvas={setCanvas}
                />
              )}
              {view === 'staff' && (
                <StaffView log={playback.log} isPlaying={playback.isPlaying} onCanvas={setCanvas} />
              )}
              {view === 'spectrogram' && (
                <SpectrogramView
                  analyser={playback.audioReady ? player.getAnalyser() : null}
                  isPlaying={playback.isPlaying}
                  onCanvas={setCanvas}
                />
              )}
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
          <ExportPanel
            config={config}
            label={label}
            log={playback.log}
            noteCount={playback.total}
            audioReady={playback.audioReady}
            getAudioStream={() => player.getAudioStream()}
            getCanvas={() => canvasRef.current}
            getCaption={() => captionRef.current}
          />
          <StatsPanel
            counts={playback.counts}
            total={playback.total}
            lastStep={playback.lastStep}
            recent={playback.recent}
            lastChord={playback.lastChord}
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
          view={view}
          onToggle={() => void playback.toggle()}
          onStep={() => void playback.step()}
          onReset={playback.reset}
          onMutedChange={playback.setMuted}
          onChartStyleChange={setChartStyle}
          onViewChange={setView}
        />
      </footer>
    </div>
  )
}
