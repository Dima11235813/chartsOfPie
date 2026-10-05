---
id: R-010
title: 'Number series beyond π: shared architecture and phased plan (φ, Fibonacci, primes)'
status: review
feeds: [E05, E03, E04, E10]
---

# R-010 — Number series beyond π: one pipeline for very different numbers

## Question

The owner wants the golden ratio, the Fibonacci sequence and the prime numbers alongside π
(E05). These are very different kinds of numbers: φ is a digit stream exactly like π, while
Fibonacci and the primes are integer sequences whose terms grow without bound. How much of the
current π pipeline (data, engine, sound mapping, views, saved pieces and share links) can they
share, what is the abstraction, and in what order do we build it without regressing π?

This note is planning only. No feature code ships with it.

## Summary (the answer in one screen)

1. **Everything downstream of the data already consumes one thing: a stream of small symbols.**
   The engine, arranger, performance log, stats, chart and all fifteen views read
   `digitAt(i) ∈ 0..9`. None of them care that the symbols came from π.
2. So a series plugs in as **two layers**: a `NumberSeries` produces _terms_ (digits of a
   constant, or integers like 13 or 2,097,653), and a `Reading` turns terms into _symbols_ with a
   declared alphabet size (last digit, concatenated digits, residue mod 12, gap, is-prime…).
   The result is a `SymbolSource`: today's `DigitSource` plus `alphabetSize` and a little
   metadata. π is `pi` + `digits` with alphabet 10, byte-for-byte what plays today.
3. **Materialise, don't stream.** Every reading is computed into a capped `Uint8Array`
   (1,000,001 symbols, the same as π) before playback. Random access is needed by resume,
   posters, the Hilbert carpet and the mosaic sweep, and all of them already work on that shape.
   Measured: φ to 1,000,000 digits in about 1.3 s with BigInt in Node, the first 1,031,130 primes
   in about 0.2 s, and 1,000,000 digits of concatenated Fibonacci numbers from just 3,094 terms.
4. **Decimal first, any alphabet later.** If the first release only offers readings whose
   alphabet is 10 (last digit, concatenated digits), then sound mapping, palettes and every view
   work unchanged. Generalising "10" to _k_ (Fibonacci mod 12 → twelve pitch classes, primes as
   a binary stream for an Ulam spiral) is a separate, later milestone because "10" is hard-coded
   in about twenty places.
5. **The series is a third part of the shared state**, next to sound (`c=`/`p=`) and view
   (`v=`): a versioned `SourceConfig` in share links (`s=`) and a `source` field in saved pieces,
   defaulting to π so every existing link and piece reads exactly as before.
6. **The biggest risk is forward safety, not maths.** An app that does not know about series
   would open a shared "primes" link or piece as π, silently. So the very first milestone ships
   the _reader_ (unknown series → "made by a newer version") before any second series exists,
   ideally before the installable PWA (F10.5) starts caching old app versions on phones.

Milestones: **M1** series-ready core with π only (no visible change) → **M2** φ (and optionally
e, √2) → **M3** Fibonacci and primes in base 10 → **M4** any alphabet (mod 12, binary, gaps) →
**M5** series-native art and rhythm (ratio → φ, Ulam spiral, Fibonacci word). Decisions needed
from the owner are in section 10.

---

## 1. What the series actually are

| Series              | Kind          | Natural symbols                                      | Grows?   | Periodic?                    |
| ------------------- | ------------- | ---------------------------------------------------- | -------- | ---------------------------- |
| π                   | constant      | decimal digits (OEIS A000796)                        | no       | no (believed normal)         |
| φ = (1 + √5) / 2    | constant      | decimal digits 1.6180339887… (A001622)               | no       | no                           |
| e, √2 (cheap extra) | constant      | decimal digits (A001113, A002193)                    | no       | no                           |
| Fibonacci Fₙ        | integer seq.  | none: 0, 1, 1, 2, 3, 5, 8, 13, … (A000045)           | as φⁿ/√5 | every residue mod m is       |
| Primes pₙ           | integer seq.  | none: 2, 3, 5, 7, 11, 13, … (A000040)                | ≈ n ln n | no; last digits only 1/3/7/9 |
| Fibonacci word      | symbolic seq. | 0/1 (A003849), from the golden ratio                 | no       | no (quasi-periodic)          |
| Prime indicator     | symbolic seq. | 1 if n is prime else 0 (A010051), for an Ulam spiral | no       | no                           |

