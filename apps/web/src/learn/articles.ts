import type { ViewId } from '../components/views'
import type { ReadingId, SeriesId } from '../core/series/series'

/*
 * The Learn series (R-013 §5): one short article per number, per reading and per view, each with
 * a "Try it" link that opens the app in that state. Pure data, so tests can check that every
 * series, reading and view has one, and that every link opens.
 *
 * Numeric and musical facts stated here are pinned by unit tests (rule 4): Pisano periods and the
 * base-12 facts in core/series/mod12.test.ts and base12.test.ts, Benford in fibonacci.test.ts,
 * the golden angle in viz/art.test.ts. Article ids are part of shared URLs (learn.html#id): never
 * rename one.
 */

export type ArticleGroup = 'number' | 'reading' | 'view'

export interface ArticleSection {
  readonly heading: string
  readonly paragraphs: readonly string[]
}

export interface Article {
  /** Anchor on learn.html: the series id, `reading-<id>` or `view-<id>`. */
  readonly id: string
  readonly group: ArticleGroup
  readonly title: string
  /** One sentence shown under the title and in the contents. */
  readonly summary: string
  readonly sections: readonly ArticleSection[]
  /** Patterns to watch and listen for. */
  readonly lookFor: readonly string[]
  /** Citations: OEIS entries and other references. */
  readonly references: readonly { readonly label: string; readonly url: string }[]
  /** The app state "Try it" opens. */
  readonly tryIt: {
    readonly series?: SeriesId
    readonly reading?: ReadingId
    readonly view?: ViewId
  }
}

export const GROUP_TITLES: Record<ArticleGroup, string> = {
  number: 'The numbers',
  reading: 'Ways to read a number',
  view: 'The displays',
}

const oeis = (id: string, what: string) => ({
  label: `OEIS ${id}: ${what}`,
  url: `https://oeis.org/${id}`,
})

const wiki = (page: string, what: string) => ({
  label: `Wikipedia: ${what}`,
  url: `https://en.wikipedia.org/wiki/${page}`,
})

