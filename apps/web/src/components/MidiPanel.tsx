import { useId, useState } from 'react'
import type { MidiMode, MidiOutputState } from '../midi/useMidiOutput'

/**
 * "Play through MIDI": send the notes to a hardware instrument (e.g. a Nord Electro 4 over USB),
 * which plays them with its own sounds while every view keeps following (R-008, F02.7).
 */
export function MidiPanel({ midi }: { midi: MidiOutputState }) {
  const ids = {
    device: useId(),
    channel: useId(),
    mode: useId(),
    latency: useId(),
    program: useId(),
  }
  const [program, setProgram] = useState(1)
  const { prefs, setPrefs } = midi

  return (
    <details className="customize midi-panel">
      <summary>Play through MIDI (Nord, keyboards, DAWs)</summary>
      {!midi.supported ? (
        <p className="hint">
          This browser has no Web MIDI. Use Chrome, Edge or Firefox on a computer to play through a
          hardware instrument.
        </p>
      ) : !midi.connected ? (
        <>
          <p className="hint">
            Connect your instrument by USB (a Nord Electro 4 needs no driver), then allow MIDI
            access.
          </p>
          <button type="button" className="btn" onClick={() => void midi.connect()}>
            Connect MIDI
          </button>
          {midi.error && (
            <p className="notice error" role="status">
              {midi.error}
            </p>
          )}
        </>
      ) : midi.outputs.length === 0 ? (
        <p className="hint" role="status">
          No MIDI outputs found. Plug in the instrument (and switch it on) — it appears here
          automatically.
        </p>
      ) : (
        <div>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => setPrefs({ enabled: e.target.checked })}
            />
            Send notes to {midi.device}
          </label>
          <div className="field">
            <label htmlFor={ids.device}>Device</label>
            <select
              id={ids.device}
              value={midi.device ?? ''}
              onChange={(e) => setPrefs({ deviceName: e.target.value })}
            >
              {midi.outputs.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor={ids.mode}>Play on</label>
              <select
                id={ids.mode}
                value={prefs.mode}
                onChange={(e) => setPrefs({ mode: e.target.value as MidiMode })}
              >
                <option value="both">Both</option>
                <option value="midi-only">Instrument only</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={ids.channel}>Channel</label>
              <select
                id={ids.channel}
                value={prefs.channel}
                onChange={(e) => setPrefs({ channel: Number(e.target.value) })}
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor={ids.latency}>
              Latency <output>{prefs.latencyMs} ms</output>
            </label>
            <input
              id={ids.latency}
              type="range"
              min={-100}
              max={150}
              step={5}
              value={prefs.latencyMs}
              onChange={(e) => setPrefs({ latencyMs: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor={ids.program}>Program change (1–128)</label>
            <span className="inline-row">
              <input
                id={ids.program}
                type="number"
                min={1}
                max={128}
                value={program}
                onChange={(e) => setProgram(Number(e.target.value))}
              />
              <button
                type="button"
                className="btn btn-small"
                onClick={() => midi.sendProgram(program)}
              >
                Send
              </button>
            </span>
          </div>
          <p className="hint">
            The instrument must listen on the same channel (Nord Electro 4: System → MIDI Channel,
            default 1). Move Latency until the instrument and the views line up.
          </p>
        </div>
      )}
    </details>
  )
}