The constants are the easy half: they are the same shape as π, only the data differs. The
integer sequences are the interesting half: the artistic and musical result depends entirely on
**how we read them**. That choice is the core of this plan.

### Readings we have measured (not inferred)

Computed with a throwaway script while writing this note:

- **Fibonacci last digit** (Fₙ mod 10) repeats every **60** terms (Pisano period π(10) = 60);
  mod 12 every **24**, mod 5 every 20, mod 2 every 3. So "Fibonacci, last digit" is a 60-note
  loop: in the neighbour mosaic at 60 columns every column is a single colour, which is a lovely
  thing to discover rather than be told.
- **Concatenated Fibonacci digits** 0 1 1 2 3 5 8 1 3 2 1 3 4… reach 1,000,000 digits after only
  3,094 terms (the 3,094th term has about 650 digits), so terms are cheap BigInt additions.
- **Concatenated primes** 2 3 5 7 1 1 1 3 1 7… is the Copeland–Erdős constant (A033308). One
  million digits needs the first 155,646 primes (up to 2,097,653).
- **Last digit of the first 1,000,000 primes:** 1 → 249,934, 3 → 250,110, 7 → 250,014,
  9 → 249,940, plus a single 2 and a single 5. The digit chart is flat on four bars and empty on
  six, which is itself a lesson (why can a prime > 5 never end in 0, 2, 4, 5, 6 or 8?).
- **Consecutive-prime last-digit bias** (Lemke Oliver & Soundararajan, 2016): after a prime ending
  in 1, the next prime ends in 1 only 42,853 times but in 3 77,475 times (first million primes).
  The digit ring view already draws exactly this transition matrix, so the ring becomes a
  picture of a 2016 research result with no new code.
- **Largest prime gap** among the first million primes is 154, and all gaps after the first are
  even, so "gap / 2" is a natural reading (alphabet would need clamping or bucketing).
- **φ to 1,000,000 digits** by integer square root of 5 · 10²ᴺ with BigInt: about 1.0 s for the
  root plus 0.35 s for `toString` in Node 22. A first attempt with a Newton iteration that
  started _below_ the root stopped early and produced digits that looked right for six places
  and then went wrong. That is the strongest argument in this note for independent verification
  of every data file (section 8).

---

## 2. Where π is wired in today (inventory)

The pipeline is: `loadPiDigits()` → `DigitSource` → `PlaybackEngine` (counts with
`DigitCounter`) → `Arranger.arrange(digit)` → `NotePlayer` + `PerformanceLog` → views.

