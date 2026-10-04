---
id: R-008
title: More instruments, classic keyboards & playing through hardware (Nord)
status: done
feeds: [E02, E03]
---

# R-008 — More instruments, classic keyboards & playing through hardware (Nord)

## Goal

Owner request: an acoustic guitar, more synthesizers, and the famous electric pianos and keyboards
(Rhodes, Hohner, Wurlitzer…). Also: the owner has a **Nord keyboard** with its own sound library, so
we look at how to "plug it in". And a guitar fretboard view, so guitarists can see π on the
instrument they know.

## 1. The sounds people mean, and how to make them in the browser

Every built-in instrument is synthesised (or uses freely licensed samples), loudness-calibrated
(`CALIBRATE=1 npm run audio:render`, target -20 dB on the neutral phrase) and gets a General MIDI
program for MIDI export.

| Sound                          | What makes it recognisable                                                                                                 | Browser approach (Tone.js)                                                                                                           | Status                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **Fender Rhodes** (tine piano) | Struck metal tine + tonebar: bell-like attack, sine-ish sustain, "bark" when played hard                                   | 2-operator FM, ratio ≈ 1 (+ a high-ratio bell partial); stereo tremolo of the Suitcase model                                         | ✅ `electric-piano` (FM) |
| **Wurlitzer 200A**             | Steel reed with electrostatic pickup: reedy, hollow, odd harmonics, growls when hard; built-in vibrato (amplitude tremolo) | FM with a square-ish modulator, soft clipping, tremolo ~5.5 Hz                                                                       | ✅ this slice            |
| **Hohner Clavinet D6**         | Hammered string with pickups: very bright, percussive, funky "quack"; muted decay                                          | Pulse wave (narrow width) + resonant band-pass with a fast envelope, short decay                                                     | ✅ this slice            |
| **Hohner Pianet**              | Plucked reeds (sticky pads): short, woody, mellow                                                                          | Close to Wurlitzer with faster decay; later                                                                                          | later                    |
| **Hammond B-3 + Leslie**       | Additive drawbars (sine partials 16′ 8′ 5⅓′ 4′ 2⅔′ 2′ …), instant attack, key click, rotating-speaker chorus/vibrato       | Custom-partial oscillator (drawbar registration), organ envelope, chorus for the Leslie                                              | ✅ this slice            |
| **Minimoog / analog lead**     | Detuned sawtooth oscillators through a resonant 24 dB ladder low-pass with filter envelope                                 | Fat sawtooth + resonant low-pass with envelope                                                                                       | ✅ this slice            |
| Prophet-5 / Juno-106 pads      | Poly saw/pulse with chorus (Juno)                                                                                          | `warm-pad` exists; a "Juno strings" with chorus later                                                                                | partly                   |
| Yamaha DX7 (E. piano 1, bells) | 6-operator FM                                                                                                              | `music-box` covers bells; a DX "E.Piano 1" later                                                                                     | partly                   |
| Mellotron (flutes, strings)    | Tape-replay samples: wobbly, lo-fi                                                                                         | Needs samples (licensing!) — later                                                                                                   | later                    |
| **Acoustic guitar** (steel)    | Plucked string with bright attack, body resonances (≈ 100 Hz air, ≈ 200 Hz top), quick decay                               | Subtractive pluck (saw + triangle) with a fast filter envelope through body-resonance peaks                                          | ✅ this slice            |
| Electric guitar                | Pickup resonance, amp drive, cabinet                                                                                       | done (S02.4.5)                                                                                                                       | ✅                       |
| Sampled acoustic instruments   | Realism                                                                                                                    | Only freely licensed sets (Salamander piano CC BY 3.0 already). FreePats / VSCO 2 CE (CC0) are candidates for guitar, strings, winds | candidates               |

Rules for adding sounds stay as in R-005: new sounds are new instruments/presets (never edit
Original), calibrate, render, look at the spectrogram, snapshot only presets.

