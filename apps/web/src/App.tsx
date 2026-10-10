import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createToneNotePlayer, type NotePlayer } from './audio/notePlayer'
import { findMatchingPreset } from './core/composition/presets'
import type { DigitSource } from './core/digits/digitSource'
import { loadSource as loadSeriesSource } from './core/series/load'
import { sameSource, sourceKey, type SourceConfig } from './core/series/sourceConfig'
import { getSeries, SERIES, withSymbol, type SeriesId } from './core/series/series'
import { NumberContext } from './components/numberContext'
import { Controls } from './components/Controls'
import { VIEWS } from './components/views'
import { DigitChart } from './components/DigitChart'
import { ExportPanel } from './components/ExportPanel'
import { SoundPanel } from './components/SoundPanel'
import { SpectrogramView } from './components/viz/SpectrogramView'
import { StaffView } from './components/viz/StaffView'
import { DigitArtView } from './components/viz/DigitArtView'
import { HarmonographView } from './components/viz/HarmonographView'
import { MusicClockView } from './components/viz/MusicClockView'
import { FretboardView } from './components/viz/FretboardView'
import { CymaticsView } from './components/viz/CymaticsView'
import { OscilloscopeView } from './components/viz/OscilloscopeView'
import { StringArtView } from './components/viz/StringArtView'
import { PosterPanel } from './components/PosterPanel'
import { PaletteContext } from './components/palette'
import { noteTableFor } from './core/composition/arranger'
import { getPalette, PALETTES } from './viz/palettes'
import { StartPanel } from './components/StartPanel'
import { StatsPanel } from './components/StatsPanel'
import { DEFAULT_VISUAL_CONFIG, type VisualConfig } from './core/piece/visualConfig'
import { useLinkedState } from './hooks/useLinkedState'
import type { Piece } from './core/piece/piece'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { withMidiTap } from './midi/midiTap'
import { useMidiOutput } from './midi/useMidiOutput'
import { MidiPanel } from './components/MidiPanel'
import { PiecesPanel } from './components/PiecesPanel'
import { MosaicShapesPanel } from './components/MosaicShapesPanel'
import { createDefaultStore, type PieceStore } from './storage/pieceStore'
import { defaultAccountApi, type AccountApi } from './account/accountApi'
import { useAccount } from './account/useAccount'
import { AccountBar } from './components/AccountBar'
import { AccountPieces } from './components/AccountPieces'
import { usePiPlayback } from './hooks/usePiPlayback'

const PALETTE_KEY = 'charts-of-pie:palette'

type PaletteId = VisualConfig['palette']

/** The palette is also remembered as a device preference (it applies when a link names no view). */
function readStoredPalette(): PaletteId {
  try {
    const stored = localStorage.getItem(PALETTE_KEY)
    const palette = PALETTES.find((p) => p.id === stored)
    if (palette) return palette.id as PaletteId
  } catch {
    // storage unavailable
  }
  return DEFAULT_VISUAL_CONFIG.palette
}

const initialVisual = (): VisualConfig => ({
  ...DEFAULT_VISUAL_CONFIG,
  palette: readStoredPalette(),
})

interface AppProps {
  createPlayer?: () => NotePlayer
  /** Fetch or generate the symbols of a number (tests pass fixed digits). */
  loadSource?: (source: SourceConfig) => Promise<DigitSource>
  /** Where saved pieces live (IndexedDB by default; tests pass a memory store). */
  createStore?: () => PieceStore
  /** The account API (null = accounts hidden; default from VITE_API_URL). */
  createAccountApi?: () => AccountApi | null
}