| Layer                         | File(s)                                                        | Assumes π?                                    | Assumes alphabet = 10?                                    |
| ----------------------------- | -------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Data load and validation      | `core/digits/pi.ts`, `public/data/pi-1m.txt`                   | yes (first 100, last 10, count)               | yes (`parseDigits`)                                       |
| Source interface              | `core/digits/digitSource.ts`                                   | no                                            | yes (`digitAt` 0–9)                                       |
| Counting                      | `core/digits/digitCounter.ts`                                  | no                                            | **yes** (`new Array(10)`, range check)                    |
| Engine                        | `core/engine/playbackEngine.ts`                                | no                                            | only via the counter                                      |
| Playback hook                 | `hooks/usePiPlayback.ts` (`loadSource` injectable)             | default loader only                           | `EMPTY_COUNTS` length 10                                  |
| Pitch mapping                 | `core/music/mapping.ts`                                        | no                                            | **yes** (range check, `centred` = digit − 5, table of 10) |
| Rhythm and legacy durations   | `core/composition/arranger.ts`, `core/music/legacyMapping.ts`  | no                                            | **yes** (`LEGACY_DIGIT_DURATIONS[digit]`, digit-length)   |
| Performance log, MIDI, chords | `core/composition/performanceLog.ts`, `core/midi/`             | no                                            | no (stores the digit as a number)                         |
| Palettes                      | `viz/palettes.ts`, `components/palette.ts`                     | no                                            | **yes** (ten colours; Scriabin is by pitch class)         |
| Chart and stats               | `components/DigitChart.tsx`, `StatsPanel.tsx`, `chartConfig`   | copy only                                     | **yes** (ten bars, ten rows)                              |
| Ring, walk, transitions       | `viz/render/ringRenderer.ts`, `walkRenderer.ts`, `viz/art.ts`  | copy ("π walk")                               | **yes** (ten arcs, ten directions, 10 × 10 matrix)        |
| String art                    | `viz/art.ts` `stringArtMultiplier`, `StringArtView.tsx`        | no                                            | **yes** (`2 + d₁ + d₂/10`)                                |
| Hilbert carpet                | `viz/render/hilbertRenderer.ts`, `registry.ts`                 | copy ("of 1,000,001 digits")                  | colour only                                               |
| Typographic                   | `viz/render/typeRenderer.ts`                                   | copy ("Typographic π")                        | glyphs 0–9                                                |
| Mosaic, sweep, polyplets      | `mosaicRenderer.ts`, `MosaicSweep.tsx`, `viz/polyplets.ts`     | no                                            | colour only (equality is alphabet-free)                   |
| Sunflower                     | `sunflowerRenderer.ts`                                         | no                                            | colour only                                               |
| Sound shapes (clock, scope…)  | `components/viz/*View.tsx`                                     | no                                            | colour only; they read notes, not digits                  |
| Cymatics                      | `viz/chladni.ts`                                               | no                                            | **yes** (mode table indexed by digit)                     |
| Posters and lab               | `viz/render/posters.ts`, `lab/posterLab.ts`, `lab/audioLab.ts` | yes (load π)                                  | via renderers                                             |
| Share links, pieces, API      | `core/piece/shareLink.ts`, `piece.ts`; `apps/api` `readPiece`  | implicitly (no source field: everything is π) | no                                                        |
| Resume                        | `piece.position.digitIndex`, `seek()`                          | no (an index into whatever plays)             | no                                                        |

Two conclusions:

- **Nothing below the data layer depends on π itself.** The only π-specific code is the loader,
  its validation, a handful of labels, and the lab. That is why a second _decimal_ series is
  mostly a data problem.
- **Alphabet 10 is everywhere above the engine.** About twenty sites, in the core (counter,
  mapping, legacy durations), in the palettes and in seven views. Generalising them is real work
  with real design questions (what is the legacy duration of symbol 11?), so it gets its own
  milestone instead of blocking the first new series.

---

## 3. Design passes (how the recommendation was reached)

### Pass 1 — "Make everything a `NumberSequence` with `valueAt(i)`" (R-004's first idea)

R-004 proposed `NumberSequence { id, name, length | infinite, alphabetSize?, valueAt(i) }`.
Problem: for Fibonacci, `valueAt(40)` is 102,334,155. Every consumer would then need its own way
to squash an unbounded integer into a note, a colour and a direction, and the choice would be
made fifteen different ways. It also mixes "what the number is" with "how we listen to it".
**Rejected as the consumer interface;** kept as the producer side.

### Pass 2 — Split terms from symbols

Separate the _series_ (terms) from the _reading_ (terms → symbols). Consumers only ever see
symbols from a declared alphabet. A reading is where the creative choice lives, and it is the
same idea as the existing `MAPPING_STRATEGIES` one level up: different, named, persisted ways of
reading the same numbers.

- For constants, the only reading at first is `digits` (identity). Later: other bases.
- For integer sequences: `last-digit` (mod 10), `concat` (the decimal digits of every term, in
  order), `mod` with a modulus, `gap` (difference between terms), `digit-sum`, `indicator`
  (n → is it in the sequence), `binary`.
- A reading declares its alphabet size, which may depend on a parameter (`mod 12` → 12).

### Pass 3 — Stream or materialise?