const NUMBERS: readonly Article[] = [
  {
    id: 'pi',
    group: 'number',
    title: 'π (pi)',
    summary: 'The circle constant: a circle’s circumference divided by its diameter, 3.14159…',
    sections: [
      {
        heading: 'What it is',
        paragraphs: [
          'Every circle, of any size, is a little more than three of its own diameters around. That ratio is π. It is irrational: no fraction equals it, so its decimal digits never end and never fall into a repeating loop.',
          'The app plays the first million decimal places, from a data file whose checksum is pinned in the tests so a corrupted digit cannot slip in.',
        ],
      },
      {
        heading: 'Why it sounds random',
        paragraphs: [
          'As far as anyone has measured, every digit turns up about 10 % of the time, every pair about 1 %, and so on. A number like that is called normal. Nobody has proved π is normal, but trillions of digits behave that way, which is why its melody never settles into a tune.',
          'Randomness still makes surprises: at decimal place 762 six 9s arrive in a row (the Feynman point). The typographic and mosaic displays light it up.',
        ],
      },
    ],
    lookFor: [
      'The digit chart’s bars levelling out as more digits play',
      'The Feynman point 999999 at decimal place 762',
    ],
    references: [oeis('A000796', 'decimal expansion of π')],
    tryIt: { series: 'pi', view: 'chart' },
  },
  {
    id: 'phi',
    group: 'number',
    title: 'φ (the golden ratio)',
    summary: 'The number that is one more than its own reciprocal: (1 + √5) / 2 = 1.61803…',
    sections: [
      {
        heading: 'What it is',
        paragraphs: [
          'Cut a line so the whole is to the long part as the long part is to the short part: that ratio is φ. It solves φ² = φ + 1, which gives (1 + √5) / 2.',
          'Divide each Fibonacci number by the one before (8 / 5, 13 / 8, 21 / 13 …) and the answers close in on φ, alternately a little above and a little below.',
        ],
      },
      {
        heading: 'Two lives in the app',
        paragraphs: [
          'As a number, its digits are a stream like π’s, and they look just as random. As a shape, it is everywhere else: the golden angle of the sunflower, the golden rectangle, golden swing in the rhythm settings.',
        ],
      },
    ],
    lookFor: ['Digits as evenly spread as π’s, although φ is built from a simple rule'],
    references: [oeis('A001622', 'decimal expansion of the golden ratio')],
    tryIt: { series: 'phi', view: 'sunflower' },
  },
  {
    id: 'e',
    group: 'number',
    title: 'e (Euler’s number)',
    summary: 'The number of growth: (1 + 1/n)ⁿ as n grows without limit, 2.71828…',
    sections: [
      {
        heading: 'What it is',
        paragraphs: [
          'Put 1 in a bank that pays 100 % a year. Paid once, you have 2. Paid monthly, about 2.613. Paid every instant, exactly e. It is also 1 + 1/1! + 1/2! + 1/3! + …, a sum that closes in very fast.',
          'Like π it is irrational (and transcendental: it solves no polynomial equation with whole-number coefficients).',
        ],
      },
      {
        heading: 'A pattern that is not one',
        paragraphs: [
          'Its digits start 2.718281828, where 1828 appears twice in a row, so it looks as if it will repeat. It does not: the next digits are 459045.',
        ],
      },
    ],
    lookFor: ['The early 1828 1828, then nothing of the kind'],
    references: [oeis('A001113', 'decimal expansion of e')],
    tryIt: { series: 'e', view: 'type' },
  },
  {
    id: 'sqrt2',
    group: 'number',
    title: '√2 (the square root of 2)',
    summary: 'The diagonal of a square with sides of 1: 1.41421…',
    sections: [
      {
        heading: 'What it is',
        paragraphs: [
          'By Pythagoras, a unit square’s diagonal d satisfies d² = 1² + 1² = 2. The ancient Greeks proved no fraction p / q can do this: if p² = 2q² then p is even, and then q must be even too, so the fraction could always be halved again, which is impossible.',
          'Musically it is the tritone: in equal temperament six semitones are a frequency ratio of exactly 2^(6/12) = √2.',
        ],
      },
    ],
    lookFor: ['A stream as random-looking as π’s, from the simplest irrational number'],
    references: [oeis('A002193', 'decimal expansion of √2')],
    tryIt: { series: 'sqrt2', view: 'walk' },
  },
  {
    id: 'fibonacci',
    group: 'number',
    title: 'The Fibonacci numbers',
    summary: 'Start with 0 and 1; each number after that is the sum of the two before it.',
    sections: [
      {
        heading: 'What they are',
        paragraphs: [
          '0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, … Each term is called Fₙ, from F₀ = 0. They grow by a factor that closes in on φ, so each one is about 0.21 decimal digits longer than the one before.',
          'Unlike π, they are not one number but a sequence of whole numbers, so the app has to decide how to read them out: all their digits, only the last digit, a remainder, or the digits in another base. Each reading reveals a different pattern.',
        ],
      },
      {
        heading: 'Hidden order',
        paragraphs: [
          'Their digits, all strung together, look as random as π’s. But the first digit of each number follows Benford’s law (a 1 about 30 % of the time, a 9 under 5 %), and the last digits repeat in a loop. Those loops are called Pisano periods.',
        ],
      },
    ],
    lookFor: [
      'The first-digit table in Stats, matching Benford’s prediction',
      'The loops in the last-digit, mod 12 and base 12 readings',
    ],
    references: [oeis('A000045', 'Fibonacci numbers'), oeis('A001175', 'Pisano periods')],
    tryIt: { series: 'fibonacci', view: 'golden' },
  },
]

