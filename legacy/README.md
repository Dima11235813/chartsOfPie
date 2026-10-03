# Legacy app (2019) — read-only reference

The original "Charts of Pie": vanilla JavaScript, Chart.js 2.8 and Tone.js from CDNs, iterating
through a million digits of π, charting how often each digit occurs and playing each digit as a
note of the C major pentatonic scale.

It is kept **unchanged** as the behavioural reference for the modern app in `apps/web/` — see
the `verify-parity` skill (`.claude/skills/verify-parity/SKILL.md`) and the bugs found in it
(`proj-mgmt/bugs/`). Do not edit these files.

To run it, serve the folder (e.g. `npx serve legacy/simpleHtml`) and open it in a browser. Note
that it loads the latest Tone.js from unpkg (B-004), so it may no longer work exactly as it did.