An infinite lazy stream is the elegant model, but the app needs random access in five places:
resume (`seek` replays up to 100,000 steps), posters (up to 1,000,000), the Hilbert carpet's
ghost of the whole source, the mosaic sweep's sliding windows and the shapes census. So
**every reading materialises into a `Uint8Array` of at most `MAX_SYMBOLS = 1_000_001`**, in
chunks, off the main thread when it is slow. Then `createDigitSource()` wraps it exactly like π.
Periodic readings could be infinite, but nobody will listen to a million digits; the cap keeps
memory bounded at about 1 MB per loaded series. A `Uint8Array` limits alphabets to 256, which is
far beyond anything musical.

### Pass 4 — Where do term boundaries go?

`concat` loses where one term ends and the next starts ("13" then "21" reads as 1 3 2 1).
Boundaries are musically valuable (accent the first digit of each term, so you can hear the
numbers) and visually valuable (a tick in the typographic view). Keep them as optional metadata:
a `Uint32Array` of term start offsets, or a bitset, exposed as `termStartAt?(i): boolean`. The
engine passes it to the arranger in a context object, so the arranger signature grows by an
optional argument and π (no boundaries) is unchanged.

### Pass 5 — Alphabet: generalise now or later?

Generalising now means touching the core music mapping, every palette and seven views before a
single new series plays. Doing it later means the first Fibonacci and prime readings must be
decimal (last digit, concatenated digits). Those happen to be the most explainable readings
anyway, and they already show the headline phenomena (Pisano loop, prime last-digit bias,
Copeland–Erdős). **Later** wins: M3 ships Fibonacci and primes with zero view changes, and M4
generalises with the real series in hand to test against.

### Pass 6 — Where does the choice of series live in saved state?

Options:

1. Inside `CompositionConfig` (the sound). Wrong home: the series is not a sound setting, and
   presets compare configs for equality (`findMatchingPreset`), so "Original (2019) on φ" would
   stop matching the Original preset and the share link would lose `p=original`.
2. Inside `VisualConfig`. Also wrong: the series drives the sound too.
3. **A third versioned part, `SourceConfig`,** with its own link parameter and piece field. It is
   orthogonal to sound and view, exactly like the user's mental model: _which number_, _how it
   sounds_, _how it looks_. Presets stay pure sound and keep working on every series.

**Option 3.** Absent means π, so every existing link and piece reads unchanged.

### Pass 7 — Forward safety

`parseShareHash` today ignores unknown parameters, so a current app opening
`#p=<preset>&s=<primes>` would play π without a word. Same for a saved piece with a `source` field:
`readPiece` would strip it and open π. Once the PWA (F10.5) is installed on phones, old app
versions will meet new links for weeks. Therefore M1 ships the reader first: `s=` with an unknown
series or a newer `SourceConfig` version yields the existing "made by a newer version" path
(`too-new`), and an unknown reading is never silently replaced by π. Only after that has been
deployed does any second series become selectable.

### Pass 8 — Do views need to know the series?

Most do not. A few new ones only make sense for one series (ratio → φ chart for Fibonacci, Ulam
spiral for the prime indicator) or one alphabet (an Ulam spiral is binary). So view definitions
gain an optional `supports(source) → boolean` and the View selector disables (not hides) views
that do not apply, with a reason. Existing views declare nothing and keep working everywhere.

---

## 4. The abstraction (sketch, not final code)

All of this lives in `core/series/` (pure, deterministic, no DOM), next to `core/digits/`.

