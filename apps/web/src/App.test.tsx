import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { NotePlayer } from './audio/toneAudio'
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
    playNote: vi.fn(),
    setMuted: vi.fn(),
    dispose: vi.fn(),
  } satisfies NotePlayer
}

const source = () => Promise.resolve(createDigitSource('pi', 'π', parseDigits('31415926')))

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // 5 × 42 ms between digits
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
    expect(player.playNote).not.toHaveBeenCalled()
  })

  it('plays digits as notes, updates counts, and pauses', async () => {
    const user = userEvent.setup()
    const player = fakePlayer()
    render(<App createPlayer={() => player} loadSource={source} />)
    const play = await screen.findByRole('button', { name: 'Play' })
    await waitFor(() => expect(play).toBeEnabled())

    await user.click(play)
    expect(player.start).toHaveBeenCalledTimes(1)
    expect(player.playNote).toHaveBeenCalledWith('G4', '2n') // digit 3
    expect(screen.getByTestId('total-count')).toHaveTextContent('1')
    expect(screen.getByTestId('sound-data')).toHaveTextContent('G4 for 2n')

    await waitFor(() => expect(player.playNote).toHaveBeenCalledWith('D4', '1n'), {
      timeout: 1000,
    }) // digit 1
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    const played = player.playNote.mock.calls.length
    await act(() => new Promise((r) => setTimeout(r, 300)))
    expect(player.playNote).toHaveBeenCalledTimes(played)
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
})
