import { useEffect, useRef, useState } from 'react'
import type { CompositionConfig } from '../core/composition/config'
import type { PerformanceLog } from '../core/composition/performanceLog'
import { performanceToMidi } from '../core/midi/exportPerformance'
import {
  canRecord,
  downloadBlob,
  exportFileName,
  extensionFor,
  SessionRecorder,
  type Recording,
} from '../media/sessionRecorder'

interface ExportPanelProps {
  config: CompositionConfig
  /** Preset name or "Custom", used in file names and the video caption. */
  label: string
  log: PerformanceLog
  noteCount: number
  audioReady: boolean
  getAudioStream: () => MediaStream | null
  getCanvas: () => HTMLCanvasElement | null
  /** Live caption for the video, e.g. "Lydian dream · digit 1,234". */
  getCaption: () => string
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

const formatSize = (bytes: number) =>
  bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(bytes / 1000)} kB`

export function ExportPanel(props: ExportPanelProps) {
  const { config, label, log, noteCount, audioReady } = props
  const [recorder, setRecorder] = useState<SessionRecorder | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recordingLabel = useRef(label)

  useEffect(() => {
    if (!recorder) return
    const timer = setInterval(() => setElapsed(recorder.elapsedSec), 250)
    return () => clearInterval(timer)
  }, [recorder])

  const downloadMidi = () => {
    const bytes = performanceToMidi(log.notes, config)
    downloadBlob(
      new Blob([bytes as BlobPart], { type: 'audio/midi' }),
      exportFileName(label, 'mid'),
    )
  }

  const saveImage = () => {
    const canvas = props.getCanvas()
    canvas?.toBlob((blob) => {
      if (blob) downloadBlob(blob, exportFileName(label, 'png'))
    }, 'image/png')
  }

  const toggleRecording = async () => {
    setError(null)
    if (recorder) {
      setRecorder(null)
      setRecording(await recorder.stop())
      return
    }
    try {
      const next = new SessionRecorder({
        audio: props.getAudioStream(),
        getSource: props.getCanvas,
        getCaption: props.getCaption,
      })
      next.start()
      recordingLabel.current = label
      setRecording(null)
      setElapsed(0)
      setRecorder(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const recordable = canRecord()

  return (
    <section className="export-panel" aria-labelledby="export-heading">
      <h2 id="export-heading">Export</h2>
      <div className="export-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={downloadMidi}
          disabled={noteCount === 0}
        >
          Download MIDI
        </button>
        <button type="button" className="btn btn-small" onClick={saveImage}>
          Save image
        </button>
        <button
          type="button"
          className={`btn btn-small${recorder ? ' btn-recording' : ''}`}
          onClick={() => void toggleRecording()}
          disabled={!recordable || (!audioReady && !recorder)}
          aria-pressed={Boolean(recorder)}
        >
          {recorder ? `■ Stop ${formatTime(elapsed)}` : '● Record video'}
        </button>
      </div>
      {!recordable && <p className="hint">Recording isn't supported in this browser.</p>}
      {recordable && !audioReady && !recorder && (
        <p className="hint">Press Play first, then record what you see and hear.</p>
      )}
      {error && (
        <p className="notice error" role="status">
          Recording failed: {error}
        </p>
      )}
      {recording && (
        <ul className="downloads" aria-label="Recordings">
          {recording.video && (
            <li>
              <button
                type="button"
                className="link"
                onClick={() =>
                  downloadBlob(
                    recording.video!,
                    exportFileName(recordingLabel.current, extensionFor(recording.video!.type)),
                  )
                }
              >
                Download video ({formatTime(recording.durationSec)},{' '}
                {formatSize(recording.video.size)})
              </button>
            </li>
          )}
          {recording.audio && (
            <li>
              <button
                type="button"
                className="link"
                onClick={() =>
                  downloadBlob(
                    recording.audio!,
                    exportFileName(
                      `${recordingLabel.current}-audio`,
                      extensionFor(recording.audio!.type),
                    ),
                  )
                }
              >
                Download audio ({formatSize(recording.audio.size)})
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