```ts
/** What the rest of the app consumes. Today's DigitSource, generalised. */
export interface SymbolSource {
  readonly id: string // e.g. 'pi:digits', 'fibonacci:last-digit'
  readonly name: string // 'π (pi)', 'Fibonacci · last digit'
  readonly length: number
  /** Symbols are 0..alphabetSize-1. 10 for every reading until M4. */
  readonly alphabetSize: number
  symbolAt(index: number): number
  /** Concatenated readings: true where a new term begins. */
  termStartAt?(index: number): boolean
  /** The term a symbol came from (for captions: "digit 3 of F₁₇ = 1597"). */
  termIndexAt?(index: number): number
}

/** A series: the mathematical object. Registry ids are persisted forever. */
export interface NumberSeries {
  readonly id: SeriesId // 'pi' | 'phi' | 'e' | 'sqrt2' | 'fibonacci' | 'primes'
  readonly name: string
  readonly kind: 'constant' | 'integers' | 'symbols'
  readonly readings: readonly ReadingId[] // which readings make sense
  readonly defaultReading: ReadingId
  readonly oeis: string // citation, shown in an info popover
  /** How to obtain the terms: a verified asset, or a pure generator. */
  readonly data: { asset: AssetSpec } | { generate: TermGenerator }
}

/** A reading: terms → symbols, with the alphabet it produces. */
export interface ReadingDefinition {
  readonly id: ReadingId // 'digits' | 'last-digit' | 'concat' | 'mod' | 'gap' | 'indicator'
  readonly name: string
  alphabetSize(params: ReadingParams): number
  /** Pure: fills `out` from the series' terms; returns symbols written (+ term starts). */
  materialise(series: NumberSeries, params: ReadingParams, out: Uint8Array): Materialised
}
```

Compatibility shims keep the change mechanical: `DigitSource` becomes a type alias of
`SymbolSource` with `alphabetSize: 10` and `digitAt` as an alias of `symbolAt` during the
transition, so the dozens of `digitAt` call sites move in a separate, boring commit.

### Data and generation per series

| Series    | Data path                                                                                 | Cost to 1,000,001 symbols                   | Verification                                                                                      |
| --------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| π         | `public/data/pi-1m.txt` (existing)                                                        | fetch ~1 MB                                 | unchanged: first 100, last 10, length, sha256                                                     |
| φ         | `public/data/phi-1m.txt`, generated by `scripts/generate-constants.ts` (BigInt √5)        | fetch ~1 MB; generating in-app ≈ 1.3 s+     | OEIS A001622 head; a published 1M-digit reference; CI recomputes and compares the sha256          |
| e, √2     | same script (e by binary splitting, √2 by integer root)                                   | same                                        | A001113, A002193; published references                                                            |
| Fibonacci | generator: modular for `last-digit`/`mod` (no BigInt, O(1) per term); BigInt for `concat` | trivial; `concat` needs 3,094 terms         | A000045 terms, Pisano periods (A001175) as tests                                                  |
| Primes    | segmented sieve of Eratosthenes                                                           | ~0.2 s for 1,031,130 primes (to 16,000,000) | A000040 terms, π(10ⁿ) counts (4, 25, 168, 1229, 9592, 78498, 664579), Copeland–Erdős A033308 head |

Generators run in a Web Worker wrapper (outside `core/`) so a phone never janks; the core
functions stay synchronous and pure so tests call them directly with small N. Results are cached
per `(series, reading, params)` for the session. Constant files are lazy-loaded only when chosen,
and the PWA (F10.5) precaches π only and runtime-caches the others, so installing the app does
not download 4 MB the user may never use.

---

## 5. Code-sharing matrix

How each layer is shared across the three families. **Shared** = same code unchanged;
**adapter** = same code, one small parameter; **new** = series-specific code.

| Layer                          | π (today)       | φ, e, √2 (digits)          | Fibonacci, primes, base 10 (M3)                   | Any alphabet (M4)                                    |
| ------------------------------ | --------------- | -------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Data                           | asset           | asset (same loader + spec) | **new** generators                                | **new** readings (`mod`, `gap`, `indicator`)         |
| `SymbolSource` / engine        | shared          | shared                     | shared (+ optional term starts)                   | shared                                               |
| Counter, stats, chart          | shared          | shared                     | shared                                            | adapter (k bars)                                     |
| Pitch mapping                  | shared          | shared                     | shared                                            | adapter (k symbols; `semitones` fits mod 12 exactly) |
| Rhythm, legacy durations       | shared          | shared                     | shared; adapter for term-start accents            | adapter (decision D7)                                |
| Sound chain, instruments, MIDI | shared          | shared                     | shared                                            | shared                                               |
| Palettes                       | shared          | shared                     | shared                                            | adapter (k colours, interpolated; 12 = Scriabin)     |
| Mosaic, sunflower, Hilbert     | shared          | shared                     | shared                                            | shared (colour only)                                 |
| Ring, walk, string art, cymat. | shared          | shared                     | shared                                            | adapter (k arcs/directions/modes)                    |
| Typographic                    | shared          | shared (label)             | adapter (term boundaries)                         | adapter (glyphs past 9)                              |
| Sound-shape views              | shared          | shared                     | shared                                            | shared                                               |
| Series-native views (M5)       | —               | —                          | **new**: ratio → φ, Fibonacci spiral, Ulam spiral | **new**                                              |
| Persistence                    | `c=`/`p=`, `v=` | **+ `s=`**, piece `source` | same                                              | same (reading params)                                |