const READINGS: readonly Article[] = [
  {
    id: 'reading-digits',
    group: 'reading',
    title: 'Digits',
    summary: 'A constant’s decimal digits, one after another: 3 1 4 1 5 9 …',
    sections: [
      {
        heading: 'How it works',
        paragraphs: [
          'Each decimal digit, 0 to 9, becomes one note and one colour. The sound settings choose which note each digit plays (a scale, a starting note and a direction); the colour palette chooses the colours.',
        ],
      },
    ],
    lookFor: ['The same digit always making the same note and colour'],
    references: [],
    tryIt: { series: 'pi' },
  },
  {
    id: 'reading-concat',
    group: 'reading',
    title: 'All digits',
    summary:
      'Every digit of every Fibonacci number, one number after another: 0 1 1 2 3 5 8 1 3 2 1 …',
    sections: [
      {
        heading: 'How it works',
        paragraphs: [
          'Write F₀, F₁, F₂ … out in full and read the digits in order. A million digits take 3,094 terms; the last ones are over 600 digits long. The Term readout shows which Fibonacci number you are inside.',
          'Taken together the digits are almost exactly 10 % each, like π’s. The order is in the first digit of each term: Benford’s law says a number starts with d a share log₁₀(1 + 1/d) of the time, and Fibonacci numbers obey it.',
        ],
      },
    ],
    lookFor: ['The Stats first-digit table: 1 most often, 9 least'],
    references: [oeis('A000045', 'Fibonacci numbers')],
    tryIt: { series: 'fibonacci', reading: 'concat', view: 'chart' },
  },
  {
    id: 'reading-last-digit',
    group: 'reading',
    title: 'Last digit',
    summary: 'Only the last digit of each Fibonacci number: a loop of 60.',
    sections: [
      {
        heading: 'How it works',
        paragraphs: [
          'The last digit of a sum depends only on the last digits of what you add. So the last digits of the Fibonacci numbers follow their own rule, and since there are only 100 possible pairs of last digits, the pair (0, 1) must come back. It does after 60 terms, the Pisano period of 10.',
          'Played, it is a 60-note melody on repeat. In the neighbour mosaic, a width that divides 60 lines the loop up into columns.',
        ],
      },
    ],
    lookFor: ['The melody repeating after 60 notes', 'Mosaic widths 12, 15, 20, 30 and 60'],
    references: [oeis('A001175', 'Pisano periods'), wiki('Pisano_period', 'Pisano period')],
    tryIt: { series: 'fibonacci', reading: 'last-digit', view: 'mosaic' },
  },
  {
    id: 'reading-mod-12',
    group: 'reading',
    title: 'Mod 12',
    summary: 'Each Fibonacci number’s remainder after dividing by 12: one of the twelve notes.',
    sections: [
      {
        heading: 'How it works',
        paragraphs: [
          'There are twelve notes in an octave, so a remainder from 0 to 11 can be a note directly: 0 is C, 1 is C♯, and so on up to 11, B (written A and B for 10 and 11). The remainders repeat every 24 terms: 0 1 1 2 3 5 8 1 9 10 7 5 0 5 5 10 3 1 4 5 9 2 11 1.',
          'One remainder never appears: 6. Played on semitones above C, the loop is a 24-note melody that never plays F♯, the note a tritone above C. The music clock shows the gap as a hollow dot.',
        ],
      },
    ],
    lookFor: ['The empty F♯ on the music clock', 'A 24-note loop'],
    references: [oeis('A001175', 'Pisano periods'), wiki('Pisano_period', 'Pisano period')],
    tryIt: { series: 'fibonacci', reading: 'mod-12', view: 'clock' },
  },
  {
    id: 'reading-base-12',
    group: 'reading',
    title: 'All digits in base 12',
    summary: 'The Fibonacci numbers written in base 12 (dozenal), every digit in order.',
    sections: [
      {
        heading: 'Counting in twelves',
        paragraphs: [
          'Base 12 has twelve digits: 0 to 9, then A for ten and B for eleven. Places count ones, twelves, gross (144) and so on. So 13 is written 11 (one twelve and one), and 144 is written 100.',
          'The Fibonacci numbers in base 12 begin 0 1 1 2 3 5 8 11 19 2A 47 75 100 175 275 42A 6A3 B11 …',
        ],
      },
      {
        heading: 'Why base 12 is tidy',
        paragraphs: [
          'F₁₂ = 144 = 12² is written 100. And every 12th Fibonacci number ends in 00 in base 12, and no others do, because a Fibonacci number is divisible by 144 exactly when its index is a multiple of 12.',
          'The last base-12 digit is the mod 12 loop of 24. Surprisingly the last two base-12 digits also repeat every 24 terms. In base 10 the last digit takes 60 terms and the last two take 300.',
          'The first digits still follow Benford’s law, now in base 12: a 1 about 27.9 % of the time, a B about 3.5 %. Overall each of the twelve digits is about 1/12 (8.3 %).',
        ],
      },
      {
        heading: 'How it sounds',
        paragraphs: [
          'Twelve symbols give twelve notes and twelve colours. Choose the semitones mapping in Customize and each base-12 digit is exactly one pitch class, 0 = C to B = B.',
        ],
      },
    ],
    lookFor: [
      'The first-digit table with eleven rows, 1 to B',
      'Terms 12, 24, 36 … ending in 00 (Jump to Fₙ, then step)',
    ],
    references: [
      oeis('A000045', 'Fibonacci numbers'),
      oeis('A001175', 'Pisano periods'),
      wiki('Duodecimal', 'Duodecimal (base 12)'),
      wiki('Benford%27s_law', 'Benford’s law'),
    ],
    tryIt: { series: 'fibonacci', reading: 'base-12', view: 'type' },
  },
]

