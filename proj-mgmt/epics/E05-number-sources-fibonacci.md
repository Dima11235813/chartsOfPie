---
id: E05
title: 'More numbers: Fibonacci, φ, e, √2, primes'
status: in-progress
phase: 3
---

# E05 — More numbers: Fibonacci, φ, e, √2, primes

## Outcome

π is one of many numbers. You pick a **number** (π, φ, e, √2, Fibonacci, primes) and, for
integer sequences, a **reading** (last digit, all digits, mod 12…), and every sound preset and
every view works with it. Links and saved pieces remember the number; every π link made so far
opens exactly as before.

Architecture and plan: [R-011](../research/R-011-number-series-architecture.md). A series
produces terms, a reading turns them into symbols with a declared alphabet size, and the rest of
the app consumes a `SymbolSource` (today's `DigitSource`, generalised).

## Milestones and features

| Milestone | What ships                                                     | Features     | Status        |
| --------- | -------------------------------------------------------------- | ------------ | ------------- |
| M0        | Plan: R-011, this breakdown, owner decisions                   | —            | done          |
| M1        | Series-ready core and persistence, π only, no visible change   | F05.1        | done (PR #19) |
| M2        | Golden ratio (and e, √2) as verified digit files + Number pick | F05.3        | done (PR #19) |
| G         | Golden structure for every number (R-012)                      | F05.8        | in-progress   |
| M3        | Fibonacci and primes in base 10 (last digit, concatenated)     | F05.2, F05.4 | review        |
| M4        | Any alphabet: mod 12, binary, gaps, other bases                | F05.5        | backlog       |
| M5        | Series-native art and rhythm (ratio → φ, Ulam, Fibonacci word) | F05.7        | backlog       |
| Later     | User-entered sequences                                         | F05.6        | backlog       |

- [ ] [F05.1 — Series-ready core and source persistence](../features/F05.1-series-core.md)
- [ ] [F05.2 — Fibonacci](../features/F05.2-fibonacci.md)
- [ ] [F05.3 — Constants: φ, e, √2](../features/F05.3-constants.md)
- [ ] [F05.4 — Primes](../features/F05.4-primes.md)
- [ ] [F05.5 — Any alphabet: residues, bases, binary](../features/F05.5-any-alphabet.md)
- [ ] [F05.6 — User sequences](../features/F05.6-user-sequences.md)
- [ ] [F05.7 — Series-native views and rhythms](../features/F05.7-series-native-views.md)
- [ ] [F05.8 — Golden structure for every number](../features/F05.8-golden-structure.md)

## Out of scope

Live streaming of unbounded sequences (every reading is materialised, capped at 1,000,001
symbols); arbitrary-precision arithmetic in the UI; user sequences before E07/E08.

## Research

- [R-011 — Number series beyond π: shared architecture and phased plan](../research/R-011-number-series-architecture.md)
- [R-012 — Golden ratio and Fibonacci across every feature; decisions G-1 to G-6](../research/R-012-golden-ratio-fibonacci-integration.md)
- [R-004 — Fibonacci and other sequences](../research/R-004-fibonacci-and-sequences.md)
