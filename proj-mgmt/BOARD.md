# Board

_Last updated with the E01 modernisation milestone._

## Epics

| Epic | Title                                       | Status      | Phase |
| ---- | ------------------------------------------- | ----------- | ----- |
| E01  | Modernise the foundation                    | done        | 0     |
| E02  | Music theory engine: scales, modes & rhythm | ready       | 1     |
| E03  | Visualization gallery & playgrounds         | backlog     | 2     |
| E04  | Learn: guided lessons                       | backlog     | 4     |
| E05  | More numbers: Fibonacci, φ, e, √2, primes   | backlog     | 3     |
| E06  | Developer experience & AI agents            | in-progress | ∞     |
| E07  | Backend platform: API, authN & authZ        | backlog     | 5     |
| E08  | Save, gallery & share                       | backlog     | 6     |
| E09  | Platform quality: PWA, accessibility, perf  | backlog     | ∞     |

## Up next (ready)

| Story   | Title                                           | Feature |
| ------- | ----------------------------------------------- | ------- |
| S06.2.1 | Rebrand and relocate to Math Art (owner-driven) | F06.2   |
| S02.1.1 | Scale & mode catalogue in the core              | F02.1   |
| S02.1.2 | Choose scale, root and octave in the UI         | F02.1   |
| S02.2.1 | Selectable digit → pitch mapping strategies     | F02.2   |
| S02.5.1 | Versioned CompositionConfig with URL sharing    | F02.5   |
| S02.3.1 | Tempo-locked playback with BPM control          | F02.3   |
| S02.3.2 | Selectable rhythm encodings                     | F02.3   |
| S02.1.3 | Explain the selected scale as math              | F02.1   |

Backlog in E02: S02.4.1 instruments · S02.4.2 harmony · S02.4.3 MIDI export.

## Done

E01 stories S01.1.1, S01.1.2, S01.2.1, S01.3.1, S01.3.2, S01.4.1, S01.5.1, S01.5.2, S01.6.1 ·
E06 story S06.1.1.

## Bugs

| Bug   | Title                                               | Severity | Status  |
| ----- | --------------------------------------------------- | -------- | ------- |
| B-001 | Inline π digits corrupted near the end              | medium   | done    |
| B-002 | Playback auto-starts on load and audio is blocked   | high     | done    |
| B-003 | Chart.js loaded twice from CDN                      | low      | done    |
| B-004 | Tone.js loaded unpinned from unpkg                  | medium   | done    |
| B-005 | Functions leak as implicit globals                  | low      | done    |
| B-006 | Memory logger runs forever and is Chrome-only       | low      | done    |
| B-007 | Duplicate DOM ids and unused containers             | low      | done    |
| B-008 | `Math.random(0, 9)` arguments ignored; 0 ms delays  | low      | done    |
| B-009 | Layout not usable on phones or tablets              | medium   | done    |
| B-010 | Page title is “Document”                            | low      | done    |
| B-011 | Pentatonic generator only correct for C             | medium   | done    |
| B-012 | Pause then quick resume can double the tempo        | medium   | done    |
| B-013 | Indigo digits low contrast; palette repeats colours | low      | backlog |
| B-014 | Orphaned `charts-of-pie` submodule pointer          | low      | backlog |