The headline: φ is a **data-only** addition after M1, and Fibonacci and primes in base 10 are
**generators plus one optional metadata channel**. Everything else is reused.

---

## 6. Persistence: `SourceConfig`

```ts
export const sourceConfigSchema = z.object({
  version: z.literal(1),
  series: z.enum(SERIES_IDS), // 'pi' | 'phi' | 'e' | 'sqrt2' | 'fibonacci' | 'primes' (forever)
  reading: z.enum(READING_IDS), // 'digits' | 'last-digit' | 'concat' | 'mod' | 'gap' | 'indicator'
  /** Reading parameters, each with a default (additive later). */
  params: z.prefault(z.object({ modulus: z._default(z.int().check(z.gte(2), z.lte(64)), 10) }), {}),
})
// DEFAULT_SOURCE_CONFIG = { version: 1, series: 'pi', reading: 'digits', params: { modulus: 10 } }
```

- **Share links:** `&s=<encoded SourceConfig>`, left out when it is π (so every link made so far,
  and every new π link, is byte-identical). Fixtures in `core/piece/fixtures/share-links.json`
  gain cases; none change.
- **Saved pieces:** a `source` field with the π default. This is additive (rule 1 of R-007): no
  piece version bump, the schema snapshot `piece.v1.json` changes together with the default, a
  new golden fixture `fixtures/pieces/v1/with-source.json` is added and none is edited.
- **Unknown series or reading** (written by a newer app): `too-new`, never "π instead".
- **`position.digitIndex`** keeps its persisted name and now means "symbol index in the
  piece's source", which is what it already means for π.
- **API:** `apps/api` validates uploads with the web app's `readPiece` but stores the raw
  document (`JSON.stringify(body.document)`), so an older API keeps the `source` field intact and
  nothing is lost. Redeploy it with M1 anyway, so its own reads (gallery, names) know about
  series and it rejects a newer `SourceConfig` version as `too-new`.
- **Last session** (`useLinkedState`) stores a share hash, so it picks up `s=` for free.
- **Presets stay pure sound.** "Original (2019)" on φ is still `p=original` + `s=…`.

---

## 7. Phased roadmap

Every milestone is shippable on its own, keeps "Original (2019)" on π bit-identical
(`verify-parity`), and leaves the audio and poster snapshot baselines for π untouched.

### M0 — Plan (this PR)

R-010, E05 broken into features, M1 stories ready, owner decisions listed.

### M1 — Series-ready core, π only (no visible change) · F05.1

- `core/series/`: `SymbolSource`, `NumberSeries`, `ReadingDefinition`, registry with π only.
- `DigitSource` → `SymbolSource` alias; `alphabetSize` threaded through the counter and hook
  (still 10).
- `SourceConfig` schema, `s=` link parameter, piece `source` field with default, too-new
  handling, fixtures and schema snapshot; API redeployed.
- `usePiPlayback` → `useSeriesPlayback(source)` with the existing injectable loader; labels
  that say π come from the series name (`'π walk'` stays the label while π plays).
- **Exit:** `npm run check`, all e2e and both snapshot suites pass unchanged; a link with an
  unknown `s=` shows the "newer version" message. Ideally lands **before F10.5** (PWA).

### M2 — The golden ratio (and the other constants) · F05.3

