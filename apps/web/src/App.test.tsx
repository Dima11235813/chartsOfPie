import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createMemoryStore } from './storage/pieceStore'
import type { AccountApi, RemotePiece, Visibility } from './account/accountApi'
import type { NotePlayer } from './audio/notePlayer'
import { createDigitSource, parseDigits } from './core/digits/digitSource'
import { encodeConfig } from './core/composition/config'
import { getPreset } from './core/composition/presets'

// Chart.js needs a real canvas; the chart itself is covered by chartConfig tests and e2e.
// Canvas views need a real canvas; they are covered by viz unit tests and e2e.
vi.mock('./components/viz/StaffView', () => ({
  StaffView: () => <div data-testid="staff-view" />,
}))
vi.mock('./components/viz/SpectrogramView', () => ({
  SpectrogramView: ({ analyser }: { analyser: unknown }) => (
    <div data-testid="spectrogram-view">{analyser ? 'live' : 'idle'}</div>
  ),
}))

vi.mock('./components/DigitChart', () => ({
  DigitChart: ({ counts }: { counts: readonly number[] }) => (
    <div data-testid="chart">{counts.join(',')}</div>
  ),
}))

function fakePlayer() {
  return {
    start: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    playStep: vi.fn(),
    stop: vi.fn(),
    setMuted: vi.fn(),
    getAnalyser: vi.fn(() => null),
    getWaveform: vi.fn(() => null),
    getAudioStream: vi.fn(() => null),
    dispose: vi.fn(),
  } satisfies NotePlayer
}

