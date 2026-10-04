import { useCallback, useEffect, useMemo, useState } from 'react'
import { LiveMidiSender } from '../core/midi/liveMidi'
import type { MidiTappedPlayer } from './midiTap'

export type MidiMode = 'both' | 'midi-only'

export interface MidiPrefs {
  /** Send notes to the device. */
  enabled: boolean
  /** Remembered by name: ids change between sessions on some systems. */
  deviceName: string | null
  channel: number
  latencyMs: number
  mode: MidiMode
}

const KEY = 'charts-of-pie:midi-out'
const DEFAULTS: MidiPrefs = {
  enabled: true,
  deviceName: null,
  channel: 1,
  latencyMs: 0,
  mode: 'both',
}

function readPrefs(): MidiPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MidiPrefs>) }
  } catch {
    // unavailable or unreadable: defaults
  }
  return DEFAULTS
}

export interface MidiOutputState {
  supported: boolean
  connected: boolean
  error: string | null
  outputs: { id: string; name: string }[]
  /** The output notes go to (by name), or null. */
  device: string | null
  prefs: MidiPrefs
  connect(): Promise<void>
  setPrefs(change: Partial<MidiPrefs>): void
  sendProgram(program: number): void
}

const isSupported = () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

/** Prefer a Nord if one is plugged in, else the first output. */
const pickDefault = (names: string[]) => names.find((n) => /nord/i.test(n)) ?? names[0] ?? null

/**
 * Web MIDI output (F02.7): ask for access (permission prompt), list outputs, and route the player's
 * notes to the chosen one. Preferences are per device (localStorage), not part of shared pieces.
 */
export function useMidiOutput(player: MidiTappedPlayer): MidiOutputState {
  const supported = isSupported()
  const [access, setAccess] = useState<MIDIAccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [prefs, setPrefsState] = useState(readPrefs)

  const connect = useCallback(async () => {
    if (!isSupported()) return
    try {
      const midi = await navigator.requestMIDIAccess({ sysex: false })
      const refresh = () => setOutputs([...midi.outputs.values()])
      midi.onstatechange = refresh
      refresh()
      setAccess(midi)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'MIDI access was refused')
    }
  }, [])

  // Reconnect silently on later visits once permission was granted.
  useEffect(() => {
    if (!isSupported() || !navigator.permissions) return
    navigator.permissions
      .query({ name: 'midi' as PermissionName })
      .then((status) => {
        if (status.state === 'granted') void connect()
      })
      .catch(() => {})
  }, [connect])

  const setPrefs = useCallback((change: Partial<MidiPrefs>) => {
    setPrefsState((current) => {
      const next = { ...current, ...change }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // not remembered
      }
      return next
    })
  }, [])

  const names = outputs.map((o) => o.name ?? o.id)
  const device =
    prefs.deviceName && names.includes(prefs.deviceName) ? prefs.deviceName : pickDefault(names)
  const output = outputs.find((o) => (o.name ?? o.id) === device) ?? null

  const sender = useMemo(
    () =>
      output && prefs.enabled
        ? new LiveMidiSender((bytes, at) => output.send(bytes, at), {
            channel: prefs.channel,
            latencyMs: prefs.latencyMs,
          })
        : null,
    [output, prefs.enabled, prefs.channel, prefs.latencyMs],
  )

  useEffect(() => {
    player.setRoute(sender && { sender, internalSound: prefs.mode === 'both' })
    return () => player.setRoute(null)
  }, [player, sender, prefs.mode])

  return {
    supported,
    connected: access !== null,
    error,
    outputs: outputs.map((o) => ({ id: o.id, name: o.name ?? o.id })),
    device,
    prefs,
    connect,
    setPrefs,
    sendProgram: (program) => sender?.program(program),
  }
}
