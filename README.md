# Charts of Pie — Math is Art

Watch and **listen** to the first million digits of π. Each digit becomes a note, a duration and
a bar in a live chart of how often every digit has appeared — mathematics as music and art.

This is the first step of a larger project: an interactive, mobile-, tablet- and desktop-friendly
platform for discovering how math, music and visual art connect — scales and modes (Lydian,
pentatonic, …), Fibonacci and the golden ratio, visualization playgrounds, lessons, and later
accounts to save and share your creations. See the [roadmap](proj-mgmt/ROADMAP.md).

**Try it:** <https://dima11235813.github.io/chartsOfPie/> — deployed from `master` by
[GitHub Pages](.github/workflows/deploy-pages.yml) after CI passes.

## Quick start

Requires Node.js ≥ 20.19 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command                | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start the dev server                                       |
| `npm run build`        | Type-check and build the static site to `apps/web/dist`    |
| `npm test`             | Unit tests (Vitest)                                        |
| `npm run test:e2e`     | Playwright smoke tests on desktop, tablet and mobile sizes |
| `npm run check`        | Everything CI runs except e2e                              |
| `npm run audio:render` | Render every sound preset to WAV + a loudness report       |

## Sound presets

Pick a preset in the **Sound** panel, or open **Customize** to choose the scale (major, minor,
the seven modes including Lydian, pentatonics, blues, whole tone…), root, octave, how digits map
onto notes, tempo, rhythm, instrument (sampled grand piano, Rhodes-style electric piano, Wurlitzer,
Clavinet, drawbar organ, analog synth lead, electric and acoustic guitar, marimba, music box,
plucked strings, pad, sine, or the original synth), reverb, echo and a drone. Every sound is a
link: the URL updates as you change settings, and **Copy share link** shares it.

## Views

Switch the **View** in the bottom bar:

- **Analytical:** digit chart, sheet music (with chords that form by coincidence), live
  spectrogram.
- **Artistic:** digit ring, π walk, sunflower, neighbour mosaic, Hilbert carpet (all million digits),
  typographic π, times-table string art.
- **Sound shapes:** music clock (with a circle-of-fifths mode), harmonograph (pure vs tempered
  ratios), oscilloscope, guitar fretboard (scale map, fingering, four tunings), cymatics (sand on a
  Chladni plate drawing each note's figure).

**Keyboard:** Space plays/pauses, → plays one digit, M mutes, F shows the view full screen.

**My pieces** saves the sound, the view and where you are in π on your device (IndexedDB) and
reopens it there; export a backup file to keep pieces safe. A plain visit restores your last
session. **Play through MIDI** sends the notes to a hardware instrument such as a Nord Electro 4
over USB (Chrome, Edge, Firefox).

**Colours** offers the original rainbow, a colour-blind friendly palette, Scriabin's note colours
and a calm "ink" ramp. **Export** downloads MIDI, a PNG of the view, or a video/audio recording; **Poster** renders any
artwork at print size (up to 4096² px, up to a million digits).

## How the original works

The **Original (2019)** preset reproduces the first version exactly:

| Digit  | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Note   | C4  | D4  | E4  | G4  | A4  | C5  | D5  | E5  | G5  | A5  |
| Length | 16n | 1n  | 1t  | 2n  | 2t  | 4n  | 4t  | 8n  | 8t  | 16t |

Between digits it waits a random 0–420 ms (in 42 ms steps).
The digits in `apps/web/public/data/pi-1m.txt` were independently computed and are checksum-pinned
in the tests.

## Repository layout

```
apps/web/        the app (React 19, TypeScript, Vite, Chart.js 4, Tone.js 15)
  src/core/      pure math & music engine (digits, scales, playback engine)
legacy/          the original 2019 version, kept as a reference
docs/            inspiration and notes
proj-mgmt/       roadmap, epics, features, stories, tasks, bugs, research
.claude/         AI agent definitions and skills; CLAUDE.md is the agent guide
.mcp.json        Serena MCP server for semantic code navigation (needs `uv`)
```

Piano samples: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0
(`apps/web/public/audio/salamander/README.md`).

## Working with AI agents

See [CLAUDE.md](CLAUDE.md). The repo ships Claude Code subagents (`music-theory-expert`,
`visualization-engineer`, `regression-guardian`, `product-steward`), skills (`proj-mgmt`,
`add-scale`, `add-visualization`, `verify-parity`) and a [Serena](https://github.com/oraios/serena)
MCP server config. Install [uv](https://docs.astral.sh/uv/) so `uvx` can launch Serena.