- `scripts/generate-constants.ts` → `phi-1m.txt` (+ `e-1m.txt`, `sqrt2-1m.txt` if D3 says yes),
  verified twice and sha256-pinned; lazy-loaded.
- A **Number** selector (π, φ, …) in the controls, 44 px targets, works at 360 px; e2e switches
  to φ and back while paused and asserts pixels (rule 9).
- Info popover per series (definition, OEIS link, one surprising fact).
- **Exit:** every view plays φ; one poster snapshot for φ.

### M3 — Fibonacci and primes in base 10 · F05.2, F05.4

- Pure generators (modular and BigInt Fibonacci, segmented sieve), worker wrapper, session cache.
- Readings `last-digit` and `concat` (Fibonacci concat; primes concat = Copeland–Erdős), with
  term starts; optional "accent term starts" in the arranger (additive config field, default
  off) and boundary marks in the typographic view.
- Reading selector appears only for series with more than one reading.
- **Exit:** both series play in every view; unit tests pin Pisano periods, prime counts and
  OEIS heads; e2e for the new selectors both ways.

### M4 — Any alphabet · F05.5

- Counter, chart, stats, palettes (k colours; Scriabin for 12), mapping (k symbols), ring, walk,
  string art, cymatics, typographic glyphs past 9.
- Readings `mod` (Fibonacci mod 12 → a 24-step chromatic loop), `gap` (prime gaps / 2, clamped),
  `indicator` (binary prime stream), other bases for constants (binary π, base-12 φ).
- `supports(source)` on views; the selector explains disabled ones.
- **Exit:** alphabet 2, 4, 10, 12 and 16 each render every supported view with pixels; π
  snapshots still unchanged.

### M5 — Series-native art, sound and lessons · F05.7, feeds E04

- Fₙ₊₁/Fₙ converging on φ (alternating above and below); Fibonacci squares and spiral; Ulam and
  Sacks spirals from the prime indicator; Pisano-period loop indicator.
- Fibonacci-word rhythm (a new `rhythm` id; R-004), Zeckendorf rhythms.
- Hand-off to E04 lessons: "Why sunflowers know Fibonacci", "Why primes avoid even last digits",
  "The prime last-digit bias".

### Later — F05.6 user-entered sequences

Fits the same model as a series with `kind: 'symbols'` and a validated, length-capped payload in
the piece (not the link). Deferred because it needs storage and moderation thinking (E07/E08).

---

## 8. Risks and mitigations

