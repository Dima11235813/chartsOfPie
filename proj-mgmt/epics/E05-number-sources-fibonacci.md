---
id: E05
title: 'More numbers: Fibonacci, φ, e, √2, primes'
status: backlog
phase: 3
---

# E05 — More numbers: Fibonacci, φ, e, √2, primes

## Outcome

π is one of many number sources. Every source plugs into the same engine (`DigitSource` or a new
`NumberSequence` interface) so all encodings and visualizations work with it.

## Features (to be broken down when phase 3 starts)

- [ ] F05.1 — Source abstraction: generalise `DigitSource` to sequences of integers with a
      declared alphabet size (digits 0–9, residues mod n, raw integers) and a selector in the UI
- [ ] F05.2 — **Fibonacci** (roadmap priority): Fibonacci numbers mod 10 (Pisano period 60) and
      mod 12 (period 24 → one pitch class per step), Fibonacci-word rhythms, Zeckendorf
      representation, golden-angle phyllotaxis visualization, ratio Fₙ₊₁/Fₙ → φ convergence chart
- [ ] F05.3 — Constants: φ, e, √2 digits (generated offline, verified, sha256-pinned like π)
- [ ] F05.4 — Primes: prime gaps, primes mod 10 (last-digit bias), Ulam spiral
- [ ] F05.5 — Bases: show any source in base 2–16 and map to scales of matching size
- [ ] F05.6 — User sequences: paste or type a sequence (with validation and length limits)

## Research

[R-004 — Fibonacci and other sequences](../research/R-004-fibonacci-and-sequences.md)
