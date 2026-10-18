---
id: R-013
title: 'Lenses, new views and sounds, and a Learn series for every number and display'
status: in-progress
feeds: [E03, E02, E04, E05]
---

# R-013 — Lenses that reveal patterns, more views and sounds, and "Learn more"

## Question

The owner asked (2026-10-17): keep adding art views and sounds, think of interesting ways to
manipulate a number series so it reveals patterns ("my recent favourite: the Fibonacci sequence
in base 12"), and give the app **Learn more** links into an educational series that explains
each number and how each display of it works.

Builds on [R-011](R-011-number-series-architecture.md) (series → reading → symbols, `s=` in
links) and [R-012](R-012-golden-ratio-fibonacci-integration.md) (φ and Fibonacci everywhere).

## The short answer

1. **A "lens" is a reading.** Every manipulation below is a pure function from a series' terms to
   symbols with a declared alphabet: a base, a modulus, a digit sum, a difference. R-011 already
   persists readings as fixed additive ids (`s=fibonacci.mod-12`), so each lens is one id, one
   generator and its tests, with no schema version bump.
2. **Base 12 is the best first lens**, because Fibonacci is unusually tidy in base 12 (facts in
   §1). It ships first, as `s=fibonacci.base-12`.
3. **The next view should show place value**: one term per row, right-aligned, coloured by digit
   (the _place-value wall_, §2). It makes the base-12 facts visible at a glance, and works for any
   base or sequence of whole numbers.
4. **Learn more is a separate page (`learn.html`)** with one short article per number, per
   reading and per view, each with a **Try it** link that opens the app in exactly that state,
   and an OEIS citation. The app links to the right article next to the Number, Reading and View
   pickers. It is the first piece of E04 (lessons), written so lessons can embed it later.

## 1. Facts this plan relies on (computed, not recalled)

Computed with BigInt in Node on 2026-10-17; the ones the app states are pinned by unit tests.

| Fact                                                           | Base 12             | Base 10 for contrast |
| -------------------------------------------------------------- | ------------------- | -------------------- |
| F₁₂ = 144 = 12², the only Fibonacci square past 1              | written **100**     | 144                  |
| Last digit repeats with period π(b) (Pisano, A001175)          | **24**, never a 6   | 60                   |
| Last **two** digits repeat with period π(b²)                   | **24** (π(144))     | 300 (π(100))         |
| Last three digits                                              | 288 (π(1728))       | 1,500                |
| Fₙ ends in 00 exactly when                                     | **12 divides n**    | 150 divides n        |
| First digit d follows Benford, share log_b(1 + 1/d)            | 1: 27.9 %, B: 3.5 % | 1: 30.1 %, 9: 4.6 %  |
| Each symbol's share over the first million concatenated digits | ~8.3 % (1/12) each  | ~10 % each           |
| Terms needed for a million concatenated symbols                | 3,214               | 3,094                |

Why base 12 is tidy: 12 = 2² · 3, and the Fibonacci numbers divisible by 2, 3, 4 and 12 sit at
every 3rd, 4th, 6th and 12th term. So the low base-12 digits repeat quickly, while in base 10 the
factor 5 (period 20) stretches the loops to 60 and 300.

## 2. Lenses (readings) worth adding

Each is a new reading id (additive), listed on the series it makes sense for.

| Lens                       | Id (proposed)                | Alphabet           | What it reveals                                                        |
| -------------------------- | ---------------------------- | ------------------ | ---------------------------------------------------------------------- |
| All digits in base 12      | `base-12` (**built**)        | 12                 | Benford in base 12; every 12th term ends in 00; ~1/12 each overall     |
| Mod 12                     | `mod-12` (done)              | 12                 | 24-note loop without F♯                                                |
| Last digit                 | `last-digit` (done)          | 10                 | 60-step loop                                                           |
| Digital root               | `digital-root` (**built**)   | 10 (0 only for F₀) | Fibonacci: a 24-step loop (π(9) = 24), so it lines up with mod 12      |
| Mod 5, mod 8               | `mod-5`, `mod-8` (**built**) | 5, 8               | Short loops (20, 12) for pentatonic or octatonic playing               |
| Binary                     | `base-2`                     | 2                  | Two-colour carpets; the Ulam / Sacks spirals for primes                |
| First digit only           | `first-digit`                | 9                  | Benford as a stream: hear 1 far more often than 9                      |
| Term length                | `length`                     | ~36                | A slow staircase (each term ~0.21 digits longer: log₁₀ φ)              |
| Differences / gaps         | `gaps` (primes)              | ≤ 36               | Prime gaps: always even after 2, sixes most common                     |
| Constants in base 12 or 16 | `base-12` on π, φ, e         | 12, 16             | π looks just as random in any base (normality): the lesson is the null |

Constants in another base need data, not a generator: convert the verified decimal file once
(⌊x · 10ᴰ⌋ · 12ᴷ / 10ᴰ in BigInt), verify with a second independent algorithm as R-011 did for
φ, e and √2, and pin the sha256. Fibonacci and primes stay generated in the browser.

## 3. New views

| View                   | Idea                                                                                                                                                                                | Works for                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Place-value wall**   | One term per row, right-aligned, one cell per digit coloured by digit. Right columns show the loops, the left edge a straight staircase of slope log_b φ, the first column Benford. | Any whole-number reading (terms) |
| Pisano star            | Residues mod m on a circle, joined in playing order: mod 12 traces a 24-step star that skips the 6 o'clock point                                                                    | Periodic readings                |
| Pair orbit             | (Fₙ, Fₙ₊₁) mod m as points on an m × m grid: the loop as a closed orbit                                                                                                             | Periodic readings                |
| Ratio → φ (S05.7.1)    | Fₙ₊₁/Fₙ alternating above and below φ, closing in                                                                                                                                   | Fibonacci                        |
| Ulam / Sacks (S05.7.3) | Prime indicator on a square or Archimedean spiral                                                                                                                                   | Primes, binary                   |
| Times-table circle     | Mathologer's modular multiplication: point i joined to (i · d) mod m, with d from the current digit                                                                                 | Any number                       |

The place-value wall comes first: it is the one picture that explains the base-12 facts.

## 4. New sounds

All measured (rule 2): new presets only, -14 ± 1.5 dB, a spectrogram baseline each.

- **Dozenal semitones** preset: mod 12 and base 12 on `semitones` from C with a soft mallet, so
  base-12 symbols are the 12 pitch classes directly (no scale bending).
- **Place-value voices**: each term plays as a chord or arpeggio, last digit in the bass (the
  24-step loop as an ostinato), first digit on top (Benford melody).
- **Term-boundary accent**: a softer click or a velocity change where each term starts (R-012
  risk "hearing where one number ends").
- **Two loops at once**: mod 12 (24 steps) against last digit (60 steps) as a polyrhythm that
  lines up every 120 terms.
- Microtonal b-EDO (base 19 on 19-tone equal temperament) is interesting but needs a tuning
  model in the engine; parked.

## 5. Learn more: the educational series

**Shape.** A third Vite page, `learn.html`, beside the app and the lab. Articles are data in
`src/learn/articles.ts` (title, a one-line summary, short sections, facts, OEIS links), rendered
by a small React page; `learn.html#fibonacci`, `#reading-base-12`, `#view-mosaic` open one
article. A page rather than a dialog: it is shareable, crawlable, readable while the music keeps
playing in the other tab, and it is the frame E04 lessons will grow from.

**Coverage, first slice.** Every number (π, φ, e, √2, Fibonacci), every reading (digits, all
digits, last digit, mod 12, base 12) and every view (16). Each article answers three questions:
what am I looking at, what is the maths, what pattern should I look for. Every musical or
numeric fact in an article is pinned by a test (rule 4), and every article has a **Try it** link
built with the share-link builder, so it opens in the right state.

**Links from the app.** A small "Learn more" link next to the Number / Reading pickers (opens
the reading's article for a series with several readings, the number's otherwise) and next to
the View selector. Opened in a new tab so playback is not interrupted.

**Later (E04).** Ordered tracks ("Numbers", "Sound is math", "Art"), embedded live playgrounds
with a preset config, progress kept on the device.

## 6. Order

| Slice | Contents                                                                          | Status                   |
| ----- | --------------------------------------------------------------------------------- | ------------------------ |
| L1    | `fibonacci.base-12` reading, Benford in any base, `learn.html` with every article | done (PR #36)            |
| L2    | Place-value wall view (any terms reading), poster, e2e on, off, on (rule 9)       | done (PR #36)            |
| L3    | Dozenal semitones preset + term-boundary accent, measured                         | preset done; accent next |
| L4    | Digital root, mod 5, mod 8 readings; Pisano star view                             | readings done; star next |
| L5    | π, φ, e, √2 in base 12 (verified data files)                                      | backlog                  |
| L6    | Place-value voices, two-loop polyrhythm                                           | backlog                  |
| L7    | E04 lesson tracks built on the Learn articles                                     | backlog                  |

## 7. Decisions (defaults taken; the owner can overrule)

- **D1. Base 12 reading id** `base-12`, named "All digits in base 12", third-to-last in
  Fibonacci's list (all digits stays the default, G-3). Reversible until links are shared.
- **D2. Learn as a page, opened in a new tab**, not a dialog (§5).
- **D3. Articles as TypeScript data**, not MDX: no new build dependency; MDX can come with E04.
- **D4. Benford in base b** uses log_b(1 + 1/d) for d = 1 … b − 1 in the stats table.
