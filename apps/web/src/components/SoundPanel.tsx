import { useId, useState } from 'react'
import { DYNAMICS, RHYTHMS, TIMINGS, type CompositionConfig } from '../core/composition/config'
import { noteTableFor } from '../core/composition/arranger'
import { findMatchingPreset, getPreset, PRESETS } from '../core/composition/presets'
import { MAPPING_STRATEGIES } from '../core/music/mapping'
import { PITCH_CLASSES } from '../core/music/notes'
import { getScale, SCALE_CATALOGUE } from '../core/music/scaleCatalogue'
import { INSTRUMENTS } from '../audio/instruments'
import { useDigitColors } from './palette'

interface SoundPanelProps {
  config: CompositionConfig
  onChange: (config: CompositionConfig) => void
}

const CUSTOM = 'custom'

export function SoundPanel({ config, onChange }: SoundPanelProps) {
  const colors = useDigitColors()
  const preset = findMatchingPreset(config)
  const [lastPresetName, setLastPresetName] = useState(preset?.name ?? '')
  const [copied, setCopied] = useState(false)
  const set = <K extends keyof CompositionConfig>(key: K, value: CompositionConfig[K]) =>
    onChange({ ...config, [key]: value })
  const notes = noteTableFor(config)
  const scale = getScale(config.scale)
  const isTempo = config.timing === 'tempo'
  const usesSteps = config.rhythm !== 'legacy'

  const choosePreset = (id: string) => {
    const next = getPreset(id)
    if (!next) return
    setLastPresetName(next.name)
    onChange(next.config)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', window.location.href)
    }
  }

  return (
    <section className="sound-panel" aria-labelledby="sound-heading">
      <h2 id="sound-heading">Sound</h2>

      <Field label="Preset">
        {(id) => (
          <select
            id={id}
            value={preset?.id ?? CUSTOM}
            onChange={(e) => choosePreset(e.target.value)}
          >
            {!preset && (
              <option value={CUSTOM}>
                Custom{lastPresetName ? ` (from ${lastPresetName})` : ''}
              </option>
            )}
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <p className="hint">
        {preset?.description ?? 'Your own combination — share it with the link below.'}
      </p>

      <ol className="note-legend" aria-label="Which note each digit plays">
        {notes.map((note, digit) => (
          <li key={digit} title={`Digit ${digit} plays ${note}`}>
            <span className="legend-digit" style={{ color: colors[digit] }}>
              {digit}
            </span>
            <span className="legend-note">{note}</span>
          </li>
        ))}
      </ol>

      <details className="customize">
        <summary>Customize</summary>

        <fieldset>
          <legend>Notes</legend>
          <Field label="Scale">
            {(id) => (
              <select
                id={id}
                value={config.scale}
                disabled={config.mapping === 'semitones'}
                onChange={(e) => set('scale', e.target.value as CompositionConfig['scale'])}
              >
                {SCALE_CATALOGUE.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p className="hint">{scale.character}</p>
          <div className="field-row">
            <Field label="Root">
              {(id) => (
                <select
                  id={id}
                  value={config.root}
                  onChange={(e) => set('root', e.target.value as CompositionConfig['root'])}
                >
                  {PITCH_CLASSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Octave">
              {(id) => (
                <select
                  id={id}
                  value={config.octave}
                  onChange={(e) => set('octave', Number(e.target.value))}
                >
                  {[2, 3, 4, 5].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Digits → notes">
            {(id) => (
              <select
                id={id}
                value={config.mapping}
                onChange={(e) => set('mapping', e.target.value as CompositionConfig['mapping'])}
              >
                {MAPPING_STRATEGIES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p className="hint">
            {MAPPING_STRATEGIES.find((m) => m.id === config.mapping)?.description}
          </p>
        </fieldset>

        <fieldset>
          <legend>Time</legend>
          <Field label="Timing">
            {(id) => (
              <select
                id={id}
                value={config.timing}
                onChange={(e) => set('timing', e.target.value as CompositionConfig['timing'])}
              >
                {TIMINGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Range
            label="Tempo"
            value={config.bpm}
            min={30}
            max={240}
            step={1}
            format={(v) => `${v} BPM`}
            onChange={(v) => set('bpm', v)}
            disabled={!isTempo && !usesSteps}
          />
          <Field label="Steps per beat">
            {(id) => (
              <select
                id={id}
                value={config.subdivision}
                onChange={(e) =>
                  set('subdivision', Number(e.target.value) as CompositionConfig['subdivision'])
                }
              >
                <option value={1}>1 (quarter notes)</option>
                <option value={2}>2 (eighth notes)</option>
                <option value={4}>4 (sixteenth notes)</option>
              </select>
            )}
          </Field>
          <Field label="Rhythm">
            {(id) => (
              <select
                id={id}
                value={config.rhythm}
                onChange={(e) => set('rhythm', e.target.value as CompositionConfig['rhythm'])}
              >
                {RHYTHMS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p className="hint">{RHYTHMS.find((r) => r.id === config.rhythm)?.description}</p>
          <Range
            label="Note length"
            value={config.legato}
            min={0.25}
            max={4}
            step={0.05}
            format={(v) => `${v.toFixed(2)}× step`}
            onChange={(v) => set('legato', v)}
            disabled={!usesSteps}
          />
        </fieldset>

        <fieldset>
          <legend>Instrument &amp; space</legend>
          <Field label="Instrument">
            {(id) => (
              <select
                id={id}
                value={config.instrument}
                onChange={(e) =>
                  set('instrument', e.target.value as CompositionConfig['instrument'])
                }
              >
                {INSTRUMENTS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Dynamics">
            {(id) => (
              <select
                id={id}
                value={config.dynamics}
                onChange={(e) => set('dynamics', e.target.value as CompositionConfig['dynamics'])}
              >
                {DYNAMICS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Range
            label="Humanize"
            value={config.humanize}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(v) => set('humanize', v)}
          />
          <Range
            label="Reverb"
            value={config.reverb}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(v) => set('reverb', v)}
          />
          <Range
            label="Echo"
            value={config.echo}
            min={0}
            max={1}
            step={0.05}
            format={percent}
            onChange={(v) => set('echo', v)}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={config.drone}
              onChange={(e) => set('drone', e.target.checked)}
            />
            Drone (root + fifth underneath)
          </label>
          <Range
            label="Volume"
            value={config.volume}
            min={-30}
            max={6}
            step={1}
            format={(v) => `${v > 0 ? '+' : ''}${v} dB`}
            onChange={(v) => set('volume', v)}
          />
        </fieldset>
      </details>

      <button type="button" className="btn btn-small" onClick={() => void copyLink()}>
        {copied ? 'Link copied' : 'Copy share link'}
      </button>
    </section>
  )
}

const percent = (v: number) => `${Math.round(v * 100)}%`

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  )
}

interface RangeProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
}

function Range({ label, value, min, max, step, format, onChange, disabled }: RangeProps) {
  const id = useId()
  return (
    <div className="field range">
      <label htmlFor={id}>
        {label} <output htmlFor={id}>{format(value)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