export default function App({
  createPlayer = createToneNotePlayer,
  loadSource = loadSeriesSource,
  createStore = createDefaultStore,
  createAccountApi = defaultAccountApi,
}: AppProps) {
  const [store] = useState(createStore)
  const [accountApi] = useState(createAccountApi)
  const account = useAccount(accountApi)
  // Every note can also go to a MIDI instrument (e.g. a Nord) — see midi/midiTap.
  const [player] = useState(() => withMidiTap(createPlayer()))
  const midi = useMidiOutput(player)
  const {
    config,
    setConfig,
    visual,
    setVisual,
    start,
    setStart,
    source,
    setSource,
    newerSource,
    invalidLink,
  } = useLinkedState(initialVisual)
  const { view, chartStyle, palette: paletteId, viewOptions } = visual
  const updateVisual = useCallback(
    (change: Partial<VisualConfig>) => setVisual({ ...visual, ...change }),
    [visual, setVisual],
  )
  const updateViewOptions = <K extends keyof VisualConfig['viewOptions']>(
    key: K,
    options: VisualConfig['viewOptions'][K],
  ) => updateVisual({ viewOptions: { ...viewOptions, [key]: options } })
  const noteTable = useMemo(() => noteTableFor(config), [config])
  const colors = useMemo(() => getPalette(paletteId).digitColors(noteTable), [paletteId, noteTable])
  const changePalette = useCallback(
    (id: string) => {
      updateVisual({ palette: id as PaletteId })
      try {
        localStorage.setItem(PALETTE_KEY, id)
      } catch {
        // storage unavailable (private mode): the choice just isn't remembered
      }
    },
    [updateVisual],
  )
  // A new number reloads playback (from its first symbol); the same number keeps playing.
  const loadCurrentSource = useCallback(() => loadSource(source), [loadSource, source])
  const playback = usePiPlayback(player, config, loadCurrentSource, start)
  const { load } = playback
  const number = getSeries(source.series)
  // The symbols loaded are those of the chosen number (not the one it is switching from).
  const loaded = load.status === 'ready' && load.full.id === sourceKey(source) ? load : null
  // The starting point lives in the link (and the last session) once the digits are loaded.
  const playingFrom = loaded ? loaded.start : start
  useEffect(() => {
    if (playingFrom !== start) setStart(playingFrom)
  }, [playingFrom, start, setStart])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // The old view's cleanup (null) runs before the new view registers its canvas.
  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
  }, [])
  useKeyboardShortcuts(load.status === 'ready', {
    toggle: () => {
      if (!playback.isFinished) void playback.toggle()
    },
    step: () => {
      if (!playback.isFinished) void playback.step()
    },
    mute: () => playback.setMuted(!playback.muted),
    fullscreen: () => toggleFullscreen(),
  })
  const stageRef = useRef<HTMLElement | null>(null)
  // Neighbour mosaic: the width it is drawn at now (for the shape census) and an isolated shape.
  const [mosaicColumns, setMosaicColumns] = useState(12)
  const [shapeFilter, setShapeFilter] = useState<string | null>(null)
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stageRef.current?.requestFullscreen?.()
  }
  const label = findMatchingPreset(config)?.name ?? 'Custom'
  const changeNumber = (series: SeriesId) => {
    if (series === source.series) return
    // Decimal places of one number mean nothing in another: start the new one at its beginning.
    setStart(0)
    setSource({ version: 1, series, reading: getSeries(series).readings[0] })
  }
  // A piece of another number resumes once that number's symbols have loaded.
  const pendingPiece = useRef<Piece | null>(null)
  const resume = playback.seek
  useEffect(() => {
    const piece = pendingPiece.current
    if (!piece || !loaded) return
    pendingPiece.current = null
    resume(piece.position?.digitIndex ?? 0, piece.sound, piece.position?.start ?? 0)
  }, [loaded, resume])
  const openPiece = (piece: Piece) => {
    setConfig(piece.sound)
    setVisual(piece.visual)
    if (!sameSource(piece.source, source)) {
      setStart(piece.position?.start ?? 0)
      setSource(piece.source)
      pendingPiece.current = piece
      return
    }
    playback.seek(piece.position?.digitIndex ?? 0, piece.sound, piece.position?.start ?? 0)
  }
  const captionRef = useRef('')
  useEffect(() => {
    captionRef.current = `${label} · ${playback.total.toLocaleString()} digits of ${number.symbol}${
      playingFrom > 0 ? ` from decimal place ${playingFrom.toLocaleString()}` : ''
    }${playback.lastChord ? ` · last chord ${playback.lastChord.chord.symbol}` : ''}`
  }, [label, playback.total, playback.lastChord, playingFrom, number.symbol])

  return (
    <NumberContext.Provider value={number}>
      <PaletteContext.Provider value={colors}>
        <div className="app">
          <header className="app-header">
            <h1>
              <span className="logo" aria-hidden="true">
                π
              </span>{' '}
              Charts of Pie
            </h1>
            <p className="tagline">
              Watch and listen to the{' '}
              {loaded ? `first ${(loaded.full.length - 1).toLocaleString()}` : 'first million'}{' '}
              digits of{' '}
              <label className="number-pick">
                <select
                  aria-label="Number"
                  value={source.series}
                  onChange={(e) => changeNumber(e.target.value as SeriesId)}
                >
                  {SERIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </p>
            <AccountBar account={account} />
          </header>

          <main className="layout">
            <section
              className="stage"
              ref={stageRef}
              aria-label={withSymbol(
                VIEWS.find((v) => v.id === view)?.label ?? view,
                number.symbol,
              )}
            >
              {load.status === 'loading' && (
                <p className="notice">Loading the digits of {number.symbol}…</p>
              )}
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
                    <StaffView
                      log={playback.log}
                      isPlaying={playback.isPlaying}
                      onCanvas={setCanvas}
                    />
                  )}
                  {(view === 'ring' ||
                    view === 'walk' ||
                    view === 'sunflower' ||
                    view === 'mosaic' ||
                    view === 'hilbert' ||
                    view === 'type') && (
                    <DigitArtView
                      key={view}
                      kind={view}
                      source={load.source}
                      log={playback.log}
                      onCanvas={setCanvas}
                      mosaic={viewOptions.mosaic}
                      sunflower={viewOptions.sunflower}
                      onSunflowerChange={(change) =>
                        updateViewOptions('sunflower', { ...viewOptions.sunflower, ...change })
                      }
                      onMosaicChange={(change) =>
                        updateViewOptions('mosaic', { ...viewOptions.mosaic, ...change })
                      }
                      shapeFilter={view === 'mosaic' ? shapeFilter : null}
                      onLayout={setMosaicColumns}
                    />
                  )}
                  {view === 'clock' && (
                    <MusicClockView
                      log={playback.log}
                      noteTable={noteTable}
                      order={viewOptions.clock.order}
                      onOrderChange={(order) => updateViewOptions('clock', { order })}
                      onCanvas={setCanvas}
                    />
                  )}
                  {view === 'fretboard' && (
                    <FretboardView
                      log={playback.log}
                      noteTable={noteTable}
                      tuning={viewOptions.fretboard.tuning}
                      onTuningChange={(tuning) => updateViewOptions('fretboard', { tuning })}
                      onCanvas={setCanvas}
                    />
                  )}
                  {view === 'cymatics' && (
                    <CymaticsView log={playback.log} noteTable={noteTable} onCanvas={setCanvas} />
                  )}
                  {view === 'harmonograph' && (
                    <HarmonographView
                      log={playback.log}
                      pure={viewOptions.harmonograph.pure}
                      onPureChange={(pure) =>
                        updateViewOptions('harmonograph', { ...viewOptions.harmonograph, pure })
                      }
                      golden={viewOptions.harmonograph.golden}
                      onGoldenChange={(golden) =>
                        updateViewOptions('harmonograph', { ...viewOptions.harmonograph, golden })
                      }
                      onCanvas={setCanvas}
                    />
                  )}
                  {view === 'scope' && (
                    <OscilloscopeView
                      waveform={playback.audioReady ? player.getWaveform() : null}
                      isPlaying={playback.isPlaying}
                      color={colors[playback.lastStep?.digit ?? 3]!}
                      mode={viewOptions.scope.mode}
                      onModeChange={(mode) => updateViewOptions('scope', { mode })}
                      onCanvas={setCanvas}
                    />
                  )}
                  {view === 'strings' && (
                    <StringArtView
                      source={load.source}
                      log={playback.log}
                      onCanvas={setCanvas}
                      mode={viewOptions.stringArt.mode}
                      onModeChange={(mode) => updateViewOptions('stringArt', { mode })}
                    />
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
              {newerSource !== null && (
                <p className="notice error" role="status">
                  That share link plays a number this version of the app does not know yet, so π
                  plays instead. Reload or update the app to open it.
                </p>
              )}
              {invalidLink && (
                <p className="notice error" role="status">
                  That share link could not be read, so defaults are used for the parts that failed.
                </p>
              )}
              {load.status === 'ready' && (
                <StartPanel full={load.full} start={load.start} onStart={playback.startAt} />
              )}
              {view === 'mosaic' && load.status === 'ready' && (
                <MosaicShapesPanel
                  source={load.source}
                  played={playback.total}
                  columns={mosaicColumns}
                  selected={shapeFilter}
                  onSelect={setShapeFilter}
                />
              )}
              <SoundPanel config={config} onChange={setConfig} />
              <MidiPanel midi={midi} />
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
              <PiecesPanel
                store={store}
                sound={config}
                visual={visual}
                position={playback.total}
                start={playingFrom}
                source={source}
                suggestedName={`${label} · ${withSymbol(VIEWS.find((v) => v.id === view)?.label ?? view, number.symbol)}`}
                getCanvas={() => canvasRef.current}
                onOpen={openPiece}
                accountSection={
                  accountApi &&
                  account.token && (
                    <AccountPieces
                      api={accountApi}
                      token={account.token}
                      store={store}
                      onOpen={openPiece}
                    />
                  )
                }
              />
              {load.status === 'ready' && (
                <PosterPanel
                  source={load.full}
                  settings={{
                    mosaicColumns: viewOptions.mosaic.columns || undefined,
                    mosaicMinGroup: viewOptions.mosaic.minGroup,
                  }}
                />
              )}
              <StatsPanel
                counts={playback.counts}
                total={playback.total}
                lastStep={playback.lastStep}
                recent={playback.recent}
                lastChord={playback.lastChord}
                offset={playingFrom}
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
              onChartStyleChange={(style) => updateVisual({ chartStyle: style })}
              onViewChange={(id) => updateVisual({ view: id })}
              onFullscreen={toggleFullscreen}
              paletteId={paletteId}
              onPaletteChange={changePalette}
            />
          </footer>
        </div>
      </PaletteContext.Provider>
    </NumberContext.Provider>
  )
}