const VIEWS: readonly Article[] = [
  {
    id: 'view-chart',
    group: 'view',
    title: 'Digit chart',
    summary: 'How often each digit has appeared so far, as bars, a pie, a radar and more.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Each bar counts one digit. The value axis runs from the smallest count to the largest, as the original 2019 app did, so even tiny differences stay visible. That makes the race between digits exciting, but remember the differences are small.',
          'For a normal number such as π (as far as anyone knows) every bar heads towards the same share, 1/10.',
        ],
      },
    ],
    lookFor: ['The lead changing hands early, then the shares settling down'],
    references: [],
    tryIt: { view: 'chart' },
  },
  {
    id: 'view-staff',
    group: 'view',
    title: 'Sheet music',
    summary: 'The notes as they play, scrolling on a grand staff.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Each digit’s note is drawn on the treble or bass staff. When notes that are still ringing happen to form a chord (Am, G7, Cmaj7 …), the chord is named: harmony that nobody composed.',
        ],
      },
    ],
    lookFor: ['Chord names appearing by coincidence'],
    references: [],
    tryIt: { view: 'staff' },
  },
  {
    id: 'view-spectrogram',
    group: 'view',
    title: 'Spectrogram',
    summary: 'The sound itself: frequency up the side, time across, loudness as brightness.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Every note is a stack of frequencies: the pitch you hear and its harmonics at 2, 3, 4 … times that frequency. Here they are horizontal stripes. Reverb shows as tails after each note.',
        ],
      },
    ],
    lookFor: ['Evenly stacked harmonics above each note'],
    references: [],
    tryIt: { view: 'spectrogram' },
  },
  {
    id: 'view-ring',
    group: 'view',
    title: 'Digit ring',
    summary: 'Ten arcs around a circle, with a ribbon from each digit to the next.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Each symbol owns an arc. Every step draws a ribbon from the arc of one digit to the arc of the next, so the weave shows which digit follows which. Bubbles outside the rim count each transition.',
          'For a random-looking number the weave is even. For a loop such as the last digits of Fibonacci, only some ribbons ever appear.',
        ],
      },
    ],
    lookFor: ['Missing ribbons in a looping reading'],
    references: [{ label: 'Krzywinski: The art of π', url: 'https://mkweb.bcgsc.ca/pi/art/' }],
    tryIt: { view: 'ring' },
  },
  {
    id: 'view-walk',
    group: 'view',
    title: 'Number walk',
    summary: 'Each digit is a step in one of ten directions; the path wanders like a random walk.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Digit 0 steps up, and each digit after it turns a further 36° clockwise (twelve directions of 30° for twelve symbols). A truly random sequence makes a random walk, which drifts but never heads anywhere for long. A pattern makes a pattern: a loop draws the same shape over and over.',
        ],
      },
    ],
    lookFor: ['Repeating shapes for a looping reading', 'Long drifts for π'],
    references: [
      {
        label: 'Nadieh Bremer: The Art in Pi',
        url: 'https://www.visualcinnamon.com/portfolio/the-art-in-pi/',
      },
    ],
    tryIt: { view: 'walk' },
  },
  {
    id: 'view-sunflower',
    group: 'view',
    title: 'Sunflower',
    summary: 'Digits as seeds, each turned by the golden angle, as a sunflower packs its seeds.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Seed n sits at distance √n from the centre, turned n × 137.5° (the golden angle, 360° / φ²). Because φ is the hardest number to approximate with fractions, no two seeds ever line up, and the disc fills evenly. That is Vogel’s model of real sunflowers.',
          'The spirals you see come in Fibonacci numbers: count them one way and the other and you get neighbours such as 21 and 34.',
        ],
      },
    ],
    lookFor: ['Spiral arms in Fibonacci counts'],
    references: [wiki('Golden_angle', 'Golden angle')],
    tryIt: { view: 'sunflower' },
  },
  {
    id: 'view-mosaic',
    group: 'view',
    title: 'Neighbour mosaic',
    summary: 'Digits in rows, with lines joining equal neighbours, so repeats show as chains.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Each digit is a dot, joined to any equal digit just before it, above it, or diagonally above. With n columns, a vertical line means “the same digit as n places earlier”. Changing the width (or the sweep) tests every repeat distance in turn.',
          'For a loop of 60, any width that divides 60 lines the loop up into stripes.',
        ],
      },
    ],
    lookFor: ['Stripes at widths that divide a loop', 'The six-dot bar of the Feynman point'],
    references: [],
    tryIt: { view: 'mosaic' },
  },
  {
    id: 'view-hilbert',
    group: 'view',
    title: 'Hilbert carpet',
    summary: 'Up to a million digits, one cell each, along a space-filling curve.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'A Hilbert curve visits every cell of a square grid, always stepping to a neighbour, so digits that are close in the number stay close in the picture. Randomness looks like even static; a run or a loop looks like a patch or a texture.',
        ],
      },
    ],
    lookFor: ['Even static for π; textures for a loop'],
    references: [wiki('Hilbert_curve', 'Hilbert curve')],
    tryIt: { view: 'hilbert' },
  },
  {
    id: 'view-golden',
    group: 'view',
    title: 'Golden rectangle',
    summary: 'Digits fill squares of side 1, 1, 2, 3, 5, 8 … with the golden spiral drawn through.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Squares whose sides are Fibonacci numbers tile a rectangle that gets closer and closer to the golden ratio. The digits fill them from the centre out, and since 1² + 1² + 2² + … + Fₖ² = Fₖ × Fₖ₊₁, each new square completes a bigger rectangle exactly.',
        ],
      },
    ],
    lookFor: ['The rectangle’s proportions approaching φ : 1'],
    references: [],
    tryIt: { series: 'fibonacci', view: 'golden' },
  },
  {
    id: 'view-wall',
    group: 'view',
    title: 'Place-value wall',
    summary: 'One number per row, right-aligned, so digits of equal place value stand in columns.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Write the Fibonacci numbers one under another, lined up on the right as you would to add them. Each column is one place value: units on the right, then tens (or twelves in base 12), then hundreds (or gross).',
          'The right-hand columns show the loops. In base 12 the units column repeats every 24 rows, and so does the twelves column next to it; every 12th row ends in two zero cells. In base 10 the units repeat every 60 rows.',
          'The left edge is a straight staircase: each Fibonacci number is about 0.21 decimal digits (0.19 base-12 digits) longer than the one before. The first cell of each row follows Benford’s law, so it is a 1 far more often than anything else.',
          'Numbers without separate terms, such as π, are laid out as a triangle instead: each row is one digit longer than the one above.',
        ],
      },
    ],
    lookFor: [
      'The striped right-hand columns, repeating every 24 rows in base 12',
      'The straight diagonal left edge',
    ],
    references: [wiki('Positional_notation', 'Positional notation')],
    tryIt: { series: 'fibonacci', reading: 'base-12', view: 'wall' },
  },
  {
    id: 'view-type',
    group: 'view',
    title: 'Typographic display',
    summary: 'The digits themselves, in colour, with runs of three or more glowing.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'This is the number as text, each digit in its colour. Runs of the same digit glow behind the type. Symbols past 9 are written A, B and so on, as in base 12.',
        ],
      },
    ],
    lookFor: ['999999 at decimal place 762 of π'],
    references: [],
    tryIt: { view: 'type' },
  },
  {
    id: 'view-strings',
    group: 'view',
    title: 'String art',
    summary: 'A times table on a circle: point n joined to point k × n, with k from the digits.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Put 240 points around a circle and join each point n to point k × n (going round again past 240). k = 2 draws a cardioid, k = 3 a nephroid. Here k comes from the latest two digits, so the figure morphs as the number plays.',
        ],
      },
    ],
    lookFor: ['The cardioid when k is near 2'],
    references: [wiki('Cardioid', 'Cardioid')],
    tryIt: { view: 'strings' },
  },
  {
    id: 'view-clock',
    group: 'view',
    title: 'Music clock',
    summary: 'The twelve notes around a circle, the melody as a trail, chords as shapes.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Pitch repeats every octave, so the twelve note names sit on a circle like hours. Notes ringing together form a polygon; a major chord and a minor chord are mirror-image triangles. Switch to the circle of fifths and the notes of one key sit side by side.',
          'Dot size shows how often each note has played. A note never heard is a hollow ring.',
        ],
      },
    ],
    lookFor: ['F♯ staying hollow for Fibonacci mod 12 on semitones'],
    references: [],
    tryIt: { view: 'clock' },
  },
  {
    id: 'view-harmonograph',
    group: 'view',
    title: 'Harmonograph',
    summary: 'Two notes as a Lissajous figure: the lower drives across, the higher drives up.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Simple frequency ratios make simple closed figures: 3 : 2 (a fifth) closes after three loops one way and two the other. Equal temperament nudges every ratio slightly (the fifth is 1.955 cents flat), so the figure slowly turns. Pure ratios stops the turning.',
        ],
      },
    ],
    lookFor: ['A still figure with Pure ratios on, a turning one off'],
    references: [],
    tryIt: { view: 'harmonograph' },
  },
  {
    id: 'view-scope',
    group: 'view',
    title: 'Oscilloscope',
    summary: 'A literal picture of the sound wave, left speaker against right.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'The vectorscope plots the left channel against the right, turned 45°. Mono sound is a vertical line; reverb and stereo instruments bloom sideways. The waveform mode draws both channels against time.',
        ],
      },
    ],
    lookFor: ['The shape widening when reverb is on'],
    references: [],
    tryIt: { view: 'scope' },
  },
  {
    id: 'view-fretboard',
    group: 'view',
    title: 'Guitar fretboard',
    summary: 'Each note lit where a guitarist would most likely play it.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'Every position of the scale’s notes is marked, so the familiar box shapes appear. Fret spacing shrinks up the neck because each fret shortens the string by the same ratio, 2^(1/12).',
        ],
      },
    ],
    lookFor: ['The pentatonic boxes repeating every 12 frets'],
    references: [],
    tryIt: { view: 'fretboard' },
  },
  {
    id: 'view-cymatics',
    group: 'view',
    title: 'Cymatics (Chladni plate)',
    summary: 'Sand on a vibrating plate gathers on the lines that stay still.',
    sections: [
      {
        heading: 'How to read it',
        paragraphs: [
          'A square plate vibrating in mode (n, m) has nodal lines where it does not move, and sand drifts onto them. Higher notes choose higher modes, so they draw finer figures.',
        ],
      },
    ],
    lookFor: ['Finer patterns for higher notes'],
    references: [wiki('Ernst_Chladni', 'Ernst Chladni and his figures')],
    tryIt: { view: 'cymatics' },
  },
]

export const ARTICLES: readonly Article[] = [...NUMBERS, ...READINGS, ...VIEWS]

export const getArticle = (id: string) => ARTICLES.find((a) => a.id === id)

/** Article ids for what is on screen. */
export const seriesArticleId = (series: SeriesId) => series
export const readingArticleId = (reading: ReadingId) => `reading-${reading}`
export const viewArticleId = (view: ViewId) => `view-${view}`
