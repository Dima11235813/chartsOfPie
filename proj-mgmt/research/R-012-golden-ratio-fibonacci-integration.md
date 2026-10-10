---
id: R-012
title: 'Golden ratio and Fibonacci: what they change in each feature, and the best order'
status: done
feeds: [E05, E02, E03, E04]
---

# R-012 — Golden ratio and Fibonacci across the app

## Question

The owner asked: plan how the golden ratio and the Fibonacci sequence come into the app, how
they affect the features we have, and how to integrate them best.

[R-011](R-011-number-series-architecture.md) (draft PR #19) already answers the _architecture_:
a series produces terms, a reading turns them into symbols, and the choice travels as a third
part of the shared state (`s=` in links, `source` in pieces). PR #19 has also **built** M1 (the
series-ready core) and M2 (φ, e and √2 as digit streams with a Number picker).

This note is the layer on top. It works through every feature on master today, including the
ones that landed after R-011 was written (Where in π, the mosaic fill, sweep and shape census,
the performance pass, MIDI out, the newer views). For each one it says what φ and Fibonacci
change and what they need. Then it gives an integration order.

## The short answer

1. **φ has two lives in the app.** As a _number_, its digits are a stream like π's; PR #19
   built that. As a _structure_ (the golden angle, a φ:1 interval, golden swing, Fibonacci
   phrase lengths, the Fibonacci word) it shapes sound, rhythm and views for **every** number,
   π included. The second life needs no series machinery and can ship on its own.
2. **Fibonacci is a series, and its reading decides everything.** Its last digits loop every 60
   terms, so the mosaic, chart, ring and sound all show that loop. Its concatenated digits look
   random, except for the first digit of each term, which follows Benford's law. Both are lessons
   the existing views already show, given the data.
3. **Most features need nothing, a few need a small adapter, and three need real design work:**
   - Where in π: what does "position" mean for a sequence of terms?
   - Term boundaries: hearing and seeing where one Fibonacci number ends.
   - Alphabet 12, for Fibonacci mod 12 on the music clock and fretboard.
4. **Order:**
   - Merge PR #19 first; it is mergeable and covers φ's digits.
   - Ship a "golden" sound and art slice next. It works on every number and conflicts with nothing.
   - Then Fibonacci in base 10 (R-011 M3), with jump-to-term and Pisano column chips.
   - Then mod 12 (M4).
   - Then the Fibonacci-native views (M5).

## 1. Facts this plan relies on (computed, not recalled)

Computed with a throwaway Node script, 2026-10-07:

| Fact                                      | Value                                                                                                      | Why it matters here                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pisano periods                            | mod 2: 3 · mod 3: 8 · mod 5: 20 · mod 8: 12 · **mod 10: 60** · **mod 12: 24**                              | Fibonacci last digits are a 60-note loop; mod 12 is a 24-note melody                                                                 |
| Last digits over one 60-term loop         | 0, 2, 4, 6, 8 four times each; 1, 3, 5, 7, 9 **eight** times each                                          | The digit chart shows a striking 4 : 8 comb instead of π's flat bars                                                                 |
| Walk and ring on Fibonacci last digits    | the 60-step walk returns exactly to its start; 60 of 100 digit-to-digit transitions occur                  | The walk is a closed figure, and the ring stops growing after one loop                                                               |
| Mosaic on Fibonacci last digits           | vertical equal neighbours at 12 columns: **0 %**; 15: 20 %; 20: 33 %; 30: 20 %; **60: 100 %**              | At 60 columns every column is one colour; at 12 there are no vertical links at all. The sweep and the width slider _find_ the period |
| Fibonacci mod 12 as pitch classes         | 0 1 1 2 3 5 8 1 9 10 7 5 0 5 5 10 3 1 4 5 9 2 11 1, which uses **11 of the 12** pitch classes and never F♯ | A 24-step melody that avoids the tritone above C: the music clock shows the missing spoke                                            |
| Concatenated Fibonacci digits (1,000,000) | 3,094 terms; every digit 9.94–10.07 %                                                                      | Looks as random as π overall…                                                                                                        |
| First digit of F₁…F₃₀₀₀                   | 1: 30.1 % · 2: 17.6 % · 3: 12.5 % … 9: 4.6 % (Benford: 1 → 30.1 %)                                         | …but the first digit of each term follows Benford's law. Only visible if we know where terms start                                   |
| φ as a frequency ratio                    | 1200 · log₂ φ = **833.09 cents**, between a minor sixth (800) and a major sixth (900)                      | A "golden interval" for the harmonograph and an optional tuning                                                                      |
| Golden angle                              | 137.508°                                                                                                   | Already drives the sunflower (`GOLDEN_ANGLE` in `viz/art.ts`); the ring spreads link ends by frac(k/φ)                               |
| Golden swing                              | long : short = φ when swing s = (φ − 1)/(φ + 1) = 1/φ³ ≈ **0.236**                                         | Fits the existing `swing` field (0–0.5): no schema change, only a named value                                                        |
| Fibonacci word (0 → 01, 1 → 0)            | 0100101001001010010100…; zeros : ones → **1.61808**                                                        | A rhythm of long and short notes that never repeats, with the long notes φ times as common                                           |
| Zeckendorf codes                          | 4 = 101, 6 = 1001, 7 = 1010, 12 = 10101; never two 1s in a row                                             | Rhythm patterns with no two adjacent hits                                                                                            |
| Golden section                            | of 34 bars: 21.01; of a 60-step loop: 37.08                                                                | A climax point for phrases of Fibonacci length                                                                                       |

