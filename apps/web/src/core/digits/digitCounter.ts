/** Running tally of how often each symbol (digit 0–9 by default) has occurred. */
export class DigitCounter {
  private readonly tally: number[]
  private seen = 0

  /** `alphabetSize`: how many distinct symbols to count (10 for decimal digits). */
  constructor(readonly alphabetSize = 10) {
    if (!Number.isInteger(alphabetSize) || alphabetSize < 1) {
      throw new RangeError(`Bad alphabet size: ${alphabetSize}`)
    }
    this.tally = new Array<number>(alphabetSize).fill(0)
  }

  record(digit: number): void {
    if (!Number.isInteger(digit) || digit < 0 || digit >= this.alphabetSize) {
      throw new RangeError(
        this.alphabetSize === 10
          ? `Not a decimal digit: ${digit}`
          : `Symbol ${digit} is outside 0..${this.alphabetSize - 1}`,
      )
    }
    this.tally[digit]! += 1
    this.seen += 1
  }

  reset(): void {
    this.tally.fill(0)
    this.seen = 0
  }

  get total(): number {
    return this.seen
  }

  /** A copy of the counts, index = digit. */
  get counts(): number[] {
    return [...this.tally]
  }

  get min(): number {
    return Math.min(...this.tally)
  }

  get max(): number {
    return Math.max(...this.tally)
  }

  /** Share of each digit in [0, 1]; all zeros before anything is recorded. */
  get ratios(): number[] {
    return this.tally.map((count) => (this.seen === 0 ? 0 : count / this.seen))
  }
}