| Risk                                                                                               | Mitigation                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old app (cached PWA, stale tab) opens a φ or primes link or piece as π, silently                   | M1 ships the `s=`/`source` reader with too-new handling before any second series; land M1 before F10.5                                                   |
| Wrong digits that look right (seen while writing this note)                                        | Two independent checks per constant: a published reference and an in-repo BigInt recomputation in CI, plus the OEIS head and a pinned sha256             |
| Regressing π / Original (2019)                                                                     | M1 is a refactor with no visible change; `verify-parity`, audio and poster snapshots must stay byte-identical; `digitAt` alias keeps the diff mechanical |
| "10" leaks after M4 (a view silently assumes ten colours)                                          | One `alphabetSize` source of truth; a unit test that runs every renderer with k = 2, 12, 16; e2e on a mod-12 source                                      |
| Generation janks a phone                                                                           | Pure chunked generators in a worker; cap at 1,000,001; cache; progress shown; prime sieve bounded at ~16 M                                               |
| App weight and offline size grow by ~1 MB per constant                                             | Lazy-load; PWA precaches π only (F10.5 decision); gzip; constants opt-in                                                                                 |
| Persisted ids chosen badly (they are forever)                                                      | Ids fixed in this note and reviewed by the owner (section 6); `persistedIds.test.ts` extended                                                            |
| Some readings sound monotonous (primes' last digit uses four notes; Fibonacci loops every 60)      | That is the point musically, but pair each series with suggested presets in its info popover; owner listening review like S02.6.3                        |
| Audio CPU/distortion work in flight changes the sound chain                                        | Series work does not touch `audio/`; if presets change there, rebase snapshot baselines in that PR, not ours                                             |
| Merge conflicts with open mosaic PRs #17 and #18 (`useLinkedState`, `MosaicSweep`, `DigitArtView`) | Start M1 after #18 merges; M1 changes `useLinkedState` only to carry `s=`; `MosaicSweep` keeps calling `digitAt` via the alias                           |
| Tests get slow generating a million primes                                                         | Unit tests use small N and known checkpoints; one full-size check per series in a separate, tagged test                                                  |

## 9. How this interacts with work in flight

- **PR #17 (mosaic sweep fills the screen)** and **PR #18 (mosaic shows every digit by default)**
  both touch the mosaic, and #18 changes `useLinkedState`. Series work must not start editing
  those files until both merge. Nothing in them conflicts with the design: the mosaic and sweep
  are alphabet-free and read `source.digitAt`, which M1 keeps as an alias.
- **Audio distortion investigation** (CPU cost of instruments and effects): independent of the
  series, which never touch `audio/`. If it changes presets, its PR updates the π baselines.
- **Saved pieces (E10)**: the store, My pieces and backups are done (F10.3, F10.4). M1 adds one
  defaulted field to the piece and one link parameter; backups copy documents verbatim so they
  need nothing. **F10.5 (PWA)** is the one ordering constraint: land M1 first, or accept that
  phones with the cached pre-M1 app would open shared series links as π until they update.

## 10. Decisions for the owner

Each has a recommendation, and work can start on the recommended option.

| #   | Question                                                   | Options                                                              | Recommended                                                                             |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| D1  | First readings for Fibonacci and primes?                   | last digit + concatenated digits (base 10) / jump straight to mod 12 | **Base 10 first**: zero view changes, and it already shows the Pisano loop and the bias |
| D2  | φ digits: ship a verified file, or compute in the browser? | file (~1 MB, instant) / compute (~1.3 s desktop, longer on phones)   | **File**, with the generator kept for CI verification                                   |
| D3  | Add e and √2 in M2 alongside φ?                            | yes (same script, cheap) / φ only                                    | **Yes**, they cost one generator call each                                              |
| D4  | Where does the series choice live in links and pieces?     | own `SourceConfig` part (`s=`) / inside the sound config             | **Own part**, so presets keep matching and π links stay identical                       |
| D5  | Should presets choose a series?                            | no, presets stay sound only / yes                                    | **No**; suggest pairings in each series' info popover instead                           |
| D6  | View names that say π ("π walk", "Typographic π")          | follow the series ("φ walk") / neutral ("Walk")                      | **Follow the series**; ids never change, only labels                                    |
| D7  | Legacy note lengths for alphabets other than 10 (M4)       | scale the symbol onto the ten lengths / disable the Original rhythm  | **Scale onto the ten lengths**, so every preset works on every reading                  |
| D8  | Ship M1 before the installable PWA (F10.5)?                | yes / PWA first                                                      | **Yes**, to avoid cached apps misreading series links                                   |
| D9  | Fibonacci concatenation starts at F₀ = 0 or F₁ = 1?        | `0112358…` / `112358…`                                               | **F₀ = 0** (OEIS convention, and the counter's first digit is then 0)                   |

## Sources

- OEIS: A000796 (π), A001622 (φ), A001113 (e), A002193 (√2), A000045 (Fibonacci), A001175
  (Pisano periods), A000040 (primes), A033308 (Copeland–Erdős constant), A003849 (Fibonacci word),
  A010051 (characteristic function of primes), A001223 (prime gaps).
- R. J. Lemke Oliver and K. Soundararajan, "Unexpected biases in the distribution of consecutive
  primes", _PNAS_ 113 (31), 2016.
- S. M. Ulam's prime spiral (1963), as popularised by M. Gardner, _Scientific American_, March 1964.
- Earlier notes: [R-004](R-004-fibonacci-and-sequences.md) (Fibonacci ideas),
  [R-007](R-007-saved-pieces-and-pwa.md) (compatibility contract),
  [R-006](R-006-artistic-visualizations.md) (views).
- Measurements in section 1 were made with Node 22 on the project's cloud container, 2026-10-05.
