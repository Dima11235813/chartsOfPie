# Charts of Pie — Math is Art

Watch and **listen** to the first million digits of π. Each digit becomes a note, a duration and
a bar in a live chart of how often every digit has appeared — mathematics as music and art.

This is the first step of a larger project: an interactive, mobile-, tablet- and desktop-friendly
platform for discovering how math, music and visual art connect — scales and modes (Lydian,
pentatonic, …), Fibonacci and the golden ratio, visualization playgrounds, lessons, and later
accounts to save and share your creations. See the [roadmap](proj-mgmt/ROADMAP.md).

## Quick start

Requires Node.js ≥ 20.19 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `npm run dev`      | Start the dev server                                       |
| `npm run build`    | Type-check and build the static site to `apps/web/dist`    |
| `npm test`         | Unit tests (Vitest)                                        |
| `npm run test:e2e` | Playwright smoke tests on desktop, tablet and mobile sizes |
| `npm run check`    | Everything CI runs except e2e                              |

## How it works

| Digit  | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Note   | C4  | D4  | E4  | G4  | A4  | C5  | D5  | E5  | G5  | A5  |
| Length | 16n | 1n  | 1t  | 2n  | 2t  | 4n  | 4t  | 8n  | 8t  | 16t |

Between digits the app waits a random 0–420 ms (in 42 ms steps), exactly like the original.
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

## Working with AI agents

See [CLAUDE.md](CLAUDE.md). The repo ships Claude Code subagents (`music-theory-expert`,
`visualization-engineer`, `regression-guardian`, `product-steward`), skills (`proj-mgmt`,
`add-scale`, `add-visualization`, `verify-parity`) and a [Serena](https://github.com/oraios/serena)
MCP server config. Install [uv](https://docs.astral.sh/uv/) so `uvx` can launch Serena.
