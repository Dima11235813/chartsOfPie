import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { NotePlayer } from './audio/notePlayer'
import { createDigitSource, parseDigits } from './core/digits/digitSource'

// Chart.js needs a real canvas; the chart itself is covered by chartConfig tests and e2e.
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
    dispose: vi.fn(),
  } satisfies NotePlayer
}

const source = () => Promise.resolve(createDigitSource('pi', 'π', parseDigits('31415926')))

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // 5 × 42 ms between digits
    window.history.replaceState(null, '', '/')
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
})
