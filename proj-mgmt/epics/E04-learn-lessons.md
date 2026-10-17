---
id: E04
title: 'Learn: guided lessons'
status: backlog
phase: 4
---

# E04 — Learn: guided lessons

## Outcome

Short, interactive lessons that use the playgrounds to teach real math and music theory, from
"What is π?" to "Why do modes sound different?". Suitable for curious adults and students (~12+).

## Features (to be broken down later)

- [x] F04.0 — **Learn page** (`learn.html`, R-013 §5): one article per number, reading and view,
      each with a Try it link into the app and OEIS citations; "Learn more" links next to the
      Number, Reading and View pickers. Articles are data (`src/learn/articles.ts`); a unit test
      fails if a series, reading or view has no article

- [ ] F04.1 — Lesson framework: MDX content + embeddable live playground with a preset config
- [ ] F04.2 — Track "Numbers": what is π · irrational vs rational · normal numbers & digit
      frequency (why every bar converges to ~10 %) · Fibonacci & φ
- [ ] F04.3 — Track "Sound is math": frequency & pitch · the octave as 2 : 1 · equal temperament
      as 2^(n/12) · just intonation ratios (3 : 2, 5 : 4) · consonance
- [ ] F04.4 — Track "Scales & modes": intervals · pentatonic · major/minor · modes as rotations ·
      circle of fifths as ×7 mod 12
- [ ] F04.5 — Track "Art": colour mapping, spirals, golden angle (137.5°) & phyllotaxis
- [ ] F04.6 — Progress tracking (local first, synced once accounts exist — E07)
- [ ] F04.7 — Quizzes / "name that mode" ear-training
