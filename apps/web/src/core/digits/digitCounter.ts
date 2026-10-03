/** Running tally of how often each digit 0–9 has occurred. */
export class DigitCounter {
  private readonly tally = new Array<number>(10).fill(0)
  private seen = 0

  record(digit: number): void {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new RangeError(`Not a decimal digit: ${digit}`)
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