const source = () => Promise.resolve(createDigitSource('pi', 'π', parseDigits('31415926')))

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // 5 × 42 ms between digits
    window.history.replaceState(null, '', '/')
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('does not autoplay: audio starts only after the user presses Play', async () => {
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    const play = await screen.findByRole('button', { name: 'Play' })
    await waitFor(() => expect(play).toBeEnabled())
    expect(player.start).not.toHaveBeenCalled()
    expect(player.playStep).not.toHaveBeenCalled()
  })

  it('plays digits as notes, updates counts, and pauses', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    const play = await screen.findByRole('button', { name: 'Play' })
    await waitFor(() => expect(play).toBeEnabled())

    await user.click(play)
    expect(player.start).toHaveBeenCalledTimes(1)
    // Original preset: digit 3 → G4 for 2n (1 s at Tone's default 120 BPM), full velocity.
    expect(player.playStep).toHaveBeenCalledWith('G4', 1, 1, 0)
    expect(screen.getByTestId('total-count')).toHaveTextContent('1')
    expect(screen.getByTestId('sound-data')).toHaveTextContent('G4 for 2n')

    // digit 1 → D4 for 1n (2 s), after the 210 ms legacy gap
    await waitFor(() => expect(player.playStep).toHaveBeenCalledWith('D4', 2, 1, 210), {
      timeout: 1000,
    })
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(player.stop).toHaveBeenCalled()
    const played = player.playStep.mock.calls.length
    await act(() => new Promise((r) => setTimeout(r, 300)))
    expect(player.playStep).toHaveBeenCalledTimes(played)
  })

  it('steps one digit at a time and resets', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    const stepButton = await screen.findByRole('button', { name: 'Step' })
    await waitFor(() => expect(stepButton).toBeEnabled())

    await user.click(stepButton)
    await user.click(stepButton)
    await user.click(stepButton)
    expect(screen.getByTestId('chart')).toHaveTextContent('0,1,0,1,1,0,0,0,0,0')
    expect(screen.getByTestId('current-digit')).toHaveTextContent('4')

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByTestId('chart')).toHaveTextContent('0,0,0,0,0,0,0,0,0,0')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0')
  })

  it('mutes and unmutes', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    await user.click(screen.getByRole('button', { name: 'Mute' }))
    expect(player.setMuted).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(player.setMuted).toHaveBeenLastCalledWith(false)
  })

  it('shows an error when digits fail to load', async () => {
    render(<App createPlayer={fakePlayer} loadSource={() => Promise.reject(new Error('boom'))} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  })

  it('keeps visualising when audio cannot start', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    player.start.mockRejectedValue(new Error('no audio'))
    render(<App createPlayer={() => player} loadSource={source} />)
    const stepButton = await screen.findByRole('button', { name: 'Step' })
    await waitFor(() => expect(stepButton).toBeEnabled())
    await user.click(stepButton)
    expect(screen.getByText(/Audio unavailable: no audio/)).toBeInTheDocument()
    expect(screen.getByTestId('total-count')).toHaveTextContent('1')
  })

  it('applies a preset: new notes, sound settings and a shareable URL', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    const legend = screen.getByRole('list', { name: 'Which note each digit plays' })
    expect(legend).toHaveTextContent('0C4')

    await user.selectOptions(screen.getByLabelText('Preset'), 'Lydian dream')
    expect(legend).toHaveTextContent('5F4') // centred mapping: 5 is the root
    expect(window.location.hash).toBe('#p=lydian-dream')
    await waitFor(() =>
      expect(player.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ instrument: 'electric-piano', drone: ['F2', 'C3'] }),
      ),
    )

    const stepButton = screen.getByRole('button', { name: 'Step' })
    await waitFor(() => expect(stepButton).toBeEnabled())
    await user.click(stepButton) // digit 3 → two degrees below F in F Lydian = D4
    expect(player.playStep).toHaveBeenLastCalledWith(
      'D4',
      expect.any(Number),
      expect.any(Number),
      0,
    )
  })

  it('switches to Custom when a setting is changed, and encodes it in the URL', async () => {
    const user = userEvent.setup()
    render(<App createPlayer={fakePlayer} loadSource={source} />)
    await user.click(screen.getByText('Customize'))
    await user.selectOptions(screen.getByLabelText('Scale'), 'Dorian')
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Custom (from Original (2019))')
    expect(window.location.hash).toMatch(/^#c=/)
  })

  it('loads a config from the URL and reports unreadable links', async () => {
    window.history.replaceState(null, '', '/#p=music-box')
    const { unmount } = render(<App createPlayer={fakePlayer} loadSource={source} />)
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Music box')
    unmount()

    window.history.replaceState(null, '', '/#c=not-a-config')
    render(<App createPlayer={fakePlayer} loadSource={source} />)
    expect(screen.getByText(/share link could not be read/)).toBeInTheDocument()
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Original (2019)')
  })

  it('puts the view in the link and restores it, alongside the sound', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/#p=music-box')
    const { unmount } = render(<App createPlayer={fakePlayer} loadSource={source} />)
    await screen.findByTestId('chart')
    await user.selectOptions(screen.getByLabelText('Chart style'), 'Radar')
    await user.selectOptions(screen.getByLabelText('View'), 'Sheet music')
    expect(window.location.hash).toMatch(/^#p=music-box&v=/)
    unmount()

    render(<App createPlayer={fakePlayer} loadSource={source} />)
    expect(screen.getByLabelText('View')).toHaveValue('staff')
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Music box')
    await user.selectOptions(screen.getByLabelText('View'), 'Digit chart')
    expect(screen.getByLabelText('Chart style')).toHaveValue('radar')
  })

  it('keyboard shortcuts: Space plays and pauses, → steps, M mutes; fields keep their keys', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled())

    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(player.playStep).toHaveBeenCalledTimes(1))
    await user.keyboard('m')
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('m')
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument()

    await user.keyboard(' ')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    await user.keyboard(' ')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument())

    // Typing in a field never triggers a shortcut.
    screen.getByLabelText('View').focus()
    await user.keyboard('m')
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument()
  })

  it('saves a piece and reopens it at the saved digit with its sound and view', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    const { unmount } = render(
      <App createPlayer={fakePlayer} loadSource={source} createStore={() => store} />,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Preset'), 'Music box')
    await user.selectOptions(screen.getByLabelText('View'), 'Sheet music')
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Step' }))
    await user.type(screen.getByLabelText('Name'), 'Three digits')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Three digits')).toBeInTheDocument()
    unmount()

    // A fresh visit on the default sound: open the piece.
    window.history.replaceState(null, '', '/#p=original')
    render(<App createPlayer={fakePlayer} loadSource={source} createStore={() => store} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    expect(screen.getByTestId('total-count')).toHaveTextContent('0')
    await user.click(await screen.findByRole('button', { name: 'Open Three digits' }))
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Music box')
    expect(screen.getByLabelText('View')).toHaveValue('staff')
    expect(screen.getByTestId('total-count')).toHaveTextContent('3')
  })

  it('a saved piece remembers where in π it started', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    const { unmount } = render(
      <App createPlayer={fakePlayer} loadSource={source} createStore={() => store} />,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    // 3.1415926: start at decimal place 4 (the 5), play 5 and 9.
    await user.clear(screen.getByLabelText('Decimal place'))
    await user.type(screen.getByLabelText('Decimal place'), '4')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    for (let i = 0; i < 2; i++) await user.click(screen.getByRole('button', { name: 'Step' }))
    expect(screen.getByTestId('current-digit')).toHaveTextContent('9')
    await user.type(screen.getByLabelText('Name'), 'Mid-π')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/digit 2 from decimal place 4/)).toBeInTheDocument()
    unmount()

    window.history.replaceState(null, '', '/#p=original')
    render(<App createPlayer={fakePlayer} loadSource={source} createStore={() => store} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    await user.click(await screen.findByRole('button', { name: 'Open Mid-π' }))
    expect(screen.getByTestId('total-count')).toHaveTextContent('2')
    expect(screen.getByTestId('decimal-place')).toHaveTextContent('5')
    expect(screen.getByTestId('current-digit')).toHaveTextContent('9')
    expect(window.location.hash).toMatch(/at=4/)
  })

  it('restores the last session on a plain visit, but a link wins', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App createPlayer={fakePlayer} loadSource={source} />)
    await user.selectOptions(screen.getByLabelText('Preset'), 'Music box')
    await user.selectOptions(screen.getByLabelText('View'), 'Music clock')
    unmount()

    window.history.replaceState(null, '', '/')
    const second = render(<App createPlayer={fakePlayer} loadSource={source} />)
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Music box')
    expect(screen.getByLabelText('View')).toHaveValue('clock')
    second.unmount()

    window.history.replaceState(null, '', '/#p=lydian-dream')
    render(<App createPlayer={fakePlayer} loadSource={source} />)
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Lydian dream')
  })

  it('signs in with a one-time code, backs pieces up to the account, shares and reopens them', async () => {
    const user = userEvent.setup()
    const remote = new Map<string, RemotePiece>()
    const api: AccountApi = {
      signInUrl: (back) => `https://api.test/auth/github?return_to=${back}`,
      exchange: vi.fn(async (code: string) => {
        expect(code).toBe('one-time')
        return {
          token: 'tok',
          user: { id: 'u1', name: 'Ada', avatarUrl: null, role: 'user' as const },
        }
      }),
      me: vi.fn(async (token: string) =>
        token === 'tok' ? { id: 'u1', name: 'Ada', avatarUrl: null, role: 'user' as const } : null,
      ),
      logout: vi.fn(async () => {}),
      listPieces: vi.fn(async () => [...remote.values()]),
      putPiece: vi.fn(async (_t: string, doc: Record<string, unknown>) => {
        const piece = {
          id: String(doc.id),
          ownerId: 'u1',
          name: String(doc.name),
          visibility: 'private' as const,
          createdAt: String(doc.createdAt),
          updatedAt: String(doc.updatedAt),
          document: doc,
        }
        remote.set(piece.id, piece)
        return piece
      }),
      setVisibility: vi.fn(async (_t: string, id: string, visibility: Visibility) => {
        remote.set(id, { ...remote.get(id)!, visibility })
      }),
      deletePiece: vi.fn(async (_t: string, id: string) => {
        remote.delete(id)
      }),
    }
    window.history.replaceState(null, '', '/?login=one-time#p=music-box')
    render(
      <App
        createPlayer={fakePlayer}
        loadSource={source}
        createStore={createMemoryStore}
        createAccountApi={() => api}
      />,
    )
    expect(await screen.findByText('Ada')).toBeInTheDocument()
    // The code is gone from the address bar; the sound in the hash is kept.
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#p=music-box')
    expect(localStorage.getItem('charts-of-pie:session')).toBe('tok')

    await user.type(screen.getByLabelText('Name'), 'Boxed')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('button', { name: 'Open Boxed' })
    await user.click(screen.getByRole('button', { name: 'Back up this device’s pieces' }))
    expect(await screen.findByText('Backed up 1 piece to your account.')).toBeInTheDocument()
    const visibility = await screen.findByLabelText('Who can see Boxed')
    await user.selectOptions(visibility, 'Public gallery')
    expect(api.setVisibility).toHaveBeenCalledWith('tok', expect.any(String), 'public')

    await user.selectOptions(screen.getByLabelText('Preset'), 'Lydian dream')
    await user.click(screen.getByRole('button', { name: 'Open Boxed from your account' }))
    expect(screen.getByLabelText('Preset')).toHaveDisplayValue('Music box')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Sign in with GitHub' })).toBeInTheDocument()
    expect(localStorage.getItem('charts-of-pie:session')).toBeNull()
  })

  it('hides accounts when no API is configured', () => {
    render(<App createPlayer={fakePlayer} loadSource={source} createAccountApi={() => null} />)
    expect(screen.queryByRole('button', { name: 'Sign in with GitHub' })).not.toBeInTheDocument()
  })

  it('switches between chart, sheet music and spectrogram views', async () => {
    const user = userEvent.setup()
    render(<App createPlayer={fakePlayer} loadSource={source} />)
    await screen.findByTestId('chart')
    expect(screen.getByLabelText('Chart style')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('View'), 'Sheet music')
    expect(screen.getByTestId('staff-view')).toBeInTheDocument()
    expect(screen.queryByLabelText('Chart style')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('View'), 'Spectrogram')
    expect(screen.getByTestId('spectrogram-view')).toHaveTextContent('idle')
  })

  it('reports chords that form by coincidence and exports MIDI', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:midi')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    // Centred A minor, one step per digit, notes four steps long: 5, 7, 9 → A4, C5, E5 overlap.
    const config = { ...getPreset('minor-nocturne')!.config, rhythm: 'steady', legato: 4 } as const
    window.history.replaceState(null, '', `/#c=${encodeConfig(config)}`)
    const triad = () => Promise.resolve(createDigitSource('t', 't', parseDigits('5791')))
    render(<App createPlayer={fakePlayer} loadSource={triad} />)

    const download = screen.getByRole('button', { name: 'Download MIDI' })
    expect(download).toBeDisabled()
    const stepButton = screen.getByRole('button', { name: 'Step' })
    await waitFor(() => expect(stepButton).toBeEnabled())
    await user.click(stepButton) // 5 → A4 (root)
    await user.click(stepButton) // 7 → C5
    expect(screen.getByTestId('last-chord')).toHaveTextContent('–')
    await user.click(stepButton) // 9 → E5: A, C and E all sounding
    expect(screen.getByTestId('last-chord')).toHaveTextContent('Am — minor at decimal place 2')

    await user.click(download)
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('audio/midi')
    const header = new Uint8Array(await blob.arrayBuffer()).slice(0, 4)
    expect(String.fromCharCode(...header)).toBe('MThd')
    expect(click).toHaveBeenCalled()
  })
})