## 2. "Plugging in" the Nord

### Can we load the Nord library into the app?

**No — and we shouldn't try.** Nord Piano Library and Nord Sample Library files (`.npno`,
`.nsmp`/`.nsmp3`) are a proprietary format licensed for use on Nord instruments. Extracting them
into a web app would breach that licence.

### What works instead: let the Nord play π (Web MIDI)

The browser can **send MIDI to the Nord over USB** (Web MIDI API). The app keeps doing the maths
(digits → notes, rhythm, chords) and the Nord makes the sound, with every piano, organ and synth
in its library — and the app still visualises everything.

- **Supported in** Chrome, Edge, Opera and Firefox (≥ 108; asks permission). **Not Safari / iOS.**
  Needs HTTPS — the GitHub Pages site qualifies — and a permission prompt (`navigator.requestMIDIAccess()`).
- **Connection:** Nord Stage 3/4, Electro 6, Piano 4/5, Grand and Lead models are class-compliant
  USB-MIDI devices — one cable, no driver. The Nord's MIDI channel (Global/System menu) must match
  the channel we send on (default 1).
- **Timing:** Tone schedules on the audio clock; `MIDIOutput.send(bytes, timestamp)` takes a
  `performance.now()` timestamp. Convert with `AudioContext.getOutputTimestamp()` so the Nord and
  the on-screen views line up, plus a user "latency" slider (USB + Nord ≈ 5–10 ms).
- **Sound selection:** Program Change (and Bank Select CC 0/32) can step through Nord programs;
  the exact mapping differs per model, so start with "use whatever the Nord has selected".
- **Mixing:** choose "Nord only" (mute the browser instrument) or "both" (layer).
- **Coming back in:** an audio interface (or the Nord's USB audio on newer models) can feed the
  Nord's sound back into the app (`getUserMedia`) so the spectrogram, oscilloscope and recording
  show/keep the real sound. MIDI **input** (play the Nord, see the fretboard/clock/staff react) is
  a natural follow-up.
- Works with **any** MIDI instrument or DAW (via a virtual MIDI port), not just Nord.

### Delivery

1. **MIDI out** (next slice): device picker in the Sound panel, channel, latency, "Nord only /
   both"; note on/off scheduled with the audio clock; drone as held notes; all-notes-off on pause.
   Feature-detected (hidden where unsupported). e2e with a mocked `requestMIDIAccess`.
2. Owner test with the Nord; tune latency default; document per-model Program Change.
3. MIDI in → views; audio-in → spectrogram/recording.

## 3. Guitar fretboard view

- Six strings, frets 0–15 (all frets fit on a phone in landscape and on desktop; on a narrow
  portrait screen the board scrolls into view).
- **Scale map:** every position of the current scale's notes is marked with a small dot in its
  digit colour — the familiar "box" shapes of the pentatonic appear by themselves.
- **Fingering:** each played note lights the position nearest the previous one (a simple model
  of a hand moving along the neck, preferring lower frets), with a fading trail of recent notes;
  notes sounding together (coincidental chords) are shown together and named.
- Notes outside the guitar's range are folded by octaves and drawn hollow.
- **Tunings:** standard, drop D, DADGAD, open G — a view option saved in links and pieces.

## Sources

- MDN: Web MIDI API (`requestMIDIAccess`, `MIDIOutput.send` timestamps), `AudioContext.getOutputTimestamp`.
- Nord: user manuals of the Nord Stage 3 and Electro 6 (MIDI implementation, USB-MIDI); Nord
  Sample Library / Piano Library licence terms on nordkeyboards.com.
- Wikipedia: Rhodes piano, Wurlitzer electronic piano, Clavinet, Hammond organ (drawbar footages),
  Leslie speaker, Minimoog.
- J. Chowning (1973), FM synthesis; Smith & Abel / Välimäki on plucked-string body resonances.