## 2. Feature by feature

**Effort:** — none, **S** small adapter, **M** design work. "φ digits" means φ read as decimal
digits (PR #19); "Fib" means Fibonacci in base 10 (last digit or concatenated, R-011 M3).

### Navigation and persistence

| Feature                                         | φ digits                                                                                                                                                                                                       | Fibonacci                                                                                                                                                                                                                                                                                                                                                  | Effort |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Where in π** (`StartPanel`, `at=`)            | Built in #19 as "Where in φ". Find digits works unchanged. Famous spots per number replace the π-only Feynman point (φ = 1.6180…: the first 0 is at decimal place 4; longer runs are found by the same search) | **Position is ambiguous.** For last digits, any start is the same 60-loop, shifted: show "step k of the 60-step loop" instead of a decimal place. For concatenated digits, people think in terms ("start at F₁₀₀"), not symbol offsets: add **Jump to Fₙ**, which maps n to its first symbol through the reading's term starts. `at=` stays a symbol index | M      |
| **Share links and last session**                | `s=phi` plus `at=` (built)                                                                                                                                                                                     | `s=fibonacci[.concat]` plus `at=`, a symbol index into that reading. A link to "F₁₀₀" stores the symbol index, so it survives any later UI change                                                                                                                                                                                                          | —      |
| **Saved pieces** (`source`, `position.start`)   | Built in #19                                                                                                                                                                                                   | Same fields. `position.start` is a symbol index, like `at=`                                                                                                                                                                                                                                                                                                | —      |
| **Resume / seek** (`MAX_RESUME_DIGITS` 100,000) | Unchanged                                                                                                                                                                                                      | Unchanged. With Where in π, a jump is instant anyway                                                                                                                                                                                                                                                                                                       | —      |

### Sound

| Feature                                                         | φ digits                                                                  | Fibonacci                                                                                                                                                                                                                    | Effort |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Sound: scales, mappings, instruments, presets**               | Unchanged; presets stay sound-only (R-011 D5)                             | Base 10: unchanged. A 60-note loop with the 4 : 8 comb sounds like a riff; the listening review should pick suggested presets. Mod 12 needs the alphabet work (R-011 M4). `semitones` then maps symbol = pitch class exactly | S / M  |
| **Rhythm** (`legacy`, `steady`, `steady-rests`, `digit-length`) | Unchanged                                                                 | Unchanged. New, for **every** number: `fibonacci-word` and `zeckendorf` rhythms (§3)                                                                                                                                         | S      |
| **Swing**                                                       | A "Golden" notch at 0.236 (long : short = φ) next to straight and triplet | same                                                                                                                                                                                                                         | S      |
| **Term boundaries** (sound)                                     | n/a                                                                       | Concatenated reading only: an optional accent on the first digit of each term (R-011 S05.2.3). Without it Benford stays hidden                                                                                               | M      |
| **MIDI out** (`LiveMidiSender`, Nord)                           | Unchanged                                                                 | Unchanged. The 60-step loop is good for driving a hardware arpeggiator. Mod 12 sends true pitch classes                                                                                                                      | —      |
| **Audio snapshots, Original (2019)**                            | π baselines must stay identical; #19 keeps them                           | Same rule. New baselines only for new presets                                                                                                                                                                                | —      |

### Views and posters

| Feature                                    | φ digits                                                           | Fibonacci                                                                                                                                                                                                                                                                                                                                  | Effort |
| ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **Digit chart and stats**                  | Unchanged (flat, like π)                                           | Last digits: the 4 : 8 comb appears within 60 digits, a ready-made "why?" moment. Concatenated: flat, plus an optional "first digit of each term" chart showing Benford (needs term starts)                                                                                                                                                | S      |
| **Neighbour mosaic, sweep, shape census**  | Unchanged; it fills the stage and only counts on screen (#22, #23) | **The showcase.** At 60 columns, every column is one colour; at 12, no vertical link. Add **Pisano chips** (12, 20, 30, 60) next to Fit when the reading is periodic. The census stops changing after one period, so the "found X of 94 shapes" progress plateaus. Show "shapes repeat every 60 digits" instead of implying more will come | S      |
| **Digit ring** (transitions)               | Unchanged                                                          | Last digits: exactly **60 of the 100** possible transitions occur (odd digits have 8 followers, even ones 4), so the ring draws a fixed set of chords within one loop and then never adds another. It is a picture of the recurrence                                                                                                       | —      |
| **π walk**                                 | "φ walk" (built)                                                   | Last digits: the walk **closes exactly** after 60 steps (the odd digits' five directions cancel, as do the even ones'), so it retraces one closed figure forever. Concatenated: a random-looking walk                                                                                                                                      | —      |
| **Sunflower**                              | Unchanged (already golden-angle)                                   | Same view, but this is _the_ Fibonacci picture. Highlight the parastichy counts (21, 34, 55 spirals) as a toggle; it works on every number                                                                                                                                                                                                 | S      |
| **Hilbert carpet**                         | Unchanged (#19 counts the source's length)                         | Last digits: a period-60 texture, very different from π's noise. A good poster                                                                                                                                                                                                                                                             | —      |
| **Typographic**                            | "Typographic φ" (built)                                            | Concatenated: mark term boundaries (thin rule or alternating weight) so 13, 21, 34 read as numbers                                                                                                                                                                                                                                         | S      |
| **String art**                             | Unchanged                                                          | Unchanged. New for all numbers: a **"Golden" multiplier** (×φ, ×φ²) mode beside the digit-driven multiplier; ×φ never closes into a regular star                                                                                                                                                                                           | S      |
| **Harmonograph**                           | Unchanged                                                          | Unchanged. New for all numbers: a **golden interval** (833 ¢) demo beside Pure ratios. φ is the "most irrational" ratio, so the figure never closes                                                                                                                                                                                        | S      |
| **Music clock**                            | Unchanged                                                          | Mod 12 (after M4): the 24-step loop lights 11 spokes and leaves **F♯ dark**. In circle-of-fifths order the shape is different. Both are lessons                                                                                                                                                                                            | — (M4) |
| **Guitar fretboard**                       | Unchanged                                                          | Mod 12: a fixed 24-note shape on the neck                                                                                                                                                                                                                                                                                                  | —      |
| **Cymatics**                               | Unchanged                                                          | Last digits: the plate cycles through a 60-figure sequence. Mode table is indexed by digit, fine in base 10; needs the M4 adapter for 12                                                                                                                                                                                                   | — / S  |
| **Sheet music, spectrogram, oscilloscope** | Unchanged                                                          | Unchanged. Sheet music could add bar lines every 60 notes for the loop                                                                                                                                                                                                                                                                     | —      |
| **Posters** (`posters.ts`, snapshots)      | φ snapshots built in #19                                           | New baselines: Fibonacci mosaic at 60 columns, Hilbert carpet, Benford chart                                                                                                                                                                                                                                                               | S      |

### Platform

| Feature                                 | φ digits                                         | Fibonacci                                                                                                                                                                                                    | Effort |
| --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **Performance** (`npm run perf`, R-010) | One extra 1 MB file per number, loaded on demand | Last digits: a 60-entry table, free. Concatenated: 3,094 BigInt additions plus `toString` of terms up to ~650 digits, well under a second; run it off the main thread or chunk it, and add a `perf` scenario | S      |
| **Account API**                         | Redeploy after #19 so it knows `source`          | Same                                                                                                                                                                                                         | —      |

### What this table says

- **The mosaic, the chart and the music clock** carry most of the Fibonacci story with no new
  views. The work is small affordances, such as Pisano chips and an honest census plateau.
- **Term boundaries** are the one Fibonacci-specific channel worth building early. They unlock
  Benford, typographic numbers, jump-to-Fₙ and accents.
- **Golden structure** (swing, rhythm, string art, harmonograph, sunflower spirals) is
  independent of which number plays. It is the cheapest, least risky golden content, and it
  makes π better too.

## 3. φ-native ideas worth adding (beyond R-011)

R-011 M5 lists the ratio → φ chart, Fibonacci squares and spiral, Ulam spiral, Fibonacci-word and
Zeckendorf rhythms. This note adds detail and a few more, all usable with any number:

1. **Fibonacci-word rhythm** (`rhythm: 'fibonacci-word'`): each digit's step is long or short as
   the Fibonacci word dictates, with long = φ × short. The result is quasi-periodic, never
   repeating but always feeling regular. A new enum value is additive. Older apps that meet it
   fall back through the existing unknown-value path and must show the "newer version" notice
   rather than play it silently as another rhythm (rule 8; check `replaced` handling).
2. **Zeckendorf rhythm** (`rhythm: 'zeckendorf'`): a digit d plays its Zeckendorf code as hits
   and rests (4 → x-x, 7 → x-x-, 12 → x-x-x), so no two hits are adjacent.
3. **Golden swing:** a named notch at swing 0.236 (long : short = φ). No schema change; it is a
   value of the existing field. The UI shows "Golden" when the value matches.
4. **Golden interval:** in the harmonograph, a toggle that draws φ:1 (833 ¢) for comparison with
   pure and tempered intervals. Later, an optional "golden" microtonal scale (steps of 833 ¢
   folded into the octave) as a _new_ scale id, never a change to an existing one.
5. **Golden string art:** multiplier ×φ beside the digit-driven multiplier.
6. **Sunflower spirals:** highlight the 21, 34 and 55 parastichies (seeds n, n + 21, n + 42…);
   a toggle with the rule 9 e2e.
7. **Golden-section form** (later, E02): phrases of Fibonacci length (8, 13, 21, 34 notes) with a
   dynamic swell peaking at the golden section (21 of 34). This is an arranger feature behind a
   new, defaulted config field.
8. **Fibonacci-native views** (R-011 M5, refined):
   - **ratio → φ:** a line that alternates above and below φ, closing in. Each step is
     F(n+1)/F(n) for the term being played.
   - **Golden rectangle mosaic:** digits fill a recursively subdivided golden rectangle (squares
     of side 1, 1, 2, 3, 5, 8…) with the spiral drawn through it. A digit view that works for
     any number, and a strong poster.
   - **Pisano loop:** the 60 last digits on a circle, with the current step lit.

## 4. Integration order

| Step | What                                                                                                                                                                                        | Depends on       | Conflicts                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0    | **Merge PR #19** (R-011 M1 and M2: series core, φ/e/√2, Number picker), after the owner listens to φ and redeploys the API                                                                  | owner review     | It is rebased on today's master and mergeable. It touches `App.tsx` heavily, so other App work should wait until it lands |
| G1   | **Golden slice, every number:** golden swing notch, golden string art, golden interval in the harmonograph, sunflower spirals. Each control gets a both-ways e2e (rule 9)                   | none             | Views and sound UI only. Can start in parallel with step 0 if it avoids `App.tsx`                                         |
| G2   | **Fibonacci-word and Zeckendorf rhythms** (new rhythm ids, unit tests citing the patterns, audio render and listening check, rule 2)                                                        | none             | `config.ts`, `arranger.ts`. Additive enum values, so check the too-new path                                               |
| F1   | **Fibonacci in base 10** (R-011 M3): generators, `last-digit` and `concat` readings, **term starts** as metadata                                                                            | step 0           | Core series files from #19                                                                                                |
| F2   | **Fibonacci affordances:** Pisano chips in the mosaic, census plateau message, step-in-loop position, **Jump to Fₙ** in Where in φ/Fib, typographic term marks, first-digit (Benford) chart | F1               | `StartPanel`, `DigitArtView`, `MosaicShapesPanel`                                                                         |
| F3   | **Mod 12** (R-011 M4): alphabet 12 through the counter, mapping, palettes and seven views. Then the music clock shows the missing F♯                                                        | F1               | Wide: plan as its own epic slice                                                                                          |
| F4   | **Fibonacci-native views:** ratio → φ, golden rectangle mosaic, Pisano loop; lessons in E04                                                                                                 | F1 (F3 optional) | New files only                                                                                                            |

G1 and G2 deliver "golden" content within days, with no dependency on the series work. F1 and F2
then turn Fibonacci from "another stream" into the app's best lesson on periodicity.

## 5. Risks

| Risk                                                                   | Mitigation                                                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fibonacci last digits feel repetitive (a 60-note loop)                 | That _is_ the lesson. Default Fibonacci to the concatenated reading in the picker and offer last digits as "Hear the loop"; listening review with presets |
| "Position" for Fibonacci confuses (decimal place vs term)              | Keep `at=` a symbol index everywhere (simple, permanent); the UI translates to "term n" or "step k of 60" per reading                                     |
| New rhythm ids opened by an old app                                    | Verify the too-new / `replaced` path for an unknown rhythm in the share-link fixtures before shipping G2                                                  |
| Merge conflicts with PR #19 (`App.tsx`, `StartPanel`, `usePiPlayback`) | Step 0 first; G1/G2 stay out of those files                                                                                                               |
| Census and "found X of 94" promise more shapes on a periodic reading   | Detect periodic readings (period known from the reading) and say so                                                                                       |
| CPU: BigInt concatenation on phones                                    | Chunked generation off the main thread; a `perf` scenario for Fibonacci; cache per session                                                                |
| Facts drift (Pisano periods, Benford shares)                           | Unit tests cite them with OEIS references (A001175, A000045, A003849), as rule 4 requires for musical facts                                               |

## 6. Decisions (owner, 2026-10-10: all as recommended)

| #   | Question                                               | Decision                                                                                                     |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| G-1 | Merge PR #19 (φ, e, √2 and the Number picker)?         | **Merged** after re-checking it on today's master                                                            |
| G-2 | Golden slice before Fibonacci?                         | **Yes**. Built: golden swing, golden string art, golden ratio in the harmonograph, sunflower spirals (F05.8) |
| G-3 | Fibonacci's default reading                            | **Concatenated digits**; "last digit (60-step loop)" second                                                  |
| G-4 | Positions for Fibonacci                                | **Store symbol indices; show terms** ("F₁₀₀", Jump to Fₙ) and **loop steps** for last digits                 |
| G-5 | Fibonacci-word and Zeckendorf rhythms for every number | **Yes**, as new rhythm ids after the too-new check (S05.8.2)                                                 |
| G-6 | Golden microtonal scale (833 ¢ steps)                  | **Later**, as a new scale id after a listening review (S05.8.3)                                              |

R-011's D1–D9 still stand. D1 (base 10 first) and D9 (F₀ = 0) are consistent with this plan.

## Sources

- OEIS A000045 (Fibonacci numbers), A001175 (Pisano periods), A003849 (Fibonacci word), A001622
  (φ), A007895 (Zeckendorf: number of terms).
- E. Zeckendorf, "Représentation des nombres naturels par une somme de nombres de Fibonacci…",
  _Bull. Soc. Roy. Sci. Liège_ 41 (1972).
- H. Vogel, "A better way to construct the sunflower head", _Mathematical Biosciences_ 44 (1979).
- F. Benford, "The law of anomalous numbers", _Proc. Am. Philos. Soc._ 78 (1938); Fibonacci numbers
  satisfy it (J. L. Brown & R. L. Duncan, _Fibonacci Quarterly_ 8, 1970).
- [R-004](R-004-fibonacci-and-sequences.md), [R-011](R-011-number-series-architecture.md) (PR #19),
  [R-010](R-010-performance.md), [R-009](R-009-mosaic-shapes.md).
