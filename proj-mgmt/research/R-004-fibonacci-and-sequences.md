---
id: R-004
title: Fibonacci and other sequences
status: done
feeds: [E05, E03, E04]
---

# R-004 — Fibonacci and other sequences

## Question

How do we bring the Fibonacci sequence (the next roadmap item after π) and other sequences into
the same music + visualization engine?

## Fibonacci facts that make good experiences

- Fₙ = Fₙ₋₁ + Fₙ₋₂ with F₀ = 0, F₁ = 1. Values grow exponentially (Fₙ ≈ φⁿ/√5), so we never
  sonify raw values — we use **residues** or **digits**.
- **Pisano periods:** Fₙ mod m is periodic. Period π(10) = 60 (last digits repeat every 60
  terms), π(12) = 24, π(2) = 3, π(5) = 20. "Fibonacci mod 12" maps directly onto the 12 pitch
  classes → a 24-note melody that loops forever: a perfect lesson on periodicity.
- **Golden ratio:** Fₙ₊₁/Fₙ → φ = (1 + √5)/2 ≈ 1.6180339887. Chart the ratio converging,
  alternating above/below φ.
- **Golden angle** 360°·(1 − 1/φ) ≈ 137.508° produces phyllotaxis (sunflower) patterns; spiral
  counts in sunflowers are consecutive Fibonacci numbers.
- **Zeckendorf representation:** every positive integer is a unique sum of non-consecutive
  Fibonacci numbers → binary-like rhythm patterns.
- **Fibonacci word** (0 → 01, 1 → 0 substitution) is a quasi-periodic binary sequence → rhythms
  that never quite repeat.
- Digits of φ itself are another irrational-number source like π.

## Other sequences for E05

e, √2, φ digits (pre-computed offline like π, sha256-pinned) · primes (gaps, last digit, Ulam
spiral) · Collatz trajectories · Recamán's sequence (famous for its sound and arc diagram) ·
Thue–Morse · user-entered sequences.

## Engine changes required

> Superseded in detail by [R-010](R-010-number-series-architecture.md), which splits a series
> (terms) from a reading (terms → symbols) instead of a single `valueAt(i)`.

- Generalise `DigitSource` into `NumberSequence { id, name, length | infinite, alphabetSize?,
valueAt(i) }`. Finite digit files and generated sequences (Fibonacci mod m computed on the fly
  with BigInt or modular arithmetic) both implement it.
- Mapping strategies (S02.2.1) take `alphabetSize` into account (mod 12 → chromatic directly).
- Counters generalise to an alphabet of any size.

## Recommendation

E05 starts with F05.1 (source abstraction) then F05.2 Fibonacci: "Fibonacci mod 12" melody,
Pisano-period visual loop, ratio → φ chart, phyllotaxis visualization (shares E03 renderer), and an
E04 lesson "Why sunflowers know Fibonacci".

## Sources

- OEIS A000045 (Fibonacci numbers), A001175 (Pisano periods).
- Vogel, H. "A better way to construct the sunflower head", _Mathematical Biosciences_ 44 (1979).
- Zeckendorf's theorem — standard number theory texts.
